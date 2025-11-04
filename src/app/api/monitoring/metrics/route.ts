/**
 * Monitoring Metrics API
 *
 * Returns current system metrics, uptime stats, and performance data.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { getUptimeStats, getUptimeHistory, calculateUptimePercentage } from '@/lib/monitoring/uptime'
import { getRecentAlerts } from '@/lib/monitoring/alerts'

export const dynamic = 'force-dynamic'

/**
 * GET - Fetch monitoring metrics
 *
 * Query parameters:
 * - period: Time period for stats (1h, 24h, 7d, 30d)
 */
export const GET = withAuth(
  async (req) => {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '24h'

    try {
      // Get period in hours
      const periodHours = getPeriodHours(period)

      // Get uptime stats
      const uptimeStats = getUptimeStats(periodHours)

      // Get recent uptime history
      const uptimeHistory = getUptimeHistory(100)

      // Get recent alerts
      const recentAlerts = await getRecentAlerts(20)

      // Calculate uptime for different periods
      const now = new Date()
      const uptime24h = await calculateUptimePercentage(
        new Date(now.getTime() - 24 * 60 * 60 * 1000),
        now
      )
      const uptime7d = await calculateUptimePercentage(
        new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        now
      )
      const uptime30d = await calculateUptimePercentage(
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        now
      )

      // Get current system health
      const currentHealth = await getCurrentHealth()

      // Build metrics response
      const metrics = {
        timestamp: new Date().toISOString(),
        period,
        currentStatus: {
          status: currentHealth.status,
          uptime: process.uptime ? Math.floor(process.uptime()) : undefined,
          memory: currentHealth.memory,
          services: currentHealth.services,
        },
        uptimeStats: {
          current: uptimeStats,
          periods: {
            '24h': uptime24h,
            '7d': uptime7d,
            '30d': uptime30d,
          },
          history: uptimeHistory.slice(-50).map((record) => ({
            timestamp: record.timestamp,
            status: record.status,
            responseTime: record.responseTime,
          })),
        },
        performance: {
          avgResponseTime: uptimeStats.avgResponseTime,
          latestResponseTime:
            uptimeHistory.length > 0
              ? uptimeHistory[uptimeHistory.length - 1].responseTime
              : 0,
        },
        alerts: {
          recent: recentAlerts.slice(0, 10).map((alert) => ({
            name: alert.alert_name,
            severity: alert.severity,
            message: alert.message,
            triggeredAt: alert.triggered_at,
          })),
          criticalCount: recentAlerts.filter((a) => a.severity === 'critical').length,
          warningCount: recentAlerts.filter((a) => a.severity === 'warning').length,
        },
      }

      return NextResponse.json({
        success: true,
        metrics,
      })
    } catch (error) {
      console.error('Failed to fetch monitoring metrics:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch metrics',
        },
        { status: 500 }
      )
    }
  },
  {
    requirePermission: 'analytics:view_all',
    enableAuditLog: false, // Don't log monitoring checks
  }
)

/**
 * Convert period string to hours
 */
function getPeriodHours(period: string): number {
  switch (period) {
    case '1h':
      return 1
    case '24h':
      return 24
    case '7d':
      return 7 * 24
    case '30d':
      return 30 * 24
    default:
      return 24
  }
}

/**
 * Get current system health
 */
async function getCurrentHealth() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/health/detailed`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return {
        status: 'unhealthy',
        memory: undefined,
        services: {},
      }
    }

    const data = await response.json()

    return {
      status: data.status,
      memory: data.checks?.memory?.details,
      services: Object.fromEntries(
        Object.entries(data.checks || {})
          .filter(([key]) => key !== 'memory' && key !== 'overall')
          .map(([key, check]: [string, any]) => [
            key,
            {
              status: check.status,
              responseTime: check.responseTime,
            },
          ])
      ),
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      memory: undefined,
      services: {},
    }
  }
}
