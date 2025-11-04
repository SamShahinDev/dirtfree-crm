import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'

/**
 * Portal Notifications API
 *
 * GET /api/portal/notifications
 * - Returns customer's notifications
 * - Supports filtering by type, read status
 * - Includes pagination
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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
 * Notification type
 */
type NotificationType =
  | 'appointment_reminder'
  | 'appointment_confirmed'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'technician_on_way'
  | 'service_completed'
  | 'invoice_created'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'payment_received'
  | 'message_reply'
  | 'promotion_available'
  | 'loyalty_reward'
  | 'survey_request'
  | 'general'

/**
 * Notification priority
 */
type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * Portal notification response
 */
interface PortalNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  priority: NotificationPriority
  isRead: boolean
  readAt: string | null
  actionUrl: string | null
  actionLabel: string | null
  jobId: string | null
  invoiceId: string | null
  threadId: string | null
  createdAt: string
  expiresAt: string | null
}

/**
 * Notifications list response
 */
interface NotificationsListResponse {
  notifications: PortalNotification[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary: {
    unreadCount: number
    totalCount: number
    priorityCount: number
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

/**
 * GET - Fetch customer's notifications
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
    const type = searchParams.get('type') as NotificationType | null
    const unreadOnly = searchParams.get('unread') === 'true'
    const priority = searchParams.get('priority') as NotificationPriority | null
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    // Build query
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    let query = supabase
      .from('portal_notifications')
      .select('*', { count: 'exact' })
      .eq('customer_id', auth.customerId)

    // Apply filters
    if (type) {
      query = query.eq('type', type)
    }

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    // Exclude expired notifications
    query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

    // Get total count
    const { count: total } = await query

    // Apply pagination and ordering
    const offset = (page - 1) * limit
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: notifications, error } = await query

    if (error) {
      console.error('[Portal API] Notifications query error:', error)
      return createErrorResponse('query_failed', 'Failed to fetch notifications', 500, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Transform notifications for portal response
    const portalNotifications: PortalNotification[] = (notifications || []).map(notif => ({
      id: notif.id,
      type: notif.type as NotificationType,
      title: notif.title,
      message: notif.message,
      priority: notif.priority as NotificationPriority,
      isRead: notif.is_read,
      readAt: notif.read_at,
      actionUrl: notif.action_url,
      actionLabel: notif.action_label,
      jobId: notif.job_id,
      invoiceId: notif.invoice_id,
      threadId: notif.thread_id,
      createdAt: notif.created_at,
      expiresAt: notif.expires_at,
    }))

    // Calculate summary
    const { data: summaryData } = await supabase
      .from('portal_notifications')
      .select('is_read, priority', { count: 'exact' })
      .eq('customer_id', auth.customerId)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

    const summary = {
      unreadCount: (summaryData || []).filter(n => !n.is_read).length,
      totalCount: summaryData?.length || 0,
      priorityCount: (summaryData || []).filter(n => n.priority === 'high' || n.priority === 'urgent').length,
    }

    const response: NotificationsListResponse = {
      notifications: portalNotifications,
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
    console.error('[Portal API] GET /api/portal/notifications error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500, corsHeaders)
  }
}
