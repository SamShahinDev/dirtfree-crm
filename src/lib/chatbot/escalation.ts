/**
 * Chatbot Escalation System
 *
 * Detects when chatbot conversations should be escalated to human support
 * and handles the escalation process including ticket creation and staff notification.
 */

import { getServiceSupabase } from '@/lib/supabase/server'
import twilio from 'twilio'
import { Resend } from 'resend'

/**
 * Escalation trigger types
 */
export type EscalationTrigger =
  | 'low_confidence'
  | 'customer_frustration'
  | 'repeated_failure'
  | 'explicit_request'
  | 'vip_customer'
  | 'keyword_match'
  | 'urgent_issue'

/**
 * Escalation priority levels
 */
export type EscalationPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Escalation detection result
 */
export interface EscalationDetection {
  shouldEscalate: boolean
  trigger: EscalationTrigger | null
  priority: EscalationPriority
  reason: string
  isUrgent: boolean
  metadata: Record<string, any>
}

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  confidenceThreshold: number // Escalate if below this (default: 0.5)
  failureCountThreshold: number // Escalate after N failed intents (default: 3)
  vipCustomerIds: string[] // List of VIP customer IDs
  notifyChannels: Array<'email' | 'sms' | 'push'>
}

/**
 * Frustration keywords (indicate customer dissatisfaction)
 */
const FRUSTRATION_KEYWORDS = [
  'terrible',
  'awful',
  'horrible',
  'worst',
  'useless',
  'incompetent',
  'angry',
  'furious',
  'mad',
  'upset',
  'disappointed',
  'frustrated',
  'terrible service',
  'poor service',
  'bad service',
  'unacceptable',
  'ridiculous',
  'disgusting',
  'appalling',
  'pathetic',
  'waste of time',
  'waste of money',
]

/**
 * Refund/complaint keywords (high priority)
 */
const COMPLAINT_KEYWORDS = [
  'refund',
  'money back',
  'charge back',
  'chargeback',
  'dispute',
  'sue',
  'lawsuit',
  'attorney',
  'lawyer',
  'legal action',
  'better business bureau',
  'bbb',
  'complaint',
  'file a complaint',
  'report you',
  'cancel service',
  'cancel my account',
]

/**
 * Human request keywords
 */
const HUMAN_REQUEST_KEYWORDS = [
  'speak to',
  'talk to',
  'connect me',
  'transfer me',
  'real person',
  'human',
  'agent',
  'representative',
  'manager',
  'supervisor',
  'someone',
  'actual person',
  'live person',
  'customer service',
  'customer support',
]

/**
 * Urgent issue keywords
 */
const URGENT_KEYWORDS = [
  'emergency',
  'urgent',
  'asap',
  'immediately',
  'right now',
  'flooding',
  'water damage',
  'burst pipe',
  'leak',
  'fire',
  'smoke',
  'mold',
  'health hazard',
  'dangerous',
  'safety',
]

/**
 * Default escalation configuration
 */
const DEFAULT_CONFIG: EscalationConfig = {
  confidenceThreshold: 0.5,
  failureCountThreshold: 3,
  vipCustomerIds: [],
  notifyChannels: ['email', 'sms'],
}

/**
 * Detect if escalation is needed
 */
export function detectEscalation(
  message: string,
  confidence: number,
  failureCount: number,
  customerId?: string,
  config: Partial<EscalationConfig> = {}
): EscalationDetection {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const lowerMessage = message.toLowerCase()

  // Check for urgent issues first (highest priority)
  const urgentKeyword = URGENT_KEYWORDS.find((keyword) =>
    lowerMessage.includes(keyword)
  )
  if (urgentKeyword) {
    return {
      shouldEscalate: true,
      trigger: 'urgent_issue',
      priority: 'urgent',
      reason: `Urgent issue detected: ${urgentKeyword}`,
      isUrgent: true,
      metadata: { keyword: urgentKeyword },
    }
  }

  // Check for complaint/refund keywords (high priority)
  const complaintKeyword = COMPLAINT_KEYWORDS.find((keyword) =>
    lowerMessage.includes(keyword)
  )
  if (complaintKeyword) {
    return {
      shouldEscalate: true,
      trigger: 'customer_frustration',
      priority: 'high',
      reason: `Complaint/refund request: ${complaintKeyword}`,
      isUrgent: false,
      metadata: { keyword: complaintKeyword, type: 'complaint' },
    }
  }

  // Check for explicit human request
  const humanKeyword = HUMAN_REQUEST_KEYWORDS.find((keyword) =>
    lowerMessage.includes(keyword)
  )
  if (humanKeyword) {
    return {
      shouldEscalate: true,
      trigger: 'explicit_request',
      priority: 'high',
      reason: `Customer requested human support: ${humanKeyword}`,
      isUrgent: false,
      metadata: { keyword: humanKeyword },
    }
  }

  // Check for frustration keywords
  const frustrationKeyword = FRUSTRATION_KEYWORDS.find((keyword) =>
    lowerMessage.includes(keyword)
  )
  if (frustrationKeyword) {
    return {
      shouldEscalate: true,
      trigger: 'customer_frustration',
      priority: 'high',
      reason: `Customer frustration detected: ${frustrationKeyword}`,
      isUrgent: false,
      metadata: { keyword: frustrationKeyword },
    }
  }

  // Check for VIP customer
  if (customerId && fullConfig.vipCustomerIds.includes(customerId)) {
    return {
      shouldEscalate: true,
      trigger: 'vip_customer',
      priority: 'high',
      reason: 'VIP customer requires human assistance',
      isUrgent: false,
      metadata: { customerId },
    }
  }

  // Check for low confidence
  if (confidence < fullConfig.confidenceThreshold) {
    return {
      shouldEscalate: true,
      trigger: 'low_confidence',
      priority: 'medium',
      reason: `Low confidence score: ${Math.round(confidence * 100)}%`,
      isUrgent: false,
      metadata: { confidence },
    }
  }

  // Check for repeated failures
  if (failureCount >= fullConfig.failureCountThreshold) {
    return {
      shouldEscalate: true,
      trigger: 'repeated_failure',
      priority: 'medium',
      reason: `${failureCount} consecutive failed intent detections`,
      isUrgent: false,
      metadata: { failureCount },
    }
  }

  // No escalation needed
  return {
    shouldEscalate: false,
    trigger: null,
    priority: 'low',
    reason: '',
    isUrgent: false,
    metadata: {},
  }
}

