import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { getServiceSupabase } from '@/lib/supabase/server'
import { createPortalAuditLog } from '@/lib/audit/portal-audit'

/**
 * Job Reschedule API
 *
 * POST /api/portal/jobs/reschedule
 * - Allows customers to request reschedule
 * - Creates internal CRM task for dispatcher confirmation
 * - Sends notification to dispatchers
 * - Cannot reschedule jobs within 24 hours or completed/cancelled jobs
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
 * Reschedule request schema
 */
const RescheduleRequestSchema = z.object({
  jobId: z.string().uuid(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTime: z.enum(['morning', 'afternoon', 'evening']),
  reason: z.string().max(500).optional(),
})

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
 * POST - Request job reschedule
 */
export async function POST(request: NextRequest) {
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
    const validation = RescheduleRequestSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_error',
        'Invalid request data',
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    const { jobId, preferredDate, preferredTime, reason } = validation.data

    // Fetch job from database to verify ownership and eligibility
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, customer_id, status, scheduled_date, scheduled_time_start')
      .eq('id', jobId)
      .eq('customer_id', auth.customerId)
      .single()

    if (jobError || !job) {
      return createErrorResponse(
        'job_not_found',
        'Job not found or access denied',
        404,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Check if job can be rescheduled
    if (job.status === 'completed' || job.status === 'cancelled') {
      return createErrorResponse(
        'job_not_reschedulable',
        `Cannot reschedule ${job.status} jobs`,
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Check if job is within 24 hours
    if (job.scheduled_date) {
      const scheduledDate = new Date(job.scheduled_date)
      const now = new Date()
      const hoursUntilJob = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (hoursUntilJob < 24 && hoursUntilJob > 0) {
        return createErrorResponse(
          'reschedule_too_late',
          'Cannot reschedule jobs within 24 hours. Please call us directly.',
          400,
          { ...corsHeaders, ...rateLimitHeaders }
        )
      }
    }

    // Create a truck thread for the reschedule request
    const serviceSupabase = getServiceSupabase()

    // First create the truck thread
    const { data: thread, error: threadError } = await serviceSupabase
      .from('truck_threads')
      .insert({
        customer_id: auth.customerId,
        job_id: jobId,
        title: `Reschedule Request - Job ${jobId.slice(0, 8)}`,
        status: 'open',
        urgent: false,
      })
      .select()
      .single()

    if (threadError || !thread) {
      console.error('[Portal API] Failed to create thread:', threadError)
      return createErrorResponse(
        'request_failed',
        'Failed to create reschedule request',
        500,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Create the initial post with reschedule details
    const timeRanges = {
      morning: '8:00 AM - 12:00 PM',
      afternoon: '12:00 PM - 4:00 PM',
      evening: '4:00 PM - 8:00 PM',
    }

    const postContent = `Customer requested reschedule via portal:

**Preferred Date:** ${preferredDate}
**Preferred Time:** ${preferredTime.charAt(0).toUpperCase() + preferredTime.slice(1)} (${timeRanges[preferredTime]})
${reason ? `**Reason:** ${reason}` : ''}

**Current Schedule:** ${job.scheduled_date || 'Not scheduled'} ${job.scheduled_time_start || ''}

Please review and update the job schedule accordingly.`

    const { error: postError } = await serviceSupabase
      .from('truck_posts')
      .insert({
        thread_id: thread.id,
        author_id: auth.userId,
        content: postContent,
        urgent: false,
        status: 'open',
      })

    if (postError) {
      console.error('[Portal API] Failed to create post:', postError)
      // Clean up thread
      await serviceSupabase.from('truck_threads').delete().eq('id', thread.id)

      return createErrorResponse(
        'request_failed',
        'Failed to create reschedule request',
        500,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Create audit log
    await createPortalAuditLog({
      actorId: auth.userId,
      action: 'CREATE',
      entity: 'customer',
      entityId: jobId,
      meta: {
        action: 'reschedule_request',
        preferredDate,
        preferredTime,
        reason,
        threadId: thread.id,
      },
    })

    // TODO: Send notification to dispatchers (implement when notification system is ready)

    return createSuccessResponse(
      {
        requestId: thread.id,
        message: 'Reschedule request submitted successfully. Our team will contact you to confirm the new schedule.',
        preferredDate,
        preferredTime,
      },
      {
        ...corsHeaders,
        ...rateLimitHeaders,
      }
    )

  } catch (error) {
    console.error('[Portal API] POST /api/portal/jobs/reschedule error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}
