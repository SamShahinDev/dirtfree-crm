'use server'

import { requireAdmin } from '@/lib/auth/guards'
import { getSloTargets, evaluateSlos, formatSloMetric, getSloDisplayName } from '@/lib/alerts/slo'
import { log, createUserContext } from '@/lib/obs/log'
import { timing } from '@/lib/obs/timing'

export interface HeartbeatData {
  ok: boolean
  lastCronOkAt?: string
  readyOk: boolean
  dbOk: boolean
  p95ApiMs?: number
  ts: string
  degraded?: boolean
  checks: {
    cron: {
      ok: boolean
      lastSuccess?: string
      minutesSinceSuccess?: number
    }
    ready: {
      ok: boolean
      error?: string
    }
    database: {
      ok: boolean
      responseTime?: number
      error?: string
    }
    api: {
      p95Ms?: number
    }
  }
}

export interface SamplesData {
  reminderDeliveryRate: number
  inboundVerifyErrorRate: number
  apiP95Ms: number
  ts: string
  windowMinutes: number
  counts: {
    remindersSent: number
    remindersFailed: number
    inboundVerifyAttempts: number
    inboundVerifyErrors: number
    apiRequests: number
  }
}

export interface SloStatus {
  slo: string
  displayName: string
  current: string
  target: string
  healthy: boolean
  breach: boolean
}

export interface OperationalMetrics {
  heartbeat: HeartbeatData
  samples: SamplesData
  sloStatuses: SloStatus[]
  lastUpdated: string
  overallHealthy: boolean
}

export async function getOperationalMetrics(): Promise<OperationalMetrics> {
  // Require admin access
  await requireAdmin()

  const logger = log.child(createUserContext('ops-dashboard'))
  logger.info('Operational metrics requested')

  try {
    // Fetch data from our internal APIs
    const [heartbeatResponse, samplesResponse] = await Promise.all([
      timing.operation('ops-heartbeat', async () => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ops/heartbeat`)
        if (!response.ok) {
          throw new Error(`Heartbeat API failed: ${response.status}`)
        }
        return response.json()
      }),
      timing.operation('ops-samples', async () => {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ops/samples`)
        if (!response.ok) {
          throw new Error(`Samples API failed: ${response.status}`)
        }
        return response.json()
      })
    ])

    // Evaluate SLOs
    const targets = getSloTargets()
    const metrics = {
      reminderDelivery: samplesResponse.reminderDeliveryRate,
      inboundVerifyErrorRate: samplesResponse.inboundVerifyErrorRate,
      apiP95Ms: samplesResponse.apiP95Ms
    }

    const evaluations = evaluateSlos(metrics, targets)

    // Format SLO statuses for display
    const sloStatuses: SloStatus[] = evaluations.map(evaluation => ({
      slo: evaluation.slo,
      displayName: getSloDisplayName(evaluation.slo),
      current: formatSloMetric(evaluation.slo, evaluation.actual),
      target: formatSloMetric(evaluation.slo, evaluation.target),
      healthy: evaluation.healthy,
      breach: evaluation.breach
    }))

    // Determine overall health
    const overallHealthy = heartbeatResponse.ok && evaluations.every(e => e.healthy)

    const result: OperationalMetrics = {
      heartbeat: heartbeatResponse,
      samples: samplesResponse,
      sloStatuses,
      lastUpdated: new Date().toISOString(),
      overallHealthy
    }

    logger.info('Operational metrics retrieved', {
      overallHealthy,
      heartbeatOk: heartbeatResponse.ok,
      slosHealthy: evaluations.filter(e => e.healthy).length,
      slosTotal: evaluations.length
    })

    return result

  } catch (error) {
    logger.error('Failed to retrieve operational metrics', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    // Return safe defaults on error
    const errorMetrics: OperationalMetrics = {
      heartbeat: {
        ok: false,
        readyOk: false,
        dbOk: false,
        ts: new Date().toISOString(),
        degraded: true,
        checks: {
          cron: { ok: false },
          ready: { ok: false, error: 'Failed to fetch data' },
          database: { ok: false, error: 'Failed to fetch data' },
          api: {}
        }
      },
      samples: {
        reminderDeliveryRate: 0,
        inboundVerifyErrorRate: 0,
        apiP95Ms: 0,
        ts: new Date().toISOString(),
        windowMinutes: 5,
        counts: {
          remindersSent: 0,
          remindersFailed: 0,
          inboundVerifyAttempts: 0,
          inboundVerifyErrors: 0,
          apiRequests: 0
        }
      },
      sloStatuses: [],
      lastUpdated: new Date().toISOString(),
      overallHealthy: false
    }

    return errorMetrics
  }
}

export interface TrendData {
  timestamp: string
  value: number
}

export async function getSloTrends(slo: string, hoursBack: number = 24): Promise<TrendData[]> {
  // Require admin access
  await requireAdmin()

  // For now, return mock trend data since we don't have historical storage
  // In a real implementation, this would query a time-series database
  const trends: TrendData[] = []
  const now = new Date()

  for (let i = hoursBack; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)

    // Generate realistic mock data based on SLO type
    let value: number
    switch (slo) {
      case 'reminderDelivery':
        value = 0.95 + Math.random() * 0.05 // 95-100%
        break
      case 'inboundVerifyErrorRate':
        value = Math.random() * 0.03 // 0-3%
        break
      case 'apiP95Ms':
        value = 400 + Math.random() * 600 // 400-1000ms
        break
      default:
        value = Math.random()
    }

    trends.push({
      timestamp: timestamp.toISOString(),
      value
    })
  }

  return trends
}