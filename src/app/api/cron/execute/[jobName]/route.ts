/**
 * Unified Cron Job Execution Endpoint
 *
 * Executes any registered cron job by name.
 * Protected by cron secret authentication.
 *
 * Usage:
 * POST /api/cron/execute/health-check
 * Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse } from 'next/server'
import { executeCronJob } from '@/lib/cron/executor'
import { getCronJob } from '@/lib/cron/registry'
import { captureError } from '@/lib/errors/tracking'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: { jobName: string } }
) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET) {
      console.error('[CRON] CRON_SECRET environment variable is not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (authHeader !== expectedAuth) {
      console.warn('[CRON] Unauthorized cron job execution attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { jobName } = params

    // Validate job exists
    const job = getCronJob(jobName)
    if (!job) {
      console.error(`[CRON] Job not found: ${jobName}`)
      return NextResponse.json(
        {
          error: 'Job not found',
          jobName,
          availableJobs: 'See /api/cron/jobs for available jobs',
        },
        { status: 404 }
      )
    }

    console.log(`[CRON] Executing job: ${jobName}`)

    // Execute the job
    const result = await executeCronJob(jobName)

    if (result.skipped) {
      return NextResponse.json(
        {
          success: false,
          skipped: true,
          reason: result.reason,
          jobName,
          message: `Job ${jobName} was skipped: ${result.reason}`,
        },
        { status: 200 }
      )
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        jobName,
        execution: {
          startedAt: result.execution.startedAt,
          completedAt: result.execution.completedAt,
          duration: result.execution.duration,
          status: result.execution.status,
        },
        message: `Job ${jobName} completed successfully`,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          jobName,
          execution: {
            startedAt: result.execution.startedAt,
            completedAt: result.execution.completedAt,
            duration: result.execution.duration,
            status: result.execution.status,
            error: result.execution.error,
          },
          error: result.error?.message,
          message: `Job ${jobName} failed`,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[CRON] Cron execution error:', error)
    captureError(error as Error, {
      severity: 'error',
      action: 'cron_execution_endpoint',
      details: {
        jobName: params.jobName,
      },
    })

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        jobName: params.jobName,
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler for job information
 */
export async function GET(
  req: Request,
  { params }: { params: { jobName: string } }
) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { jobName } = params

    // Get job configuration
    const job = getCronJob(jobName)
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      name: job.name,
      schedule: job.schedule,
      enabled: job.enabled,
      timeout: job.timeout,
      retries: job.retries,
      description: job.description,
      category: job.category,
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
