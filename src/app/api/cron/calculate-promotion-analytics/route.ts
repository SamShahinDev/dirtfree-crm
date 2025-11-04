import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Calculate Promotion Analytics Cron Job
 *
 * GET /api/cron/calculate-promotion-analytics
 *
 * Background job to calculate analytics for active promotions.
 *
 * Features:
 * - Calculates analytics for all active promotions
 * - Updates promotion_analytics table
 * - Runs database analytics functions
 * - Provides comprehensive metrics
 *
 * Recommended schedule: Daily at midnight
 *
 * Setup in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/calculate-promotion-analytics",
 *     "schedule": "0 0 star star star (daily at midnight)"
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
      console.warn('[Cron] Unauthorized attempt to calculate promotion analytics')
      return createErrorResponse('unauthorized', 'Invalid cron authentication', 401)
    }

    const supabase = getServiceSupabase()

    // Get all active and recently completed promotions
    // We calculate analytics for:
    // 1. Active promotions
    // 2. Scheduled promotions (that have started delivering)
    // 3. Recently completed/expired promotions (within last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: promotions, error: fetchError } = await supabase
      .from('promotions')
      .select('id, title, status, end_date')
      .or(`status.in.(active,scheduled,paused),end_date.gte.${thirtyDaysAgo.toISOString()}`)

    if (fetchError) {
      console.error('[Cron] Error fetching promotions:', fetchError)
      return createErrorResponse(
        'fetch_error',
        'Failed to fetch promotions',
        500
      )
    }

    if (!promotions || promotions.length === 0) {
      return createSuccessResponse({
        message: 'No promotions to analyze',
        processed: 0,
        duration: Date.now() - startTime,
      })
    }

    console.log(`[Cron] Calculating analytics for ${promotions.length} promotions`)

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Process each promotion
    for (const promotion of promotions) {
      try {
        // Calculate analytics using database function
        const { data: analyticsData, error: calcError } = await (supabase as any).rpc(
          'calculate_promotion_analytics',
          { p_promotion_id: (promotion as any).id }
        )

        if (calcError) {
          console.error(`[Cron] Error calculating analytics for ${(promotion as any).id}:`, calcError)
          results.failed++
          results.errors.push(
            `Promotion ${(promotion as any).title}: ${calcError.message}`
          )
          continue
        }

        results.succeeded++
        console.log(`[Cron] Successfully calculated analytics for promotion: ${(promotion as any).title}`)
      } catch (error) {
        console.error(`[Cron] Exception calculating analytics for ${(promotion as any).id}:`, error)
        results.failed++
        results.errors.push(
          `Promotion ${(promotion as any).title}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      results.processed++
    }

    const duration = Date.now() - startTime

    console.log(
      `[Cron] Completed calculating analytics for ${results.processed} promotions in ${duration}ms. ` +
      `Succeeded: ${results.succeeded}, Failed: ${results.failed}`
    )

    return createSuccessResponse({
      message: 'Promotion analytics calculated',
      processed: results.processed,
      succeeded: results.succeeded,
      failed: results.failed,
      duration,
      errors: results.errors.length > 0 ? results.errors : undefined,
    })
  } catch (error) {
    console.error('[Cron] Error in calculate-promotion-analytics:', error)
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
