/**
 * Message Notification Service
 *
 * Handles staff notifications for customer messages in the portal.
 * Notifies relevant staff members via email when customers create or reply to threads.
 */

import { getServiceSupabase } from '@/lib/supabase/server'
import { sendCustomEmail } from '@/lib/email/service'
import type { Database } from '@/types/supabase'

type Customer = Database['public']['Tables']['customers']['Row']
type Thread = Database['public']['Tables']['truck_threads']['Row']

/**
 * Configuration for staff to notify
 */
const NOTIFICATION_ROLES = ['admin', 'dispatcher', 'manager']

/**
 * Get staff members who should receive message notifications
 */
async function getNotifiableStaff(): Promise<Array<{ id: string; name: string; email: string }>> {
  const supabase = getServiceSupabase()

  // Get users with elevated roles who should be notified
  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select(`
      user_id,
      role,
      user:users(name, email)
    `)
    .in('role', NOTIFICATION_ROLES)

  if (error || !userRoles) {
    console.error('[Message Notifications] Failed to fetch notifiable staff:', error)
    return []
  }

  // Deduplicate users and format response
  const staffMap = new Map<string, { id: string; name: string; email: string }>()

  for (const roleEntry of userRoles) {
    const user = (roleEntry as any).user
    if (user && user.email && !staffMap.has(roleEntry.user_id)) {
      staffMap.set(roleEntry.user_id, {
        id: roleEntry.user_id,
        name: user.name || 'Staff Member',
        email: user.email,
      })
    }
  }

  return Array.from(staffMap.values())
}

/**
 * Generate email HTML for new thread notification
 */
