/**
 * Unified Notification Service
 *
 * Centralized notification system that works across all platforms
 * (CRM, Portal, Website) with support for multiple delivery channels.
 */

import { getServerSupabase } from '@/lib/supabase/server'
import { Resend } from 'resend'
import twilio from 'twilio'

// Initialize services
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null

export interface NotificationPayload {
  recipientType: 'customer' | 'staff' | 'all_staff' | 'role'
  recipientId?: string
  recipientRole?: string
  title: string
  message: string
  notificationType:
    | 'booking'
    | 'payment'
    | 'message'
    | 'alert'
    | 'promotion'
    | 'system'
    | 'reminder'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  channels: Array<'portal' | 'email' | 'sms' | 'push' | 'crm'>
  emailSubject?: string
  emailBody?: string
  smsBody?: string
  actionUrl?: string
  actionLabel?: string
  metadata?: Record<string, any>
  relatedEntityType?: string
  relatedEntityId?: string
  scheduledFor?: Date
  expiresAt?: Date
}

interface DeliveryResults {
  success: string[]
  failed: Array<{ channel: string; reason: string }>
}

/**
 * Send a notification across specified channels
 */
export async function sendNotification(payload: NotificationPayload) {
  const supabase = await getServerSupabase()

  // Create notification record
  const { data: notification, error } = await supabase
    .from('cross_platform_notifications')
    .insert({
      recipient_type: payload.recipientType,
      recipient_id: payload.recipientId,
      recipient_role: payload.recipientRole,
      title: payload.title,
      message: payload.message,
      notification_type: payload.notificationType,
      priority: payload.priority || 'normal',
      channels: payload.channels,
      email_subject: payload.emailSubject,
      email_body: payload.emailBody,
      sms_body: payload.smsBody,
      action_url: payload.actionUrl,
      action_label: payload.actionLabel,
      metadata: payload.metadata,
      related_entity_type: payload.relatedEntityType,
      related_entity_id: payload.relatedEntityId,
      scheduled_for: payload.scheduledFor?.toISOString(),
      expires_at: payload.expiresAt?.toISOString(),
      sent_at: payload.scheduledFor ? null : new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create notification:', error)
    throw new Error(`Failed to create notification: ${error.message}`)
  }

  // If scheduled for future, don't send now
  if (payload.scheduledFor && payload.scheduledFor > new Date()) {
    return { notification, scheduled: true }
  }

  // Deliver immediately
  const deliveryResults = await deliverNotification(notification)

  // Update delivery status
  await supabase
    .from('cross_platform_notifications')
    .update({
      delivered_channels: deliveryResults.success,
      failed_channels: deliveryResults.failed,
    })
    .eq('id', notification.id)

  return { notification, delivery: deliveryResults }
}

/**
 * Deliver a notification via all specified channels
 */
export async function deliverNotification(
  notification: any
): Promise<DeliveryResults> {
  const results: DeliveryResults = {
    success: [],
    failed: [],
  }

  const supabase = await getServerSupabase()

  // Get recipient details
  let recipientEmail: string | null = null
  let recipientPhone: string | null = null
  let recipientName: string | null = null

  if (notification.recipient_type === 'customer') {
    const { data: customer } = await supabase
      .from('customers')
      .select('email, phone, sms_opt_in, name')
      .eq('id', notification.recipient_id)
      .single()

    if (customer) {
      recipientEmail = customer.email
      recipientPhone = customer.sms_opt_in ? customer.phone : null
      recipientName = customer.name
    }
  } else if (notification.recipient_type === 'staff') {
    const { data: user } = await supabase
      .from('users')
      .select('email, phone, name')
      .eq('id', notification.recipient_id)
      .single()

    if (user) {
      recipientEmail = user.email
      recipientPhone = user.phone
      recipientName = user.name
    }
  } else if (notification.recipient_type === 'all_staff') {
    // For all_staff, we'll send to each staff member individually
    const { data: users } = await supabase
      .from('users')
      .select('id, email, phone, name')
      .eq('active', true)

    if (users && users.length > 0) {
      // Send to each staff member
      for (const user of users) {
        const userNotification = {
          ...notification,
          recipient_type: 'staff',
          recipient_id: user.id,
        }
        await deliverNotification(userNotification)
      }
      results.success.push('crm')
      return results
    }
  } else if (notification.recipient_type === 'role') {
    // For role-based, send to all users with that role
    const { data: users } = await supabase
      .from('users')
      .select('id, email, phone, name')
      .eq('role', notification.recipient_role)
      .eq('active', true)

    if (users && users.length > 0) {
      // Send to each user with the role
      for (const user of users) {
        const userNotification = {
          ...notification,
          recipient_type: 'staff',
          recipient_id: user.id,
        }
        await deliverNotification(userNotification)
      }
      results.success.push('crm')
      return results
    }
  }

  // Deliver via each channel
  for (const channel of notification.channels) {
    try {
      switch (channel) {
        case 'email':
          if (recipientEmail && notification.email_subject && notification.email_body) {
            if (!resend) {
              results.failed.push({
                channel: 'email',
                reason: 'Resend API key not configured',
              })
              break
            }

            await resend.emails.send({
              from: process.env.EMAIL_FROM || 'Dirt Free Carpet <notifications@dirtfreecarpet.com>',
              to: recipientEmail,
              subject: notification.email_subject,
              html: notification.email_body,
            })
            results.success.push('email')
          } else {
            results.failed.push({
              channel: 'email',
              reason: 'Missing recipient email or email content',
            })
          }
          break

        case 'sms':
          if (recipientPhone && notification.sms_body) {
            if (!twilioClient) {
              results.failed.push({
                channel: 'sms',
                reason: 'Twilio credentials not configured',
              })
              break
            }

            await twilioClient.messages.create({
              from: process.env.TWILIO_PHONE_NUMBER,
              to: recipientPhone,
              body: notification.sms_body,
            })
            results.success.push('sms')
          } else {
            results.failed.push({
              channel: 'sms',
              reason: 'Missing recipient phone or SMS content',
            })
          }
          break

        case 'portal':
          // Portal notifications are handled via real-time subscription
          // The notification record itself serves as the portal notification
          results.success.push('portal')
          break

        case 'crm':
          // CRM notifications are handled via real-time subscription
          // The notification record itself serves as the CRM notification
          results.success.push('crm')
          break

        case 'push':
          // TODO: Implement web push notifications
          results.failed.push({ channel: 'push', reason: 'Not implemented yet' })
          break

        default:
          results.failed.push({
            channel,
            reason: `Unknown channel: ${channel}`,
          })
      }
    } catch (error) {
      console.error(`Failed to deliver via ${channel}:`, error)
      results.failed.push({
        channel,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}

/**
 * Send notification using a template
 */
export async function sendNotificationFromTemplate(
  templateKey: string,
  recipientType: NotificationPayload['recipientType'],
  recipientId: string | undefined,
  variables: Record<string, string>,
  options?: {
    recipientRole?: string
    channels?: NotificationPayload['channels']
    priority?: NotificationPayload['priority']
    actionUrl?: string
    actionLabel?: string
    scheduledFor?: Date
    expiresAt?: Date
  }
) {
  const supabase = await getServerSupabase()

  // Get template
  const { data: template, error } = await supabase
    .from('notification_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('active', true)
    .single()

  if (error || !template) {
    throw new Error(`Template not found: ${templateKey}`)
  }

  // Replace variables in templates
  const replaceVariables = (text: string) => {
    let result = text
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }
    return result
  }

  // Build notification payload
  const payload: NotificationPayload = {
    recipientType,
    recipientId,
    recipientRole: options?.recipientRole,
    title: replaceVariables(template.title_template),
    message: replaceVariables(template.message_template),
    notificationType: template.notification_type,
    priority: options?.priority || 'normal',
    channels: options?.channels || template.default_channels,
    emailSubject: template.email_subject_template
      ? replaceVariables(template.email_subject_template)
      : undefined,
    emailBody: template.email_body_template
      ? replaceVariables(template.email_body_template)
      : undefined,
    smsBody: template.sms_body_template
      ? replaceVariables(template.sms_body_template)
      : undefined,
    actionUrl: options?.actionUrl,
    actionLabel: options?.actionLabel,
    metadata: { template_key: templateKey, variables },
    scheduledFor: options?.scheduledFor,
    expiresAt: options?.expiresAt,
  }

  return sendNotification(payload)
}

// ============================================================
// CONVENIENCE FUNCTIONS FOR COMMON NOTIFICATIONS
// ============================================================

/**
 * Notify staff of a new booking
 */
export async function notifyNewBooking(customerId: string, jobId: string, jobDetails: any) {
  return sendNotification({
    recipientType: 'role',
    recipientRole: 'dispatcher',
    title: 'New Booking Received',
    message: `A new booking has been submitted via the website for ${jobDetails.service || 'service'}`,
    notificationType: 'booking',
    priority: 'high',
    channels: ['crm', 'email'],
    emailSubject: 'New Website Booking - Action Required',
    emailBody: `<p>A new booking has been received:</p>
      <ul>
        <li><strong>Customer:</strong> ${jobDetails.customerName}</li>
        <li><strong>Service:</strong> ${jobDetails.service}</li>
        <li><strong>Date:</strong> ${jobDetails.date}</li>
        <li><strong>Time:</strong> ${jobDetails.time}</li>
      </ul>
      <p>Please review and confirm this booking.</p>`,
    actionUrl: `/dashboard/jobs/${jobId}`,
    actionLabel: 'View Booking',
    relatedEntityType: 'job',
    relatedEntityId: jobId,
    metadata: { customer_id: customerId },
  })
}

/**
 * Notify customer of payment received
 */
export async function notifyPaymentReceived(
  customerId: string,
  invoiceId: string,
  amount: number,
  invoiceNumber: string
) {
  return sendNotification({
    recipientType: 'customer',
    recipientId: customerId,
    title: 'Payment Received',
    message: `Your payment of $${amount.toFixed(2)} has been received. Thank you!`,
    notificationType: 'payment',
    channels: ['portal', 'email', 'sms'],
    emailSubject: 'Payment Confirmation - Dirt Free Carpet',
    emailBody: `<p>Thank you for your payment!</p>
      <p>We have received your payment of <strong>$${amount.toFixed(2)}</strong> for invoice #${invoiceNumber}.</p>
      <p>Your account has been updated accordingly.</p>`,
    smsBody: `Payment of $${amount.toFixed(2)} received. Thank you! -Dirt Free`,
    actionUrl: `/invoices/${invoiceId}`,
    actionLabel: 'View Receipt',
    relatedEntityType: 'invoice',
    relatedEntityId: invoiceId,
  })
}

/**
 * Notify customer of message reply
 */
export async function notifyMessageReply(
  customerId: string,
  messageId: string,
  staffName: string,
  messagePreview: string
) {
  return sendNotification({
    recipientType: 'customer',
    recipientId: customerId,
    title: 'New Message',
    message: `${staffName} replied to your message`,
    notificationType: 'message',
    priority: 'high',
    channels: ['portal', 'email', 'sms'],
    emailSubject: `New Message from ${staffName} - Dirt Free Carpet`,
    emailBody: `<p>${staffName} replied to your message:</p>
      <blockquote>${messagePreview}</blockquote>
      <p>Log in to your portal to view the full conversation.</p>`,
    smsBody: `${staffName} replied to your message. Check your portal: ${process.env.NEXT_PUBLIC_PORTAL_URL}`,
    actionUrl: `/messages/${messageId}`,
    actionLabel: 'View Message',
    relatedEntityType: 'message',
    relatedEntityId: messageId,
  })
}

/**
 * Notify customer of promotion
 */
export async function notifyPromotionAvailable(
  customerId: string,
  promotionId: string,
  promotionTitle: string,
  promotionDescription: string
) {
  return sendNotification({
    recipientType: 'customer',
    recipientId: customerId,
    title: 'Special Offer Available!',
    message: `Check out our latest offer: ${promotionTitle}`,
    notificationType: 'promotion',
    channels: ['portal', 'email'],
    emailSubject: `Special Offer: ${promotionTitle} - Dirt Free Carpet`,
    emailBody: `<h2>Special Offer Just for You!</h2>
      <h3>${promotionTitle}</h3>
      <p>${promotionDescription}</p>
      <p>Log in to your portal to learn more and book your service.</p>`,
    actionUrl: `/promotions/${promotionId}`,
    actionLabel: 'View Offer',
    relatedEntityType: 'promotion',
    relatedEntityId: promotionId,
  })
}

/**
 * Notify customer of appointment reminder
 */
export async function notifyAppointmentReminder(
  customerId: string,
  jobId: string,
  appointmentDate: Date,
  serviceName: string,
  address: string
) {
  const dateStr = appointmentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = appointmentDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return sendNotification({
    recipientType: 'customer',
    recipientId: customerId,
    title: 'Appointment Reminder',
    message: `Reminder: You have an appointment tomorrow at ${timeStr}`,
    notificationType: 'reminder',
    channels: ['portal', 'email', 'sms'],
    emailSubject: 'Appointment Reminder - Dirt Free Carpet',
    emailBody: `<p>This is a reminder about your upcoming appointment:</p>
      <ul>
        <li><strong>Date:</strong> ${dateStr}</li>
        <li><strong>Time:</strong> ${timeStr}</li>
        <li><strong>Service:</strong> ${serviceName}</li>
        <li><strong>Address:</strong> ${address}</li>
      </ul>
      <p>We look forward to serving you!</p>`,
    smsBody: `Reminder: Your Dirt Free appointment is tomorrow at ${timeStr}. Reply STOP to opt out.`,
    actionUrl: `/jobs/${jobId}`,
    actionLabel: 'View Appointment',
    relatedEntityType: 'job',
    relatedEntityId: jobId,
    scheduledFor: new Date(appointmentDate.getTime() - 24 * 60 * 60 * 1000), // 24 hours before
  })
}

/**
 * Notify staff of system alert
 */
export async function notifySystemAlert(
  title: string,
  message: string,
  priority: 'low' | 'normal' | 'high' | 'urgent' = 'high',
  targetRole?: string
) {
  return sendNotification({
    recipientType: targetRole ? 'role' : 'all_staff',
    recipientRole: targetRole,
    title,
    message,
    notificationType: 'system',
    priority,
    channels: ['crm', 'email'],
    emailSubject: `System Alert: ${title}`,
    emailBody: `<p><strong>System Alert</strong></p><p>${message}</p>`,
  })
}
