/**
 * Background Job Queue System
 *
 * Efficient job processing with:
 * - Priority-based queue
 * - Concurrent processing
 * - Automatic retries with exponential backoff
 * - Job persistence to database
 * - Status monitoring
 *
 * Usage:
 * ```typescript
 * import { jobQueue } from '@/lib/jobs/job-queue'
 *
 * await jobQueue.addJob({
 *   type: 'send_promotion',
 *   payload: { customerId: '123', promotionId: '456' },
 *   priority: 5,
 *   maxRetries: 3,
 *   scheduledFor: new Date(),
 * })
 * ```
 */

import { nanoid } from 'nanoid'
import { createClient } from '@/lib/supabase/server'

// =====================================================
// Types
// =====================================================

export interface Job {
  id: string
  type: JobType
  payload: any
  priority: number
  maxRetries: number
  retryCount: number
  scheduledFor: Date
  status: JobStatus
  startedAt?: Date
  completedAt?: Date
  errorMessage?: string
  createdAt: Date
}

export type JobType =
  | 'send_promotion'
  | 'send_review_request'
  | 'process_opportunity_offer'
  | 'send_reminder'
  | 'generate_report'
  | 'sync_customer_data'
  | 'process_payment'
  | 'send_notification'
  | 'cleanup_old_data'
  | 'update_analytics'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type JobInput = Omit<Job, 'id' | 'status' | 'retryCount' | 'createdAt'>

interface JobQueueConfig {
  concurrency?: number
  pollInterval?: number
  enablePersistence?: boolean
}

// =====================================================
// Job Processors
// =====================================================

type JobProcessor = (payload: any) => Promise<void>

const jobProcessors: Record<JobType, JobProcessor> = {
  send_promotion: async (payload) => {
    const { sendPromotionEmail } = await import('./processors/promotion-processor')
    await sendPromotionEmail(payload)
  },
  send_review_request: async (payload) => {
    const { sendReviewRequest } = await import('./processors/review-processor')
    await sendReviewRequest(payload)
  },
  process_opportunity_offer: async (payload) => {
    const { processOpportunityOffer } = await import('./processors/opportunity-processor')
    await processOpportunityOffer(payload)
  },
  send_reminder: async (payload) => {
    const { sendReminder } = await import('./processors/reminder-processor')
    await sendReminder(payload)
  },
  generate_report: async (payload) => {
    const { generateReport } = await import('./processors/report-processor')
    await generateReport(payload)
  },
  sync_customer_data: async (payload) => {
    const { syncCustomerData } = await import('./processors/sync-processor')
    await syncCustomerData(payload)
  },
  process_payment: async (payload) => {
    const { processPayment } = await import('./processors/payment-processor')
    await processPayment(payload)
  },
  send_notification: async (payload) => {
    const { sendNotification } = await import('./processors/notification-processor')
    await sendNotification(payload)
  },
  cleanup_old_data: async (payload) => {
    const { cleanupOldData } = await import('./processors/cleanup-processor')
    await cleanupOldData(payload)
  },
  update_analytics: async (payload) => {
    const { updateAnalytics } = await import('./processors/analytics-processor')
    await updateAnalytics(payload)
  },
}

// =====================================================
// Job Queue Class
// =====================================================

class JobQueue {
  private queue: Job[] = []
  private processing = false
  private concurrency: number
  private pollInterval: number
  private enablePersistence: boolean
  private pollTimer?: NodeJS.Timeout

  constructor(config: JobQueueConfig = {}) {
    this.concurrency = config.concurrency || 3
    this.pollInterval = config.pollInterval || 5000 // 5 seconds
    this.enablePersistence = config.enablePersistence !== false

    // Start polling for scheduled jobs
    if (this.enablePersistence) {
      this.startPolling()
    }
  }

