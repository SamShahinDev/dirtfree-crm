/**
 * Cron Job Executor
 *
 * Executes cron jobs with timeout, retry, and error handling.
 * Logs all executions to the database and tracks running jobs.
 */

import { cronJobs, getCronJob } from './registry'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { captureError, captureMessage } from '@/lib/errors/tracking'

export interface JobExecution {
  jobName: string
  startedAt: Date
  completedAt?: Date
  status: 'running' | 'success' | 'failed'
  error?: string
  duration?: number
  attempt?: number
}

export interface JobExecutionResult {
  success: boolean
  execution: JobExecution
  error?: Error
  skipped?: boolean
  reason?: string
}

/**
 * Track currently running jobs to prevent concurrent executions
 */
const runningJobs = new Map<string, JobExecution>()

/**
 * Execute a cron job by name
 *
 * Features:
 * - Timeout handling
 * - Retry logic with exponential backoff
 * - Concurrent execution prevention
 * - Sentry transaction tracking
 * - Database logging
 *
 * @param jobName - Name of the job to execute
 * @returns Execution result
 */
export async function executeCronJob(jobName: string): Promise<JobExecutionResult> {
  const job = getCronJob(jobName)

  if (!job) {
    const error = new Error(`Cron job not found: ${jobName}`)
    captureError(error, {
      severity: 'error',
      action: 'execute_cron_job',
      details: { jobName },
    })
    throw error
  }

  // Check if job is enabled
  if (!job.enabled) {
    console.log(`[CRON] Job ${jobName} is disabled, skipping execution`)
    return {
      success: false,
      execution: {
        jobName,
        startedAt: new Date(),
        status: 'failed',
      },
      skipped: true,
      reason: 'disabled',
    }
  }

  // Check if job is already running
  if (runningJobs.has(jobName)) {
    console.log(`[CRON] Job ${jobName} is already running, skipping execution`)
    return {
      success: false,
      execution: runningJobs.get(jobName)!,
      skipped: true,
      reason: 'already_running',
    }
  }

  // Initialize execution tracking
  const execution: JobExecution = {
    jobName,
    startedAt: new Date(),
    status: 'running',
  }

  runningJobs.set(jobName, execution)

  // Log job start
  await logJobExecution({
    job_name: jobName,
    status: 'started',
    started_at: execution.startedAt.toISOString(),
  })

  captureMessage(`Cron job started: ${jobName}`, 'info', {
    extra: {
      schedule: job.schedule,
      timeout: job.timeout,
      retries: job.retries,
    },
  })

  // Start Sentry transaction
  const transaction = Sentry.startTransaction({
    name: `cron.${jobName}`,
    op: 'cron',
    tags: {
      cron_job: jobName,
      schedule: job.schedule,
      category: job.category || 'unknown',
    },
  })

  let attempt = 0
  let lastError: Error | null = null

  // Retry loop
  while (attempt < job.retries) {
    attempt++
    execution.attempt = attempt

    try {
      console.log(`[CRON] Executing ${jobName} (attempt ${attempt}/${job.retries})`)

      // Execute job with timeout
      await Promise.race([
        job.handler(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Job timeout after ${job.timeout} seconds`)),
            job.timeout * 1000
          )
        ),
      ])

      // Success!
      execution.status = 'success'
      execution.completedAt = new Date()
      execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime()

      transaction.setStatus('ok')
      transaction.setTag('attempts', attempt)

      console.log(`[CRON] Job ${jobName} completed successfully in ${execution.duration}ms`)

      captureMessage(`Cron job completed: ${jobName}`, 'info', {
        extra: {
          duration: execution.duration,
          attempts: attempt,
        },
      })

      // Log success to database
      await logJobExecution({
        job_name: jobName,
        status: 'completed',
        started_at: execution.startedAt.toISOString(),
        completed_at: execution.completedAt.toISOString(),
        duration_ms: execution.duration,
        attempts: attempt,
      })

      runningJobs.delete(jobName)
      transaction.finish()

      return {
        success: true,
        execution,
      }
    } catch (error) {
      lastError = error as Error
      console.error(`[CRON] Job ${jobName} failed (attempt ${attempt}/${job.retries}):`, error)

      // If we have retries left, wait with exponential backoff
      if (attempt < job.retries) {
        const backoffMs = 5000 * attempt // 5s, 10s, 15s, etc.
        console.log(`[CRON] Retrying ${jobName} in ${backoffMs}ms...`)
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }

  // All retries exhausted - job failed
  execution.status = 'failed'
  execution.completedAt = new Date()
  execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime()
  execution.error = lastError?.message

  transaction.setStatus('internal_error')
  transaction.setTag('attempts', attempt)

  console.error(`[CRON] Job ${jobName} failed after ${attempt} attempts`)

  // Capture error to Sentry
  captureError(lastError!, {
    severity: 'error',
    action: 'cron_job_execution',
    details: {
      jobName,
      attempts: attempt,
      duration: execution.duration,
    },
  })

  // Log failure to database
  await logJobExecution({
    job_name: jobName,
    status: 'failed',
    started_at: execution.startedAt.toISOString(),
    completed_at: execution.completedAt.toISOString(),
    duration_ms: execution.duration,
    error_message: execution.error,
    attempts: attempt,
  })

  runningJobs.delete(jobName)
  transaction.finish()

  return {
    success: false,
    execution,
    error: lastError!,
  }
}

/**
 * Log job execution to database
 */
async function logJobExecution(data: {
  job_name: string
  status: 'started' | 'completed' | 'failed'
  started_at: string
  completed_at?: string
  duration_ms?: number
  error_message?: string
  attempts?: number
}): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('cron_job_logs').insert(data)

    if (error) {
      console.error('[CRON] Failed to log job execution:', error)
    }
  } catch (error) {
    console.error('[CRON] Failed to log job execution:', error)
  }
}

/**
 * Get currently running jobs
 */
export function getRunningJobs(): JobExecution[] {
  return Array.from(runningJobs.values())
}

/**
 * Check if a job is currently running
 */
export function isJobRunning(jobName: string): boolean {
  return runningJobs.has(jobName)
}

/**
 * Get job execution history from database
 */
export async function getJobExecutionHistory(
  jobName?: string,
  limit: number = 50
): Promise<any[]> {
  const supabase = createClient()

  let query = supabase
    .from('cron_job_logs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (jobName) {
    query = query.eq('job_name', jobName)
  }

  const { data, error } = await query

  if (error) {
    console.error('[CRON] Failed to fetch job execution history:', error)
    return []
  }

  return data || []
}

/**
 * Get job execution statistics
 */
export async function getJobStats(jobName: string): Promise<{
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  successRate: number
  avgDuration: number
  lastRun?: Date
  lastSuccess?: Date
  lastFailure?: Date
}> {
  const supabase = createClient()

  const { data: logs, error } = await supabase
    .from('cron_job_logs')
    .select('*')
    .eq('job_name', jobName)
    .order('started_at', { ascending: false })

  if (error || !logs || logs.length === 0) {
    return {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      successRate: 0,
      avgDuration: 0,
    }
  }

  const completedLogs = logs.filter((log) => log.status === 'completed')
  const failedLogs = logs.filter((log) => log.status === 'failed')

  const totalRuns = completedLogs.length + failedLogs.length
  const successfulRuns = completedLogs.length
  const failedRuns = failedLogs.length
  const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0

  const avgDuration =
    completedLogs.length > 0
      ? completedLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / completedLogs.length
      : 0

  return {
    totalRuns,
    successfulRuns,
    failedRuns,
    successRate,
    avgDuration,
    lastRun: logs[0]?.started_at ? new Date(logs[0].started_at) : undefined,
    lastSuccess: completedLogs[0]?.completed_at
      ? new Date(completedLogs[0].completed_at)
      : undefined,
    lastFailure: failedLogs[0]?.completed_at ? new Date(failedLogs[0].completed_at) : undefined,
  }
}

/**
 * Get statistics for all jobs
 */
export async function getAllJobsStats(): Promise<
  Map<
    string,
    {
      totalRuns: number
      successfulRuns: number
      failedRuns: number
      successRate: number
      avgDuration: number
      lastRun?: Date
    }
  >
> {
  const stats = new Map()

  for (const job of cronJobs) {
    const jobStats = await getJobStats(job.name)
    stats.set(job.name, jobStats)
  }

  return stats
}
