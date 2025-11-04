import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'

/**
 * Promotion Analytics API
 *
 * GET /api/promotions/[id]/analytics - Get promotion analytics and metrics
 *
 * Features:
 * - Comprehensive performance metrics
 * - Conversion funnel data
 * - Time-to-conversion distribution
 * - Delivery timeline
 * - Channel performance breakdown
 * - ROI calculations
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
  )
}

async function checkUserRole(userId: string, requiredRoles: string[]): Promise<boolean> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', requiredRoles)
    .single()
  return !error && !!data
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const hasAccess = await checkUserRole(user.id, ['admin', 'manager', 'dispatcher'])
    if (!hasAccess) {
      return createErrorResponse('forbidden', 'Insufficient permissions', 403)
    }

    const promotionId = params.id
    const serviceSupabase = getServiceSupabase()

    // Check if promotion exists
    const { data: promotion, error: promoError } = await serviceSupabase
      .from('promotions')
      .select('id, title, status')
      .eq('id', promotionId)
      .single()

    if (promoError || !promotion) {
      return createErrorResponse('not_found', 'Promotion not found', 404)
    }

    // Calculate fresh analytics
    const { data: analyticsData, error: calcError } = await (serviceSupabase as any).rpc(
      'calculate_promotion_analytics',
      { p_promotion_id: promotionId }
    )

    if (calcError) {
      console.error('[Analytics] Error calculating analytics:', calcError)
      return createErrorResponse(
        'calculation_error',
        'Failed to calculate analytics',
        500
      )
    }

    // Get funnel metrics
    const { data: funnelData, error: funnelError } = await (serviceSupabase as any).rpc(
      'get_promotion_funnel_metrics',
      { p_promotion_id: promotionId }
    )

    // Get time distribution
    const { data: timeDistribution, error: timeError } = await (serviceSupabase as any).rpc(
      'get_promotion_time_distribution',
      { p_promotion_id: promotionId }
    )

    // Get delivery timeline
    const { data: timeline, error: timelineError } = await (serviceSupabase as any).rpc(
      'get_promotion_delivery_timeline',
      { p_promotion_id: promotionId }
    )

    // Parse analytics data
    const analytics = analyticsData || {}

    // Format response
    return createSuccessResponse({
      promotion: {
        id: (promotion as any).id,
        title: (promotion as any).title,
        status: (promotion as any).status,
      },
      metrics: {
        volume: {
          totalSent: parseInt(analytics.total_sent || '0'),
          totalDelivered: parseInt(analytics.total_delivered || '0'),
          totalViewed: parseInt(analytics.total_viewed || '0'),
          totalClaimed: parseInt(analytics.total_claimed || '0'),
          totalRedeemed: parseInt(analytics.total_redeemed || '0'),
        },
        rates: {
          deliveryRate: parseFloat(analytics.delivery_rate || '0'),
          viewRate: parseFloat(analytics.view_rate || '0'),
          claimRate: parseFloat(analytics.claim_rate || '0'),
          redemptionRate: parseFloat(analytics.redemption_rate || '0'),
          conversionRate: parseFloat(analytics.conversion_rate || '0'),
        },
        financial: {
          totalRevenue: parseFloat(analytics.total_revenue || '0'),
          totalDiscountGiven: parseFloat(analytics.total_discount_given || '0'),
          totalCost: parseFloat(analytics.total_cost || '0'),
          netProfit: parseFloat(analytics.total_revenue || '0') - parseFloat(analytics.total_discount_given || '0') - parseFloat(analytics.total_cost || '0'),
          roiPercentage: parseFloat(analytics.roi_percentage || '0'),
          costPerRedemption: parseFloat(analytics.cost_per_redemption || '0'),
          revenuePerRedemption: parseFloat(analytics.revenue_per_redemption || '0'),
        },
        timing: {
          avgTimeToView: parseFloat(analytics.avg_time_to_view || '0'),
          avgTimeToClaim: parseFloat(analytics.avg_time_to_claim || '0'),
          avgTimeToRedeem: parseFloat(analytics.avg_time_to_redeem || '0'),
        },
        channels: analytics.channel_metrics || {},
      },
      funnel: funnelData || [],
      timeDistribution: timeDistribution || [],
      timeline: timeline || [],
      calculatedAt: analytics.calculated_at || new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Analytics] GET /api/promotions/[id]/analytics error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
