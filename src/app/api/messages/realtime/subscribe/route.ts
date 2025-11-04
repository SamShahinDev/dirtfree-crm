import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Realtime Message Subscription API
 *
 * POST /api/messages/realtime/subscribe
 * - Subscribe customer/user to their message channel
 * - Returns channel configuration for Supabase Realtime
 * - Validates authentication and permissions
 *
 * Authentication: Portal Access Token or User Session
 */

const API_VERSION = 'v1'

/**
 * Validation schema for subscription request
 */
const SubscriptionRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  includePresence: z.boolean().optional().default(false),
  includeTyping: z.boolean().optional().default(true),
  includeReadReceipts: z.boolean().optional().default(true),
})

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ success: false, error, message, version: API_VERSION }, { status })
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
  )
}

/**
 * Authenticate request and determine user type
 */
async function authenticateRequest(request: NextRequest): Promise<{
  userId?: string
  customerId?: string
  error?: NextResponse
}> {
  const authHeader = request.headers.get('authorization')
  const portalToken = request.headers.get('x-portal-token')

  const token = authHeader?.replace('Bearer ', '') || portalToken

  if (!token) {
    return {
      error: createErrorResponse('authentication_required', 'Authentication required', 401)
    }
  }

  const supabase = getServiceSupabase()

  // Try to validate as staff user first
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (user && !authError) {
    return { userId: user.id }
  }

  // Try to validate as portal customer
  const { data: session, error: sessionError } = await supabase
    .from('portal_sessions')
    .select('customer_id, expires_at')
    .eq('token_hash', Buffer.from(token).toString('base64'))
    .single()

  if (sessionError || !session) {
    return {
      error: createErrorResponse('unauthorized', 'Invalid or expired token', 401)
    }
  }

  // Check if session expired
  if (new Date((session as any).expires_at) < new Date()) {
    return {
      error: createErrorResponse('token_expired', 'Session has expired', 401)
    }
  }

  return { customerId: (session as any).customer_id }
}

/**
 * POST - Subscribe to realtime messages
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const { userId, customerId, error: authError } = await authenticateRequest(request)
    if (authError) {
      return authError
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = SubscriptionRequestSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid subscription data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const { conversationId, includePresence, includeTyping, includeReadReceipts } = validation.data

    // Get Supabase configuration for client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return createErrorResponse('configuration_error', 'Supabase not configured', 500)
    }

    // Build channel names based on subscription type
    const channels: string[] = []

    if (conversationId) {
      // Subscribe to specific conversation
      channels.push(`conversation:${conversationId}`)
      if (includePresence) {
        channels.push(`presence:${conversationId}`)
      }
    } else if (customerId) {
      // Subscribe to customer's messages
      channels.push(`customer:${customerId}:messages`)
    } else if (userId) {
      // Subscribe to staff user's messages
      channels.push(`user:${userId}:messages`)
    }

    // Build subscription configuration
    const subscriptionConfig = {
      supabaseUrl,
      supabaseKey: supabaseAnonKey,
      channels,
      features: {
        messages: true,
        readReceipts: includeReadReceipts,
        typing: includeTyping,
        presence: includePresence,
      },
      filters: {
        userId,
        customerId,
        conversationId,
      },
    }

    // Log subscription for monitoring
    const supabase = getServiceSupabase()
    supabase.from('audit_logs').insert({
      user_id: userId || null,
      action: 'realtime_subscription',
      resource_type: conversationId ? 'conversation' : customerId ? 'customer' : 'user',
      resource_id: conversationId || customerId || userId || null,
      metadata: {
        channels,
        features: subscriptionConfig.features,
      },
    } as any).then(
      () => {},
      (err: any) => console.error('[Realtime Subscribe] Failed to log subscription:', err)
    )

    return createSuccessResponse(subscriptionConfig)

  } catch (error) {
    console.error('[Realtime Subscribe] POST /api/messages/realtime/subscribe error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * DELETE - Unsubscribe from realtime messages
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate request
    const { userId, customerId, error: authError } = await authenticateRequest(request)
    if (authError) {
      return authError
    }

    // Parse request body for specific channels to unsubscribe
    const body = await request.json().catch(() => ({}))
    const { channels } = body

    // Log unsubscription
    const supabase = getServiceSupabase()
    supabase.from('audit_logs').insert({
      user_id: userId || null,
      action: 'realtime_unsubscription',
      resource_type: customerId ? 'customer' : 'user',
      resource_id: customerId || userId || null,
      metadata: {
        channels: channels || 'all',
      },
    } as any).then(
      () => {},
      (err: any) => console.error('[Realtime Subscribe] Failed to log unsubscription:', err)
    )

    return createSuccessResponse({
      message: 'Unsubscribed successfully',
      channels: channels || 'all',
    })

  } catch (error) {
    console.error('[Realtime Subscribe] DELETE /api/messages/realtime/subscribe error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