  /**
   * Add a job to the queue
   */
  async addJob(jobInput: JobInput): Promise<string> {
    const newJob: Job = {
      ...jobInput,
      id: nanoid(),
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
    }

    // Persist to database if enabled
    if (this.enablePersistence) {
      await this.persistJob(newJob)
    }

    // Add to in-memory queue if scheduled for now or past
    if (newJob.scheduledFor <= new Date()) {
      this.queue.push(newJob)
      this.sortQueue()

      if (!this.processing) {
        this.processQueue()
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Job Queue] Added job ${newJob.id} (${newJob.type}) with priority ${newJob.priority}`)
    }

    return newJob.id
  }

  /**
   * Add multiple jobs at once
   */
  async addBatch(jobs: JobInput[]): Promise<string[]> {
    const jobIds = await Promise.all(jobs.map((job) => this.addJob(job)))
    return jobIds
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    this.processing = true

    while (this.queue.length > 0) {
      // Get batch of jobs respecting concurrency
      const batch = this.queue.splice(0, this.concurrency)

      // Process batch concurrently
      await Promise.allSettled(batch.map((job) => this.processJob(job)))
    }

    this.processing = false
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    try {
      job.status = 'processing'
      job.startedAt = new Date()

      if (this.enablePersistence) {
        await this.updateJobStatus(job)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Job Queue] Processing job ${job.id} (${job.type})`)
      }

      // Get processor for job type
      const processor = jobProcessors[job.type]
      if (!processor) {
        throw new Error(`No processor found for job type: ${job.type}`)
      }

      // Execute job
      await processor(job.payload)

      // Mark as completed
      job.status = 'completed'
      job.completedAt = new Date()

      if (this.enablePersistence) {
        await this.updateJobStatus(job)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Job Queue] Completed job ${job.id} (${job.type})`)
      }
    } catch (error) {
      await this.handleJobError(job, error)
    }
  }

  /**
   * Handle job error with retry logic
   */
  private async handleJobError(job: Job, error: any): Promise<void> {
    job.retryCount++
    job.errorMessage = error instanceof Error ? error.message : String(error)

    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[Job Queue] Job ${job.id} failed (attempt ${job.retryCount}/${job.maxRetries}):`,
        error
      )
    }

    if (job.retryCount < job.maxRetries) {
      // Retry with exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, job.retryCount), 300000) // Max 5 minutes
      job.status = 'pending'
      job.scheduledFor = new Date(Date.now() + backoffMs)

      if (this.enablePersistence) {
        await this.updateJobStatus(job)
      }

      // Re-add to queue
      this.queue.push(job)
      this.sortQueue()
    } else {
      // Max retries reached
      job.status = 'failed'
      job.completedAt = new Date()

      if (this.enablePersistence) {
        await this.updateJobStatus(job)
      }

      console.error(
        `[Job Queue] Job ${job.id} (${job.type}) failed permanently after ${job.maxRetries} retries:`,
        error
      )
    }
  }

  /**
   * Sort queue by priority (highest first) and scheduled time
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // First by priority (higher first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      // Then by scheduled time (earlier first)
      return a.scheduledFor.getTime() - b.scheduledFor.getTime()
    })
  }

  /**
   * Start polling for scheduled jobs
   */
  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.loadScheduledJobs()
    }, this.pollInterval)
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }
  }

  /**
   * Load scheduled jobs from database
   */
  private async loadScheduledJobs(): Promise<void> {
    try {
      const supabase = await createClient()

      const { data: jobs, error } = await supabase
        .from('background_jobs')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .order('priority', { ascending: false })
        .order('scheduled_for', { ascending: true })
        .limit(100)

      if (error) throw error

      if (jobs && jobs.length > 0) {
        for (const dbJob of jobs) {
          const job: Job = {
            id: dbJob.id,
            type: dbJob.job_type as JobType,
            payload: dbJob.payload,
            priority: dbJob.priority,
            maxRetries: dbJob.max_retries,
            retryCount: dbJob.retry_count,
            scheduledFor: new Date(dbJob.scheduled_for),
            status: dbJob.status as JobStatus,
            createdAt: new Date(dbJob.created_at),
          }

          // Check if already in queue
          if (!this.queue.find((q) => q.id === job.id)) {
            this.queue.push(job)
          }
        }

        this.sortQueue()

        if (!this.processing) {
          this.processQueue()
        }
      }
    } catch (error) {
      console.error('[Job Queue] Error loading scheduled jobs:', error)
    }
  }

  /**
   * Persist job to database
   */
  private async persistJob(job: Job): Promise<void> {
    try {
      const supabase = await createClient()

      const { error } = await supabase.from('background_jobs').insert({
        id: job.id,
        job_type: job.type,
        payload: job.payload,
        status: job.status,
        priority: job.priority,
        retry_count: job.retryCount,
        max_retries: job.maxRetries,
        scheduled_for: job.scheduledFor.toISOString(),
        created_at: job.createdAt.toISOString(),
      })

      if (error) throw error
    } catch (error) {
      console.error('[Job Queue] Error persisting job:', error)
    }
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(job: Job): Promise<void> {
    try {
      const supabase = await createClient()

      const { error } = await supabase
        .from('background_jobs')
        .update({
          status: job.status,
          retry_count: job.retryCount,
          scheduled_for: job.scheduledFor.toISOString(),
          started_at: job.startedAt?.toISOString(),
          completed_at: job.completedAt?.toISOString(),
          error_message: job.errorMessage,
        })
        .eq('id', job.id)

      if (error) throw error
    } catch (error) {
      console.error('[Job Queue] Error updating job status:', error)
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    queueLength: number
    processing: boolean
    concurrency: number
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      concurrency: this.concurrency,
    }
  }

  /**
   * Get job by ID from database
   */
  async getJob(jobId: string): Promise<Job | null> {
    try {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('background_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      if (error) throw error
      if (!data) return null

      return {
        id: data.id,
        type: data.job_type as JobType,
        payload: data.payload,
        priority: data.priority,
        maxRetries: data.max_retries,
        retryCount: data.retry_count,
        scheduledFor: new Date(data.scheduled_for),
        status: data.status as JobStatus,
        startedAt: data.started_at ? new Date(data.started_at) : undefined,
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        errorMessage: data.error_message,
        createdAt: new Date(data.created_at),
      }
    } catch (error) {
      console.error('[Job Queue] Error getting job:', error)
      return null
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId)
      if (!job) return false

      // Reset job
      job.status = 'pending'
      job.retryCount = 0
      job.scheduledFor = new Date()
      job.errorMessage = undefined

      await this.updateJobStatus(job)
      await this.loadScheduledJobs()

      return true
    } catch (error) {
      console.error('[Job Queue] Error retrying job:', error)
      return false
    }
  }
}

