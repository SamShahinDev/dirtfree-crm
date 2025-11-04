/**
 * Cron Jobs Management API
 *
 * List all cron jobs with statistics and execution history.
 * Protected by admin authentication.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { cronJobs } from '@/lib/cron/registry'
import { getAllJobsStats, getRunningJobs } from '@/lib/cron/executor'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET - List all cron jobs with statistics
 */
export const GET = withAuth(
  async (req) => {
    try {
      const supabase = createClient()

      // Get stats for all jobs
      const statsMap = await getAllJobsStats()

      // Get job configurations from database
      const { data: configs } = await supabase
        .from('cron_job_config')
        .select('*')

      const configMap = new Map(configs?.map((c) => [c.job_name, c]) || [])

      // Get running jobs
      const runningJobs = getRunningJobs()
      const runningJobNames = new Set(runningJobs.map((j) => j.jobName))

      // Build response with job details and stats
      const jobs = cronJobs.map((job) => {
        const stats = statsMap.get(job.name) || {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          successRate: 0,
          avgDuration: 0,
        }

        const config = configMap.get(job.name)
        const isRunning = runningJobNames.has(job.name)

        return {
          name: job.name,
          description: job.description,
          schedule: job.schedule,
          category: job.category,
          timeout: job.timeout,
          retries: job.retries,
          enabled: config?.enabled ?? job.enabled,
          isRunning,
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
        }
      })

      // Group by category
      const categories = {
        opportunities: jobs.filter((j) => j.category === 'opportunities'),
        promotions: jobs.filter((j) => j.category === 'promotions'),
        reviews: jobs.filter((j) => j.category === 'reviews'),
        loyalty: jobs.filter((j) => j.category === 'loyalty'),
        analytics: jobs.filter((j) => j.category === 'analytics'),
        monitoring: jobs.filter((j) => j.category === 'monitoring'),
        cleanup: jobs.filter((j) => j.category === 'cleanup'),
      }

      // Calculate summary stats
      const summary = {
        totalJobs: jobs.length,
        enabledJobs: jobs.filter((j) => j.enabled).length,
        disabledJobs: jobs.filter((j) => !j.enabled).length,
        runningJobs: jobs.filter((j) => j.isRunning).length,
        totalExecutions: jobs.reduce((sum, j) => sum + j.stats.totalRuns, 0),
        totalFailures: jobs.reduce((sum, j) => sum + j.stats.failedRuns, 0),
        overallSuccessRate:
          jobs.length > 0
            ? Math.round(
                (jobs.reduce((sum, j) => sum + j.stats.successRate, 0) / jobs.length) * 100
              ) / 100
            : 0,
      }

      return NextResponse.json({
        success: true,
        summary,
        jobs,
        categories,
        runningJobs: runningJobs.map((j) => ({
          name: j.jobName,
          startedAt: j.startedAt,
          duration: Date.now() - j.startedAt.getTime(),
        })),
      })
    } catch (error) {
      console.error('Failed to fetch cron jobs:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch cron jobs',
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
