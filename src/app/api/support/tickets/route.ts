import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Support Tickets API
 *
 * GET /api/support/tickets
 * - List support tickets with filtering
 * - Query params: status, priority, assignedTo, limit
 *
 * POST /api/support/tickets
 * - Create new support ticket manually
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for ticket creation
 */
const CreateTicketSchema = z.object({
  customerId: z.string().uuid().optional(),
  escalationReason: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  metadata: z.record(z.string(), z.any()).optional(),
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
 * GET - List support tickets
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
      'technician',
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
    const statusFilter = searchParams.get('status')
    const priorityFilter = searchParams.get('priority')
    const assignedTo = searchParams.get('assignedTo')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get ticket queue
    const serviceSupabase = getServiceSupabase()
    const { data: tickets, error: ticketsError } = await serviceSupabase.rpc(
      'get_ticket_queue',
      {
        p_status_filter: statusFilter,
        p_priority_filter: priorityFilter,
        p_assigned_to: assignedTo || null,
        p_limit: limit,
      } as any
    )

    if (ticketsError) {
      console.error('[Support Tickets] Error fetching tickets:', ticketsError)
      return createErrorResponse(
        'database_error',
        'Failed to fetch tickets',
        500
      )
    }

    // Transform to camelCase
    const ticketsArray = (tickets as any[]) || []
    const transformedTickets = ticketsArray.map((ticket: any) => ({
      id: ticket.id,
      ticketNumber: ticket.ticket_number,
      customerId: ticket.customer_id,
      customerName: ticket.customer_name,
      escalationReason: ticket.escalation_reason,
      priority: ticket.priority,
      status: ticket.status,
      assignedToUserId: ticket.assigned_to_user_id,
      assignedToName: ticket.assigned_to_name,
      createdAt: ticket.created_at,
      unreadMessages: parseInt(ticket.unread_messages || '0'),
    }))

    // Get ticket counts by priority
    const { data: counts } = await serviceSupabase.rpc('get_open_ticket_counts')

    return createSuccessResponse({
      tickets: transformedTickets,
      counts: counts || [],
    })
  } catch (error) {
    console.error('[Support Tickets] GET /api/support/tickets error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Create new support ticket manually
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
        'Only admins, managers, and dispatchers can create tickets',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateTicketSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid ticket data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const { customerId, escalationReason, priority, metadata } = validation.data

    // Create ticket
    const serviceSupabase = getServiceSupabase()
    const { data: ticketId, error: createError } = await serviceSupabase.rpc(
      'create_support_ticket',
      {
        p_customer_id: customerId || null,
        p_chatbot_session_id: null,
        p_escalation_reason: escalationReason,
        p_priority: priority,
        p_metadata: metadata || {},
      } as any
    )

    if (createError || !ticketId) {
      console.error('[Support Tickets] Error creating ticket:', createError)
      return createErrorResponse(
        'creation_failed',
        'Failed to create ticket',
        500
      )
    }

    // Get ticket details
    const { data: ticket } = await serviceSupabase
      .from('support_tickets')
      .select('id, ticket_number, priority, status, created_at')
      .eq('id', ticketId)
      .single()

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'support_ticket_created',
      resource_type: 'support_ticket',
      resource_id: ticketId,
      metadata: {
        ticketNumber: (ticket as any)?.ticket_number,
        priority,
      },
    } as any)

    return createSuccessResponse({
      message: 'Ticket created successfully',
      ticket: {
        id: (ticket as any)?.id,
        ticketNumber: (ticket as any)?.ticket_number,
        priority: (ticket as any)?.priority,
        status: (ticket as any)?.status,
        createdAt: (ticket as any)?.created_at,
      },
    }, 201)
  } catch (error) {
    console.error('[Support Tickets] POST /api/support/tickets error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
