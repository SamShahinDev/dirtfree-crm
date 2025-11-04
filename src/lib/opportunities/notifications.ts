/**
 * Opportunity Notification Library
 *
 * Handles all notification triggers for opportunity management:
 * 1. New Opportunity Created
 * 2. Follow-up Due Today
 * 3. Follow-up Overdue
 * 4. Offer Claimed
 * 5. Opportunity Expiring Soon
 */

import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { sendSms } from '@/lib/sms/service'

// ============================================================================
// Types
// ============================================================================

interface NotificationPreferences {
  user_id: string
  notify_new_opportunity_assigned: boolean
  notify_follow_up_due_today: boolean
  notify_follow_up_overdue: boolean
  notify_offer_claimed: boolean
  notify_opportunity_expiring: boolean
  email_notifications: boolean
  sms_notifications: boolean
  portal_notifications: boolean
  reminder_time: string
  overdue_escalation_days: number
  expiring_warning_days: number
}

interface NotificationResult {
  success: boolean
  emailSent?: boolean
  smsSent?: boolean
  portalSent?: boolean
  error?: string
}

// ============================================================================
// 1. New Opportunity Created Notification
// ============================================================================

export async function notifyNewOpportunityAssigned(
  opportunityId: string,
  assignedUserId: string,
  customerName: string,
  opportunityType: string,
  estimatedValue?: number
): Promise<NotificationResult> {
  try {
    const supabase = await createClient()

    // Get user preferences
    const { data: prefs } = await (supabase as any)
      .rpc('get_user_notification_preferences', { p_user_id: assignedUserId })
      .single()

    if (!prefs || !(prefs as any).notify_new_opportunity_assigned) {
      return { success: true, emailSent: false, smsSent: false, portalSent: false }
    }

    const preferences = prefs as unknown as NotificationPreferences

    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('email, phone, full_name')
      .eq('id', assignedUserId)
      .single()

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const userDetails = user as any
    const results: NotificationResult = { success: true }

    // Portal Notification
    if (preferences.portal_notifications) {
      await supabase.from('notifications').insert({
        user_id: assignedUserId,
        type: 'opportunity_assigned',
        title: 'New Opportunity Assigned',
        message: `${customerName} has been identified as a ${opportunityType.replace('_', ' ')} opportunity${estimatedValue ? ` worth $${estimatedValue.toFixed(2)}` : ''}.`,
        link: `/dashboard/opportunities/${opportunityId}`,
        metadata: {
          opportunity_id: opportunityId,
          customer_name: customerName,
          opportunity_type: opportunityType,
          estimated_value: estimatedValue,
        } as any,
      } as any)
      results.portalSent = true
    }

    // Email Notification
    if (preferences.email_notifications && userDetails.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">New Opportunity Assigned</h1>
          </div>

          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi ${userDetails.full_name},
            </p>

            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              A new opportunity has been assigned to you:
            </p>

            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 20px;">
              <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Customer:</strong> ${customerName}</p>
              <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Type:</strong> ${opportunityType.replace('_', ' ')}</p>
              ${estimatedValue ? `<p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Est. Value:</strong> $${estimatedValue.toFixed(2)}</p>` : ''}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/${opportunityId}"
                 style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Opportunity
              </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Don't let this opportunity slip away! Review the details and schedule a follow-up.
            </p>
          </div>
        </div>
      `

      await sendEmail({
        to: userDetails.email,
        subject: `New Opportunity: ${customerName}`,
        html: emailHtml,
      })
      results.emailSent = true
    }

    // SMS Notification
    if (preferences.sms_notifications && userDetails.phone) {
      const smsMessage = `New opportunity assigned! ${customerName} - ${opportunityType.replace('_', ' ')}${estimatedValue ? ` ($${estimatedValue.toFixed(2)})` : ''}. View details: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/${opportunityId}`

      await sendSms({
        to: userDetails.phone,
        message: smsMessage,
      })
      results.smsSent = true
    }

    return results
  } catch (error) {
    console.error('[Notifications] New opportunity error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ============================================================================
// 2. Follow-up Due Today Notification
// ============================================================================

export async function notifyFollowUpDueToday(
  userId: string,
  opportunities: Array<{
    id: string
    customer_name: string
    opportunity_type: string
    follow_up_scheduled_date: string
  }>
): Promise<NotificationResult> {
  try {
    const supabase = await createClient()

    // Get user preferences
    const { data: prefs } = await (supabase as any)
      .rpc('get_user_notification_preferences', { p_user_id: userId })
      .single()

    if (!prefs || !(prefs as any).notify_follow_up_due_today) {
      return { success: true, emailSent: false, smsSent: false, portalSent: false }
    }

    const preferences = prefs as unknown as NotificationPreferences

    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('email, phone, full_name')
      .eq('id', userId)
      .single()

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const userDetails = user as any
    const results: NotificationResult = { success: true }
    const count = opportunities.length

    // Portal Notification
    if (preferences.portal_notifications) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'follow_up_due',
        title: `${count} Follow-up${count > 1 ? 's' : ''} Due Today`,
        message: `You have ${count} opportunity follow-up${count > 1 ? 's' : ''} scheduled for today.`,
        link: '/dashboard/opportunities/follow-ups?tab=today',
        metadata: {
          opportunity_count: count,
          opportunity_ids: opportunities.map((o) => o.id),
        } as any,
      } as any)
      results.portalSent = true
    }

    // Email Notification
    if (preferences.email_notifications && userDetails.email) {
      const opportunityList = opportunities
        .map(
          (opp) =>
            `<li style="margin: 10px 0; color: #374151;">
              <strong>${opp.customer_name}</strong> - ${opp.opportunity_type.replace('_', ' ')}
            </li>`
        )
        .join('')

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Follow-ups Due Today</h1>
          </div>

          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Good morning ${userDetails.full_name},
            </p>

            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              You have <strong>${count}</strong> opportunity follow-up${count > 1 ? 's' : ''} scheduled for today:
            </p>

            <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${opportunityList}
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/follow-ups?tab=today"
                 style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Today's Follow-ups
              </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              Stay on top of your opportunities! Timely follow-ups lead to better conversion rates.
            </p>
          </div>
        </div>
      `

      await sendEmail({
        to: userDetails.email,
        subject: `📅 ${count} Follow-up${count > 1 ? 's' : ''} Due Today`,
        html: emailHtml,
      })
      results.emailSent = true
    }

    // SMS Notification
    if (preferences.sms_notifications && userDetails.phone) {
      const smsMessage = `Reminder: You have ${count} opportunity follow-up${count > 1 ? 's' : ''} due today. View them at ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/follow-ups`

      await sendSms({
        to: userDetails.phone,
        message: smsMessage,
      })
      results.smsSent = true
    }

    return results
  } catch (error) {
    console.error('[Notifications] Follow-up due today error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ============================================================================
// 3. Follow-up Overdue Notification
// ============================================================================

export async function notifyFollowUpOverdue(
  userId: string,
  opportunities: Array<{
    id: string
    customer_name: string
    opportunity_type: string
    follow_up_scheduled_date: string
    days_overdue: number
  }>,
  escalateToManager: boolean = false,
  managerId?: string
): Promise<NotificationResult> {
  try {
    const supabase = await createClient()

    // Get user preferences
    const { data: prefs } = await (supabase as any)
      .rpc('get_user_notification_preferences', { p_user_id: userId })
      .single()

    if (!prefs || !(prefs as any).notify_follow_up_overdue) {
      return { success: true, emailSent: false, smsSent: false, portalSent: false }
    }

    const preferences = prefs as unknown as NotificationPreferences

    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('email, phone, full_name')
      .eq('id', userId)
      .single()

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const userDetails = user as any
    const results: NotificationResult = { success: true }
    const count = opportunities.length
    const maxDaysOverdue = Math.max(...opportunities.map((o) => o.days_overdue))

    // Portal Notification
    if (preferences.portal_notifications) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'follow_up_overdue',
        title: `⚠️ ${count} Overdue Follow-up${count > 1 ? 's' : ''}`,
        message: `You have ${count} overdue opportunity follow-up${count > 1 ? 's' : ''}. The oldest is ${maxDaysOverdue} day${maxDaysOverdue > 1 ? 's' : ''} overdue.`,
        link: '/dashboard/opportunities/follow-ups?tab=overdue',
        metadata: {
          opportunity_count: count,
          max_days_overdue: maxDaysOverdue,
          opportunity_ids: opportunities.map((o) => o.id),
        } as any,
      } as any)
      results.portalSent = true
    }

    // Email Notification
    if (preferences.email_notifications && userDetails.email) {
      const opportunityList = opportunities
        .map(
          (opp) =>
            `<li style="margin: 10px 0; color: #374151;">
              <strong>${opp.customer_name}</strong> - ${opp.opportunity_type.replace('_', ' ')}
              <span style="color: #dc2626; font-weight: 600;">(${opp.days_overdue} day${opp.days_overdue > 1 ? 's' : ''} overdue)</span>
            </li>`
        )
        .join('')

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">⚠️ Overdue Follow-ups</h1>
          </div>

          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi ${userDetails.full_name},
            </p>

            <p style="font-size: 16px; color: #dc2626; font-weight: 600; margin-bottom: 20px;">
              You have <strong>${count}</strong> overdue opportunity follow-up${count > 1 ? 's' : ''}:
            </p>

            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin-bottom: 20px;">
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${opportunityList}
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/follow-ups?tab=overdue"
                 style="display: inline-block; background: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Overdue Follow-ups
              </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              ⏰ <strong>Action Required:</strong> These opportunities need immediate attention to prevent them from going cold.
            </p>
          </div>
        </div>
      `

      await sendEmail({
        to: userDetails.email,
        subject: `⚠️ ${count} Overdue Follow-up${count > 1 ? 's' : ''} - Action Required`,
        html: emailHtml,
      })
      results.emailSent = true
    }

    // SMS Notification
    if (preferences.sms_notifications && userDetails.phone) {
      const smsMessage = `URGENT: ${count} overdue opportunity follow-up${count > 1 ? 's' : ''}! View now: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/follow-ups`

      await sendSms({
        to: userDetails.phone,
        message: smsMessage,
      })
      results.smsSent = true
    }

    // Escalate to Manager if needed
    if (escalateToManager && managerId && maxDaysOverdue >= preferences.overdue_escalation_days) {
      await notifyManagerOfOverdueFollowUps(managerId, userId, userDetails.full_name, opportunities)
    }

    return results
  } catch (error) {
    console.error('[Notifications] Follow-up overdue error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Helper: Notify manager of overdue follow-ups
async function notifyManagerOfOverdueFollowUps(
  managerId: string,
  staffId: string,
  staffName: string,
  opportunities: Array<any>
): Promise<void> {
  try {
    const supabase = await createClient()

    const { data: manager } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', managerId)
      .single()

    if (!manager) return

    const managerDetails = manager as any
    const count = opportunities.length
    const maxDaysOverdue = Math.max(...opportunities.map((o) => o.days_overdue))

    // Portal notification to manager
    await supabase.from('notifications').insert({
      user_id: managerId,
      type: 'staff_overdue_escalation',
      title: `Staff Follow-ups Overdue`,
      message: `${staffName} has ${count} overdue follow-up${count > 1 ? 's' : ''} (up to ${maxDaysOverdue} days overdue).`,
      link: `/dashboard/opportunities/follow-ups?assignedTo=${staffId}&tab=overdue`,
      metadata: {
        staff_id: staffId,
        staff_name: staffName,
        opportunity_count: count,
        max_days_overdue: maxDaysOverdue,
      } as any,
    } as any)

    // Email to manager
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Staff Escalation Alert</h1>
        </div>

        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Hi ${managerDetails.full_name},
          </p>

          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            <strong>${staffName}</strong> has ${count} overdue opportunity follow-up${count > 1 ? 's' : ''} that require attention.
          </p>

          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
            <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Staff Member:</strong> ${staffName}</p>
            <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Overdue Follow-ups:</strong> ${count}</p>
            <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Longest Overdue:</strong> ${maxDaysOverdue} day${maxDaysOverdue > 1 ? 's' : ''}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/follow-ups?assignedTo=${staffId}&tab=overdue"
               style="display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Review Staff Follow-ups
            </a>
          </div>

          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            Please follow up with ${staffName} to ensure these opportunities don't go cold.
          </p>
        </div>
      </div>
    `

    await sendEmail({
      to: managerDetails.email,
      subject: `Escalation: ${staffName} has ${count} overdue follow-up${count > 1 ? 's' : ''}`,
      html: emailHtml,
    })
  } catch (error) {
    console.error('[Notifications] Manager escalation error:', error)
  }
}

// ============================================================================
// 4. Offer Claimed Notification
// ============================================================================

export async function notifyOfferClaimed(
  opportunityId: string,
  assignedUserId: string,
  customerName: string,
  offerCode: string,
  offerPercentage: number
): Promise<NotificationResult> {
  try {
    const supabase = await createClient()

    // Get user preferences
    const { data: prefs } = await (supabase as any)
      .rpc('get_user_notification_preferences', { p_user_id: assignedUserId })
      .single()

    if (!prefs || !(prefs as any).notify_offer_claimed) {
      return { success: true, emailSent: false, smsSent: false, portalSent: false }
    }

    const preferences = prefs as unknown as NotificationPreferences

    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('email, phone, full_name')
      .eq('id', assignedUserId)
      .single()

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const userDetails = user as any
    const results: NotificationResult = { success: true }

    // Portal Notification
    if (preferences.portal_notifications) {
      await supabase.from('notifications').insert({
        user_id: assignedUserId,
        type: 'offer_claimed',
        title: '🎉 Customer Claimed Offer!',
        message: `${customerName} has claimed their ${offerPercentage}% discount offer (${offerCode}). Follow up now to close the deal!`,
        link: `/dashboard/opportunities/${opportunityId}`,
        metadata: {
          opportunity_id: opportunityId,
          customer_name: customerName,
          offer_code: offerCode,
          offer_percentage: offerPercentage,
        } as any,
      } as any)
      results.portalSent = true
    }

    // Email Notification
    if (preferences.email_notifications && userDetails.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">🎉 Offer Claimed!</h1>
          </div>

          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Great news ${userDetails.full_name}!
            </p>

            <p style="font-size: 18px; color: #10b981; font-weight: 600; margin-bottom: 20px;">
              ${customerName} has claimed their offer!
            </p>

            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 20px;">
              <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Customer:</strong> ${customerName}</p>
              <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Offer Code:</strong> ${offerCode}</p>
              <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Discount:</strong> ${offerPercentage}%</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/${opportunityId}"
                 style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Opportunity
              </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              ⚡ <strong>Hot Lead Alert!</strong> The customer is interested - follow up immediately to close this deal!
            </p>
          </div>
        </div>
      `

      await sendEmail({
        to: userDetails.email,
        subject: `🎉 ${customerName} Claimed Your Offer!`,
        html: emailHtml,
      })
      results.emailSent = true
    }

    // SMS Notification
    if (preferences.sms_notifications && userDetails.phone) {
      const smsMessage = `🎉 HOT LEAD! ${customerName} just claimed their ${offerPercentage}% offer. Follow up now: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/${opportunityId}`

      await sendSms({
        to: userDetails.phone,
        message: smsMessage,
      })
      results.smsSent = true
    }

    return results
  } catch (error) {
    console.error('[Notifications] Offer claimed error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ============================================================================
// 5. Opportunity Expiring Soon Notification
// ============================================================================

export async function notifyOpportunityExpiring(
  opportunityId: string,
  assignedUserId: string,
  customerName: string,
  offerCode: string,
  daysUntilExpiry: number
): Promise<NotificationResult> {
  try {
    const supabase = await createClient()

    // Get user preferences
    const { data: prefs } = await (supabase as any)
      .rpc('get_user_notification_preferences', { p_user_id: assignedUserId })
      .single()

    if (!prefs || !(prefs as any).notify_opportunity_expiring) {
      return { success: true, emailSent: false, smsSent: false, portalSent: false }
    }

    const preferences = prefs as unknown as NotificationPreferences

    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('email, phone, full_name')
      .eq('id', assignedUserId)
      .single()

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const userDetails = user as any
    const results: NotificationResult = { success: true }

    // Portal Notification
    if (preferences.portal_notifications) {
      await supabase.from('notifications').insert({
        user_id: assignedUserId,
        type: 'opportunity_expiring',
        title: `⏰ Offer Expiring in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? 's' : ''}`,
        message: `${customerName}'s offer (${offerCode}) expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}. Follow up before it's too late!`,
        link: `/dashboard/opportunities/${opportunityId}`,
        metadata: {
          opportunity_id: opportunityId,
          customer_name: customerName,
          offer_code: offerCode,
          days_until_expiry: daysUntilExpiry,
        } as any,
      } as any)
      results.portalSent = true
    }

    // Email Notification
    if (preferences.email_notifications && userDetails.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">⏰ Offer Expiring Soon</h1>
          </div>

          <div style="padding: 30px; background: #f9fafb;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi ${userDetails.full_name},
            </p>

            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              An opportunity offer is about to expire:
            </p>

            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
              <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Customer:</strong> ${customerName}</p>
              <p style="margin: 5px 0; color: #6b7280;"><strong style="color: #111827;">Offer Code:</strong> ${offerCode}</p>
              <p style="margin: 5px 0; color: #f59e0b; font-weight: 600; font-size: 18px;"><strong style="color: #111827;">Expires in:</strong> ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/${opportunityId}"
                 style="display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Opportunity
              </a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              ⚠️ <strong>Time Sensitive:</strong> Reach out to ${customerName} before this offer expires to maximize your chances of conversion.
            </p>
          </div>
        </div>
      `

      await sendEmail({
        to: userDetails.email,
        subject: `⏰ Offer Expiring in ${daysUntilExpiry} Day${daysUntilExpiry > 1 ? 's' : ''}: ${customerName}`,
        html: emailHtml,
      })
      results.emailSent = true
    }

    // SMS Notification
    if (preferences.sms_notifications && userDetails.phone) {
      const smsMessage = `⏰ ${customerName}'s offer expires in ${daysUntilExpiry} day${daysUntilExpiry > 1 ? 's' : ''}! Follow up: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/opportunities/${opportunityId}`

      await sendSms({
        to: userDetails.phone,
        message: smsMessage,
      })
      results.smsSent = true
    }

    return results
  } catch (error) {
    console.error('[Notifications] Opportunity expiring error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
