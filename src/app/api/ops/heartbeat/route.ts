import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { getCurrentApiP95 } from '@/lib/alerts/slo'
import { log, createRequestContext } from '@/lib/obs/log'
import { timing } from '@/lib/obs/timing'

export interface HeartbeatResponse {
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

async function checkLastCronSuccess(): Promise<{ ok: boolean; lastSuccess?: Date; minutesSinceSuccess?: number }> {
  try {
    const supabase = getServerSupabase()

    // Look for recent successful cron runs in audit log
    const { data, error } = await supabase
      .from('audit_log')
      .select('ts')
      .eq('action', 'cron_reminders')
      .eq('outcome', 'ok')
      .order('ts', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return { ok: false }
    }

    const lastSuccess = new Date(data.ts)
    const now = new Date()
    const minutesSinceSuccess = Math.floor((now.getTime() - lastSuccess.getTime()) / 60000)

    const toleranceMinutes = parseInt(process.env.ALERTS_HEARTBEAT_TOLERANCE_MIN || '20')
    const ok = minutesSinceSuccess <= toleranceMinutes

    return {
      ok,
      lastSuccess,
      minutesSinceSuccess
    }
  } catch (error) {
    return { ok: false }
  }
}

async function checkReadyEndpoint(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ready`)
    const ok = response.ok

    if (!ok) {
      const errorText = await response.text()
      return { ok: false, error: `Ready endpoint returned ${response.status}: ${errorText}` }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkDatabase(): Promise<{ ok: boolean; responseTime?: number; error?: string }> {
  const startTime = Date.now()

  try {
    const supabase = getServerSupabase()

    // Simple ping query
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1)

    const responseTime = Date.now() - startTime

    if (error) {
      return {
        ok: false,
        responseTime,
        error: error.message
      }
    }

    return {
      ok: true,
      responseTime
    }
  } catch (error) {
    return {
      ok: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function GET() {
  const requestContext = createRequestContext(new Request('http://localhost/api/ops/heartbeat'))
  const logger = log.child(requestContext)

  try {
    logger.info('Heartbeat check initiated')

    const timestamp = new Date()

    // Run all checks in parallel
    const [cronCheck, readyCheck, dbCheck] = await Promise.all([
      timing.operation('heartbeat-cron', () => checkLastCronSuccess()),
      timing.operation('heartbeat-ready', () => checkReadyEndpoint()),
      timing.operation('heartbeat-db', () => checkDatabase())
    ])

    // Get current API P95
    const p95ApiMs = getCurrentApiP95()

    // Determine overall health
    const allChecksOk = cronCheck.ok && readyCheck.ok && dbCheck.ok
    const degraded = !allChecksOk

    const response: HeartbeatResponse = {
      ok: allChecksOk,
      lastCronOkAt: cronCheck.lastSuccess?.toISOString(),
      readyOk: readyCheck.ok,
      dbOk: dbCheck.ok,
      p95ApiMs: p95ApiMs > 0 ? p95ApiMs : undefined,
      ts: timestamp.toISOString(),
      degraded,
      checks: {
        cron: {
          ok: cronCheck.ok,
          lastSuccess: cronCheck.lastSuccess?.toISOString(),
          minutesSinceSuccess: cronCheck.minutesSinceSuccess
        },
        ready: {
          ok: readyCheck.ok,
          error: readyCheck.error
        },
        database: {
          ok: dbCheck.ok,
          responseTime: dbCheck.responseTime,
          error: dbCheck.error
        },
        api: {
          p95Ms: p95ApiMs > 0 ? p95ApiMs : undefined
        }
      }
    }

    logger.info('Heartbeat check completed', {
      ok: allChecksOk,
      degraded,
      cronOk: cronCheck.ok,
      readyOk: readyCheck.ok,
      dbOk: dbCheck.ok,
      p95ApiMs
    })

    return NextResponse.json(response, {
      status: degraded ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    logger.error('Heartbeat check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    const errorResponse: HeartbeatResponse = {
      ok: false,
      readyOk: false,
      dbOk: false,
      ts: new Date().toISOString(),
      degraded: true,
      checks: {
        cron: { ok: false },
        ready: { ok: false, error: 'System error during check' },
        database: { ok: false, error: 'System error during check' },
        api: {}
      }
    }

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}