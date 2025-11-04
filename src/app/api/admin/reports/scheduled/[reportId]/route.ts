/**
 * Individual Scheduled Report Management API
 *
 * Get, update, and delete a specific scheduled report.
 * Protected by admin authentication.
 */

import { NextResponse } from 'next/response'
import { withAuth } from '@/middleware/api-auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET - Get a specific scheduled report
 */
export const GET = withAuth(
  async (req, { params }: { params: { reportId: string } }) => {
    try {
      const { reportId } = params
      const supabase = createClient()

      const { data: report, error } = await supabase
        .from('scheduled_reports')
        .select('*')
        .eq('id', reportId)
        .single()

      if (error || !report) {
        return NextResponse.json(
          {
            success: false,
            error: 'Report not found',
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        report,
      })
    } catch (error) {
      console.error('Get scheduled report error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to get report',
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
 * PATCH - Update a scheduled report
 */
export const PATCH = withAuth(
  async (req, { params }: { params: { reportId: string } }) => {
    try {
      const { reportId } = params
      const body = await req.json()

      const supabase = createClient()

      // Update report
      const { data, error } = await supabase
        .from('scheduled_reports')
        .update(body)
        .eq('id', reportId)
        .select()
        .single()

      if (error) {
        console.error('Failed to update scheduled report:', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update report',
          },
          { status: 500 }
        )
      }

      if (!data) {
        return NextResponse.json(
          {
            success: false,
            error: 'Report not found',
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        report: data,
      })
    } catch (error) {
      console.error('Update scheduled report error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update report',
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
 * DELETE - Delete a scheduled report
 */
export const DELETE = withAuth(
  async (req, { params }: { params: { reportId: string } }) => {
    try {
      const { reportId } = params
      const supabase = createClient()

      const { error } = await supabase
        .from('scheduled_reports')
        .delete()
        .eq('id', reportId)

      if (error) {
        console.error('Failed to delete scheduled report:', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to delete report',
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Report deleted successfully',
      })
    } catch (error) {
      console.error('Delete scheduled report error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete report',
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
