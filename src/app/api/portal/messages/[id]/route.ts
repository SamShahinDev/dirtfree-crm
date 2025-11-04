import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { getServiceSupabase } from '@/lib/supabase/server'
import { filterMessageThreadForPortalDetail } from '@/lib/portal/message-filter'

/**
 * Message Thread Detail API
 *
 * GET /api/portal/messages/[id]
 * - Returns full message thread with all posts
 * - Marks messages as read
 * - Includes job information if thread is job-related
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
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

/**
 * GET - Fetch message thread details
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id: threadId } = await params

    // Fetch thread with all posts
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: thread, error } = await supabase
      .from('truck_threads')
      .select(`
        *,
        posts:truck_posts(
          *,
          staff:created_by(name)
        ),
        job:jobs(scheduled_date, service_type)
      `)
      .eq('id', threadId)
      .eq('customer_id', auth.customerId)
      .single()

    if (error || !thread) {
      return createErrorResponse('thread_not_found', 'Message thread not found or access denied', 404, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Mark messages as read
    const serviceSupabase = getServiceSupabase()

    try {
      await serviceSupabase.rpc('mark_thread_messages_as_read', {
        p_thread_id: threadId,
        p_user_id: auth.userId,
      })
    } catch (markReadError) {
      console.error('[Portal API] Failed to mark messages as read:', markReadError)
      // Don't fail the request if marking as read fails
    }

    // Filter thread for portal view
    const portalThread = filterMessageThreadForPortalDetail(thread)

    return createSuccessResponse(portalThread, { ...corsHeaders, ...rateLimitHeaders })

  } catch (error) {
    console.error('[Portal API] GET /api/portal/messages/[id] error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500, corsHeaders)
  }
}