// =====================================================
// Singleton Instance
// =====================================================

export const jobQueue = new JobQueue({
  concurrency: parseInt(process.env.JOB_QUEUE_CONCURRENCY || '3'),
  pollInterval: parseInt(process.env.JOB_QUEUE_POLL_INTERVAL || '5000'),
  enablePersistence: process.env.JOB_QUEUE_PERSISTENCE !== 'false',
})

// =====================================================
// Helper Functions
// =====================================================

/**
 * Calculate job priority based on various factors
 */
export function calculatePriority(factors: {
  urgency?: 'low' | 'medium' | 'high' | 'critical'
  customerTier?: 'standard' | 'premium' | 'vip'
  value?: number
}): number {
  let priority = 5 // Default medium priority

  // Urgency
  switch (factors.urgency) {
    case 'critical':
      priority += 5
      break
    case 'high':
      priority += 3
      break
    case 'medium':
      priority += 0
      break
    case 'low':
      priority -= 2
      break
  }

  // Customer tier
  switch (factors.customerTier) {
    case 'vip':
      priority += 3
      break
    case 'premium':
      priority += 2
      break
    case 'standard':
      priority += 0
      break
  }

  // Value
  if (factors.value) {
    if (factors.value > 10000) priority += 3
    else if (factors.value > 5000) priority += 2
    else if (factors.value > 1000) priority += 1
  }

  return Math.max(1, Math.min(10, priority)) // Clamp between 1-10
}

/**
 * Batch process items
 */
export async function batchProcess<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  batchSize: number = 50
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(processor))
  }
}
