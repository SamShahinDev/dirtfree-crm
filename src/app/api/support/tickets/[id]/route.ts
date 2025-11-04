import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Support Ticket Operations API
 *
 * GET /api/support/tickets/[id]
 * - Get ticket details with full conversation history
 *
 * PATCH /api/support/tickets/[id]
 * - Update ticket (assign, resolve, update status)
 *
 * POST /api/support/tickets/[id]/messages
 * - Add message to ticket
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for ticket update
 */
const UpdateTicketSchema = z.object({
  action: z.enum(['assign', 'resolve', 'close', 'update_status', 'update_priority']),
  assignedToUserId: z.string().uuid().optional(),
  resolutionNotes: z.string().optional(),
  status: z.enum(['open', 'assigned', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
})

/**
 * Validation schema for adding message
 */
const AddMessageSchema = z.object({
  messageText: z.string().min(1),
  isInternalNote: z.boolean().default(false),
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
 * GET - Get ticket details with conversation history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      'technician',
    ])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    const ticketId = params.id

    // Get ticket with full history
    const serviceSupabase = getServiceSupabase()
    const { data: ticketData, error: ticketError } = await serviceSupabase.rpc(
      'get_ticket_with_history',
      { p_ticket_id: ticketId } as any
    )

    if (ticketError || !ticketData) {
      console.error('[Support Ticket] Error fetching ticket:', ticketError)
      return createErrorResponse(
        'not_found',
        'Ticket not found',
        404
      )
    }

    return createSuccessResponse(ticketData)
  } catch (error) {
    console.error('[Support Ticket] GET /api/support/tickets/[id] error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * PATCH - Update ticket
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      'technician',
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
    const validation = UpdateTicketSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid update data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const { action, assignedToUserId, resolutionNotes, status, priority } = validation.data
    const ticketId = params.id

    const serviceSupabase = getServiceSupabase()

    // Handle different actions
    switch (action) {
      case 'assign':
        if (!assignedToUserId) {
          return createErrorResponse(
            'validation_failed',
            'assignedToUserId is required for assign action',
            400
          )
        }

        const { error: assignError } = await serviceSupabase.rpc('assign_ticket', {
          p_ticket_id: ticketId,
          p_user_id: assignedToUserId,
        } as any)

        if (assignError) {
          console.error('[Support Ticket] Error assigning ticket:', assignError)
          return createErrorResponse('update_failed', 'Failed to assign ticket', 500)
        }
        break

      case 'resolve':
        if (!resolutionNotes) {
          return createErrorResponse(
            'validation_failed',
            'resolutionNotes is required for resolve action',
            400
          )
        }

        const { error: resolveError } = await serviceSupabase.rpc('resolve_ticket', {
          p_ticket_id: ticketId,
          p_resolution_notes: resolutionNotes,
        } as any)

        if (resolveError) {
          console.error('[Support Ticket] Error resolving ticket:', resolveError)
          return createErrorResponse('update_failed', 'Failed to resolve ticket', 500)
        }
        break

      case 'close':
      case 'update_status':
        const { error: statusError } = await (serviceSupabase as any)
          .from('support_tickets')
          .update({
            status: status || 'closed',
            closed_at: action === 'close' ? new Date().toISOString() : undefined,
          })
          .eq('id', ticketId)

        if (statusError) {
          console.error('[Support Ticket] Error updating status:', statusError)
          return createErrorResponse('update_failed', 'Failed to update status', 500)
        }
        break

      case 'update_priority':
        if (!priority) {
          return createErrorResponse(
            'validation_failed',
            'priority is required for update_priority action',
            400
          )
        }

        const { error: priorityError } = await (serviceSupabase as any)
          .from('support_tickets')
          .update({ priority })
          .eq('id', ticketId)

        if (priorityError) {
          console.error('[Support Ticket] Error updating priority:', priorityError)
          return createErrorResponse('update_failed', 'Failed to update priority', 500)
        }
        break
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: `support_ticket_${action}`,
      resource_type: 'support_ticket',
      resource_id: ticketId,
      metadata: {
        action,
        assignedToUserId,
        resolutionNotes,
        status,
        priority,
      },
    } as any)

    return createSuccessResponse({
      message: 'Ticket updated successfully',
      action,
    })
  } catch (error) {
    console.error('[Support Ticket] PATCH /api/support/tickets/[id] error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Add message to ticket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      'technician',
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
    const validation = AddMessageSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid message data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const { messageText, isInternalNote } = validation.data
    const ticketId = params.id

    // Add message
    const serviceSupabase = getServiceSupabase()
    const { data: message, error: messageError } = await serviceSupabase
      .from('support_ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_type: 'staff',
        sender_id: user.id,
        message_text: messageText,
        is_internal_note: isInternalNote,
      } as any)
      .select()
      .single()

    if (messageError) {
      console.error('[Support Ticket] Error adding message:', messageError)
      return createErrorResponse(
        'creation_failed',
        'Failed to add message',
        500
      )
    }

    // Update ticket's updated_at timestamp
    await (serviceSupabase as any)
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticketId)

    return createSuccessResponse({
      message: 'Message added successfully',
      messageId: (message as any)?.id,
    }, 201)
  } catch (error) {
    console.error('[Support Ticket] POST /api/support/tickets/[id] error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
