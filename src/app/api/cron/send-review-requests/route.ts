import { NextRequest, NextResponse } from 'next/server'
import { getEligibleJobsForReview, processBatchAutoReviewRequests } from '@/lib/reviews/auto-request'

/**
 * Send Review Requests Cron Job
 *
 * GET /api/cron/send-review-requests
 *
 * Automated review request system triggered every 6 hours.
 *
 * Process:
 * 1. Find completed jobs from 24-48 hours ago
 * 2. Check eligibility:
 *    - Job status = completed
 *    - No existing review request
 *    - Customer hasn't opted out
 *    - Job value >= $50
 * 3. Send review requests via portal, email, or SMS
 * 4. Create review_requests records
 *
 * Eligibility Criteria:
 * - Job completed between 24-48 hours ago
 * - Job value >= $50 minimum threshold
 * - No existing review request for this job
 * - Customer has not opted out of review requests
 * - Customer has at least one communication channel enabled
 *
 * Delivery Channels:
 * - Portal: Always enabled for eligible customers
 * - Email: Sent if customer has email and hasn't opted out
 * - SMS: Sent only to high-value customers (lifetime value > $500 OR total jobs >= 3)
 *
 * Schedule: Every 6 hours
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/send-review-requests",
 *     "schedule": "0 star-slash-6 star star star (every 6 hours)"
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
      console.warn('[Cron] Unauthorized attempt to run send review requests')
      return createErrorResponse('unauthorized', 'Invalid cron authentication', 401)
    }

    console.log('[Cron] Starting automated review request processing...')
    console.log(`[Cron] Time: ${new Date().toISOString()}`)

    // Get eligible jobs (completed 24-48 hours ago)
    const eligibleJobIds = await getEligibleJobsForReview()

    if (eligibleJobIds.length === 0) {
      console.log('[Cron] No eligible jobs found for review requests')
      return createSuccessResponse({
        message: 'No eligible jobs to process',
        jobsFound: 0,
        reviewsCreated: 0,
        reviewsSent: 0,
        reviewsSkipped: 0,
      })
    }

    console.log(`[Cron] Found ${eligibleJobIds.length} eligible jobs`)

    // Process batch of jobs
    const result = await processBatchAutoReviewRequests(eligibleJobIds)

    const duration = Date.now() - startTime

    // Log detailed results
    console.log('[Cron] Automated review request processing completed:')
    console.log(`  - Jobs found: ${eligibleJobIds.length}`)
    console.log(`  - Total processed: ${result.totalProcessed}`)
    console.log(`  - Successful: ${result.successful}`)
    console.log(`  - Skipped: ${result.skipped}`)
    console.log(`  - Failed: ${result.failed}`)
    console.log(`  - Duration: ${duration}ms`)

    // Log skip reasons for debugging
    const skipReasons = result.results
      .filter((r) => r.skipped && r.skipReason)
      .reduce((acc, r) => {
        const reason = r.skipReason || 'Unknown'
        acc[reason] = (acc[reason] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    if (Object.keys(skipReasons).length > 0) {
      console.log('\n  Skip reasons breakdown:')
      Object.entries(skipReasons).forEach(([reason, count]) => {
        console.log(`    - ${reason}: ${count}`)
      })
    }

    // Log errors if any
    const errors = result.results
      .filter((r) => !r.success && !r.skipped && r.error)
      .map((r) => r.error)

    if (errors.length > 0) {
      console.log('\n  Errors encountered:')
      errors.forEach((error, index) => {
        console.log(`    ${index + 1}. ${error}`)
      })
    }

    return createSuccessResponse({
      message: 'Automated review requests processed successfully',
      summary: {
        jobsFound: eligibleJobIds.length,
        totalProcessed: result.totalProcessed,
        reviewsCreated: result.successful,
        reviewsSkipped: result.skipped,
        reviewsFailed: result.failed,
        duration,
      },
      skipReasons: Object.keys(skipReasons).length > 0 ? skipReasons : undefined,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit to first 10 errors
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[Cron] Error processing automated review requests:', error)

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
