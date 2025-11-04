import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Portal Analytics Aggregation Cron Job
 *
 * GET /api/cron/aggregate-portal-analytics
 * - Runs daily at midnight (configured in Vercel/cron)
 * - Aggregates previous day's portal usage
 * - Stores in portal_analytics_daily table
 * - Provides daily rollup for faster reporting
 *
 * Authorization: Vercel Cron Secret or Internal Secret
 */

/**
 * Verify cron authorization
 */
function isAuthorized(request: NextRequest): boolean {
  // Check Vercel cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  // Check internal cron secret (for testing)
  const internalSecret = process.env.INTERNAL_CRON_SECRET
  if (internalSecret && authHeader === `Bearer ${internalSecret}`) {
    return true
  }

  return false
}

/**
 * GET - Aggregate portal analytics
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, error: 'unauthorized', message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = getServiceSupabase()

    // Get date to aggregate (default: yesterday)
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    let targetDate: Date
    if (dateParam) {
      targetDate = new Date(dateParam)
    } else {
      // Default to yesterday
      targetDate = new Date()
      targetDate.setDate(targetDate.getDate() - 1)
    }

    const dateString = targetDate.toISOString().split('T')[0]

    console.log(`[Portal Analytics Aggregation] Aggregating data for ${dateString}`)

    // Call aggregation function
    const { error } = await supabase.rpc('aggregate_portal_analytics', {
      p_date: dateString,
    })

    if (error) {
      console.error('[Portal Analytics Aggregation] Aggregation failed:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'aggregation_failed',
          message: error.message,
          date: dateString,
        },
        { status: 500 }
      )
    }

    // Get the aggregated data to return
    const { data: aggregatedData, error: fetchError } = await supabase
      .from('portal_analytics_daily')
      .select('*')
      .eq('date', dateString)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[Portal Analytics Aggregation] Failed to fetch aggregated data:', fetchError)
    }

    console.log(`[Portal Analytics Aggregation] Successfully aggregated data for ${dateString}`)

    return NextResponse.json({
      success: true,
      message: `Analytics aggregated for ${dateString}`,
      date: dateString,
      data: aggregatedData || null,
    })

  } catch (error) {
    console.error('[Portal Analytics Aggregation] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Alternative method for cron triggers
 */
export async function POST(request: NextRequest) {
  return GET(request)
}
