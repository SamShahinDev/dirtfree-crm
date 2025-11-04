/**
 * Portal Notification Service
 *
 * Unified notification system for customer portal.
 * Sends notifications via:
 * - In-app (database)
 * - Email (Resend)
 * - SMS (Twilio)
 *
 * Supports queued delivery and tracking.
 */

import { getServiceSupabase } from '@/lib/supabase/server'
import { sendCustomEmail } from '@/lib/email/service'
import { sendSms } from '@/lib/sms/service'
import type { Database } from '@/types/supabase'

/**
 * Notification type
 */
export type NotificationType =
  | 'appointment_reminder'
  | 'appointment_confirmed'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'technician_on_way'
  | 'service_completed'
  | 'invoice_created'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'payment_received'
  | 'message_reply'
  | 'promotion_available'
  | 'loyalty_reward'
  | 'survey_request'
  | 'general'

/**
 * Notification priority
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * Delivery channel
 */
export type DeliveryChannel = 'in_app' | 'email' | 'sms' | 'all'

/**
 * Notification options
 */
export interface NotificationOptions {
  // Customer
  customerId: string

  // Content
  type: NotificationType
  title: string
  message: string
  priority?: NotificationPriority

  // Action
  actionUrl?: string
  actionLabel?: string

  // Related entities
  jobId?: string
  invoiceId?: string
  threadId?: string

  // Delivery
  channels?: DeliveryChannel[]
  sendEmail?: boolean
  sendSms?: boolean

  // Expiration
  expiresInDays?: number

  // Metadata
  metadata?: Record<string, any>
}

/**
 * Notification result
 */
export interface NotificationResult {
  success: boolean
  notificationId?: string
  errors: string[]
  deliveryStatus: {
    inApp: boolean
    email: boolean
    sms: boolean
  }
}

/**
 * Get customer details for notification delivery
 */
async function getCustomerDetails(customerId: string): Promise<{
  name: string
  email: string
  phone: string | null
} | null> {
  const supabase = getServiceSupabase()

  const { data: customer, error } = await supabase
    .from('customers')
    .select('name, email, phone')
    .eq('id', customerId)
    .single()

  if (error || !customer) {
    console.error('[Portal Notifier] Failed to fetch customer:', error)
    return null
  }

  return customer
}

/**
 * Generate email HTML for notification
 */