/**
 * Create support ticket from escalation
 */
export async function createSupportTicket(
  sessionId: string,
  customerId: string | null,
  escalationDetection: EscalationDetection
): Promise<{ ticketId: string; ticketNumber: string } | null> {
  try {
    const supabase = getServiceSupabase()

    const { data: ticketId, error } = await supabase.rpc('create_support_ticket', {
      p_customer_id: customerId,
      p_chatbot_session_id: sessionId,
      p_escalation_reason: escalationDetection.reason,
      p_priority: escalationDetection.priority,
      p_metadata: {
        trigger: escalationDetection.trigger,
        isUrgent: escalationDetection.isUrgent,
        ...escalationDetection.metadata,
      },
    } as any)

    if (error || !ticketId) {
      console.error('[Escalation] Error creating support ticket:', error)
      return null
    }

    // Get ticket number
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('ticket_number')
      .eq('id', ticketId)
      .single()

    return {
      ticketId,
      ticketNumber: (ticket as any)?.ticket_number || 'UNKNOWN',
    }
  } catch (error) {
    console.error('[Escalation] Error creating support ticket:', error)
    return null
  }
}

/**
 * Notify available staff about escalation
 */
export async function notifyAvailableStaff(
  ticketId: string,
  ticketNumber: string,
  priority: EscalationPriority,
  escalationReason: string,
  channels: Array<'email' | 'sms' | 'push'> = ['email', 'sms']
): Promise<void> {
  try {
    const supabase = getServiceSupabase()

    // Get user IDs with required roles
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'manager', 'dispatcher'])

    const userIds = (userRoles || []).map((ur: any) => ur.user_id)

    if (userIds.length === 0) {
      console.warn('[Escalation] No available staff to notify')
      return
    }

    // Get available staff (online or recently active)
    const { data: staff } = await supabase
      .from('users')
      .select('id, email, phone')
      .in('id', userIds)
      .limit(10)

    if (!staff || staff.length === 0) {
      console.warn('[Escalation] No available staff to notify')
      return
    }

    // Determine notification priority emoji
    const priorityEmoji =
      priority === 'urgent'
        ? '🚨'
        : priority === 'high'
        ? '⚠️'
        : priority === 'medium'
        ? 'ℹ️'
        : '📋'

    // Send notifications
    const notifications = staff.flatMap((staffMember: any) => {
      const notificationChannels = []

      // Email notification
      if (channels.includes('email') && staffMember.email) {
        notificationChannels.push(
          sendEmailNotification(
            staffMember.email,
            ticketNumber,
            priority,
            escalationReason,
            priorityEmoji
          ).then(() => ({
            userId: staffMember.id,
            channel: 'email' as const,
          }))
        )
      }

      // SMS notification
      if (channels.includes('sms') && staffMember.phone) {
        notificationChannels.push(
          sendSMSNotification(
            staffMember.phone,
            ticketNumber,
            priority,
            escalationReason,
            priorityEmoji
          ).then(() => ({
            userId: staffMember.id,
            channel: 'sms' as const,
          }))
        )
      }

      return notificationChannels
    })

    // Wait for all notifications to send
    const sent = await Promise.allSettled(notifications)

    // Log successful notifications
    for (const result of sent) {
      if (result.status === 'fulfilled') {
        await supabase.from('staff_notifications').insert({
          user_id: result.value.userId,
          ticket_id: ticketId,
          notification_type: 'escalation_alert',
          channel: result.value.channel,
          metadata: {
            priority,
            escalationReason,
            ticketNumber,
          },
        } as any)
      }
    }

    console.log(
      `[Escalation] Notified ${sent.filter((r) => r.status === 'fulfilled').length} staff members about ticket ${ticketNumber}`
    )
  } catch (error) {
    console.error('[Escalation] Error notifying staff:', error)
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  email: string,
  ticketNumber: string,
  priority: EscalationPriority,
  reason: string,
  emoji: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Escalation] Resend API key not configured')
    return
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: 'Support <support@dirtfreecarpet.com>',
      to: email,
      subject: `${emoji} ${priority.toUpperCase()} - New Support Ticket: ${ticketNumber}`,
      html: `
        <h2>${emoji} New Support Ticket Escalated</h2>
        <p><strong>Ticket:</strong> ${ticketNumber}</p>
        <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <br>
        <p>A customer conversation has been escalated to human support. Please review and respond as soon as possible.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/support/queue">View Support Queue</a></p>
      `,
    })
  } catch (error) {
    console.error('[Escalation] Error sending email notification:', error)
    throw error
  }
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(
  phone: string,
  ticketNumber: string,
  priority: EscalationPriority,
  reason: string,
  emoji: string
): Promise<void> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('[Escalation] Twilio not configured')
    return
  }

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
      body: `${emoji} ${priority.toUpperCase()} Support Ticket ${ticketNumber}\n\n${reason}\n\nView: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/support/queue`,
    })
  } catch (error) {
    console.error('[Escalation] Error sending SMS notification:', error)
    throw error
  }
}

