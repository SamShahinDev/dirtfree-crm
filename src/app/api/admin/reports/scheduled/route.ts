/**
 * Scheduled Reports Management API
 *
 * List, create, update, and delete scheduled reports.
 * Protected by admin authentication.
 */

import { NextResponse } from 'next/response'
import { withAuth } from '@/middleware/api-auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET - List all scheduled reports with statistics
 */
export const GET = withAuth(
  async (req) => {
    try {
      const supabase = createClient()

      // Get all scheduled reports
      const { data: reports, error } = await supabase
        .from('scheduled_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch scheduled reports:', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch reports',
          },
          { status: 500 }
        )
      }

      // Get statistics for each report
      const reportsWithStats = await Promise.all(
        (reports || []).map(async (report) => {
          const { data: stats } = await supabase.rpc('get_report_success_rate', {
            p_report_id: report.id,
            p_days: 30,
          })

          const { data: history } = await supabase.rpc('get_report_generation_history', {
            p_report_id: report.id,
            p_days: 30,
          })

          return {
            ...report,
            stats: {
              successRate: stats || 100,
              totalGenerations: history?.length || 0,
              lastGenerated: history?.[0]?.generated_at || null,
            },
          }
        })
      )

      return NextResponse.json({
        success: true,
        reports: reportsWithStats,
      })
    } catch (error) {
      console.error('List scheduled reports error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to list reports',
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

/**
 * POST - Create a new scheduled report
 */
export const POST = withAuth(
  async (req) => {
    try {
      const body = await req.json()
      const { name, reportType, schedule, recipients, filters, format, enabled } = body

      // Validate required fields
      if (!name || !reportType || !schedule || !recipients || !format) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields',
          },
          { status: 400 }
        )
      }

      if (!Array.isArray(recipients) || recipients.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Recipients must be a non-empty array',
          },
          { status: 400 }
        )
      }

      // Validate report type
      const validTypes = [
        'revenue_summary',
        'customer_activity',
        'opportunity_pipeline',
        'promotion_performance',
        'loyalty_engagement',
      ]
      if (!validTypes.includes(reportType)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid report type',
          },
          { status: 400 }
        )
      }

      // Validate format
      const validFormats = ['pdf', 'csv', 'excel']
      if (!validFormats.includes(format)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid format',
          },
          { status: 400 }
        )
      }

      const supabase = createClient()
      const userId = req.user?.id

      // Create scheduled report
      const { data, error } = await supabase
        .from('scheduled_reports')
        .insert({
          name,
          report_type: reportType,
          schedule,
          recipients,
          filters: filters || {},
          format,
          enabled: enabled !== undefined ? enabled : true,
          created_by_user_id: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create scheduled report:', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to create report',
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        report: data,
      })
    } catch (error) {
      console.error('Create scheduled report error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create report',
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