function generateNotificationEmail(
  customerName: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionLabel?: string
): string {
  const appUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #1a202c;">
      ${title}
    </h1>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">
      Hi ${customerName},
    </p>
  </div>

  <div style="background-color: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <div style="font-size: 15px; color: #374151; line-height: 1.7; white-space: pre-wrap;">${message}</div>
  </div>

  ${actionUrl ? `
  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${actionUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">${actionLabel || 'View Details'}</a>
  </div>
  ` : ''}

  <div style="text-align: center; margin-bottom: 16px;">
    <a href="${appUrl}" style="display: inline-block; color: #6b7280; text-decoration: none; font-size: 14px;">Go to Customer Portal →</a>
  </div>

  <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
    <p style="margin: 0;">This is an automated notification from ${process.env.COMPANY_NAME || 'Dirt Free Carpet'}.</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generate SMS message for notification
 */
function generateNotificationSms(
  title: string,
  message: string,
  actionUrl?: string
): string {
  const companyName = process.env.COMPANY_NAME || 'Dirt Free Carpet'

  // SMS character limit: keep it under 160 characters if possible
  let smsMessage = `${companyName}: ${title}\n\n${message}`

  // Truncate message if too long
  if (smsMessage.length > 140 && actionUrl) {
    smsMessage = smsMessage.substring(0, 137) + '...'
  }

  // Add action URL if provided and space permits
  if (actionUrl && smsMessage.length + actionUrl.length + 5 < 160) {
    smsMessage += `\n\n${actionUrl}`
  }

  return smsMessage
}

/**
 * Create in-app notification
 */
async function createInAppNotification(options: NotificationOptions): Promise<{
  success: boolean
  notificationId?: string
  error?: string
}> {
  const supabase = getServiceSupabase()

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { data: notification, error } = await supabase
    .from('portal_notifications')
    .insert({
      customer_id: options.customerId,
      type: options.type,
      title: options.title,
      message: options.message,
      priority: options.priority || 'normal',
      action_url: options.actionUrl || null,
      action_label: options.actionLabel || null,
      job_id: options.jobId || null,
      invoice_id: options.invoiceId || null,
      thread_id: options.threadId || null,
      expires_at: expiresAt,
      metadata: options.metadata || {},
      is_read: false,
      email_sent: false,
      sms_sent: false,
    })
    .select('id')
    .single()

  if (error || !notification) {
    console.error('[Portal Notifier] Failed to create in-app notification:', error)
    return { success: false, error: error?.message || 'Failed to create notification' }
  }

  return { success: true, notificationId: notification.id }
}

/**
 * Update notification delivery status
 */
async function updateDeliveryStatus(
  notificationId: string,
  channel: 'email' | 'sms',
  success: boolean
): Promise<void> {
  const supabase = getServiceSupabase()

  const updates: any = {}

  if (channel === 'email') {
    updates.email_sent = success
    updates.email_sent_at = success ? new Date().toISOString() : null
  } else if (channel === 'sms') {
    updates.sms_sent = success
    updates.sms_sent_at = success ? new Date().toISOString() : null
  }

  await supabase
    .from('portal_notifications')
    .update(updates)
    .eq('id', notificationId)
}

/**
 * Send notification via email
 */
async function sendEmailNotification(
  customer: { name: string; email: string },
  title: string,
  message: string,
  actionUrl?: string,
  actionLabel?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = generateNotificationEmail(
      customer.name || customer.email,
      title,
      message,
      actionUrl,
      actionLabel
    )

    const result = await sendCustomEmail(customer.email, title, html)

    return {
      success: result.success,
      error: result.error,
    }
  } catch (error) {
    console.error('[Portal Notifier] Email send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

/**
 * Send notification via SMS
 */
async function sendSmsNotification(
  customer: { phone: string; name: string },
  customerId: string,
  title: string,
  message: string,
  actionUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!customer.phone) {
      return { success: false, error: 'No phone number available' }
    }

    const smsMessage = generateNotificationSms(title, message, actionUrl)

    const result = await sendSms({
      to: customer.phone,
      message: smsMessage,
      customerId,
    })

    return {
      success: result.success,
      error: result.error,
    }
  } catch (error) {
    console.error('[Portal Notifier] SMS send error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    }
  }
}

/**
 * Send notification to customer portal
 *
 * Main entry point for sending notifications.
 * Creates in-app notification and optionally sends email/SMS.
 */
export async function sendPortalNotification(
  options: NotificationOptions
): Promise<NotificationResult> {
  const errors: string[] = []
  const deliveryStatus = {
    inApp: false,
    email: false,
    sms: false,
  }

  // Get customer details
  const customer = await getCustomerDetails(options.customerId)
  if (!customer) {
    return {
      success: false,
      errors: ['Customer not found'],
      deliveryStatus,
    }
  }

  // Determine which channels to use
  const channels = options.channels || ['in_app']
  const shouldSendEmail = options.sendEmail !== false && (channels.includes('email') || channels.includes('all'))
  const shouldSendSms = options.sendSms !== false && (channels.includes('sms') || channels.includes('all'))

  // Create in-app notification (always)
  const inAppResult = await createInAppNotification(options)

  if (!inAppResult.success) {
    errors.push(inAppResult.error || 'Failed to create in-app notification')
    return {
      success: false,
      errors,
      deliveryStatus,
    }
  }

  deliveryStatus.inApp = true
  const notificationId = inAppResult.notificationId!

  // Send email notification
  if (shouldSendEmail) {
    const emailResult = await sendEmailNotification(
      customer,
      options.title,
      options.message,
      options.actionUrl,
      options.actionLabel
    )

    deliveryStatus.email = emailResult.success

    if (!emailResult.success) {
      errors.push(`Email: ${emailResult.error || 'Failed to send'}`)
    }

    // Update delivery status in database
    await updateDeliveryStatus(notificationId, 'email', emailResult.success)
  }

  // Send SMS notification
  if (shouldSendSms) {
    const smsResult = await sendSmsNotification(
      { phone: customer.phone || '', name: customer.name },
      options.customerId,
      options.title,
      options.message,
      options.actionUrl
    )

    deliveryStatus.sms = smsResult.success

    if (!smsResult.success) {
      errors.push(`SMS: ${smsResult.error || 'Failed to send'}`)
    }

    // Update delivery status in database
    await updateDeliveryStatus(notificationId, 'sms', smsResult.success)
  }

  return {
    success: deliveryStatus.inApp,
    notificationId,
    errors,
    deliveryStatus,
  }
}

/**
 * Convenience functions for common notification types
 */

export async function sendAppointmentReminder(params: {
  customerId: string
  jobId: string
  appointmentDate: string
  appointmentTime: string
  serviceType: string
  sendEmail?: boolean
  sendSms?: boolean
}): Promise<NotificationResult> {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || ''

  return sendPortalNotification({
    customerId: params.customerId,
    type: 'appointment_reminder',
    title: 'Appointment Reminder',
    message: `Your ${params.serviceType} appointment is scheduled for ${params.appointmentDate} at ${params.appointmentTime}.`,
    priority: 'high',
    actionUrl: `${portalUrl}/appointments`,
    actionLabel: 'View Appointment',
    jobId: params.jobId,
    channels: ['in_app', 'email', 'sms'],
    sendEmail: params.sendEmail,
    sendSms: params.sendSms,
    expiresInDays: 1,
  })
}

export async function sendInvoiceDue(params: {
  customerId: string
  invoiceId: string
  invoiceNumber: string
  amount: number
  dueDate: string
  sendEmail?: boolean
}): Promise<NotificationResult> {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || ''

  return sendPortalNotification({
    customerId: params.customerId,
    type: 'invoice_due',
    title: `Invoice ${params.invoiceNumber} Due`,
    message: `Your invoice #${params.invoiceNumber} for $${params.amount.toFixed(2)} is due on ${params.dueDate}. Click below to view and pay.`,
    priority: 'high',
    actionUrl: `${portalUrl}/invoices/${params.invoiceId}`,
    actionLabel: 'Pay Invoice',
    invoiceId: params.invoiceId,
    channels: ['in_app', 'email'],
    sendEmail: params.sendEmail,
    expiresInDays: 30,
  })
}

export async function sendMessageReply(params: {
  customerId: string
  threadId: string
  threadTitle: string
  staffName: string
  sendEmail?: boolean
}): Promise<NotificationResult> {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || ''

  return sendPortalNotification({
    customerId: params.customerId,
    type: 'message_reply',
    title: 'New Message Reply',
    message: `${params.staffName} replied to your message: "${params.threadTitle}"`,
    priority: 'normal',
    actionUrl: `${portalUrl}/messages/${params.threadId}`,
    actionLabel: 'View Message',
    threadId: params.threadId,
    channels: ['in_app', 'email'],
    sendEmail: params.sendEmail,
    expiresInDays: 7,
  })
}

export async function sendPromotionAvailable(params: {
  customerId: string
  promotionTitle: string
  promotionDetails: string
  expiresInDays?: number
}): Promise<NotificationResult> {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || ''

  return sendPortalNotification({
    customerId: params.customerId,
    type: 'promotion_available',
    title: params.promotionTitle,
    message: params.promotionDetails,
    priority: 'normal',
    actionUrl: `${portalUrl}/promotions`,
    actionLabel: 'View Promotion',
    channels: ['in_app', 'email'],
    expiresInDays: params.expiresInDays || 30,
  })
}
