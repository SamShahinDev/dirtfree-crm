import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { postSlack, createSloAlert, createHeartbeatAlert } from '@/lib/alerts/slack'
import { evaluateSlos, getSloTargets, getBreachedSlos, getHealthySlos, formatSloMetric } from '@/lib/alerts/slo'
import { log, createRequestContext } from '@/lib/obs/log'
import { timing } from '@/lib/obs/timing'

interface AlertState {
  breachedSlos: string[]
  lastHeartbeatOk: boolean
  lastAlertAt?: Date
}

// In-memory alert state (resets on server restart - acceptable for now)
let alertState: AlertState = {
  breachedSlos: [],
  lastHeartbeatOk: true
}

async function fetchHeartbeat() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ops/heartbeat`)
  if (!response.ok) {
    throw new Error(`Heartbeat check failed: ${response.status}`)
  }
  return response.json()
}

async function fetchSamples() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ops/samples`)
  if (!response.ok) {
    throw new Error(`Samples check failed: ${response.status}`)
  }
  return response.json()
}

async function auditAlert(action: string, outcome: 'ok' | 'alert', meta: any) {
  try {
    const supabase = getServerSupabase()

    await supabase
      .from('audit_log')
      .insert({
        ts: new Date().toISOString(),
        actor_id: null,
        actor_email: null,
        action,
        entity: 'slo_monitoring',
        entity_id: null,
        outcome,
        meta,
        before: null,
        after: null
      })
  } catch (error) {
    // Don't fail the whole alert process if audit logging fails
    console.error('Failed to audit alert:', error)
  }
}

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request)
  const logger = log.child(requestContext)

  try {
    logger.info('SLO alert check initiated')

    const environment = process.env.ALERTS_ENV || 'development'
    const now = new Date()

    // Fetch current metrics
    const [heartbeat, samples] = await Promise.all([
      timing.operation('alerts-heartbeat', () => fetchHeartbeat()),
      timing.operation('alerts-samples', () => fetchSamples())
    ])

    logger.info('Metrics fetched', {
      heartbeatOk: heartbeat.ok,
      degraded: heartbeat.degraded,
      reminderDeliveryRate: samples.reminderDeliveryRate,
      inboundVerifyErrorRate: samples.inboundVerifyErrorRate,
      apiP95Ms: samples.apiP95Ms
    })

    // Evaluate SLOs
    const targets = getSloTargets()
    const metrics = {
      reminderDelivery: samples.reminderDeliveryRate,
      inboundVerifyErrorRate: samples.inboundVerifyErrorRate,
      apiP95Ms: samples.apiP95Ms
    }

    const evaluations = evaluateSlos(metrics, targets)
    const currentlyBreached = getBreachedSlos(evaluations)
    const currentlyHealthy = getHealthySlos(evaluations)

    // Check for state transitions
    const newlyBreached = currentlyBreached.filter(slo => !alertState.breachedSlos.includes(slo))
    const newlyRecovered = alertState.breachedSlos.filter(slo => !currentlyBreached.includes(slo))
    const heartbeatChanged = heartbeat.ok !== alertState.lastHeartbeatOk

    const shouldAlert = newlyBreached.length > 0 || newlyRecovered.length > 0 || (heartbeat.degraded && alertState.lastHeartbeatOk)

    logger.info('SLO evaluation completed', {
      currentlyBreached,
      newlyBreached,
      newlyRecovered,
      heartbeatOk: heartbeat.ok,
      heartbeatChanged,
      shouldAlert
    })

    // Send alerts if needed
    if (shouldAlert) {
      const currentValues: Record<string, string> = {}
      const targetValues: Record<string, string> = {}

      evaluations.forEach(eval => {
        currentValues[eval.slo] = formatSloMetric(eval.slo, eval.actual)
        targetValues[eval.slo] = formatSloMetric(eval.slo, eval.target)
      })

      // Send SLO alert if SLOs changed
      if (newlyBreached.length > 0 || newlyRecovered.length > 0) {
        const sloAlert = createSloAlert({
          environment,
          breachedSlos: newlyBreached,
          recoveredSlos: newlyRecovered,
          currentValues,
          targets: targetValues,
          timestamp: now
        })

        await postSlack(sloAlert)

        await auditAlert('slo_alert', newlyBreached.length > 0 ? 'alert' : 'ok', {
          breachedSlos: newlyBreached,
          recoveredSlos: newlyRecovered,
          currentValues,
          targets: targetValues
        })

        logger.info('SLO alert sent', {
          breachedSlos: newlyBreached,
          recoveredSlos: newlyRecovered
        })
      }

      // Send heartbeat alert if heartbeat degraded
      if (heartbeat.degraded && alertState.lastHeartbeatOk) {
        const degradedServices = []
        if (!heartbeat.readyOk) degradedServices.push('Ready Check')
        if (!heartbeat.dbOk) degradedServices.push('Database')
        if (!heartbeat.checks.cron.ok) degradedServices.push('Cron Jobs')

        const heartbeatAlert = createHeartbeatAlert({
          environment,
          degradedServices,
          lastCronOkAt: heartbeat.lastCronOkAt ? new Date(heartbeat.lastCronOkAt) : undefined,
          timestamp: now
        })

        await postSlack(heartbeatAlert)

        await auditAlert('heartbeat_alert', 'alert', {
          degradedServices,
          lastCronOkAt: heartbeat.lastCronOkAt,
          readyOk: heartbeat.readyOk,
          dbOk: heartbeat.dbOk,
          cronOk: heartbeat.checks.cron.ok
        })

        logger.info('Heartbeat alert sent', {
          degradedServices
        })
      }

      // Send recovery alert if heartbeat recovered
      if (!heartbeat.degraded && !alertState.lastHeartbeatOk) {
        const recoveryAlert = createHeartbeatAlert({
          environment,
          degradedServices: [], // Empty means recovered
          timestamp: now
        })

        // Modify message for recovery
        recoveryAlert.text = `Heartbeat Recovery - ${environment.toUpperCase()}`
        if (recoveryAlert.blocks && recoveryAlert.blocks[0]) {
          recoveryAlert.blocks[0] = {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Heartbeat Recovery - ${environment.toUpperCase()}*\n<!date^${Math.floor(now.getTime() / 1000)}^{date_short_pretty} at {time}|${now.toISOString()}>`
            }
          }
        }

        await postSlack(recoveryAlert)

        await auditAlert('heartbeat_recovery', 'ok', {
          readyOk: heartbeat.readyOk,
          dbOk: heartbeat.dbOk,
          cronOk: heartbeat.checks.cron.ok
        })

        logger.info('Heartbeat recovery alert sent')
      }
    }

    // Update alert state
    alertState = {
      breachedSlos: currentlyBreached,
      lastHeartbeatOk: heartbeat.ok,
      lastAlertAt: shouldAlert ? now : alertState.lastAlertAt
    }

    logger.info('SLO alert check completed', {
      alertsSent: shouldAlert,
      currentBreachedSlos: currentlyBreached.length,
      heartbeatOk: heartbeat.ok
    })

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      alertsSent: shouldAlert,
      metrics: {
        heartbeat: {
          ok: heartbeat.ok,
          degraded: heartbeat.degraded
        },
        slos: {
          reminderDeliveryRate: samples.reminderDeliveryRate,
          inboundVerifyErrorRate: samples.inboundVerifyErrorRate,
          apiP95Ms: samples.apiP95Ms
        },
        evaluations: {
          breached: currentlyBreached,
          healthy: currentlyHealthy
        }
      }
    })

  } catch (error) {
    logger.error('SLO alert check failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    // Try to send a critical system alert
    try {
      const criticalAlert = {
        text: `🚨 CRITICAL: SLO Monitoring System Failure - ${process.env.ALERTS_ENV || 'unknown'}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🚨 *CRITICAL: SLO Monitoring System Failure*\n<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Error:* ${error instanceof Error ? error.message : 'Unknown system error'}`
            }
          }
        ]
      }

      await postSlack(criticalAlert)

      await auditAlert('slo_monitoring_failure', 'alert', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } catch (slackError) {
      logger.error('Failed to send critical alert to Slack', {
        error: slackError instanceof Error ? slackError.message : 'Unknown error'
      })
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}