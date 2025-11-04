import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { filterInvoiceForPortalDetail } from '@/lib/portal/invoice-filter'

/**
 * Invoice Detail API
 *
 * GET /api/portal/invoices/[id]
 * - Returns detailed invoice with line items
 * - Includes payment history
 * - Payment link if available
 * - Verifies customer owns the invoice
 */

const rateLimiter = getPortalRateLimiter()
const API_VERSION = 'v1'

function getCorsHeaders(origin?: string | null): HeadersInit {
  const envOrigins = process.env.ALLOWED_PORTAL_ORIGINS?.split(',').map(o => o.trim()) || []
  const allowedOrigins = [
    ...envOrigins,
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null,
  ].filter(Boolean) as string[]

  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

function createErrorResponse(error: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error, message, version: API_VERSION }, { status, headers })
}

function createSuccessResponse<T>(data: T, headers?: HeadersInit) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status: 200, headers }
  )
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin')) })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    const portalToken = request.headers.get('X-Portal-Token') ||
                        request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!portalToken) {
      return createErrorResponse('authentication_required', 'Portal token required', 401, corsHeaders)
    }

    const auth = await validatePortalToken(portalToken)
    const rateLimitResult = await rateLimiter.limit(auth.customerId)
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
      return createErrorResponse('rate_limit_exceeded', 'Too many requests', 429, { ...corsHeaders, ...rateLimitHeaders })
    }

    const { id: invoiceId } = await params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        items:invoice_items(
          id,
          description,
          quantity,
          unit_cents,
          line_total_cents,
          sort_order
        ),
        payments(
          id,
          amount_cents,
          currency,
          status,
          provider,
          provider_data,
          processed_at,
          created_at
        ),
        job:jobs(
          service_type,
          scheduled_date
        )
      `)
      .eq('id', invoiceId)
      .eq('customer_id', auth.customerId)
      .single()

    if (error || !invoice) {
      return createErrorResponse('invoice_not_found', 'Invoice not found or access denied', 404, { ...corsHeaders, ...rateLimitHeaders })
    }

    const portalInvoice = filterInvoiceForPortalDetail(invoice)

    return createSuccessResponse(portalInvoice, { ...corsHeaders, ...rateLimitHeaders })

  } catch (error) {
    console.error('[Portal API] GET /api/portal/invoices/[id] error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500, corsHeaders)
  }
}