function generateNewThreadEmail(
  customerName: string,
  subject: string,
  message: string,
  isUrgent: boolean,
  threadId: string,
  jobId?: string | null
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const threadUrl = `${appUrl}/dashboard/messages/${threadId}`
  const customerLabel = customerName || 'Customer'
  const urgentBadge = isUrgent
    ? '<span style="background-color: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 8px;">URGENT</span>'
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Customer Message</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #1a202c;">
      New Customer Message${urgentBadge}
    </h1>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      ${customerLabel} has sent a new message through the customer portal.
    </p>
  </div>

  <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <div style="margin-bottom: 16px;">
      <strong style="color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">From</strong>
      <p style="margin: 4px 0 0 0; font-size: 16px; color: #1a202c;">${customerLabel}</p>
    </div>

    <div style="margin-bottom: 16px;">
      <strong style="color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Subject</strong>
      <p style="margin: 4px 0 0 0; font-size: 16px; color: #1a202c;">${subject}</p>
    </div>

    ${jobId ? `
    <div style="margin-bottom: 16px;">
      <span style="background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 500;">
        Related to Job
      </span>
    </div>
    ` : ''}

    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
      <strong style="color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message</strong>
      <div style="margin-top: 8px; padding: 16px; background-color: #f9fafb; border-radius: 6px; white-space: pre-wrap; font-size: 14px; color: #374151; line-height: 1.7;">${message}</div>
    </div>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${threadUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View & Reply</a>
  </div>

  <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">This is an automated notification from your CRM system.</p>
    ${isUrgent ? `<p style="margin: 8px 0 0 0; color: #ef4444; font-weight: 600;">⚠️ This message is marked as urgent and requires immediate attention.</p>` : ''}
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate email HTML for new reply notification
 */
function generateNewReplyEmail(
  customerName: string,
  threadSubject: string,
  message: string,
  threadId: string,
  hasAttachments: boolean
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const threadUrl = `${appUrl}/dashboard/messages/${threadId}`
  const customerLabel = customerName || 'Customer'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Customer Reply</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #1a202c;">
      New Customer Reply
    </h1>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      ${customerLabel} has replied to a message thread.
    </p>
  </div>

  <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <div style="margin-bottom: 16px;">
      <strong style="color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">From</strong>
      <p style="margin: 4px 0 0 0; font-size: 16px; color: #1a202c;">${customerLabel}</p>
    </div>

    <div style="margin-bottom: 16px;">
      <strong style="color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Thread</strong>
      <p style="margin: 4px 0 0 0; font-size: 16px; color: #1a202c;">${threadSubject}</p>
    </div>

    ${hasAttachments ? `
    <div style="margin-bottom: 16px;">
      <span style="background-color: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 500;">
        📎 Contains Attachments
      </span>
    </div>
    ` : ''}

    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
      <strong style="color: #4b5563; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Reply</strong>
      <div style="margin-top: 8px; padding: 16px; background-color: #f9fafb; border-radius: 6px; white-space: pre-wrap; font-size: 14px; color: #374151; line-height: 1.7;">${message}</div>
    </div>
  </div>

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${threadUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View Thread</a>
  </div>

  <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">This is an automated notification from your CRM system.</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Notify staff of new customer message thread
 */
export async function notifyStaffOfNewThread(params: {
  threadId: string
  customerId: string
  subject: string
  message: string
  isUrgent: boolean
  jobId?: string | null
}): Promise<{ success: boolean; notified: number; errors: string[] }> {
  const { threadId, customerId, subject, message, isUrgent, jobId } = params

  // Get customer info
  const supabase = getServiceSupabase()
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('name, email, phone')
    .eq('id', customerId)
    .single()

  if (customerError || !customer) {
    console.error('[Message Notifications] Failed to fetch customer:', customerError)
    return { success: false, notified: 0, errors: ['Failed to fetch customer information'] }
  }

  // Get staff to notify
  const staff = await getNotifiableStaff()

  if (staff.length === 0) {
    console.warn('[Message Notifications] No staff members found to notify')
    return { success: false, notified: 0, errors: ['No staff members configured for notifications'] }
  }

  // Send email to each staff member
  const results = await Promise.allSettled(
    staff.map(async (staffMember) => {
      const html = generateNewThreadEmail(
        customer.name || customer.email || 'Unknown Customer',
        subject,
        message,
        isUrgent,
        threadId,
        jobId
      )

      const emailSubject = isUrgent
        ? `🚨 URGENT: New Customer Message - ${subject}`
        : `New Customer Message - ${subject}`

      return sendCustomEmail(staffMember.email, emailSubject, html)
    })
  )

  // Count successes and collect errors
  let notified = 0
  const errors: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      notified++
    } else if (result.status === 'rejected') {
      errors.push(`Failed to notify ${staff[index].email}: ${result.reason}`)
    } else if (result.status === 'fulfilled' && !result.value.success) {
      errors.push(`Failed to notify ${staff[index].email}: ${result.value.error}`)
    }
  })

  console.log(`[Message Notifications] New thread notification: ${notified}/${staff.length} staff notified`)

  return {
    success: notified > 0,
    notified,
    errors,
  }
}

/**
 * Notify staff of customer reply to existing thread
 */
export async function notifyStaffOfReply(params: {
  threadId: string
  customerId: string
  message: string
  hasAttachments: boolean
}): Promise<{ success: boolean; notified: number; errors: string[] }> {
  const { threadId, customerId, message, hasAttachments } = params

  const supabase = getServiceSupabase()

  // Get customer and thread info
  const [customerResult, threadResult] = await Promise.all([
    supabase
      .from('customers')
      .select('name, email')
      .eq('id', customerId)
      .single(),
    supabase
      .from('truck_threads')
      .select('title, urgent')
      .eq('id', threadId)
      .single(),
  ])

  if (customerResult.error || !customerResult.data) {
    console.error('[Message Notifications] Failed to fetch customer:', customerResult.error)
    return { success: false, notified: 0, errors: ['Failed to fetch customer information'] }
  }

  if (threadResult.error || !threadResult.data) {
    console.error('[Message Notifications] Failed to fetch thread:', threadResult.error)
    return { success: false, notified: 0, errors: ['Failed to fetch thread information'] }
  }

  const customer = customerResult.data
  const thread = threadResult.data

  // Get staff to notify
  const staff = await getNotifiableStaff()

  if (staff.length === 0) {
    console.warn('[Message Notifications] No staff members found to notify')
    return { success: false, notified: 0, errors: ['No staff members configured for notifications'] }
  }

  // Send email to each staff member
  const results = await Promise.allSettled(
    staff.map(async (staffMember) => {
      const html = generateNewReplyEmail(
        customer.name || customer.email || 'Unknown Customer',
        thread.title,
        message,
        threadId,
        hasAttachments
      )

      const emailSubject = thread.urgent
        ? `🚨 URGENT: Customer Reply - ${thread.title}`
        : `Customer Reply - ${thread.title}`

      return sendCustomEmail(staffMember.email, emailSubject, html)
    })
  )

  // Count successes and collect errors
  let notified = 0
  const errors: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      notified++
    } else if (result.status === 'rejected') {
      errors.push(`Failed to notify ${staff[index].email}: ${result.reason}`)
    } else if (result.status === 'fulfilled' && !result.value.success) {
      errors.push(`Failed to notify ${staff[index].email}: ${result.value.error}`)
    }
  })

  console.log(`[Message Notifications] Reply notification: ${notified}/${staff.length} staff notified`)

  return {
    success: notified > 0,
    notified,
    errors,
  }
}
