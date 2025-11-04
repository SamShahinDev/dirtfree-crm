import { getServiceSupabase } from '@/lib/supabase/server'
import { sendCustomEmail } from '@/lib/email/service'
import { renderReviewEscalationEmail } from '@/lib/email/templates/review-escalation'

/**
 * Review Escalation System
 *
 * Handles escalation of unresolved low-rating reviews to management.
 *
 * Process:
 * 1. Check for support tickets from 1-3 star reviews > 48 hours old
 * 2. Filter for tickets still in 'open' or 'pending' status
 * 3. Escalate to management with high priority
 * 4. Send notification emails to managers
 */

export interface UnresolvedTicket {
  ticketId: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  jobId: string
  serviceType: string
  reviewRequestId: string
  rating: number
  feedback: string
  resolutionRequest: string | null
  createdAt: string
  hoursSinceCreated: number
}

export interface EscalationResult {
  success: boolean
  ticketId?: string
  error?: string
  notificationsSent?: number
}

/**
 * Check for unresolved low-rating reviews
 * Returns support tickets from 1-3 star reviews that are still unresolved after 48 hours
 */
export async function checkUnresolvedLowRatings(): Promise<UnresolvedTicket[]> {
  try {
    const supabase = getServiceSupabase()

    // Calculate 48 hours ago
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)

    console.log(`[Escalation] Checking for tickets created before ${fortyEightHoursAgo.toISOString()}`)

    // Get support tickets created from review system that are still open/pending
    const { data: tickets, error: ticketsError } = await supabase
      .from('support_tickets')
      .select(`
        id,
        customer_id,
        job_id,
        status,
        metadata,
        created_at,
        customers (
          id,
          full_name,
          email,
          phone
        ),
        jobs (
          id,
          service_type
        )
      `)
      .eq('source', 'review_system')
      .in('status', ['open', 'pending'])
      .lt('created_at', fortyEightHoursAgo.toISOString())
      .order('created_at', { ascending: true })

    if (ticketsError) {
      console.error('[Escalation] Error fetching tickets:', ticketsError)
      return []
    }

    if (!tickets || tickets.length === 0) {
      console.log('[Escalation] No unresolved tickets found')
      return []
    }

    console.log(`[Escalation] Found ${tickets.length} unresolved tickets`)

    // Transform to UnresolvedTicket format
    const unresolvedTickets: UnresolvedTicket[] = tickets
      .map((ticket: any) => {
        const metadata = typeof ticket.metadata === 'string'
          ? JSON.parse(ticket.metadata)
          : ticket.metadata

        const createdAt = new Date(ticket.created_at)
        const hoursSinceCreated = Math.floor(
          (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)
        )

        return {
          ticketId: ticket.id,
          customerId: ticket.customer_id,
          customerName: ticket.customers?.full_name || 'Unknown',
          customerEmail: ticket.customers?.email || '',
          customerPhone: ticket.customers?.phone || null,
          jobId: ticket.job_id,
          serviceType: ticket.jobs?.service_type || 'Unknown Service',
          reviewRequestId: metadata?.review_request_id || '',
          rating: metadata?.rating || 0,
          feedback: metadata?.feedback || 'No feedback provided',
          resolutionRequest: metadata?.resolution_request || null,
          createdAt: ticket.created_at,
          hoursSinceCreated,
        }
      })
      .filter((ticket) => ticket.rating >= 1 && ticket.rating <= 3) // Only 1-3 star reviews

    console.log(`[Escalation] Filtered to ${unresolvedTickets.length} low-rating tickets`)

    return unresolvedTickets
  } catch (error) {
    console.error('[Escalation] Error checking unresolved low ratings:', error)
    return []
  }
}

/**
 * Escalate ticket to management
 * Updates priority, adds escalation note, sends notification to managers
 */
