/**
 * Test Report Generation API
 *
 * Generate a test report without sending emails.
 * Protected by admin authentication.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { testReportGeneration } from '@/lib/reports/scheduler'

export const dynamic = 'force-dynamic'

/**
 * POST - Test report generation
 */
export const POST = withAuth(
  async (req, { params }: { params: { reportId: string } }) => {
    try {
      const body = await req.json()
      const { reportType, format, filters } = body

      if (!reportType || !format) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields',
          },
          { status: 400 }
        )
      }

      // Test report generation
      const result = await testReportGeneration(reportType, format, filters || {})

      return NextResponse.json({
        success: true,
        result: {
          fileName: result.fileName,
          fileSize: result.fileSize,
          fileSizeKB: (result.fileSize / 1024).toFixed(2),
        },
        message: 'Test report generated successfully (not sent)',
      })
    } catch (error) {
      console.error('Test report generation error:', error)
      return NextResponse.json(
        {
          success: false,
          error: (error as Error).message || 'Failed to generate test report',
        },
        { status: 500 }
      )
    }
  },
  {
    requirePermission: 'analytics:view_all',
    enableAuditLog: false,
  }
)
