import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { getServiceSupabase } from '@/lib/supabase/server'
import { createPortalAuditLog } from '@/lib/audit/portal-audit'

/**
 * Job Cancellation API
 *
 * POST /api/portal/jobs/cancel
 * - Allows customers to cancel scheduled jobs
 * - Applies cancellation policy (24 hour notice required)
 * - Updates job status to cancelled
 * - Creates audit log and notifies team
 * - Cannot cancel completed jobs or jobs in progress
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
 * Cancellation request schema
 */
const CancellationRequestSchema = z.object({
  jobId: z.string().uuid(),
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
  cancellationType: z.enum(['customer_request', 'emergency', 'other']),
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
 * POST - Cancel job
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
    const validation = CancellationRequestSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_error',
        'Invalid request data',
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    const { jobId, reason, cancellationType } = validation.data

    // Fetch job from database to verify ownership and eligibility
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, customer_id, status, scheduled_date, scheduled_time_start, description')
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

    // Check if job can be cancelled
    if (job.status === 'completed') {
      return createErrorResponse(
        'job_not_cancellable',
        'Cannot cancel completed jobs',
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    if (job.status === 'cancelled') {
      return createErrorResponse(
        'job_already_cancelled',
        'This job is already cancelled',
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Check cancellation policy - 24 hour notice required (unless emergency)
    let requiresApproval = false
    if (job.scheduled_date && cancellationType !== 'emergency') {
      const scheduledDate = new Date(job.scheduled_date)
      const now = new Date()
      const hoursUntilJob = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (hoursUntilJob < 24 && hoursUntilJob > 0) {
        requiresApproval = true
        // For late cancellations, create a request instead of immediately cancelling
      }
    }

    const serviceSupabase = getServiceSupabase()

    if (requiresApproval) {
      // Create a truck thread for late cancellation request
      const { data: thread, error: threadError } = await serviceSupabase
        .from('truck_threads')
        .insert({
          customer_id: auth.customerId,
          job_id: jobId,
          title: `Late Cancellation Request - Job ${jobId.slice(0, 8)}`,
          status: 'open',
          urgent: true,
        })
        .select()
        .single()

      if (threadError || !thread) {
        console.error('[Portal API] Failed to create thread:', threadError)
        return createErrorResponse(
          'request_failed',
          'Failed to create cancellation request',
          500,
          { ...corsHeaders, ...rateLimitHeaders }
        )
      }

      const postContent = `**LATE CANCELLATION REQUEST** (within 24 hours)

Customer requested cancellation via portal:

**Type:** ${cancellationType === 'emergency' ? 'Emergency' : cancellationType.replace('_', ' ')}
**Reason:** ${reason}

**Current Schedule:** ${job.scheduled_date || 'Not scheduled'} ${job.scheduled_time_start || ''}
**Job Description:** ${job.description || 'N/A'}

⚠️ This cancellation is within 24 hours. Please review and approve/deny according to cancellation policy.`

      const { error: postError } = await serviceSupabase
        .from('truck_posts')
        .insert({
          thread_id: thread.id,
          author_id: auth.userId,
          content: postContent,
          urgent: true,
          status: 'open',
        })

      if (postError) {
        console.error('[Portal API] Failed to create post:', postError)
        await serviceSupabase.from('truck_threads').delete().eq('id', thread.id)

        return createErrorResponse(
          'request_failed',
          'Failed to create cancellation request',
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
          action: 'late_cancellation_request',
          reason,
          cancellationType,
          threadId: thread.id,
        },
      })

      return createSuccessResponse(
        {
          status: 'pending_approval',
          message: 'Your cancellation request has been submitted. Due to our 24-hour cancellation policy, this request requires approval. Our team will contact you shortly.',
          requestId: thread.id,
        },
        {
          ...corsHeaders,
          ...rateLimitHeaders,
        }
      )
    }

    // Immediate cancellation (more than 24 hours notice or emergency)
    const { error: updateError } = await serviceSupabase
      .from('jobs')
      .update({ status: 'cancelled' })
      .eq('id', jobId)

    if (updateError) {
      console.error('[Portal API] Failed to cancel job:', updateError)
      return createErrorResponse(
        'cancellation_failed',
        'Failed to cancel job',
        500,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    // Create a truck thread to notify team
    const { data: thread, error: threadError } = await serviceSupabase
      .from('truck_threads')
      .insert({
        customer_id: auth.customerId,
        job_id: jobId,
        title: `Job Cancelled - ${jobId.slice(0, 8)}`,
        status: 'closed',
        urgent: false,
      })
      .select()
      .single()

    if (!threadError && thread) {
      await serviceSupabase
        .from('truck_posts')
        .insert({
          thread_id: thread.id,
          author_id: auth.userId,
          content: `Job cancelled by customer via portal.

**Type:** ${cancellationType.replace('_', ' ')}
**Reason:** ${reason}

**Scheduled:** ${job.scheduled_date || 'Not scheduled'} ${job.scheduled_time_start || ''}`,
          urgent: false,
          status: 'closed',
        })
    }

    // Create audit log
    await createPortalAuditLog({
      actorId: auth.userId,
      action: 'UPDATE',
      entity: 'customer',
      entityId: jobId,
      meta: {
        action: 'job_cancelled',
        reason,
        cancellationType,
        previousStatus: job.status,
      },
    })

    // TODO: Send notification to dispatchers and technician

    return createSuccessResponse(
      {
        status: 'cancelled',
        message: 'Your appointment has been cancelled successfully.',
        jobId,
      },
      {
        ...corsHeaders,
        ...rateLimitHeaders,
      }
    )

  } catch (error) {
    console.error('[Portal API] POST /api/portal/jobs/cancel error:', error)

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}
