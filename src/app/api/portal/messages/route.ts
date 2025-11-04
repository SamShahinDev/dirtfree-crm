import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { getServiceSupabase } from '@/lib/supabase/server'
import { createPortalAuditLog } from '@/lib/audit/portal-audit'
import {
  filterMessageThreadForPortalList,
  validateAttachment,
  generateAttachmentFilename,
  type PortalMessageThreadListItem,
  type PortalMessageStatus,
} from '@/lib/portal/message-filter'
import { notifyStaffOfNewThread } from '@/lib/portal/message-notifications'
import { z } from 'zod'

/**
 * Messages API
 *
 * GET /api/portal/messages
 * - Returns customer's message threads
 * - Supports filtering by status
 * - Includes pagination
 *
 * POST /api/portal/messages
 * - Create new message thread
 * - Supports file attachments (images up to 5MB)
 * - Notifies staff members
 */

const rateLimiter = getPortalRateLimiter()
const API_VERSION = 'v1'

/**
 * CORS headers
 */
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error, message, version: API_VERSION }, { status, headers })
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, headers?: HeadersInit) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status: 200, headers }
  )
}

/**
 * Messages list response format
 */
interface MessagesListResponse {
  threads: PortalMessageThreadListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    unreadCount: number
    openCount: number
    totalCount: number
  }
}

/**
 * Create message thread schema
 */
const CreateThreadSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  jobId: z.string().uuid().optional(),
  isUrgent: z.boolean().optional().default(false),
})

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

/**
 * GET - Fetch customer's message threads
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Extract and validate portal token
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PortalMessageStatus | null
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100)

    // Build query
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    let query = supabase
      .from('truck_threads')
      .select(`
        *,
        job:jobs(scheduled_date, service_type)
      `, { count: 'exact' })
      .eq('customer_id', auth.customerId)

    // Apply status filter
    if (status && status !== 'closed') {
      query = query.eq('status', status)
    } else if (status === 'closed') {
      query = query.in('status', ['resolved', 'closed'])
    }

    // Get total count
    const { count: total } = await query

    // Apply pagination and ordering
    const offset = (page - 1) * limit
    query = query
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: threads, error } = await query

    if (error) {
      console.error('[Portal API] Messages query error:', error)
      return createErrorResponse('query_failed', 'Failed to fetch messages', 500, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Count messages for each thread
    const threadIds = (threads || []).map(t => t.id)
    const { data: postCounts } = await supabase
      .from('truck_posts')
      .select('thread_id')
      .in('thread_id', threadIds)

    const messageCounts = postCounts?.reduce((acc, post) => {
      acc[post.thread_id] = (acc[post.thread_id] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    // Get last staff reply times
    const { data: lastStaffReplies } = await supabase
      .from('truck_posts')
      .select('thread_id, created_at')
      .in('thread_id', threadIds)
      .not('created_by', 'is', null)
      .order('created_at', { ascending: false })

    const lastStaffReplyTimes = lastStaffReplies?.reduce((acc, post) => {
      if (!acc[post.thread_id]) {
        acc[post.thread_id] = post.created_at
      }
      return acc
    }, {} as Record<string, string>) || {}

    // Filter threads for portal view
    const portalThreads = (threads || []).map(thread =>
      filterMessageThreadForPortalList({
        ...thread,
        message_count: messageCounts[thread.id] || 0,
        last_staff_reply_at: lastStaffReplyTimes[thread.id] || null,
      })
    )

    // Calculate summary
    const allThreadsQuery = await supabase
      .from('truck_threads')
      .select('status, unread_count', { count: 'exact' })
      .eq('customer_id', auth.customerId)

    const summary = {
      unreadCount: portalThreads.reduce((sum, t) => sum + t.unreadCount, 0),
      openCount: (allThreadsQuery.data || []).filter(t => t.status === 'open').length,
      totalCount: allThreadsQuery.count || 0,
    }

    const response: MessagesListResponse = {
      threads: portalThreads,
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
      },
      summary,
    }

    return createSuccessResponse(response, { ...corsHeaders, ...rateLimitHeaders })

  } catch (error) {
    console.error('[Portal API] GET /api/portal/messages error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500, corsHeaders)
  }
}

/**
 * POST - Create new message thread
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Extract and validate portal token
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

    // Parse request body
    const body = await request.json()
    const validation = CreateThreadSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_error',
        validation.error.errors.map(e => e.message).join(', '),
        400,
        { ...corsHeaders, ...rateLimitHeaders }
      )
    }

    const { subject, message, jobId, isUrgent } = validation.data

    // Verify job belongs to customer if jobId provided
    if (jobId) {
      const supabase = createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', jobId)
        .eq('customer_id', auth.customerId)
        .single()

      if (jobError || !job) {
        return createErrorResponse('invalid_job', 'Job not found or access denied', 404, { ...corsHeaders, ...rateLimitHeaders })
      }
    }

    // Create thread and initial message
    const serviceSupabase = getServiceSupabase()

    const { data: thread, error: threadError } = await serviceSupabase
      .from('truck_threads')
      .insert({
        customer_id: auth.customerId,
        job_id: jobId || null,
        title: subject,
        status: 'open',
        urgent: isUrgent,
        unread_count: 0,
      })
      .select()
      .single()

    if (threadError || !thread) {
      console.error('[Portal API] Failed to create thread:', threadError)
      return createErrorResponse('create_failed', 'Failed to create message thread', 500, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Create initial message post
    const { error: postError } = await serviceSupabase
      .from('truck_posts')
      .insert({
        thread_id: thread.id,
        kind: 'message',
        body: message,
        content: message,
        author_id: auth.customerId,
        urgent: isUrgent,
        status: 'open',
      })

    if (postError) {
      console.error('[Portal API] Failed to create post:', postError)
      // Don't fail the request - thread was created
    }

    // Create audit log
    await createPortalAuditLog({
      actorId: auth.userId,
      action: 'CREATE',
      entity: 'customer',
      entityId: thread.id,
      meta: {
        action: 'message_thread_created',
        subject,
        jobId,
        isUrgent,
      },
    })

    // Notify staff members (non-blocking)
    notifyStaffOfNewThread({
      threadId: thread.id,
      customerId: auth.customerId,
      subject,
      message,
      isUrgent,
      jobId,
    }).catch((error) => {
      console.error('[Portal API] Failed to notify staff of new thread:', error)
      // Don't fail the request if notification fails
    })

    return createSuccessResponse(
      {
        threadId: thread.id,
        subject: thread.title,
        status: thread.status,
        message: 'Message thread created successfully',
      },
      { ...corsHeaders, ...rateLimitHeaders }
    )

  } catch (error) {
    console.error('[Portal API] POST /api/portal/messages error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500, corsHeaders)
  }
}
