/**
 * Example: PII Access Logs
 *
 * Demonstrates how to retrieve and analyze PII access logs.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import {
  getPiiAccessLogs,
  getPiiAccessLogsByUser,
  getRecentPiiAccessLogs,
  generatePiiAccessReport,
} from '@/lib/db/pii-access-log'

/**
 * GET - Retrieve PII access logs
 *
 * Query parameters:
 * - customerId: Filter by customer ID
 * - userId: Filter by user ID
 * - recent: Get recent logs (default: false)
 * - limit: Number of logs to return (default: 100)
 */
export const GET = withAuth(
  async (req) => {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customerId')
    const userId = searchParams.get('userId')
    const recent = searchParams.get('recent') === 'true'
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    let logs: any[] = []

    if (customerId) {
      // Get logs for specific customer
      logs = await getPiiAccessLogs(customerId, limit)
    } else if (userId) {
      // Get logs for specific user
      logs = await getPiiAccessLogsByUser(userId, limit)
    } else if (recent) {
      // Get recent logs across all customers
      logs = await getRecentPiiAccessLogs(limit)
    } else {
      return NextResponse.json(
        {
          error: 'Please provide customerId, userId, or set recent=true',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    })
  },
  {
    requirePermission: 'analytics:view_all',
    enableAuditLog: true,
  }
)

/**
 * POST - Generate PII access report
 *
 * Body:
 * - startDate: Start date for report
 * - endDate: End date for report
 * - customerId: Optional customer filter
 * - userId: Optional user filter
 */
export const POST = withAuth(
  async (req) => {
    const body = await req.json()
    const { startDate, endDate, customerId, userId, action } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      )
    }

    const report = await generatePiiAccessReport({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      customerId,
      userId,
      action,
    })

    return NextResponse.json({
      success: true,
      report,
      period: {
        start: startDate,
        end: endDate,
      },
    })
  },
  {
    requirePermission: 'analytics:view_all',
    enableAuditLog: true,
  }
)

export const dynamic = 'force-dynamic'
