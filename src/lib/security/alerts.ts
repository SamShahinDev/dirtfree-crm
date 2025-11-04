/**
 * Security Alerts
 *
 * Automated alerting system for critical security events.
 *
 * @module lib/security/alerts
 */

import type { AuditLogEntry } from '@/lib/audit/audit-logger'

/**
 * Alert channels
 */
export type AlertChannel = 'email' | 'webhook' | 'sms' | 'slack'

/**
 * Alert configuration
 */
export interface AlertConfig {
  /**
   * Channels to send alerts to
   */
  channels: AlertChannel[]

  /**
   * Minimum severity to trigger alert
   */
  minSeverity: 'low' | 'medium' | 'high' | 'critical'

  /**
   * Email recipients
   */
  emailRecipients?: string[]

  /**
   * Webhook URL
   */
  webhookUrl?: string

  /**
   * Slack webhook URL
   */
  slackWebhookUrl?: string

  /**
   * SMS recipients
   */
  smsRecipients?: string[]
}

/**
 * Default alert configuration
 */
const DEFAULT_CONFIG: AlertConfig = {
  channels: ['email'],
  minSeverity: 'high',
  emailRecipients: [process.env.SECURITY_EMAIL || 'security@dirtfreecarpet.com'],
  webhookUrl: process.env.SECURITY_WEBHOOK_URL,
  slackWebhookUrl: process.env.SLACK_SECURITY_WEBHOOK_URL,
}

/**
 * Send security alert
 *
 * @param entry - Audit log entry that triggered the alert
 * @param config - Alert configuration (optional)
 *
 * @example
 * ```typescript
 * await sendSecurityAlert({
 *   action: 'suspicious_activity',
 *   severity: 'critical',
 *   userId: user.id,
 *   details: { reason: 'Multiple failed logins' }
 * })
 * ```
 */
export async function sendSecurityAlert(
  entry: AuditLogEntry,
  config: Partial<AlertConfig> = {}
): Promise<void> {
  const alertConfig = { ...DEFAULT_CONFIG, ...config }

  // Check if severity meets threshold
  const severityLevels = { low: 0, medium: 1, high: 2, critical: 3 }
  const entrySeverityLevel = severityLevels[entry.severity]
  const minSeverityLevel = severityLevels[alertConfig.minSeverity]

  if (entrySeverityLevel < minSeverityLevel) {
    return // Below threshold, don't alert
  }

  // Send alerts on configured channels
  const promises: Promise<void>[] = []

  if (alertConfig.channels.includes('email') && alertConfig.emailRecipients) {
    promises.push(sendEmailAlert(entry, alertConfig.emailRecipients))
  }

  if (alertConfig.channels.includes('webhook') && alertConfig.webhookUrl) {
    promises.push(sendWebhookAlert(entry, alertConfig.webhookUrl))
  }

  if (alertConfig.channels.includes('slack') && alertConfig.slackWebhookUrl) {
    promises.push(sendSlackAlert(entry, alertConfig.slackWebhookUrl))
  }

  if (alertConfig.channels.includes('sms') && alertConfig.smsRecipients) {
    promises.push(sendSmsAlert(entry, alertConfig.smsRecipients))
  }

  // Send all alerts in parallel
  await Promise.allSettled(promises)
}

/**
 * Send email alert
 */
async function sendEmailAlert(
  entry: AuditLogEntry,
  recipients: string[]
): Promise<void> {
  try {
    // Format email body
    const subject = `🚨 Security Alert: ${entry.action} (${entry.severity.toUpperCase()})`

    const body = `
Security Alert Notification
============================

Severity: ${entry.severity.toUpperCase()}
Action: ${entry.action}
Status: ${entry.status}
Time: ${new Date().toISOString()}

${entry.userId ? `User ID: ${entry.userId}` : ''}
${entry.customerId ? `Customer ID: ${entry.customerId}` : ''}
${entry.resourceType ? `Resource Type: ${entry.resourceType}` : ''}
${entry.resourceId ? `Resource ID: ${entry.resourceId}` : ''}
${entry.ipAddress ? `IP Address: ${entry.ipAddress}` : ''}
${entry.errorMessage ? `Error: ${entry.errorMessage}` : ''}

Details:
${JSON.stringify(entry.details, null, 2)}

---
This is an automated security alert from Dirt Free CRM.
Please investigate immediately.
    `.trim()

    // TODO: Implement email sending
    // For now, log to console
    console.log('[SECURITY ALERT - EMAIL]', {
      to: recipients,
      subject,
      body,
    })

    // Actual implementation would use a service like SendGrid, SES, etc.
    // await sendEmail({ to: recipients, subject, body })
  } catch (error) {
    console.error('Failed to send email alert:', error)
  }
}

/**
 * Send webhook alert
 */
