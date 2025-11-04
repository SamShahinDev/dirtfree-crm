/**
 * Uptime Monitoring
 *
 * Track application uptime and service availability.
 *
 * @module lib/monitoring/uptime
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Uptime record
 */
export interface UptimeRecord {
  timestamp: Date
  status: 'up' | 'down' | 'degraded'
  responseTime: number
  errors?: string[]
  checks?: Record<string, any>
}

/**
 * Uptime statistics
 */
export interface UptimeStats {
  uptime: number // Percentage
  total: number
  up: number
  down: number
  degraded: number
  avgResponseTime: number
  recentRecords: UptimeRecord[]
}

// In-memory uptime history (last 24 hours)
const uptimeHistory: UptimeRecord[] = []

// Maximum records to keep in memory (24 hours at 5-minute intervals = 288)
const MAX_RECORDS = 288

/**
 * Record current uptime status
 *
 * @returns Uptime record
 */
export async function recordUptime(): Promise<UptimeRecord> {
  const start = Date.now()
  const errors: string[] = []
  let status: 'up' | 'down' | 'degraded' = 'up'
  let checks: Record<string, any> = {}

  try {
    // Check health endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/health/detailed`, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    const data = await response.json()
    checks = data.checks

    // Determine status based on health check
    if (data.status === 'unhealthy') {
      status = 'down'

      // Collect errors from unhealthy checks
      Object.entries(data.checks).forEach(([service, check]: [string, any]) => {
        if (check.status === 'unhealthy') {
          errors.push(`${service}: ${check.error || 'unhealthy'}`)
        }
      })
    } else if (data.status === 'degraded') {
      status = 'degraded'

      // Collect warnings from degraded checks
      Object.entries(data.checks).forEach(([service, check]: [string, any]) => {
        if (check.status === 'degraded') {
          errors.push(`${service}: degraded`)
        }
      })
    }
  } catch (error) {
    status = 'down'
    errors.push(`Health check failed: ${(error as Error).message}`)
  }

  const responseTime = Date.now() - start

  const record: UptimeRecord = {
    timestamp: new Date(),
    status,
    responseTime,
    errors: errors.length > 0 ? errors : undefined,
    checks,
  }

  // Add to history
  uptimeHistory.push(record)

  // Keep only recent records
  while (uptimeHistory.length > MAX_RECORDS) {
    uptimeHistory.shift()
  }

  // Persist to database (async, don't wait)
  persistUptimeRecord(record).catch((err) => {
    console.error('Failed to persist uptime record:', err)
  })

  // Check if alerts should be sent
  if (status === 'down') {
    sendUptimeAlert(record).catch((err) => {
      console.error('Failed to send uptime alert:', err)
    })
  }

  return record
}

/**
 * Get uptime statistics
 *
 * @param periodHours - Period in hours (default: 24)
 * @returns Uptime statistics
 */
export function getUptimeStats(periodHours: number = 24): UptimeStats {
  const cutoffTime = Date.now() - periodHours * 60 * 60 * 1000

  // Filter records within period
  const records = uptimeHistory.filter(
    (r) => r.timestamp.getTime() >= cutoffTime
  )

  const total = records.length
  const up = records.filter((r) => r.status === 'up').length
  const down = records.filter((r) => r.status === 'down').length
  const degraded = records.filter((r) => r.status === 'degraded').length

  const uptime = total > 0 ? (up / total) * 100 : 100

  const avgResponseTime =
    total > 0
      ? records.reduce((sum, r) => sum + r.responseTime, 0) / total
      : 0

  return {
    uptime,
    total,
    up,
    down,
    degraded,
    avgResponseTime,
    recentRecords: records.slice(-20), // Last 20 records
  }
}

/**
 * Get uptime history
 *
 * @param limit - Maximum number of records to return
 * @returns Uptime records
 */
export function getUptimeHistory(limit: number = 100): UptimeRecord[] {
  return uptimeHistory.slice(-limit)
}

/**
 * Persist uptime record to database
 *
 * @param record - Uptime record
 */
async function persistUptimeRecord(record: UptimeRecord): Promise<void> {
  try {
    const supabase = await createClient()

    await supabase.from('uptime_logs').insert({
      status: record.status,
      response_time: record.responseTime,
      errors: record.errors || null,
      checks: record.checks || null,
      checked_at: record.timestamp.toISOString(),
    })
  } catch (error) {
    console.error('Failed to persist uptime record:', error)
    throw error
  }
}

/**
 * Send uptime alert
 *
 * @param record - Uptime record
 */
async function sendUptimeAlert(record: UptimeRecord): Promise<void> {
  try {
    // Check if we've already alerted recently (prevent spam)
    const recentDowntime = uptimeHistory
      .slice(-3)
      .filter((r) => r.status === 'down')

    if (recentDowntime.length < 2) {
      // Only alert if we've had 2+ consecutive down checks
      return
    }

    // Import alert system dynamically to avoid circular dependencies
    const { sendSystemAlert } = await import('./alerts')

    await sendSystemAlert({
      name: 'System Down',
      severity: 'critical',
      message: 'Application health check failed',
      details: {
        status: record.status,
        errors: record.errors,
        responseTime: record.responseTime,
        timestamp: record.timestamp.toISOString(),
      },
    })
  } catch (error) {
    console.error('Failed to send uptime alert:', error)
  }
}

/**
 * Calculate uptime percentage for a period
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Uptime percentage
 */
export async function calculateUptimePercentage(
  startDate: Date,
  endDate: Date
): Promise<number> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('uptime_logs')
      .select('status')
      .gte('checked_at', startDate.toISOString())
      .lte('checked_at', endDate.toISOString())

    if (error || !data) {
      return 0
    }

    const total = data.length
    const up = data.filter((r) => r.status === 'up').length

    return total > 0 ? (up / total) * 100 : 100
  } catch (error) {
    console.error('Failed to calculate uptime percentage:', error)
    return 0
  }
}

/**
 * Get uptime logs from database
 *
 * @param limit - Maximum number of logs to return
 * @param startDate - Optional start date
 * @param endDate - Optional end date
 * @returns Uptime logs
 */
export async function getUptimeLogs(
  limit: number = 100,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('uptime_logs')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(limit)

    if (startDate) {
      query = query.gte('checked_at', startDate.toISOString())
    }

    if (endDate) {
      query = query.lte('checked_at', endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch uptime logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Failed to fetch uptime logs:', error)
    return []
  }
}

/**
 * Get current system status
 *
 * @returns Current status
 */
export function getCurrentStatus(): 'up' | 'down' | 'degraded' | 'unknown' {
  if (uptimeHistory.length === 0) {
    return 'unknown'
  }

  const latest = uptimeHistory[uptimeHistory.length - 1]
  return latest.status
}

/**
 * Check if system is currently healthy
 *
 * @returns True if healthy
 */
export function isSystemHealthy(): boolean {
  const status = getCurrentStatus()
  return status === 'up'
}
