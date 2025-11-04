import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import {
  filterInvoiceForPortalList,
  type PortalInvoiceListItem,
  type PortalInvoiceStatus,
} from '@/lib/portal/invoice-filter'

/**
 * Invoices API
 *
 * GET /api/portal/invoices
 * - Returns customer's invoices
 * - Supports filtering by status, date range
 * - Includes pagination
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
 * Invoices list response format
 */
interface InvoicesListResponse {
  invoices: PortalInvoiceListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    totalUnpaid: number
    totalOverdue: number
    unpaidCount: number
    overdueCount: number
  }
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
 * GET - Fetch customer's invoices
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PortalInvoiceStatus | null
    const startDate = searchParams.get('startDate') // ISO date YYYY-MM-DD
    const endDate = searchParams.get('endDate') // ISO date YYYY-MM-DD
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100)

    // Build query
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('customer_id', auth.customerId)

    // Apply filters
    // Map portal status to database status
    if (status) {
      if (status === 'overdue') {
        // For overdue, we want sent invoices that are past due
        query = query.eq('status', 'sent')
        // We'll filter by date in post-processing
      } else {
        query = query.eq('status', status)
      }
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Get total count
    const { count: total } = await query

    // Apply pagination and ordering
    const offset = (page - 1) * limit
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: invoices, error } = await query

    if (error) {
      console.error('[Portal API] Invoices query error:', error)
      return createErrorResponse(
        'query_failed',
        'Failed to fetch invoices',
        500,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Filter invoices for portal view
    let portalInvoices = (invoices || []).map(filterInvoiceForPortalList)

    // Post-filter for overdue if requested
    if (status === 'overdue') {
      portalInvoices = portalInvoices.filter(inv => inv.status === 'overdue')
    }

    // Calculate summary
    const summary = {
      totalUnpaid: portalInvoices
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => sum + inv.total, 0),
      totalOverdue: portalInvoices
        .filter(inv => inv.status === 'overdue')
        .reduce((sum, inv) => sum + inv.total, 0),
      unpaidCount: portalInvoices.filter(inv => inv.status !== 'paid').length,
      overdueCount: portalInvoices.filter(inv => inv.status === 'overdue').length,
    }

    const response: InvoicesListResponse = {
      invoices: portalInvoices,
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
      },
      summary,
    }

    return createSuccessResponse(response, {
      ...corsHeaders,
      ...rateLimitHeaders,
    })

  } catch (error) {
    console.error('[Portal API] GET /api/portal/invoices error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}