async function sendWebhookAlert(
  entry: AuditLogEntry,
  webhookUrl: string
): Promise<void> {
  try {
    const payload = {
      alert_type: 'security',
      severity: entry.severity,
      action: entry.action,
      status: entry.status,
      timestamp: new Date().toISOString(),
      user_id: entry.userId,
      customer_id: entry.customerId,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      error_message: entry.errorMessage,
      details: entry.details,
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Alert-Source': 'dirt-free-crm',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`)
    }
  } catch (error) {
    console.error('Failed to send webhook alert:', error)
  }
}

/**
 * Send Slack alert
 */
async function sendSlackAlert(
  entry: AuditLogEntry,
  webhookUrl: string
): Promise<void> {
  try {
    // Format Slack message with colors and formatting
    const color = {
      low: '#36a64f', // Green
      medium: '#ff9800', // Orange
      high: '#ff5722', // Red
      critical: '#d32f2f', // Dark red
    }[entry.severity]

    const emoji = {
      low: ':information_source:',
      medium: ':warning:',
      high: ':rotating_light:',
      critical: ':alert:',
    }[entry.severity]

    const payload = {
      text: `${emoji} *Security Alert: ${entry.action}*`,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Severity',
              value: entry.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Status',
              value: entry.status,
              short: true,
            },
            {
              title: 'Action',
              value: entry.action,
              short: true,
            },
            {
              title: 'Time',
              value: new Date().toISOString(),
              short: true,
            },
            ...(entry.userId
              ? [{ title: 'User ID', value: entry.userId, short: true }]
              : []),
            ...(entry.ipAddress
              ? [{ title: 'IP Address', value: entry.ipAddress, short: true }]
              : []),
            ...(entry.errorMessage
              ? [{ title: 'Error', value: entry.errorMessage, short: false }]
              : []),
          ],
          footer: 'Dirt Free CRM Security',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Slack webhook returned ${response.status}`)
    }
  } catch (error) {
    console.error('Failed to send Slack alert:', error)
  }
}

/**
 * Send SMS alert
 */
async function sendSmsAlert(
  entry: AuditLogEntry,
  recipients: string[]
): Promise<void> {
  try {
    const message = `🚨 Security Alert [${entry.severity.toUpperCase()}]: ${entry.action} at ${new Date().toLocaleTimeString()}. Check your email for details.`

    // TODO: Implement SMS sending
    // For now, log to console
    console.log('[SECURITY ALERT - SMS]', {
      to: recipients,
      message,
    })

    // Actual implementation would use a service like Twilio
    // await sendSms({ to: recipients, message })
  } catch (error) {
    console.error('Failed to send SMS alert:', error)
  }
}

/**
 * Detect suspicious patterns and send alerts
 *
 * This can be called periodically (e.g., via cron job) to detect
 * patterns that span multiple events.
 */
export async function detectAndAlertSuspiciousActivity(): Promise<void> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Get security alerts view
    const { data: alerts, error } = await supabase
      .from('security_alerts')
      .select('*')
      .limit(10)

    if (error) {
      console.error('Error fetching security alerts:', error)
      return
    }

    // Send alert for each suspicious pattern
    for (const alert of alerts || []) {
      await sendSecurityAlert({
        action: 'suspicious_activity',
        userId: alert.user_id,
        status: 'warning',
        severity: 'critical',
        details: {
          pattern: alert.action,
          occurrenceCount: alert.occurrence_count,
          lastOccurrence: alert.last_occurrence,
          ipAddresses: alert.ip_addresses,
          reason: 'Repeated suspicious activity detected',
        },
      } as AuditLogEntry)
    }
  } catch (error) {
    console.error('Error detecting suspicious activity:', error)
  }
}

/**
 * Configure alert thresholds for specific actions
 */
export interface ActionThreshold {
  action: string
  count: number
  windowMinutes: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Default thresholds
 */
export const DEFAULT_THRESHOLDS: ActionThreshold[] = [
  { action: 'login_failed', count: 5, windowMinutes: 5, severity: 'high' },
  { action: 'permission_denied', count: 10, windowMinutes: 10, severity: 'medium' },
  { action: 'rate_limit_exceeded', count: 3, windowMinutes: 5, severity: 'high' },
  { action: 'unauthorized_access_attempt', count: 3, windowMinutes: 5, severity: 'critical' },
  { action: 'pii_accessed', count: 50, windowMinutes: 60, severity: 'medium' },
]

/**
 * Check if action threshold is exceeded
 *
 * @param userId - User ID to check
 * @param action - Action to check
 * @param threshold - Threshold configuration
 * @returns True if threshold exceeded
 */
export async function isThresholdExceeded(
  userId: string,
  action: string,
  threshold: ActionThreshold
): Promise<boolean> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const since = new Date(Date.now() - threshold.windowMinutes * 60 * 1000)

    const { count, error } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('created_at', since.toISOString())

    if (error) {
      console.error('Error checking threshold:', error)
      return false
    }

    return (count || 0) >= threshold.count
  } catch (error) {
    console.error('Failed to check threshold:', error)
    return false
  }
}
