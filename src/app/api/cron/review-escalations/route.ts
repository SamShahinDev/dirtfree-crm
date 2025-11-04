import { NextRequest, NextResponse } from 'next/server'
import { processEscalations } from '@/lib/reviews/escalation'

/**
 * Review Escalation Cron Job
 *
 * GET /api/cron/review-escalations
 *
 * Escalates unresolved low-rating reviews to management.
 *
 * Process:
 * 1. Find support tickets from 1-3 star reviews
 * 2. Filter for tickets > 48 hours old
 * 3. Filter for status = 'open' or 'pending'
 * 4. Update priority to 'high'
 * 5. Send escalation emails to managers
 * 6. Log escalation events
 *
 * Escalation Criteria:
 * - Support ticket created from review system (source = 'review_system')
 * - Review rating 1-3 stars
 * - Ticket created > 48 hours ago
 * - Ticket status still 'open' or 'pending'
 * - Not already escalated
 *
 * Notifications:
 * - Sent to all users with role: admin, manager, owner
 * - Email contains customer info, rating, feedback, ticket link
 * - Subject: "🚨 URGENT: Unresolved X-Star Review"
 *
 * Recommended schedule: Daily at 9 AM
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/review-escalations",
 *     "schedule": "0 9 * * *"
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
      console.warn('[Cron] Unauthorized attempt to run review escalations')
      return createErrorResponse('unauthorized', 'Invalid cron authentication', 401)
    }

    console.log('[Cron] Starting review escalation processing...')
    console.log(`[Cron] Time: ${new Date().toISOString()}`)

    // Process all escalations
    const result = await processEscalations()

    const duration = Date.now() - startTime

    // Log results
    console.log('[Cron] Review escalation processing completed:')
    console.log(`  - Tickets checked: ${result.totalChecked}`)
    console.log(`  - Tickets escalated: ${result.totalEscalated}`)
    console.log(`  - Escalations failed: ${result.totalFailed}`)
    console.log(`  - Notifications sent: ${result.notificationsSent}`)
    console.log(`  - Duration: ${duration}ms`)

    if (result.totalChecked === 0) {
      return createSuccessResponse({
        message: 'No unresolved low-rating reviews found',
        summary: {
          ticketsChecked: 0,
          ticketsEscalated: 0,
          ticketsFailed: 0,
          notificationsSent: 0,
          duration,
        },
      })
    }

    return createSuccessResponse({
      message: 'Review escalations processed successfully',
      summary: {
        ticketsChecked: result.totalChecked,
        ticketsEscalated: result.totalEscalated,
        ticketsFailed: result.totalFailed,
        notificationsSent: result.notificationsSent,
        duration,
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[Cron] Error processing review escalations:', error)

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
