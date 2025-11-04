import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Communication Preference Checker
 *
 * Utilities to check if customer allows specific communication types.
 * Enforces opt-out compliance with CAN-SPAM, TCPA, and GDPR.
 *
 * Usage:
 * const checker = new CommunicationPreferenceChecker()
 * const result = await checker.canSendEmail(customerId, 'marketing')
 * if (result.allowed) {
 *   // Send email
 * } else {
 *   console.log('Blocked:', result.reason)
 * }
 */

export type CommunicationChannel = 'email' | 'sms' | 'phone' | 'portal'
export type MessageType = 'marketing' | 'appointment' | 'service' | 'promotional' | 'billing' | 'survey'

export interface CommunicationCheckResult {
  allowed: boolean
  reason: string
  preferences?: CustomerCommunicationPreferences
}

export interface CustomerCommunicationPreferences {
  id: string
  customerId: string
  emailEnabled: boolean
  smsEnabled: boolean
  portalNotificationsEnabled: boolean
  phoneCallsEnabled: boolean
  marketingEmails: boolean
  appointmentReminders: boolean
  serviceUpdates: boolean
  promotionalMessages: boolean
  billingNotifications: boolean
  surveyRequests: boolean
  preferredContactMethod: CommunicationChannel | null
  preferredContactTime: string | null
  languagePreference: string
  timezone: string | null
  doNotContact: boolean
  optedOutAt: string | null
  optOutReason: string | null
  maxMessagesPerWeek: number
  quietHoursStart: string | null
  quietHoursEnd: string | null
  createdAt: string
  updatedAt: string
}

export interface PreferenceViolation {
  customerId: string
  violationType: string
  attemptedChannel: CommunicationChannel
  attemptedMessageType?: MessageType
  blocked: boolean
  staffUserId?: string
  details?: Record<string, any>
}

export class CommunicationPreferenceChecker {
  /**
   * Check if a specific type of communication is allowed for a customer
   */
  async checkCommunicationAllowed(
    customerId: string,
    channel: CommunicationChannel,
    messageType?: MessageType
  ): Promise<CommunicationCheckResult> {
    try {
      const supabase = getServiceSupabase()

      // Use database function for consistent checking
      const { data, error } = await (supabase as any).rpc('check_communication_allowed', {
        p_customer_id: customerId,
        p_channel: channel,
        p_message_type: messageType || null,
      })

      if (error) {
        console.error('[PreferenceChecker] Error checking communication:', error)
        // Fail closed - don't allow if we can't check
        return {
          allowed: false,
          reason: 'Unable to verify communication preferences',
        }
      }

      const result = Array.isArray(data) && data.length > 0 ? data[0] : { allowed: false, reason: 'Unknown error' }

      // If not allowed, log the violation
      if (!result.allowed) {
        await this.logViolation({
          customerId,
          violationType: this.getViolationType(result.reason),
          attemptedChannel: channel,
          attemptedMessageType: messageType,
          blocked: true,
        })
      }

      return {
        allowed: result.allowed,
        reason: result.reason,
      }
    } catch (error) {
      console.error('[PreferenceChecker] Exception checking communication:', error)
      // Fail closed
      return {
        allowed: false,
        reason: 'System error checking preferences',
      }
    }
  }

  /**
   * Check if email is allowed
   */
  async canSendEmail(
    customerId: string,
    messageType?: MessageType
  ): Promise<CommunicationCheckResult> {
    return this.checkCommunicationAllowed(customerId, 'email', messageType)
  }

  /**
   * Check if SMS is allowed
   */
  async canSendSMS(
    customerId: string,
    messageType?: MessageType
  ): Promise<CommunicationCheckResult> {
    return this.checkCommunicationAllowed(customerId, 'sms', messageType)
  }

