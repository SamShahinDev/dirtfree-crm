import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { filterJobForPortalDetail } from '@/lib/portal/job-filter'

/**
 * Job Detail API
 *
 * GET /api/portal/jobs/[id]
 * - Returns detailed job information
 * - Includes timeline, notes, photos, invoice link
 * - Verifies customer owns the job
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
 * GET - Fetch job details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get job ID from params
    const { id: jobId } = await params

    // Validate job ID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(jobId)) {
      return createErrorResponse(
        'invalid_job_id',
        'Invalid job ID format',
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Fetch job from database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        technician:user_profiles!jobs_technician_id_fkey(
          display_name,
          phone_e164
        ),
        customer:customers!jobs_customer_id_fkey(
          address_line1,
          address_line2,
          city,
          state,
          postal_code
        ),
        invoice:invoices(
          id,
          total_amount_cents,
          invoice_url
        ),
        service_history(
          completed_at
        ),
        truck_posts(
          id,
          content,
          image_urls,
          created_at
        )
      `)
      .eq('id', jobId)
      .eq('customer_id', auth.customerId)
      .single()

    if (error || !job) {
      console.error('[Portal API] Job query error:', error)
      return createErrorResponse(
        'job_not_found',
        'Job not found or access denied',
        404,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Filter job for portal view
    const portalJob = filterJobForPortalDetail(job)

    return createSuccessResponse(portalJob, {
      ...corsHeaders,
      ...rateLimitHeaders,
    })

  } catch (error) {
    console.error('[Portal API] GET /api/portal/jobs/[id] error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}
