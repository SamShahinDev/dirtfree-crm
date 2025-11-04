/**
 * Toggle Cron Job Endpoint
 *
 * Enable or disable a cron job.
 * Protected by admin authentication.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { getCronJob } from '@/lib/cron/registry'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST - Toggle job enabled state
 */
export const POST = withAuth(
  async (req, { params }: { params: { jobName: string } }) => {
    try {
      const { jobName } = params
      const body = await req.json()
      const { enabled } = body

      if (typeof enabled !== 'boolean') {
        return NextResponse.json(
          {
            success: false,
            error: 'enabled field must be a boolean',
          },
          { status: 400 }
        )
      }

      // Validate job exists
      const job = getCronJob(jobName)
      if (!job) {
        return NextResponse.json(
          {
            success: false,
            error: 'Job not found',
          },
          { status: 404 }
        )
      }

      // Get user ID from request
      const userId = req.user?.id

      // Update job configuration in database
      const supabase = createClient()
      const { error } = await supabase.rpc('toggle_cron_job', {
        p_job_name: jobName,
        p_enabled: enabled,
        p_user_id: userId,
      })

      if (error) {
        console.error('Failed to toggle cron job:', error)
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update job configuration',
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        jobName,
        enabled,
        message: `Job ${jobName} ${enabled ? 'enabled' : 'disabled'}`,
      })
    } catch (error) {
      console.error('Toggle cron job error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to toggle job',
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