  /**
   * Check if phone call is allowed
   */
  async canMakePhoneCall(
    customerId: string,
    messageType?: MessageType
  ): Promise<CommunicationCheckResult> {
    return this.checkCommunicationAllowed(customerId, 'phone', messageType)
  }

  /**
   * Check if portal notification is allowed
   */
  async canSendPortalNotification(
    customerId: string,
    messageType?: MessageType
  ): Promise<CommunicationCheckResult> {
    return this.checkCommunicationAllowed(customerId, 'portal', messageType)
  }

  /**
   * Get customer communication preferences
   */
  async getPreferences(customerId: string): Promise<CustomerCommunicationPreferences | null> {
    try {
      const supabase = getServiceSupabase()

      const { data, error } = await supabase
        .from('customer_communication_preferences')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      if (error || !data) {
        return null
      }

      return this.transformPreferences(data)
    } catch (error) {
      console.error('[PreferenceChecker] Error getting preferences:', error)
      return null
    }
  }

  /**
   * Check multiple channels at once
   */
  async checkMultipleChannels(
    customerId: string,
    channels: CommunicationChannel[],
    messageType?: MessageType
  ): Promise<Record<CommunicationChannel, CommunicationCheckResult>> {
    const results: Partial<Record<CommunicationChannel, CommunicationCheckResult>> = {}

    await Promise.all(
      channels.map(async (channel) => {
        results[channel] = await this.checkCommunicationAllowed(customerId, channel, messageType)
      })
    )

    return results as Record<CommunicationChannel, CommunicationCheckResult>
  }

  /**
   * Get allowed channels for a customer
   */
  async getAllowedChannels(
    customerId: string,
    messageType?: MessageType
  ): Promise<CommunicationChannel[]> {
    const allChannels: CommunicationChannel[] = ['email', 'sms', 'phone', 'portal']
    const results = await this.checkMultipleChannels(customerId, allChannels, messageType)

    return allChannels.filter((channel) => results[channel]?.allowed)
  }

  /**
   * Check if customer is within quiet hours
   */
  async isWithinQuietHours(customerId: string): Promise<boolean> {
    try {
      const preferences = await this.getPreferences(customerId)

      if (!preferences || !preferences.quietHoursStart || !preferences.quietHoursEnd) {
        return false // No quiet hours set
      }

      const now = new Date()
      const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

      const quietStart = preferences.quietHoursStart
      const quietEnd = preferences.quietHoursEnd

      // Handle overnight quiet hours (e.g., 22:00 to 08:00)
      if (quietStart > quietEnd) {
        return currentTime >= quietStart || currentTime <= quietEnd
      }

      // Normal quiet hours (e.g., 12:00 to 14:00)
      return currentTime >= quietStart && currentTime <= quietEnd
    } catch (error) {
      console.error('[PreferenceChecker] Error checking quiet hours:', error)
      return false
    }
  }

  /**
   * Log a preference violation
   */
  async logViolation(violation: PreferenceViolation): Promise<string | null> {
    try {
      const supabase = getServiceSupabase()

      const { data, error } = await (supabase as any).rpc('log_preference_violation', {
        p_customer_id: violation.customerId,
        p_violation_type: violation.violationType,
        p_attempted_channel: violation.attemptedChannel,
        p_attempted_message_type: violation.attemptedMessageType || null,
        p_blocked: violation.blocked,
        p_staff_user_id: violation.staffUserId || null,
        p_details: violation.details ? JSON.stringify(violation.details) : null,
      })

      if (error) {
        console.error('[PreferenceChecker] Error logging violation:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('[PreferenceChecker] Exception logging violation:', error)
      return null
    }
  }

  /**
   * Get preferred contact method for customer
   */
  async getPreferredContactMethod(customerId: string): Promise<CommunicationChannel | null> {
    const preferences = await this.getPreferences(customerId)
    return preferences?.preferredContactMethod || null
  }

  /**
   * Check if customer has hit message frequency limit
   */
  async hasHitFrequencyLimit(customerId: string): Promise<boolean> {
    try {
      const preferences = await this.getPreferences(customerId)

      if (!preferences || !preferences.maxMessagesPerWeek) {
        return false // No limit set
      }

      const supabase = getServiceSupabase()

      // Count messages sent in the last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { data, error } = await (supabase as any).rpc('get_customer_communication_history', {
        p_customer_id: customerId,
        p_limit: 1000,
      })

      if (error || !data) {
        console.error('[PreferenceChecker] Error checking frequency:', error)
        return false // Fail open for counting
      }

      const recentMessages = (data as any[]).filter(
        (msg) => new Date(msg.sent_at) >= sevenDaysAgo
      )

      return recentMessages.length >= preferences.maxMessagesPerWeek
    } catch (error) {
      console.error('[PreferenceChecker] Exception checking frequency limit:', error)
      return false
    }
  }

