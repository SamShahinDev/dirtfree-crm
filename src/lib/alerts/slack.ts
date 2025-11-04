/**
 * Slack alerting utilities for SLO monitoring
 * Sends alerts to Slack webhook with proper formatting and PII protection
 */

import { log, createComponentContext } from '@/lib/obs/log'

export interface SlackMessage {
  text: string
  blocks?: SlackBlock[]
}

export interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
  }
  fields?: Array<{
    type: string
    text: string
  }>
  accessory?: any
}

export interface SlackSection {
  type: 'section'
  text: {
    type: 'mrkdwn'
    text: string
  }
  fields?: Array<{
    type: 'mrkdwn'
    text: string
  }>
}

export interface SlackDivider {
  type: 'divider'
}

const logger = log.child(createComponentContext('SlackAlerts'))

/**
 * Post a message to Slack via webhook
 * Ensures no PII is included in messages
 */
export async function postSlack(message: SlackMessage): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    logger.warn('Slack webhook URL not configured, skipping alert', {
      messageText: message.text.substring(0, 100)
    })
    return
  }

  try {
    logger.info('Sending Slack alert', {
      messageLength: message.text.length,
      hasBlocks: !!message.blocks,
      blockCount: message.blocks?.length || 0
    })

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Slack API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    logger.info('Slack alert sent successfully')
  } catch (error) {
    logger.error('Failed to send Slack alert', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageText: message.text.substring(0, 100)
    })
    throw error
  }
}

/**
 * Create a Slack section block with markdown text
 */
export function createSection(text: string, fields?: string[]): SlackSection {
  const section: SlackSection = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: text
    }
  }

  if (fields && fields.length > 0) {
    section.fields = fields.map(field => ({
      type: 'mrkdwn',
      text: field
    }))
  }

  return section
}

/**
 * Create a Slack divider block
 */
export function createDivider(): SlackDivider {
  return { type: 'divider' }
}

/**
 * Create a code block for Slack
 */
export function createCodeBlock(code: string): string {
  return '```\n' + code + '\n```'
}

/**
 * Create an inline code snippet for Slack
 */
export function createInlineCode(code: string): string {
  return '`' + code + '`'
}

/**
 * Create a Slack link
 */
export function createLink(url: string, text?: string): string {
  if (text) {
    return `<${url}|${text}>`
  }
  return `<${url}>`
}

/**
 * Format a percentage for display
 */
export function formatPercentage(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

/**
 * Format a duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

/**
 * Format a timestamp for Slack
 */
export function formatTimestamp(date: Date): string {
  return `<!date^${Math.floor(date.getTime() / 1000)}^{date_short_pretty} at {time}|${date.toISOString()}>`
}

/**
 * Create an alert status emoji
 */
export function getStatusEmoji(isHealthy: boolean): string {
  return isHealthy ? '✅' : '🚨'
}

/**
 * Create a severity emoji
 */
export function getSeverityEmoji(severity: 'info' | 'warning' | 'critical'): string {
  switch (severity) {
    case 'info':
      return 'ℹ️'
    case 'warning':
      return '⚠️'
    case 'critical':
      return '🚨'
    default:
      return '❓'
  }
}

/**
 * Create a formatted SLO alert message
 */
export function createSloAlert({
  environment,
  breachedSlos,
  recoveredSlos,
  currentValues,
  targets,
  timestamp = new Date()
}: {
  environment: string
  breachedSlos: string[]
  recoveredSlos: string[]
  currentValues: Record<string, number | string>
  targets: Record<string, number | string>
  timestamp?: Date
}): SlackMessage {
  const isAlert = breachedSlos.length > 0
  const isRecovery = recoveredSlos.length > 0 && breachedSlos.length === 0

  let text: string
  let emoji: string

  if (isAlert) {
    emoji = '🚨'
    text = `SLO Alert - ${environment.toUpperCase()}`
  } else if (isRecovery) {
    emoji = '✅'
    text = `SLO Recovery - ${environment.toUpperCase()}`
  } else {
    emoji = 'ℹ️'
    text = `SLO Status - ${environment.toUpperCase()}`
  }

  const blocks: SlackBlock[] = [
    createSection(`${emoji} *${text}*\n${formatTimestamp(timestamp)}`)
  ]

  if (breachedSlos.length > 0) {
    blocks.push(createDivider())
    blocks.push(createSection('*🚨 Breached SLOs:*'))

    breachedSlos.forEach(slo => {
      const current = currentValues[slo]
      const target = targets[slo]
      blocks.push(createSection(`• *${slo}*: ${current} (target: ${target})`))
    })
  }

  if (recoveredSlos.length > 0) {
    blocks.push(createDivider())
    blocks.push(createSection('*✅ Recovered SLOs:*'))

    recoveredSlos.forEach(slo => {
      const current = currentValues[slo]
      const target = targets[slo]
      blocks.push(createSection(`• *${slo}*: ${current} (target: ${target})`))
    })
  }

  // Add quick links
  blocks.push(createDivider())
  blocks.push(createSection('*Quick Links:*', [
    createLink(`${process.env.NEXT_PUBLIC_APP_URL}/reports/ops`, 'SLO Dashboard'),
    createLink(`${process.env.NEXT_PUBLIC_APP_URL}/reports/audit`, 'Audit Logs'),
    createLink(`${process.env.NEXT_PUBLIC_APP_URL}/api/health`, 'Health Check')
  ]))

  return {
    text,
    blocks
  }
}

/**
 * Create a heartbeat alert message
 */
export function createHeartbeatAlert({
  environment,
  degradedServices,
  lastCronOkAt,
  timestamp = new Date()
}: {
  environment: string
  degradedServices: string[]
  lastCronOkAt?: Date
  timestamp?: Date
}): SlackMessage {
  const emoji = '💔'
  const text = `Heartbeat Alert - ${environment.toUpperCase()}`

  const blocks: SlackBlock[] = [
    createSection(`${emoji} *${text}*\n${formatTimestamp(timestamp)}`)
  ]

  if (degradedServices.length > 0) {
    blocks.push(createDivider())
    blocks.push(createSection('*💔 Degraded Services:*'))

    degradedServices.forEach(service => {
      blocks.push(createSection(`• *${service}*`))
    })
  }

  if (lastCronOkAt) {
    const minutesAgo = Math.floor((timestamp.getTime() - lastCronOkAt.getTime()) / 60000)
    blocks.push(createDivider())
    blocks.push(createSection(`*⏰ Last Cron Success:* ${minutesAgo} minutes ago\n${formatTimestamp(lastCronOkAt)}`))
  }

  // Add quick links
  blocks.push(createDivider())
  blocks.push(createSection('*Quick Links:*', [
    createLink(`${process.env.NEXT_PUBLIC_APP_URL}/api/ready`, 'Ready Check'),
    createLink(`${process.env.NEXT_PUBLIC_APP_URL}/api/health`, 'Health Check'),
    createLink(`${process.env.NEXT_PUBLIC_APP_URL}/reports/ops`, 'Operations Dashboard')
  ]))

  return {
    text,
    blocks
  }
}