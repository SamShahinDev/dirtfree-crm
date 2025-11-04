/**
 * Manual Report Generation API
 *
 * Manually trigger a scheduled report generation and send emails.
 * Protected by admin authentication.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { generateScheduledReport } from '@/lib/reports/scheduler'

export const dynamic = 'force-dynamic'

/**
 * POST - Manually generate and send a report
 */
export const POST = withAuth(
  async (req, { params }: { params: { reportId: string } }) => {
    try {
      const { reportId } = params

      // Generate and send report asynchronously
      generateScheduledReport(reportId)
        .then(() => {
          console.log(`[REPORTS] Manual generation of ${reportId} completed successfully`)
        })
        .catch((error) => {
          console.error(`[REPORTS] Manual generation of ${reportId} failed:`, error)
        })

      return NextResponse.json({
        success: true,
        message: 'Report generation started',
        note: 'Report is being generated asynchronously. Check history for results.',
      })
    } catch (error) {
      console.error('Manual report generation error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to start report generation',
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
