/**
 * Health Check Cron Job
 *
 * Scheduled job to check system health and record uptime.
 * Configure in Vercel to run every 5 minutes.
 *
 * Vercel Cron Configuration:
 * - Path: /api/cron/health-check
 * - Schedule: */5 * * * * (every 5 minutes)
 */

import { NextResponse } from 'next/server'
import { recordUptime } from '@/lib/monitoring/uptime'
import { checkAlerts } from '@/lib/monitoring/alerts'
import { captureError, captureMessage } from '@/lib/errors/tracking'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    captureMessage('Health check cron job started', 'info')

    // Record uptime
    const uptimeRecord = await recordUptime()

    // Check alerts if system is degraded or down
    if (uptimeRecord.status !== 'up') {
      // Build metrics from uptime record
      const metrics = {
        uptime: uptimeRecord.status === 'up' ? 100 : 0,
        avgResponseTime: uptimeRecord.responseTime,
        database: {
          healthy: uptimeRecord.checks?.database?.status === 'healthy',
          responseTime: uptimeRecord.checks?.database?.responseTime,
        },
        services: uptimeRecord.checks
          ? Object.fromEntries(
              Object.entries(uptimeRecord.checks)
                .filter(([key]) => key !== 'database' && key !== 'overall')
                .map(([key, check]: [string, any]) => [
                  key,
                  {
                    healthy: check.status === 'healthy',
                    responseTime: check.responseTime,
                  },
                ])
            )
          : {},
      }

      // Check alert rules
      await checkAlerts(metrics)
    }

    captureMessage('Health check cron job completed', 'info', {
      extra: {
        status: uptimeRecord.status,
        responseTime: uptimeRecord.responseTime,
      },
    })

    return NextResponse.json({
      success: true,
      record: {
        status: uptimeRecord.status,
        responseTime: uptimeRecord.responseTime,
        timestamp: uptimeRecord.timestamp,
        errorsCount: uptimeRecord.errors?.length || 0,
      },
    })
  } catch (error) {
    captureError(error as Error, {
      action: 'health_check_cron',
      severity: 'critical',
    })

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
