/**
 * Monitoring Alerts
 *
 * Alert system for monitoring metrics and health status.
 *
 * @module lib/monitoring/alerts
 */

import { createClient } from '@/lib/supabase/server'
import { captureError, captureMessage } from '@/lib/errors/tracking'

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical'

/**
 * Alert rule configuration
 */
export interface AlertRule {
  /**
   * Unique name for the alert
   */
  name: string

  /**
   * Condition function that returns true if alert should trigger
   */
  condition: (metrics: SystemMetrics) => boolean

  /**
   * Severity level
   */
  severity: AlertSeverity

  /**
   * Cooldown period in minutes
   */
  cooldown: number

  /**
   * Description of the alert
   */
  description?: string
}

/**
 * System metrics for alert checking
 */
export interface SystemMetrics {
  // Error metrics
  errorRate?: number
  errorCount?: number

  // Performance metrics
  avgResponseTime?: number
  p95ResponseTime?: number
  p99ResponseTime?: number

  // Database metrics
  database?: {
    healthy: boolean
    responseTime?: number
    activeConnections?: number
  }

  // Service health
  services?: Record<string, { healthy: boolean; responseTime?: number }>

  // Resource usage
  memoryUsage?: number
  cpuUsage?: number
  diskUsage?: number

  // Uptime
  uptime?: number
  downtime?: number
}

/**
 * System alert details
 */
export interface SystemAlert {
  name: string
  severity: AlertSeverity
  message: string
  details?: Record<string, any>
  triggeredAt?: string
}

/**
 * Pre-defined alert rules
 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    name: 'High Error Rate',
    condition: (metrics) => (metrics.errorRate || 0) > 5, // 5% error rate
    severity: 'critical',
    cooldown: 15,
    description: 'Error rate exceeds 5%',
  },
  {
    name: 'Slow Response Time',
    condition: (metrics) => (metrics.avgResponseTime || 0) > 2000, // 2 seconds
    severity: 'warning',
    cooldown: 30,
    description: 'Average response time exceeds 2 seconds',
  },
  {
    name: 'Very Slow Response Time',
    condition: (metrics) => (metrics.p95ResponseTime || 0) > 5000, // 5 seconds
    severity: 'critical',
    cooldown: 15,
    description: '95th percentile response time exceeds 5 seconds',
  },
  {
    name: 'Database Connection Issues',
    condition: (metrics) => !metrics.database?.healthy,
    severity: 'critical',
    cooldown: 5,
    description: 'Database is not responding or unhealthy',
  },
  {
    name: 'High Memory Usage',
    condition: (metrics) => (metrics.memoryUsage || 0) > 90, // 90%
    severity: 'warning',
    cooldown: 20,
    description: 'Memory usage exceeds 90%',
  },
  {
    name: 'Critical Memory Usage',
    condition: (metrics) => (metrics.memoryUsage || 0) > 95, // 95%
    severity: 'critical',
    cooldown: 10,
    description: 'Memory usage exceeds 95%',
  },
  {
    name: 'Service Degradation',
    condition: (metrics) => {
      if (!metrics.services) return false
      const degradedServices = Object.values(metrics.services).filter(
        (s) => !s.healthy
      )
      return degradedServices.length > 0
    },
    severity: 'warning',
    cooldown: 15,
    description: 'One or more services are degraded',
  },
  {
    name: 'Multiple Services Down',
    condition: (metrics) => {
      if (!metrics.services) return false
      const downServices = Object.values(metrics.services).filter((s) => !s.healthy)
      return downServices.length >= 2
    },
    severity: 'critical',
    cooldown: 5,
    description: 'Multiple services are down',
  },
]

// Track last alert time for each rule
const lastAlertTime = new Map<string, number>()

/**
 * Check alert rules against current metrics
 *
 * @param metrics - Current system metrics
 * @param rules - Alert rules to check (defaults to DEFAULT_ALERT_RULES)
 * @returns Triggered alerts
 */
export async function checkAlerts(
  metrics: SystemMetrics,
  rules: AlertRule[] = DEFAULT_ALERT_RULES
): Promise<AlertRule[]> {
  const now = Date.now()
  const triggeredAlerts: AlertRule[] = []

  for (const rule of rules) {
    // Check cooldown
    const lastAlert = lastAlertTime.get(rule.name) || 0
    const cooldownMs = rule.cooldown * 60 * 1000

    if (now - lastAlert < cooldownMs) {
      continue
    }

    // Check condition
    try {
      if (rule.condition(metrics)) {
        triggeredAlerts.push(rule)
        lastAlertTime.set(rule.name, now)
      }
    } catch (error) {
      console.error(`Error checking alert rule "${rule.name}":`, error)
      captureError(error as Error, {
        action: 'check_alert_rule',
        severity: 'medium',
        extra: { ruleName: rule.name },
      })
    }
  }

  // Send all triggered alerts
  for (const alert of triggeredAlerts) {
    await sendAlert(alert, metrics)
  }

  return triggeredAlerts
}

/**
 * Send an alert
 *
 * @param rule - Alert rule that was triggered
 * @param metrics - Current metrics
 */