  /**
   * Transform database preferences to camelCase
   */
  private transformPreferences(data: any): CustomerCommunicationPreferences {
    return {
      id: data.id,
      customerId: data.customer_id,
      emailEnabled: data.email_enabled,
      smsEnabled: data.sms_enabled,
      portalNotificationsEnabled: data.portal_notifications_enabled,
      phoneCallsEnabled: data.phone_calls_enabled,
      marketingEmails: data.marketing_emails,
      appointmentReminders: data.appointment_reminders,
      serviceUpdates: data.service_updates,
      promotionalMessages: data.promotional_messages,
      billingNotifications: data.billing_notifications,
      surveyRequests: data.survey_requests,
      preferredContactMethod: data.preferred_contact_method,
      preferredContactTime: data.preferred_contact_time,
      languagePreference: data.language_preference,
      timezone: data.timezone,
      doNotContact: data.do_not_contact,
      optedOutAt: data.opted_out_at,
      optOutReason: data.opt_out_reason,
      maxMessagesPerWeek: data.max_messages_per_week,
      quietHoursStart: data.quiet_hours_start,
      quietHoursEnd: data.quiet_hours_end,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  /**
   * Get violation type from reason message
   */
  private getViolationType(reason: string): string {
    if (reason.includes('opted out')) return 'do_not_contact'
    if (reason.includes('disabled email')) return 'email_disabled'
    if (reason.includes('disabled SMS')) return 'sms_disabled'
    if (reason.includes('disabled phone')) return 'phone_disabled'
    if (reason.includes('disabled portal')) return 'portal_disabled'
    if (reason.includes('marketing')) return 'marketing_opt_out'
    if (reason.includes('promotional')) return 'promotional_opt_out'
    if (reason.includes('survey')) return 'survey_opt_out'
    return 'unknown'
  }
}

/**
 * Singleton instance for convenience
 */
export const preferenceChecker = new CommunicationPreferenceChecker()

/**
 * Convenience functions
 */

export async function canSendEmail(
  customerId: string,
  messageType?: MessageType
): Promise<boolean> {
  const result = await preferenceChecker.canSendEmail(customerId, messageType)
  return result.allowed
}

export async function canSendSMS(
  customerId: string,
  messageType?: MessageType
): Promise<boolean> {
  const result = await preferenceChecker.canSendSMS(customerId, messageType)
  return result.allowed
}

export async function canMakePhoneCall(
  customerId: string,
  messageType?: MessageType
): Promise<boolean> {
  const result = await preferenceChecker.canMakePhoneCall(customerId, messageType)
  return result.allowed
}

export async function canSendPortalNotification(
  customerId: string,
  messageType?: MessageType
): Promise<boolean> {
  const result = await preferenceChecker.canSendPortalNotification(customerId, messageType)
  return result.allowed
}

export async function getAllowedChannels(
  customerId: string,
  messageType?: MessageType
): Promise<CommunicationChannel[]> {
  return preferenceChecker.getAllowedChannels(customerId, messageType)
}
