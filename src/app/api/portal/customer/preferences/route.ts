import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { auditPreferencesUpdate } from '@/lib/audit/portal-audit'
import {
  mapPreferencesToDb,
  type PortalPreferencesUpdateInput,
} from '@/lib/portal/customer-filter'

/**
 * Customer Preferences API
 *
 * GET /api/portal/customer/preferences
 * - Returns customer's notification and communication preferences
 *
 * PATCH /api/portal/customer/preferences
 * - Updates customer preferences
 * - Validates input data
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
 * Customer preferences response format
 */
interface PreferencesResponse {
  emailNotifications: boolean
  smsNotifications: boolean
  preferredCommunication: 'email' | 'phone' | 'both'
  marketingOptOut: boolean
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
 * GET - Fetch customer preferences
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

    // Fetch customer preferences from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: customer, error } = await supabase
      .from('customers')
      .select('email_notifications, sms_notifications, preferred_communication, marketing_opt_out')
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

    // Format preferences response
    const preferences: PreferencesResponse = {
      emailNotifications: customer.email_notifications ?? true,
      smsNotifications: customer.sms_notifications ?? false,
      preferredCommunication: customer.preferred_communication as 'email' | 'phone' | 'both',
      marketingOptOut: customer.marketing_opt_out ?? false,
    }

    return createSuccessResponse(preferences, {
      ...corsHeaders,
      ...rateLimitHeaders,
    })

  } catch (error) {
    console.error('[Portal API] GET /api/portal/customer/preferences error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}

/**
 * Preferences update schema
 */
const PreferencesUpdateSchema = z.object({
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  preferredCommunication: z.enum(['email', 'phone', 'both']).optional(),
  marketingOptOut: z.boolean().optional(),
})

/**
 * PATCH - Update customer preferences
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
    const validation = PreferencesUpdateSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_error',
        'Invalid request data',
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    const updateData: PortalPreferencesUpdateInput = validation.data

    // Check if there are any actual updates
    if (Object.keys(updateData).length === 0) {
      return createErrorResponse(
        'validation_error',
        'No valid fields to update',
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Map preferences to database format
    const dbUpdate = mapPreferencesToDb(updateData)

    // Update preferences in database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: updatedCustomer, error } = await supabase
      .from('customers')
      .update(dbUpdate)
      .eq('id', auth.customerId)
      .select('email_notifications, sms_notifications, preferred_communication, marketing_opt_out')
      .single()

    if (error || !updatedCustomer) {
      console.error('[Portal API] Preferences update error:', error)
      return createErrorResponse(
        'update_failed',
        'Failed to update preferences',
        500,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Create audit log entry
    await auditPreferencesUpdate(auth.userId, auth.customerId, updateData)

    // Format response
    const preferences: PreferencesResponse = {
      emailNotifications: updatedCustomer.email_notifications ?? true,
      smsNotifications: updatedCustomer.sms_notifications ?? false,
      preferredCommunication: updatedCustomer.preferred_communication as 'email' | 'phone' | 'both',
      marketingOptOut: updatedCustomer.marketing_opt_out ?? false,
    }

    return createSuccessResponse(preferences, {
      ...corsHeaders,
      ...rateLimitHeaders,
    })

  } catch (error) {
    console.error('[Portal API] PATCH /api/portal/customer/preferences error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}