async function sendAlert(rule: AlertRule, metrics: SystemMetrics): Promise<void> {
  try {
    const alert: SystemAlert = {
      name: rule.name,
      severity: rule.severity,
      message: rule.description || rule.name,
      details: {
        metrics,
        timestamp: new Date().toISOString(),
      },
      triggeredAt: new Date().toISOString(),
    }

    // Send system alert
    await sendSystemAlert(alert)

    // Log to Sentry
    captureMessage(`Alert triggered: ${rule.name}`, 'warning', {
      extra: {
        alert: rule,
        metrics,
      },
      tags: {
        alert_name: rule.name,
        severity: rule.severity,
      },
    })

    // Persist to database
    await persistAlert(alert)
  } catch (error) {
    console.error('Failed to send alert:', error)
    captureError(error as Error, {
      action: 'send_alert',
      severity: 'high',
      extra: { alertName: rule.name },
    })
  }
}

/**
 * Send system alert via configured channels
 *
 * @param alert - System alert
 */
export async function sendSystemAlert(alert: SystemAlert): Promise<void> {
  const promises: Promise<void>[] = []

  // Email alert (always send)
  if (process.env.OPS_EMAIL) {
    promises.push(sendEmailAlert(alert))
  }

  // SMS for critical alerts
  if (alert.severity === 'critical' && process.env.OPS_PHONE) {
    promises.push(sendSmsAlert(alert))
  }

  // Slack notification
  if (process.env.SLACK_MONITORING_WEBHOOK_URL) {
    promises.push(sendSlackAlert(alert))
  }

  // Webhook notification
  if (process.env.MONITORING_WEBHOOK_URL) {
    promises.push(sendWebhookAlert(alert))
  }

  await Promise.allSettled(promises)
}

/**
 * Send email alert
 */
async function sendEmailAlert(alert: SystemAlert): Promise<void> {
  try {
    // TODO: Implement email sending
    // For now, log to console
    console.log('[ALERT EMAIL]', {
      to: process.env.OPS_EMAIL,
      subject: `[${alert.severity.toUpperCase()}] ${alert.name}`,
      body: `
Alert: ${alert.name}
Severity: ${alert.severity}
Time: ${alert.triggeredAt || new Date().toISOString()}

${alert.message}

Details:
${JSON.stringify(alert.details, null, 2)}
      `.trim(),
    })

    // Actual implementation would use email service
    // const { Resend } = require('resend')
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({ ... })
  } catch (error) {
    console.error('Failed to send email alert:', error)
  }
}

/**
 * Send SMS alert
 */
async function sendSmsAlert(alert: SystemAlert): Promise<void> {
  try {
    const message = `🚨 ${alert.severity.toUpperCase()}: ${alert.name}. Check email for details.`

    // TODO: Implement SMS sending
    console.log('[ALERT SMS]', {
      to: process.env.OPS_PHONE,
      message,
    })

    // Actual implementation would use Twilio
    // const twilio = require('twilio')(...)
    // await twilio.messages.create({ ... })
  } catch (error) {
    console.error('Failed to send SMS alert:', error)
  }
}

/**
 * Send Slack alert
 */
async function sendSlackAlert(alert: SystemAlert): Promise<void> {
  try {
    const color =
      alert.severity === 'critical'
        ? '#d32f2f'
        : alert.severity === 'warning'
        ? '#ff9800'
        : '#2196f3'

    const emoji =
      alert.severity === 'critical'
        ? ':rotating_light:'
        : alert.severity === 'warning'
        ? ':warning:'
        : ':information_source:'

    const payload = {
      text: `${emoji} *Monitoring Alert: ${alert.name}*`,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Time',
              value: alert.triggeredAt || new Date().toISOString(),
              short: true,
            },
            {
              title: 'Message',
              value: alert.message,
              short: false,
            },
          ],
          footer: 'Dirt Free CRM Monitoring',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }

    await fetch(process.env.SLACK_MONITORING_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    console.error('Failed to send Slack alert:', error)
  }
}

/**
 * Send webhook alert
 */
async function sendWebhookAlert(alert: SystemAlert): Promise<void> {
  try {
    await fetch(process.env.MONITORING_WEBHOOK_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Alert-Source': 'dirt-free-crm-monitoring',
      },
      body: JSON.stringify(alert),
    })
  } catch (error) {
    console.error('Failed to send webhook alert:', error)
  }
}

/**
 * Persist alert to database
 */
async function persistAlert(alert: SystemAlert): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase.from('alert_history').insert({
      alert_name: alert.name,
      severity: alert.severity,
      message: alert.message,
      details: alert.details,
      triggered_at: alert.triggeredAt || new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to persist alert:', error)
  }
}

/**
 * Get recent alerts from database
 *
 * @param limit - Maximum number of alerts to return
 * @returns Recent alerts
 */
export async function getRecentAlerts(limit: number = 50): Promise<any[]> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('alert_history')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Failed to fetch alerts:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Failed to fetch alerts:', error)
    return []
  }
}

/**
 * Clear cooldown for an alert (for testing)
 *
 * @param alertName - Name of the alert
 */
export function clearAlertCooldown(alertName: string): void {
  lastAlertTime.delete(alertName)
}

/**
 * Clear all alert cooldowns (for testing)
 */
export function clearAllAlertCooldowns(): void {
  lastAlertTime.clear()
}
