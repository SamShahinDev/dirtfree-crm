import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import { createReviewRequest } from '@/lib/reviews/request'

/**
 * Auto Review Requests Cron Job
 *
 * GET /api/cron/auto-review-requests
 *
 * Automatically creates review requests for recently completed jobs.
 *
 * Process:
 * 1. Find completed jobs from last 24 hours
 * 2. Check if review request already exists
 * 3. Create review request
 * 4. Send notification via email/SMS
 *
 * Timing:
 * - Sends review requests 24 hours after job completion
 * - This allows time for any issues to surface first
 *
 * Recommended schedule: Daily at 10 AM
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/auto-review-requests",
 *     "schedule": "0 10 every day (daily at 10 AM)"
 *   }]
 * }
 *
 * Authentication: Cron secret or Vercel internal
 */

function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message },
    { status }
  )
}

function createSuccessResponse<T>(data: T) {
  return NextResponse.json(
    { success: true, data, timestamp: new Date().toISOString() }
  )
}

/**
 * Verify cron authentication
 */
function verifyCronAuth(request: NextRequest): boolean {
  // Check Vercel cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  // Check if request is from Vercel
  const vercelSource = request.headers.get('x-vercel-source')
  if (vercelSource === 'cron') {
    return true
  }

  return false
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron authentication
    if (!verifyCronAuth(request)) {
      console.warn('[Cron] Unauthorized attempt to run auto review requests')
      return createErrorResponse('unauthorized', 'Invalid cron authentication', 401)
    }

    console.log('[Cron] Starting auto review request processing...')

    const supabase = getServiceSupabase()

    // Get completed jobs from 24 hours ago (give 1 hour buffer: 23-25 hours ago)
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneDayAgoStart = new Date(oneDayAgo.getTime() - 60 * 60 * 1000) // 25 hours ago
    const oneDayAgoEnd = new Date(oneDayAgo.getTime() + 60 * 60 * 1000) // 23 hours ago

    // Find completed jobs
    const { data: completedJobs, error: jobsError } = await supabase
      .from('jobs')
      .select(`
        id,
        customer_id,
        service_type,
        completed_at,
        status,
        customers (
          id,
          full_name,
          email,
          phone,
          communication_preferences
        )
      `)
      .eq('status', 'completed')
      .gte('completed_at', oneDayAgoStart.toISOString())
      .lte('completed_at', oneDayAgoEnd.toISOString())

    if (jobsError) {
      console.error('[Cron] Error fetching completed jobs:', jobsError)
      return createErrorResponse('fetch_failed', 'Failed to fetch completed jobs', 500)
    }

    if (!completedJobs || completedJobs.length === 0) {
      console.log('[Cron] No completed jobs found from 24 hours ago')
      return createSuccessResponse({
        message: 'No completed jobs to process',
        jobsProcessed: 0,
        reviewsCreated: 0,
        reviewsSent: 0,
      })
    }

    console.log(`[Cron] Found ${completedJobs.length} completed jobs from 24 hours ago`)

    let reviewsCreated = 0
    let reviewsSent = 0
    let errors: string[] = []

    // Process each job
    for (const job of completedJobs) {
      const customer = (job as any).customers

      if (!customer) {
        console.log(`[Cron] Skipping job ${(job as any).id} - no customer found`)
        continue
      }

      // Check if review request already exists
      const { data: existingRequest } = await supabase
        .from('review_requests')
        .select('id')
        .eq('customer_id', customer.id)
        .eq('job_id', (job as any).id)
        .single()

      if (existingRequest) {
        console.log(`[Cron] Review request already exists for job ${(job as any).id}`)
        continue
      }

      // Determine request method based on preferences
      const preferences = customer.communication_preferences || {}
      let requestMethod: 'portal' | 'email' | 'sms' = 'email'

      if (preferences.email_enabled !== false && customer.email) {
        requestMethod = 'email'
      } else if (preferences.sms_enabled && customer.phone) {
        requestMethod = 'sms'
      } else {
        requestMethod = 'portal'
      }

      // Create review request
      const result = await createReviewRequest({
        customerId: customer.id,
        jobId: (job as any).id,
        requestMethod,
        googleReviewRequested: true, // Always request Google review
      })

      if (result.success) {
        reviewsCreated++
        if (result.delivered) {
          reviewsSent++
        }
        console.log(`[Cron] Created review request for job ${(job as any).id} (${customer.full_name})`)
      } else {
        errors.push(`Job ${(job as any).id}: ${result.error}`)
        console.error(`[Cron] Failed to create review request for job ${(job as any).id}:`, result.error)
      }

      // Rate limiting: 50ms delay between requests
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    const duration = Date.now() - startTime

    console.log('[Cron] Auto review request processing completed:')
    console.log(`  - Jobs processed: ${completedJobs.length}`)
    console.log(`  - Reviews created: ${reviewsCreated}`)
    console.log(`  - Reviews sent: ${reviewsSent}`)
    console.log(`  - Errors: ${errors.length}`)
    console.log(`  - Duration: ${duration}ms`)

    return createSuccessResponse({
      message: 'Auto review requests processed successfully',
      jobsProcessed: completedJobs.length,
      reviewsCreated,
      reviewsSent,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    })
  } catch (error) {
    console.error('[Cron] Error processing auto review requests:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * Allow POST for manual triggering
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
