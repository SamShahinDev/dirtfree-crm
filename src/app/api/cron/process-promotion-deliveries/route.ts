import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import { deliverPromotion } from '@/lib/promotions/delivery'

/**
 * Process Promotion Deliveries Cron Job
 *
 * GET /api/cron/process-promotion-deliveries
 *
 * Background job to process queued promotion deliveries.
 *
 * Features:
 * - Batch processing (100 deliveries at a time)
 * - Rate limiting (respects SMS/email limits)
 * - Retry failed deliveries (up to 3 attempts)
 * - Updates delivery queue status
 * - Logs errors for monitoring
 *
 * Recommended schedule: Every 2-5 minutes
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-promotion-deliveries",
 *     "schedule": "every 5 minutes (cron syntax: star-slash-5 star star star star)"
 *   }]
 * }
 *
 * Authentication: Cron secret or Vercel internal
 */

const BATCH_SIZE = 100
const MAX_ATTEMPTS = 3
const RATE_LIMIT_DELAY_MS = 50 // 50ms between deliveries = ~20 per second max

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

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify cron authentication
    if (!verifyCronAuth(request)) {
      console.warn('[Cron] Unauthorized attempt to process promotion deliveries')
      return createErrorResponse('unauthorized', 'Invalid cron authentication', 401)
    }

    const supabase = getServiceSupabase()

    // Get pending deliveries
    const { data: pendingDeliveries, error: fetchError } = await (supabase as any).rpc(
      'get_pending_deliveries',
      { batch_size: BATCH_SIZE }
    )

    if (fetchError) {
      console.error('[Cron] Error fetching pending deliveries:', fetchError)
      return createErrorResponse(
        'fetch_error',
        'Failed to fetch pending deliveries',
        500
      )
    }

    if (!pendingDeliveries || pendingDeliveries.length === 0) {
      return createSuccessResponse({
        message: 'No pending deliveries to process',
        processed: 0,
        duration: Date.now() - startTime,
      })
    }

    console.log(`[Cron] Processing ${pendingDeliveries.length} promotion deliveries`)

    const results = {
      processed: 0,
      delivered: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Process each delivery
    for (const delivery of pendingDeliveries) {
      try {
        // Mark as processing
        await (supabase as any).rpc('mark_delivery_processing', {
          delivery_id: delivery.id,
        })

        // Prepare promotion data
        const promotionData = {
          promotionId: delivery.promotion_id,
          title: delivery.promotion_title,
          promoCode: delivery.promo_code,
          // Note: We're using minimal data here. In production, you might want to
          // fetch full promotion details if needed for the templates.
          promotionType: 'percentage_off', // Would need to be fetched
          startDate: new Date().toISOString(), // Would need to be fetched
          endDate: new Date().toISOString(), // Would need to be fetched
        }

        // Prepare customer data
        const customerData = {
          id: delivery.customer_id,
          email: delivery.customer_email,
          phone: delivery.customer_phone,
          fullName: delivery.customer_name,
        }

        // Deliver promotion
        const deliveryResults = await deliverPromotion(
          promotionData,
          customerData,
          [delivery.delivery_method as 'portal' | 'email' | 'sms']
        )

        const result = deliveryResults[0]

        if (result.success) {
          // Mark as delivered
          await (supabase as any).rpc('mark_delivery_delivered', {
            delivery_id: delivery.id,
          })
          results.delivered++
        } else {
          // Mark as failed
          await (supabase as any).rpc('mark_delivery_failed', {
            delivery_id: delivery.id,
            error_msg: result.error || 'Unknown error',
          })
          results.failed++

          // Log error
          const errorMsg = `Delivery ${delivery.id} failed: ${result.error}`
          results.errors.push(errorMsg)
          console.error('[Cron]', errorMsg)
        }

        results.processed++

        // Rate limiting - add delay between deliveries
        await sleep(RATE_LIMIT_DELAY_MS)
      } catch (error) {
        // Handle unexpected errors
        console.error(`[Cron] Error processing delivery ${delivery.id}:`, error)

        try {
          await (supabase as any).rpc('mark_delivery_failed', {
            delivery_id: delivery.id,
            error_msg: error instanceof Error ? error.message : 'Unexpected error',
          })
        } catch (updateError) {
          console.error('[Cron] Error updating failed delivery status:', updateError)
        }

        results.failed++
        results.errors.push(
          `Delivery ${delivery.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    const duration = Date.now() - startTime

    console.log(
      `[Cron] Completed processing ${results.processed} deliveries in ${duration}ms. ` +
      `Delivered: ${results.delivered}, Failed: ${results.failed}`
    )

    return createSuccessResponse({
      message: 'Promotion deliveries processed',
      processed: results.processed,
      delivered: results.delivered,
      failed: results.failed,
      duration,
      errors: results.errors.length > 0 ? results.errors : undefined,
    })
  } catch (error) {
    console.error('[Cron] Error in process-promotion-deliveries:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * Allow POST for manual triggering (requires authentication)
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
