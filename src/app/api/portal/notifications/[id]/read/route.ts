import { NextRequest, NextResponse } from 'next/server'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Mark Notification as Read API
 *
 * PATCH /api/portal/notifications/[id]/read
 * - Marks a single notification as read
 * - Updates read_at timestamp
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
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
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
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

/**
 * PATCH - Mark notification as read
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: notificationId } = await params

    // Use database function to mark as read
    const supabase = getServiceSupabase()

    const { data: result, error } = await supabase.rpc('mark_notification_as_read', {
      p_notification_id: notificationId,
      p_customer_id: auth.customerId,
    })

    if (error) {
      console.error('[Portal API] Mark notification as read error:', error)
      return createErrorResponse('update_failed', 'Failed to mark notification as read', 500, { ...corsHeaders, ...rateLimitHeaders })
    }

    if (!result) {
      return createErrorResponse('notification_not_found', 'Notification not found or already read', 404, { ...corsHeaders, ...rateLimitHeaders })
    }

    return createSuccessResponse(
      {
        notificationId,
        message: 'Notification marked as read',
      },
      { ...corsHeaders, ...rateLimitHeaders }
    )

  } catch (error) {
    console.error('[Portal API] PATCH /api/portal/notifications/[id]/read error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500, corsHeaders)
  }
}
