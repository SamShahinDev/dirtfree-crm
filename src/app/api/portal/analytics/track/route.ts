import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken } from '@/lib/portal-api'
import { getServiceSupabase } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Portal Analytics Tracking
 *
 * POST /api/portal/analytics/track
 * - Tracks portal usage events
 * - Stores in portal_analytics table
 * - Used for engagement and ROI metrics
 */

const API_VERSION = 'v1'

/**
 * Event types that can be tracked
 */
const EventTypes = [
  'login',
  'logout',
  'page_view',
  'feature_usage',
  'booking_initiated',
  'booking_completed',
  'booking_cancelled',
  'payment_initiated',
  'payment_completed',
  'payment_failed',
  'invoice_viewed',
  'invoice_downloaded',
  'message_sent',
  'message_viewed',
  'notification_clicked',
  'profile_updated',
  'preferences_updated',
  'search',
  'error',
] as const

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
 * Track event schema
 */
const TrackEventSchema = z.object({
  eventType: z.enum(EventTypes),
  page: z.string().optional(),
  feature: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  valueAmount: z.number().optional(), // For booking/payment amounts
  referrer: z.string().optional(),
})

/**
 * Extract IP address from request
 */
function getClientIP(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  const vercelIp = request.headers.get('x-vercel-forwarded-for')
  if (vercelIp) {
    return vercelIp.split(',')[0].trim()
  }

  return undefined
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

/**
 * POST - Track analytics event
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Extract portal token (optional for some events)
    const portalToken = request.headers.get('X-Portal-Token') ||
                        request.headers.get('Authorization')?.replace('Bearer ', '')

    let customerId: string | null = null
    let sessionId: string | null = null

    // Validate token if provided
    if (portalToken) {
      try {
        const auth = await validatePortalToken(portalToken)
        customerId = auth.customerId
        sessionId = auth.sessionId || null
      } catch (error) {
        // Don't fail tracking if token is invalid
        // Just log as anonymous
        console.warn('[Portal Analytics] Invalid token, tracking as anonymous')
      }
    }

    // Parse request body
    const body = await request.json()
    const validation = TrackEventSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_error',
        validation.error.errors.map(e => e.message).join(', '),
        400,
        corsHeaders
      )
    }

    const { eventType, page, feature, metadata, valueAmount, referrer } = validation.data

    // Extract request metadata
    const ipAddress = getClientIP(request)
    const userAgent = request.headers.get('user-agent') || undefined

    // Store event in database
    const supabase = getServiceSupabase()

    const { error: insertError } = await supabase.from('portal_analytics').insert({
      customer_id: customerId,
      session_id: sessionId,
      event_type: eventType,
      page: page || null,
      feature: feature || null,
      metadata: metadata || {},
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      referrer: referrer || null,
      value_amount: valueAmount || null,
    })

    if (insertError) {
      console.error('[Portal Analytics] Failed to track event:', insertError)
      return createErrorResponse('tracking_failed', 'Failed to track event', 500, corsHeaders)
    }

    return createSuccessResponse(
      {
        message: 'Event tracked successfully',
        eventType,
      },
      corsHeaders
    )

  } catch (error) {
    console.error('[Portal Analytics] POST /api/portal/analytics/track error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500,
      corsHeaders
    )
  }
}
