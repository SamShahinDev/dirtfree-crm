import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import { sendReviewReminder } from '@/lib/reviews/request'

/**
 * Review Follow-up Reminders Cron Job
 *
 * GET /api/cron/review-reminders
 *
 * Sends follow-up reminders for pending review requests.
 *
 * Process:
 * 1. Find pending review requests 3+ days old
 * 2. Check if reminder already sent within last 7 days
 * 3. Send reminder notification
 * 4. Update reminder_sent flag
 *
 * Reminder Strategy:
 * - First reminder: 3 days after initial request
 * - Second reminder: 7 days after first reminder (if still pending)
 * - No more reminders after second attempt
 *
 * Recommended schedule: Daily at 11 AM
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/review-reminders",
 *     "schedule": "0 11 every day (daily at 11 AM)"
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
      console.warn('[Cron] Unauthorized attempt to run review reminders')
      return createErrorResponse('unauthorized', 'Invalid cron authentication', 401)
    }

    console.log('[Cron] Starting review reminder processing...')

    const supabase = getServiceSupabase()

    // Get pending review requests needing follow-up
    const { data: pendingReviews, error: reviewsError } = await (supabase as any)
      .rpc('get_pending_review_requests', { days_old: 3 })

    if (reviewsError) {
      console.error('[Cron] Error fetching pending reviews:', reviewsError)
      return createErrorResponse('fetch_failed', 'Failed to fetch pending reviews', 500)
    }

    if (!pendingReviews || pendingReviews.length === 0) {
      console.log('[Cron] No pending reviews needing reminders')
      return createSuccessResponse({
        message: 'No pending reviews to remind',
        reviewsProcessed: 0,
        remindersSent: 0,
      })
    }

    console.log(`[Cron] Found ${pendingReviews.length} pending reviews needing reminders`)

    let remindersSent = 0
    let errors: string[] = []

    // Process each pending review
    for (const review of pendingReviews) {
      const reviewRequestId = (review as any).request_id

      // Check if this is already the second reminder
      const { data: reviewRequest } = await supabase
        .from('review_requests')
        .select('reminder_sent, reminder_sent_at')
        .eq('id', reviewRequestId)
        .single()

      if (!reviewRequest) {
        console.log(`[Cron] Review request ${reviewRequestId} not found`)
        continue
      }

      const request = reviewRequest as any

      // If reminder was already sent, check if it's been 7 days
      if (request.reminder_sent && request.reminder_sent_at) {
        const reminderDate = new Date(request.reminder_sent_at)
        const daysSinceReminder = Math.floor(
          (Date.now() - reminderDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Don't send more than 2 reminders (initial + 1st reminder + 2nd reminder at 7 days)
        if (daysSinceReminder < 7) {
          console.log(`[Cron] Skipping ${reviewRequestId} - reminder sent ${daysSinceReminder} days ago`)
          continue
        }
      }

      // Send reminder
      const sent = await sendReviewReminder(reviewRequestId)

      if (sent) {
        remindersSent++
        console.log(`[Cron] Sent reminder for review ${reviewRequestId} (${(review as any).customer_name})`)
      } else {
        errors.push(`Review ${reviewRequestId}: Failed to send reminder`)
        console.error(`[Cron] Failed to send reminder for review ${reviewRequestId}`)
      }

      // Rate limiting: 100ms delay between reminders
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const duration = Date.now() - startTime

    console.log('[Cron] Review reminder processing completed:')
    console.log(`  - Reviews processed: ${pendingReviews.length}`)
    console.log(`  - Reminders sent: ${remindersSent}`)
    console.log(`  - Errors: ${errors.length}`)
    console.log(`  - Duration: ${duration}ms`)

    return createSuccessResponse({
      message: 'Review reminders processed successfully',
      reviewsProcessed: pendingReviews.length,
      remindersSent,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    })
  } catch (error) {
    console.error('[Cron] Error processing review reminders:', error)
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