export async function escalateToManagement(
  ticket: UnresolvedTicket
): Promise<EscalationResult> {
  try {
    const supabase = getServiceSupabase()

    console.log(`[Escalation] Escalating ticket ${ticket.ticketId}`)

    // Update ticket priority to high
    const { error: updateError } = await (supabase as any)
      .from('support_tickets')
      .update({
        priority: 'high',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticket.ticketId)

    if (updateError) {
      console.error('[Escalation] Error updating ticket priority:', updateError)
      return {
        success: false,
        ticketId: ticket.ticketId,
        error: updateError.message,
      }
    }

    // Add escalation note to ticket
    const escalationNote = `ESCALATED: Unresolved ${ticket.rating}-star review after ${ticket.hoursSinceCreated} hours. Customer requires immediate follow-up.`

    const { error: noteError } = await (supabase as any)
      .from('support_ticket_notes')
      .insert({
        ticket_id: ticket.ticketId,
        note: escalationNote,
        note_type: 'system',
        created_by: null, // System generated
        is_internal: true,
      })

    if (noteError) {
      console.warn('[Escalation] Error adding escalation note:', noteError)
      // Don't fail escalation if note fails
    }

    // Get all managers and admins to notify
    const { data: managers, error: managersError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        users (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .in('role', ['admin', 'manager', 'owner'])

    if (managersError || !managers || managers.length === 0) {
      console.warn('[Escalation] No managers found to notify')
      return {
        success: true,
        ticketId: ticket.ticketId,
        notificationsSent: 0,
      }
    }

    console.log(`[Escalation] Sending notifications to ${managers.length} managers`)

    // Send escalation email to each manager
    let notificationsSent = 0

    for (const manager of managers) {
      const user = (manager as any).users
      if (!user || !user.email) continue

      try {
        const subject = `🚨 URGENT: Unresolved ${ticket.rating}-Star Review`

        const html = renderReviewEscalationEmail({
          managerName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Manager',
          customerName: ticket.customerName,
          customerEmail: ticket.customerEmail,
          customerPhone: ticket.customerPhone,
          serviceType: ticket.serviceType,
          rating: ticket.rating,
          feedback: ticket.feedback,
          resolutionRequest: ticket.resolutionRequest,
          hoursSinceReview: ticket.hoursSinceCreated,
          ticketUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/support/tickets/${ticket.ticketId}`,
        })

        await sendCustomEmail(user.email, subject, html)
        notificationsSent++

        console.log(`[Escalation] Sent notification to ${user.email}`)
      } catch (emailError) {
        console.error(`[Escalation] Error sending email to ${user.email}:`, emailError)
        // Continue with other managers
      }
    }

    // Log escalation event
    try {
      await (supabase as any)
        .from('audit_logs')
        .insert({
          action: 'review_escalated',
          entity_type: 'support_ticket',
          entity_id: ticket.ticketId,
          metadata: {
            customer_id: ticket.customerId,
            rating: ticket.rating,
            hours_since_created: ticket.hoursSinceCreated,
            notifications_sent: notificationsSent,
          },
        })
    } catch (logError) {
      console.warn('[Escalation] Error logging escalation event:', logError)
      // Don't fail escalation if logging fails
    }

    console.log(`[Escalation] Successfully escalated ticket ${ticket.ticketId}`)

    return {
      success: true,
      ticketId: ticket.ticketId,
      notificationsSent,
    }
  } catch (error) {
    console.error('[Escalation] Error escalating ticket:', error)
    return {
      success: false,
      ticketId: ticket.ticketId,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process all escalations
 * Convenience function to check and escalate all unresolved tickets
 */
export async function processEscalations(): Promise<{
  totalChecked: number
  totalEscalated: number
  totalFailed: number
  notificationsSent: number
}> {
  const unresolvedTickets = await checkUnresolvedLowRatings()

  let totalEscalated = 0
  let totalFailed = 0
  let notificationsSent = 0

  for (const ticket of unresolvedTickets) {
    const result = await escalateToManagement(ticket)

    if (result.success) {
      totalEscalated++
      notificationsSent += result.notificationsSent || 0
    } else {
      totalFailed++
    }

    // Rate limiting: 100ms delay between escalations
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return {
    totalChecked: unresolvedTickets.length,
    totalEscalated,
    totalFailed,
    notificationsSent,
  }
}
