/**
 * Cron Job Execution History Endpoint
 *
 * Get execution history for a specific cron job.
 * Protected by admin authentication.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { getCronJob } from '@/lib/cron/registry'
import { getJobExecutionHistory, getJobStats } from '@/lib/cron/executor'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET - Fetch job execution history
 */
export const GET = withAuth(
  async (req, { params }: { params: { jobName: string } }) => {
    try {
      const { jobName } = params
      const { searchParams } = new URL(req.url)
      const limit = parseInt(searchParams.get('limit') || '50')
      const days = parseInt(searchParams.get('days') || '30')

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

      // Get execution history
      const history = await getJobExecutionHistory(jobName, limit)

      // Get job stats
      const stats = await getJobStats(jobName)

      // Get timeline data
      const supabase = createClient()
      const { data: timeline } = await supabase.rpc('get_cron_job_timeline', {
        p_job_name: jobName,
        p_hours: days * 24,
      })

      return NextResponse.json({
        success: true,
        jobName,
        job: {
          name: job.name,
          description: job.description,
          schedule: job.schedule,
          category: job.category,
          timeout: job.timeout,
          retries: job.retries,
        },
        stats: {
          totalRuns: stats.totalRuns,
          successfulRuns: stats.successfulRuns,
          failedRuns: stats.failedRuns,
          successRate: Math.round(stats.successRate * 100) / 100,
          avgDuration: Math.round(stats.avgDuration),
          lastRun: stats.lastRun,
          lastSuccess: stats.lastSuccess,
          lastFailure: stats.lastFailure,
        },
        history: history.map((log) => ({
          id: log.id,
          status: log.status,
          startedAt: log.started_at,
          completedAt: log.completed_at,
          duration: log.duration_ms,
          error: log.error_message,
          attempts: log.attempts,
        })),
        timeline: timeline || [],
      })
    } catch (error) {
      console.error('Fetch cron job history error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch job history',
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
