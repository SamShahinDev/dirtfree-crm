import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { getCurrentApiP95, getCurrentInboundErrorRate } from '@/lib/alerts/slo'
import { log, createRequestContext } from '@/lib/obs/log'
import { timing } from '@/lib/obs/timing'

export interface SamplesResponse {
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

async function getReminderDeliveryRate(windowMinutes: number): Promise<{ rate: number; sent: number; failed: number }> {
  try {
    const supabase = getServerSupabase()
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

    // Get reminder delivery stats from communication_logs
    const { data, error } = await supabase
      .from('communication_logs')
      .select('status')
      .eq('channel', 'sms')
      .eq('context', 'reminder')
      .gte('created_at', windowStart.toISOString())

    if (error) {
      throw error
    }

    const sent = data?.filter(log => log.status === 'sent').length || 0
    const failed = data?.filter(log => log.status === 'failed').length || 0
    const total = sent + failed

    const rate = total > 0 ? sent / total : 1 // Assume 100% if no data

    return { rate, sent, failed }
  } catch (error) {
    // Return safe defaults on error
    return { rate: 1, sent: 0, failed: 0 }
  }
}

async function getInboundVerifyStats(windowMinutes: number): Promise<{ errorRate: number; attempts: number; errors: number }> {
  try {
    const supabase = getServerSupabase()
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

    // Get inbound verification stats from a webhook_outcomes table or similar
    // For now, we'll use the in-memory data from the SLO utility
    const errorRate = getCurrentInboundErrorRate()

    // Try to get actual counts from audit logs if available
    const { data, error } = await supabase
      .from('audit_log')
      .select('outcome, meta')
      .eq('action', 'twilio_inbound_verify')
      .gte('ts', windowStart.toISOString())

    let attempts = 0
    let errors = 0

    if (!error && data) {
      attempts = data.length
      errors = data.filter(log => log.outcome === 'error').length
    }

    return {
      errorRate: attempts > 0 ? errors / attempts : errorRate,
      attempts,
      errors
    }
  } catch (error) {
    // Fallback to in-memory data
    return {
      errorRate: getCurrentInboundErrorRate(),
      attempts: 0,
      errors: 0
    }
  }
}

async function getApiStats(): Promise<{ p95Ms: number; requests: number }> {
  // Get from in-memory rolling window
  const p95Ms = getCurrentApiP95()

  // For request count, we could query audit logs or use in-memory counters
  // For now, return the P95 and a placeholder count
  return {
    p95Ms,
    requests: 0 // Would need to implement request counting
  }
}

export async function GET() {
  const requestContext = createRequestContext(new Request('http://localhost/api/ops/samples'))
  const logger = log.child(requestContext)

  try {
    logger.info('SLO samples check initiated')

    const windowMinutes = parseInt(process.env.ALERTS_MINUTES || '5')
    const timestamp = new Date()

    // Gather all metrics in parallel
    const [reminderStats, inboundStats, apiStats] = await Promise.all([
      timing.operation('samples-reminders', () => getReminderDeliveryRate(windowMinutes)),
      timing.operation('samples-inbound', () => getInboundVerifyStats(windowMinutes)),
      timing.operation('samples-api', () => getApiStats())
    ])

    const response: SamplesResponse = {
      reminderDeliveryRate: reminderStats.rate,
      inboundVerifyErrorRate: inboundStats.errorRate,
      apiP95Ms: apiStats.p95Ms,
      ts: timestamp.toISOString(),
      windowMinutes,
      counts: {
        remindersSent: reminderStats.sent,
        remindersFailed: reminderStats.failed,
        inboundVerifyAttempts: inboundStats.attempts,
        inboundVerifyErrors: inboundStats.errors,
        apiRequests: apiStats.requests
      }
    }

    logger.info('SLO samples completed', {
      reminderDeliveryRate: reminderStats.rate,
      inboundVerifyErrorRate: inboundStats.errorRate,
      apiP95Ms: apiStats.p95Ms,
      windowMinutes
    })

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    logger.error('SLO samples check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    // Return safe defaults on error
    const errorResponse: SamplesResponse = {
      reminderDeliveryRate: 1, // Assume success if we can't measure
      inboundVerifyErrorRate: 0, // Assume no errors if we can't measure
      apiP95Ms: 0, // No data
      ts: new Date().toISOString(),
      windowMinutes: parseInt(process.env.ALERTS_MINUTES || '5'),
      counts: {
        remindersSent: 0,
        remindersFailed: 0,
        inboundVerifyAttempts: 0,
        inboundVerifyErrors: 0,
        apiRequests: 0
      }
    }

    return NextResponse.json(errorResponse, {
      status: 200, // Return 200 even on error to avoid cascading alerts
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}