/**
 * Handle complete escalation process
 */
export async function escalateConversation(
  sessionId: string,
  customerId: string | null,
  message: string,
  confidence: number,
  failureCount: number = 0,
  config: Partial<EscalationConfig> = {}
): Promise<{
  escalated: boolean
  ticketId?: string
  ticketNumber?: string
  reason: string
}> {
  // Detect if escalation is needed
  const detection = detectEscalation(message, confidence, failureCount, customerId || undefined, config)

  if (!detection.shouldEscalate) {
    return {
      escalated: false,
      reason: 'No escalation triggers detected',
    }
  }

  // Create support ticket
  const ticket = await createSupportTicket(sessionId, customerId, detection)

  if (!ticket) {
    return {
      escalated: false,
      reason: 'Failed to create support ticket',
    }
  }

  // Notify staff
  await notifyAvailableStaff(
    ticket.ticketId,
    ticket.ticketNumber,
    detection.priority,
    detection.reason,
    config.notifyChannels
  )

  return {
    escalated: true,
    ticketId: ticket.ticketId,
    ticketNumber: ticket.ticketNumber,
    reason: detection.reason,
  }
}

/**
 * Check if customer is VIP
 */
export async function isVIPCustomer(customerId: string): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()

    // Check if customer has VIP tag or high lifetime value
    const { data: customer } = await supabase
      .from('customers')
      .select('tags, metadata')
      .eq('id', customerId)
      .single()

    if (!customer) return false

    // Check for VIP tag
    const tags = (customer as any).tags || []
    if (tags.includes('vip') || tags.includes('VIP')) {
      return true
    }

    // Check metadata for VIP status
    const metadata = (customer as any).metadata || {}
    if (metadata.isVIP === true || metadata.vip === true) {
      return true
    }

    // Could also check lifetime value, number of appointments, etc.
    // For now, just check tags and metadata
    return false
  } catch (error) {
    console.error('[Escalation] Error checking VIP status:', error)
    return false
  }
}

/**
 * Get escalation statistics
 */
export async function getEscalationStats(
  startDate: Date,
  endDate: Date
): Promise<{
  totalEscalations: number
  byTrigger: Record<EscalationTrigger, number>
  byPriority: Record<EscalationPriority, number>
  averageResolutionTime: number
}> {
  try {
    const supabase = getServiceSupabase()

    const { data: tickets } = await supabase
      .from('support_tickets')
      .select('metadata, priority, created_at, resolved_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    if (!tickets || tickets.length === 0) {
      return {
        totalEscalations: 0,
        byTrigger: {} as any,
        byPriority: {} as any,
        averageResolutionTime: 0,
      }
    }

    // Count by trigger
    const byTrigger: Record<string, number> = {}
    tickets.forEach((ticket: any) => {
      const trigger = ticket.metadata?.trigger || 'unknown'
      byTrigger[trigger] = (byTrigger[trigger] || 0) + 1
    })

    // Count by priority
    const byPriority: Record<string, number> = {}
    tickets.forEach((ticket: any) => {
      const priority = ticket.priority || 'medium'
      byPriority[priority] = (byPriority[priority] || 0) + 1
    })

    // Calculate average resolution time
    const resolutionTimes = tickets
      .filter((t: any) => t.resolved_at)
      .map((t: any) => {
        const created = new Date(t.created_at).getTime()
        const resolved = new Date(t.resolved_at).getTime()
        return (resolved - created) / 1000 / 60 // minutes
      })

    const averageResolutionTime =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
        : 0

    return {
      totalEscalations: tickets.length,
      byTrigger: byTrigger as any,
      byPriority: byPriority as any,
      averageResolutionTime,
    }
  } catch (error) {
    console.error('[Escalation] Error getting escalation stats:', error)
    return {
      totalEscalations: 0,
      byTrigger: {} as any,
      byPriority: {} as any,
      averageResolutionTime: 0,
    }
  }
}
