import { NextRequest, NextResponse } from 'next/server'
import { processAllTriggers } from '@/lib/promotions/triggers'

/**
 * Promotion Triggers Cron Job
 *
 * GET /api/cron/promotion-triggers
 *
 * Automated promotion trigger processing job.
 *
 * Process:
 * 1. Checks all active promotion triggers
 * 2. Evaluates trigger conditions
 * 3. Creates promotions from templates
 * 4. Delivers promotions to eligible customers
 * 5. Logs execution results
 *
 * Trigger Types:
 * - inactive_customer: Re-engage customers who haven't booked
 * - birthday: Send birthday specials
 * - anniversary: Celebrate service anniversaries
 * - high_value: Reward VIP customers
 * - referral: Reward successful referrals
 *
 * Recommended schedule: Daily at 9 AM
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/promotion-triggers",
 *     "schedule": "0 9 star star star (daily at 9 AM)"
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
      console.warn('[Cron] Unauthorized attempt to run promotion triggers')
      return createErrorResponse('unauthorized', 'Invalid cron authentication', 401)
    }

    console.log('[Cron] Starting promotion triggers processing...')

    // Process all active triggers
    const { totalProcessed, results } = await processAllTriggers()

    // Aggregate results
    const summary = {
      totalTriggersProcessed: totalProcessed,
      totalCustomersFound: results.reduce((sum, r) => sum + r.customersFound, 0),
      totalPromotionsCreated: results.reduce((sum, r) => sum + r.promotionsCreated, 0),
      totalDeliveriesQueued: results.reduce((sum, r) => sum + r.deliveriesQueued, 0),
      successfulTriggers: results.filter((r) => r.success).length,
      failedTriggers: results.filter((r) => !r.success).length,
      duration: Date.now() - startTime,
    }

    // Log detailed results
    console.log('[Cron] Promotion triggers processing completed:')
    console.log(`  - Triggers processed: ${summary.totalTriggersProcessed}`)
    console.log(`  - Customers found: ${summary.totalCustomersFound}`)
    console.log(`  - Promotions created: ${summary.totalPromotionsCreated}`)
    console.log(`  - Deliveries queued: ${summary.totalDeliveriesQueued}`)
    console.log(`  - Duration: ${summary.duration}ms`)

    // Log individual trigger results
    for (const result of results) {
      if (result.customersFound > 0 || result.errors.length > 0) {
        console.log(`\n  Trigger: ${result.triggerName}`)
        console.log(`    - Customers found: ${result.customersFound}`)
        console.log(`    - Promotions created: ${result.promotionsCreated}`)
        console.log(`    - Deliveries queued: ${result.deliveriesQueued}`)
        console.log(`    - Success: ${result.success}`)

        if (result.errors.length > 0) {
          console.log(`    - Errors: ${result.errors.join(', ')}`)
        }
      }
    }

    return createSuccessResponse({
      message: 'Promotion triggers processed successfully',
      summary,
      results: results.map((r) => ({
        triggerName: r.triggerName,
        success: r.success,
        customersFound: r.customersFound,
        promotionsCreated: r.promotionsCreated,
        deliveriesQueued: r.deliveriesQueued,
        errors: r.errors.length > 0 ? r.errors : undefined,
      })),
    })
  } catch (error) {
    console.error('[Cron] Error processing promotion triggers:', error)
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
