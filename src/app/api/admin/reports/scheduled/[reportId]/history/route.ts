/**
 * Report Generation History API
 *
 * Get generation history for a specific scheduled report.
 * Protected by admin authentication.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET - Get report generation history
 */
export const GET = withAuth(
  async (req, { params }: { params: { reportId: string } }) => {
    try {
      const { reportId } = params
      const { searchParams } = new URL(req.url)
      const days = parseInt(searchParams.get('days') || '30')

      const supabase = createClient()

      // Get report details
      const { data: report, error: reportError } = await supabase
        .from('scheduled_reports')
        .select('*')
        .eq('id', reportId)
        .single()

      if (reportError || !report) {
        return NextResponse.json(
          {
            success: false,
            error: 'Report not found',
          },
          { status: 404 }
        )
      }

      // Get generation history
      const { data: history, error: historyError } = await supabase.rpc(
        'get_report_generation_history',
        {
          p_report_id: reportId,
          p_days: days,
        }
      )

      if (historyError) {
        console.error('Failed to fetch generation history:', historyError)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch history',
          },
          { status: 500 }
        )
      }

      // Get success rate
      const { data: successRate } = await supabase.rpc('get_report_success_rate', {
        p_report_id: reportId,
        p_days: days,
      })

      // Calculate statistics
      const total = history?.length || 0
      const successful = history?.filter((h: any) => h.status === 'success').length || 0
      const failed = history?.filter((h: any) => h.status === 'failed').length || 0

      return NextResponse.json({
        success: true,
        report: {
          id: report.id,
          name: report.name,
          reportType: report.report_type,
          format: report.format,
        },
        stats: {
          total,
          successful,
          failed,
          successRate: successRate || 100,
        },
        history: history || [],
      })
    } catch (error) {
      console.error('Get report history error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get history',
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
