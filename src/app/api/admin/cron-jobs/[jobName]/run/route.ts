/**
 * Manual Cron Job Execution Endpoint
 *
 * Manually trigger a cron job execution.
 * Protected by admin authentication.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { executeCronJob, isJobRunning } from '@/lib/cron/executor'
import { getCronJob } from '@/lib/cron/registry'

export const dynamic = 'force-dynamic'

/**
 * POST - Manually run a cron job
 */
export const POST = withAuth(
  async (req, { params }: { params: { jobName: string } }) => {
    try {
      const { jobName } = params

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

      // Check if job is already running
      if (isJobRunning(jobName)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Job is already running',
            jobName,
          },
          { status: 409 }
        )
      }

      // Execute job asynchronously
      // Note: We don't await here to allow long-running jobs
      executeCronJob(jobName)
        .then((result) => {
          if (result.success) {
            console.log(`[CRON] Manual execution of ${jobName} completed successfully`)
          } else {
            console.error(`[CRON] Manual execution of ${jobName} failed:`, result.error)
          }
        })
        .catch((error) => {
          console.error(`[CRON] Manual execution of ${jobName} error:`, error)
        })

      return NextResponse.json({
        success: true,
        jobName,
        message: `Job ${jobName} has been queued for execution`,
        note: 'Job is running asynchronously. Check execution history for results.',
      })
    } catch (error) {
      console.error('Manual cron job execution error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to execute job',
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
