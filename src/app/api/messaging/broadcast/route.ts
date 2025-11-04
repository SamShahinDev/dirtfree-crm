import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Broadcast Messaging API
 *
 * GET /api/messaging/broadcast
 * - List all broadcast messages
 * - Query params: status, limit, offset
 *
 * POST /api/messaging/broadcast
 * - Create new broadcast message
 * - Optionally queue for immediate or scheduled delivery
 *
 * Authentication: Required (staff only - admin, manager, dispatcher)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for recipient filter
 */
const RecipientFilterSchema = z.object({
  zones: z.array(z.string().uuid()).optional(),
  serviceTypes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  lastVisitStart: z.string().optional(),
  lastVisitEnd: z.string().optional(),
  specificIds: z.array(z.string().uuid()).optional(),
})

/**
 * Validation schema for broadcast message creation
 */
const BroadcastMessageSchema = z.object({
  subject: z.string().min(1).max(255),
  messageText: z.string().min(1),
  deliveryMethods: z.array(z.enum(['portal', 'email', 'sms'])).min(1),
  recipientFilter: RecipientFilterSchema.optional().default({}),
  scheduledFor: z.string().datetime().optional(),
  sendImmediately: z.boolean().optional().default(false),
})

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
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
 * Check if user has required role
 */
async function checkUserRole(
  userId: string,
  requiredRoles: string[]
): Promise<boolean> {
  const supabase = getServiceSupabase()

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', requiredRoles)
    .single()

  return !error && !!data
}

/**
 * GET - List broadcast messages
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Check if user has staff role
    const hasAccess = await checkUserRole(user.id, [
      'admin',
      'manager',
      'dispatcher',
    ])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const serviceSupabase = getServiceSupabase()

    // Build query
    let query = serviceSupabase
      .from('broadcast_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: broadcasts, error: broadcastsError } = await query

    if (broadcastsError) {
      console.error('[Broadcast] Error fetching broadcasts:', broadcastsError)
      return createErrorResponse(
        'database_error',
        'Failed to fetch broadcast messages',
        500
      )
    }

    // Transform to camelCase
    const transformedBroadcasts = (broadcasts || []).map((broadcast: any) => ({
      id: broadcast.id,
      subject: broadcast.subject,
      messageText: broadcast.message_text,
      deliveryMethods: broadcast.delivery_methods,
      recipientFilter: broadcast.recipient_filter,
      recipientCount: broadcast.recipient_count,
      scheduledFor: broadcast.scheduled_for,
      status: broadcast.status,
      sentAt: broadcast.sent_at,
      completedAt: broadcast.completed_at,
      deliverySuccessCount: broadcast.delivery_success_count,
      deliveryFailedCount: broadcast.delivery_failed_count,
      estimatedCostUsd: broadcast.estimated_cost_usd,
      actualCostUsd: broadcast.actual_cost_usd,
      createdByUserId: broadcast.created_by_user_id,
      updatedByUserId: broadcast.updated_by_user_id,
      createdAt: broadcast.created_at,
      updatedAt: broadcast.updated_at,
    }))

    return createSuccessResponse({
      broadcasts: transformedBroadcasts,
      pagination: {
        limit,
        offset,
        total: transformedBroadcasts.length,
      },
    })
  } catch (error) {
    console.error('[Broadcast] GET /api/messaging/broadcast error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Create new broadcast message
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Check if user has staff role
    const hasAccess = await checkUserRole(user.id, [
      'admin',
      'manager',
      'dispatcher',
    ])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = BroadcastMessageSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid broadcast data: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { subject, messageText, deliveryMethods, recipientFilter, scheduledFor, sendImmediately } = validation.data

    const serviceSupabase = getServiceSupabase()

    // Get recipient count
    const { data: recipientCountData } = await (serviceSupabase as any).rpc(
      'get_broadcast_recipient_count',
      { p_filter: recipientFilter }
    )

    const recipientCount = recipientCountData || 0

    if (recipientCount === 0) {
      return createErrorResponse(
        'validation_failed',
        'No recipients match the filter criteria',
        400
      )
    }

    // Estimate cost for SMS
    let estimatedCost = 0
    if (deliveryMethods.includes('sms')) {
      const { data: costData } = await (serviceSupabase as any).rpc(
        'estimate_sms_cost',
        {
          p_message_text: messageText,
          p_recipient_count: recipientCount,
        }
      )
      estimatedCost = parseFloat(costData || '0')
    }

    // Determine status
    let status = 'draft'
    if (sendImmediately) {
      status = 'sending'
    } else if (scheduledFor) {
      status = 'scheduled'
    }

    // Create broadcast message
    const { data: broadcast, error: createError } = await serviceSupabase
      .from('broadcast_messages')
      .insert({
        subject,
        message_text: messageText,
        delivery_methods: JSON.stringify(deliveryMethods),
        recipient_filter: JSON.stringify(recipientFilter),
        recipient_count: recipientCount,
        scheduled_for: scheduledFor || null,
        status,
        sent_at: sendImmediately ? new Date().toISOString() : null,
        estimated_cost_usd: estimatedCost,
        created_by_user_id: user.id,
        updated_by_user_id: user.id,
      } as any)
      .select()
      .single()

    if (createError || !broadcast) {
      console.error('[Broadcast] Error creating broadcast:', createError)
      return createErrorResponse(
        'creation_failed',
        'Failed to create broadcast message',
        500
      )
    }

    // If sending immediately, create delivery records
    if (sendImmediately) {
      const { data: deliveryCount, error: deliveryError } = await (serviceSupabase as any).rpc(
        'create_broadcast_deliveries',
        {
          p_broadcast_id: (broadcast as any).id,
          p_delivery_methods: deliveryMethods,
        }
      )

      if (deliveryError) {
        console.error('[Broadcast] Error creating deliveries:', deliveryError)
        // Update status to failed
        await (serviceSupabase as any)
          .from('broadcast_messages')
          .update({ status: 'failed' })
          .eq('id', (broadcast as any).id)

        return createErrorResponse(
          'delivery_failed',
          'Failed to queue messages for delivery',
          500
        )
      }

      console.log(`[Broadcast] Created ${deliveryCount} delivery records for broadcast ${(broadcast as any).id}`)
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'broadcast_created',
      resource_type: 'broadcast_message',
      resource_id: (broadcast as any).id,
      metadata: {
        subject,
        recipientCount,
        deliveryMethods,
        status,
      },
    } as any)

    return createSuccessResponse(
      {
        message: 'Broadcast message created successfully',
        broadcast: {
          id: (broadcast as any).id,
          subject: (broadcast as any).subject,
          messageText: (broadcast as any).message_text,
          deliveryMethods: (broadcast as any).delivery_methods,
          recipientCount: (broadcast as any).recipient_count,
          scheduledFor: (broadcast as any).scheduled_for,
          status: (broadcast as any).status,
          estimatedCostUsd: (broadcast as any).estimated_cost_usd,
        },
      },
      201
    )
  } catch (error) {
    console.error('[Broadcast] POST /api/messaging/broadcast error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
