import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { normalizeToE164 } from '@/lib/utils/phone'
import { auditCustomerUpdate } from '@/lib/audit/portal-audit'
import {
  filterCustomerForPortal,
  mapPortalUpdateToDb,
  type PortalCustomerUpdateInput,
} from '@/lib/portal/customer-filter'

/**
 * Customer Data API
 *
 * GET /api/portal/customer
 * - Returns authenticated customer's profile data
 * - Filters out CRM-only sensitive fields
 *
 * PATCH /api/portal/customer
 * - Updates customer profile from portal
 * - Validates and normalizes phone numbers
 * - Creates audit log entry
 * - Syncs to CRM database
 */

const rateLimiter = getPortalRateLimiter()
const API_VERSION = 'v1'

/**
 * CORS headers
 */
function getCorsHeaders(origin?: string | null): HeadersInit {
  const envOrigins = process.env.ALLOWED_PORTAL_ORIGINS
    ? process.env.ALLOWED_PORTAL_ORIGINS.split(',').map(o => o.trim())
    : []

  const allowedOrigins = [
    ...envOrigins,
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null,
  ].filter(Boolean) as string[]

  const isAllowedOrigin = origin && allowedOrigins.includes(origin)

  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : (allowedOrigins[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Standard error response
 */
function createErrorResponse(
  error: string,
  message: string,
  status: number,
  headers?: HeadersInit
) {
  return NextResponse.json(
    {
      success: false,
      error,
      message,
      version: API_VERSION,
    },
    { status, headers }
  )
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, headers?: HeadersInit) {
  return NextResponse.json(
    {
      success: true,
      data,
      version: API_VERSION,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers }
  )
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  })
}

/**
 * GET - Fetch customer profile
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Extract and validate portal token
    const portalToken = request.headers.get('X-Portal-Token') ||
                        request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!portalToken) {
      return createErrorResponse(
        'authentication_required',
        'Portal token required',
        401,
        corsHeaders
      )
    }

    // Validate token and get customer info
    const auth = await validatePortalToken(portalToken)

    // Apply rate limiting
    const rateLimitResult = await rateLimiter.limit(auth.customerId)
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
      return createErrorResponse(
        'rate_limit_exceeded',
        'Too many requests',
        429,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Fetch customer data from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', auth.customerId)
      .single()

    if (error || !customer) {
      return createErrorResponse(
        'customer_not_found',
        'Customer profile not found',
        404,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Filter customer data for portal view (remove CRM-only fields)
    const portalData = filterCustomerForPortal(customer)

    return createSuccessResponse(portalData, {
      ...corsHeaders,
      ...rateLimitHeaders,
    })

  } catch (error) {
    console.error('[Portal API] GET /api/portal/customer error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}

/**
 * Customer update schema
 */
const CustomerUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.object({
    line1: z.string().max(255).optional(),
    line2: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(50).optional(),
    postalCode: z.string().max(20).optional(),
  }).optional(),
})

/**
 * PATCH - Update customer profile
 */
export async function PATCH(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Extract and validate portal token
    const portalToken = request.headers.get('X-Portal-Token') ||
                        request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!portalToken) {
      return createErrorResponse(
        'authentication_required',
        'Portal token required',
        401,
        corsHeaders
      )
    }

    // Validate token and get customer info
    const auth = await validatePortalToken(portalToken)

    // Apply rate limiting
    const rateLimitResult = await rateLimiter.limit(auth.customerId)
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
      return createErrorResponse(
        'rate_limit_exceeded',
        'Too many requests',
        429,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CustomerUpdateSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_error',
        'Invalid request data',
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    const updateData: PortalCustomerUpdateInput = validation.data

    // Normalize phone number if provided
    let phoneE164: string | null | undefined = undefined
    if (updateData.phone !== undefined) {
      if (updateData.phone === '') {
        phoneE164 = null
      } else {
        const normalized = normalizeToE164(updateData.phone)
        if (!normalized) {
          return createErrorResponse(
            'validation_error',
            'Invalid phone number format',
            400,
            { ...corsHeaders, ...rateLimitHeaders }
          )
        }
        phoneE164 = normalized
      }
    }

    // Map portal update to database format
    const dbUpdate = mapPortalUpdateToDb(updateData, phoneE164)

    // Check if there are any actual updates
    if (Object.keys(dbUpdate).length === 0) {
      return createErrorResponse(
        'validation_error',
        'No valid fields to update',
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Update customer in database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: updatedCustomer, error } = await supabase
      .from('customers')
      .update(dbUpdate)
      .eq('id', auth.customerId)
      .select()
      .single()

    if (error || !updatedCustomer) {
      console.error('[Portal API] Update error:', error)
      return createErrorResponse(
        'update_failed',
        'Failed to update customer profile',
        500,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Create audit log entry
    await auditCustomerUpdate(auth.userId, auth.customerId, dbUpdate)

    // Filter response data for portal view
    const portalData = filterCustomerForPortal(updatedCustomer)

    return createSuccessResponse(portalData, {
      ...corsHeaders,
      ...rateLimitHeaders,
    })

  } catch (error) {
    console.error('[Portal API] PATCH /api/portal/customer error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}
