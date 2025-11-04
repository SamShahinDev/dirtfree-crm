/**
 * Error Statistics API
 *
 * Provides error statistics and trends for the admin dashboard.
 * Fetches data from Sentry API for comprehensive error monitoring.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'

/**
 * GET - Fetch error statistics
 *
 * Query parameters:
 * - period: Time period (24h, 7d, 30d, 90d)
 * - environment: Environment filter (production, development, staging)
 */
export const GET = withAuth(
  async (req) => {
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || '24h'
    const environment = searchParams.get('environment') || 'production'

    try {
      // In a real implementation, this would fetch from Sentry API
      // For now, we'll return mock data structure
      const stats = await generateErrorStats(period, environment)

      return NextResponse.json({
        success: true,
        period,
        environment,
        stats,
      })
    } catch (error) {
      console.error('Failed to fetch error stats:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch error statistics',
        },
        { status: 500 }
      )
    }
  },
  {
    requirePermission: 'analytics:view_all',
    enableAuditLog: true,
  }
)

/**
 * Generate error statistics
 *
 * In production, this would integrate with Sentry API:
 * https://docs.sentry.io/api/
 */
async function generateErrorStats(period: string, environment: string) {
  // Calculate time range
  const now = new Date()
  const periodMs = getPeriodMs(period)
  const startTime = new Date(now.getTime() - periodMs)

  // In production, use Sentry API:
  // const sentryToken = process.env.SENTRY_AUTH_TOKEN
  // const sentryOrg = process.env.SENTRY_ORG
  // const sentryProject = process.env.SENTRY_PROJECT
  //
  // const response = await fetch(
  //   `https://sentry.io/api/0/organizations/${sentryOrg}/issues/?statsPeriod=${period}&query=environment:${environment}`,
  //   {
  //     headers: {
  //       'Authorization': `Bearer ${sentryToken}`,
  //     },
  //   }
  // )

  // Mock data structure for demonstration
  return {
    overview: {
      totalErrors: 1247,
      uniqueErrors: 89,
      affectedUsers: 342,
      errorRate: 2.3, // percentage
      trend: {
        direction: 'down' as 'up' | 'down' | 'stable',
        percentage: 15.2,
      },
    },

    // Errors over time (for chart)
    timeline: generateTimeline(period),

    // Top errors by frequency
    topErrors: [
      {
        id: 'error-1',
        message: 'Failed to fetch customer data',
        count: 234,
        affectedUsers: 45,
        firstSeen: startTime.toISOString(),
        lastSeen: now.toISOString(),
        status: 'unresolved' as 'resolved' | 'unresolved' | 'ignored',
        level: 'error' as 'error' | 'warning' | 'info',
        tags: {
          component: 'CustomerList',
          environment,
        },
      },
      {
        id: 'error-2',
        message: 'Network request failed',
        count: 187,
        affectedUsers: 78,
        firstSeen: startTime.toISOString(),
        lastSeen: now.toISOString(),
        status: 'unresolved' as 'resolved' | 'unresolved' | 'ignored',
        level: 'warning' as 'error' | 'warning' | 'info',
        tags: {
          component: 'API',
          environment,
        },
      },
      {
        id: 'error-3',
        message: 'Validation error: Invalid email format',
        count: 156,
        affectedUsers: 92,
        firstSeen: startTime.toISOString(),
        lastSeen: now.toISOString(),
        status: 'unresolved' as 'resolved' | 'unresolved' | 'ignored',
        level: 'warning' as 'error' | 'warning' | 'info',
        tags: {
          component: 'Form',
          environment,
        },
      },
      {
        id: 'error-4',
        message: 'Database connection timeout',
        count: 89,
        affectedUsers: 23,
        firstSeen: startTime.toISOString(),
        lastSeen: now.toISOString(),
        status: 'unresolved' as 'resolved' | 'unresolved' | 'ignored',
        level: 'error' as 'error' | 'warning' | 'info',
        tags: {
          component: 'Database',
          environment,
        },
      },
      {
        id: 'error-5',
        message: 'Permission denied',
        count: 67,
        affectedUsers: 34,
        firstSeen: startTime.toISOString(),
        lastSeen: now.toISOString(),
        status: 'unresolved' as 'resolved' | 'unresolved' | 'ignored',
        level: 'warning' as 'error' | 'warning' | 'info',
        tags: {
          component: 'Auth',
          environment,
        },
      },
    ],

    // Errors by component/page
    byComponent: [
      { component: 'CustomerList', count: 345, percentage: 27.7 },
      { component: 'OpportunityForm', count: 234, percentage: 18.8 },
      { component: 'API', count: 198, percentage: 15.9 },
      { component: 'Dashboard', count: 156, percentage: 12.5 },
      { component: 'Auth', count: 123, percentage: 9.9 },
      { component: 'Other', count: 191, percentage: 15.2 },
    ],

    // Errors by severity
    bySeverity: {
      error: 734,
      warning: 412,
      info: 101,
    },

    // Errors by status
    byStatus: {
      unresolved: 856,
      resolved: 342,
      ignored: 49,
    },

    // Browser/Platform distribution
    byPlatform: [
      { platform: 'Chrome', count: 567, percentage: 45.5 },
      { platform: 'Safari', count: 342, percentage: 27.4 },
      { platform: 'Firefox', count: 189, percentage: 15.2 },
      { platform: 'Edge', count: 98, percentage: 7.9 },
      { platform: 'Other', count: 51, percentage: 4.0 },
    ],

    // Affected users list (top 10)
    affectedUsers: Array.from({ length: 10 }, (_, i) => ({
      userId: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      errorCount: Math.floor(Math.random() * 50) + 10,
      lastError: new Date(
        now.getTime() - Math.random() * periodMs
      ).toISOString(),
    })),

    // Performance metrics
    performance: {
      avgResponseTime: 245, // ms
      p95ResponseTime: 567, // ms
      p99ResponseTime: 1234, // ms
      slowestEndpoints: [
        { endpoint: '/api/customers', avgTime: 456, count: 234 },
        { endpoint: '/api/opportunities', avgTime: 389, count: 189 },
        { endpoint: '/api/promotions', avgTime: 312, count: 156 },
      ],
    },

    // Recent critical errors
    criticalErrors: [
      {
        id: 'critical-1',
        message: 'Database connection pool exhausted',
        timestamp: new Date(now.getTime() - 3600000).toISOString(),
        affectedUsers: 145,
        resolved: false,
      },
      {
        id: 'critical-2',
        message: 'API rate limit exceeded',
        timestamp: new Date(now.getTime() - 7200000).toISOString(),
        affectedUsers: 89,
        resolved: true,
      },
    ],
  }
}

/**
 * Generate timeline data for chart
 */
function generateTimeline(period: string) {
  const points = period === '24h' ? 24 : period === '7d' ? 7 : 30
  const interval = period === '24h' ? 'hour' : 'day'

  const timeline = []
  const now = new Date()

  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(
      now.getTime() - i * (period === '24h' ? 3600000 : 86400000)
    )

    timeline.push({
      timestamp: timestamp.toISOString(),
      errorCount: Math.floor(Math.random() * 100) + 20,
      uniqueErrors: Math.floor(Math.random() * 20) + 5,
      affectedUsers: Math.floor(Math.random() * 50) + 10,
    })
  }

  return timeline
}

/**
 * Convert period to milliseconds
 */
function getPeriodMs(period: string): number {
  switch (period) {
    case '24h':
      return 24 * 60 * 60 * 1000
    case '7d':
      return 7 * 24 * 60 * 60 * 1000
    case '30d':
      return 30 * 24 * 60 * 60 * 1000
    case '90d':
      return 90 * 24 * 60 * 60 * 1000
    default:
      return 24 * 60 * 60 * 1000
  }
}

export const dynamic = 'force-dynamic'
