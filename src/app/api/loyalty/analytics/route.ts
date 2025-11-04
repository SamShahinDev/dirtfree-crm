import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Loyalty Analytics API
 *
 * GET /api/loyalty/analytics
 * Returns comprehensive loyalty program analytics
 *
 * Query params:
 * - days_back: Number of days for timeline data (default: 90)
 * - export: Set to 'csv' or 'json' for export
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

function createSuccessResponse<T>(data: T) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() }
  )
}

/**
 * Verify staff authentication
 */
async function verifyStaffAuth(supabase: any, userId: string): Promise<boolean> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return userRole && ['admin', 'manager', 'dispatcher'].includes((userRole as any).role)
}

/**
 * GET - Fetch loyalty analytics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify staff permissions
    const isStaff = await verifyStaffAuth(supabase, user.id)
    if (!isStaff) {
      return createErrorResponse(
        'forbidden',
        'Only staff can view analytics',
        403
      )
    }

    const { searchParams } = new URL(request.url)
    const daysBack = parseInt(searchParams.get('days_back') || '90', 10)
    const exportFormat = searchParams.get('export')

    // 1. Get Program Overview from materialized view
    const { data: overview, error: overviewError } = await supabase
      .from('loyalty_analytics_summary')
      .select('*')
      .single()

    if (overviewError) {
      console.error('[Analytics API] Overview error:', overviewError)
    }

    // 2. Get Tier Distribution
    const { data: tierDistribution, error: tierError } = await supabase
      .from('loyalty_tier_distribution')
      .select('*')

    if (tierError) {
      console.error('[Analytics API] Tier distribution error:', tierError)
    }

    // 3. Get Earning Activities Breakdown
    const { data: earningActivities, error: earningError } = await supabase
      .from('loyalty_earning_activities')
      .select('*')

    if (earningError) {
      console.error('[Analytics API] Earning activities error:', earningError)
    }

    // 4. Get Popular Rewards
    const { data: popularRewards, error: rewardsError } = await supabase
      .from('loyalty_popular_rewards')
      .select('*')
      .limit(10)

    if (rewardsError) {
      console.error('[Analytics API] Popular rewards error:', rewardsError)
    }

    // 5. Get Achievement Stats
    const { data: achievementStats, error: achievementError } = await supabase
      .from('loyalty_achievement_stats')
      .select('*')
      .limit(10)

    if (achievementError) {
      console.error('[Analytics API] Achievement stats error:', achievementError)
    }

    // 6. Get Referral Funnel
    const { data: referralFunnel, error: referralError } = await supabase
      .from('loyalty_referral_funnel')
      .select('*')
      .single()

    if (referralError) {
      console.error('[Analytics API] Referral funnel error:', referralError)
    }

    // 7. Get Top Referrers
    const { data: topReferrers, error: referrersError } = await supabase
      .from('loyalty_top_referrers')
      .select('*')
      .limit(10)

    if (referrersError) {
      console.error('[Analytics API] Top referrers error:', referrersError)
    }

    // 8. Get Points Timeline using function
    const { data: pointsTimeline, error: timelineError } = await (supabase as any)
      .rpc('get_loyalty_points_timeline', { days_back: daysBack })

    if (timelineError) {
      console.error('[Analytics API] Timeline error:', timelineError)
    }

    // 9. Get Revenue by Tier
    const { data: revenueByTier, error: revenueTierError } = await (supabase as any)
      .rpc('get_loyalty_revenue_by_tier')

    if (revenueTierError) {
      console.error('[Analytics API] Revenue by tier error:', revenueTierError)
    }

    // 10. Get Loyalty vs Non-Loyalty Comparison
    const { data: loyaltyComparison, error: comparisonError } = await (supabase as any)
      .rpc('get_loyalty_vs_non_loyalty_comparison')

    if (comparisonError) {
      console.error('[Analytics API] Loyalty comparison error:', comparisonError)
    }

    // Calculate additional metrics
    const programOverview = overview ? {
      total_enrolled: (overview as any).total_loyalty_customers || 0,
      active_participants: (overview as any).active_customers_90d || 0,
      avg_points_balance: Math.round((overview as any).avg_points_balance || 0),
      total_points_issued: (overview as any).total_points_issued || 0,
      total_points_redeemed: (overview as any).total_points_redeemed || 0,
      total_redemptions: (overview as any).total_redemptions || 0,
      redemption_rate: Math.round((overview as any).redemption_rate_pct || 0),
      participation_rate: (overview as any).total_loyalty_customers > 0
        ? Math.round(((overview as any).active_customers_90d / (overview as any).total_loyalty_customers) * 100)
        : 0,
    } : null

    const referralPerformance = referralFunnel ? {
      total_sent: (referralFunnel as any).total_referrals_sent || 0,
      registered: (referralFunnel as any).step_registered || 0,
      booked: (referralFunnel as any).step_booked || 0,
      completed: (referralFunnel as any).step_completed || 0,
      conversion_sent_to_registered: (referralFunnel as any).conversion_sent_to_registered_pct || 0,
      conversion_registered_to_booked: (referralFunnel as any).conversion_registered_to_booked_pct || 0,
      conversion_booked_to_completed: (referralFunnel as any).conversion_booked_to_completed_pct || 0,
      overall_conversion_rate: (referralFunnel as any).total_referrals_sent > 0
        ? Math.round(((referralFunnel as any).step_completed / (referralFunnel as any).total_referrals_sent) * 100)
        : 0,
    } : null

    // Calculate revenue impact
    const loyaltySegment = (loyaltyComparison as any)?.find((seg: any) => seg.segment === 'Loyalty Members')
    const nonLoyaltySegment = (loyaltyComparison as any)?.find((seg: any) => seg.segment === 'Non-Loyalty')

    const revenueImpact = {
      loyalty_revenue: parseFloat(loyaltySegment?.total_revenue || '0'),
      non_loyalty_revenue: parseFloat(nonLoyaltySegment?.total_revenue || '0'),
      loyalty_avg_order_value: parseFloat(loyaltySegment?.avg_job_value || '0'),
      non_loyalty_avg_order_value: parseFloat(nonLoyaltySegment?.avg_job_value || '0'),
      loyalty_customer_ltv: parseFloat(loyaltySegment?.avg_revenue_per_customer || '0'),
      non_loyalty_customer_ltv: parseFloat(nonLoyaltySegment?.avg_revenue_per_customer || '0'),
      loyalty_repeat_rate: parseFloat(loyaltySegment?.avg_jobs_per_customer || '0'),
      non_loyalty_repeat_rate: parseFloat(nonLoyaltySegment?.avg_jobs_per_customer || '0'),
    }

    // Add revenue uplift calculations
    const revenueUplift = {
      avg_order_value_uplift: nonLoyaltySegment?.avg_job_value > 0
        ? Math.round(((loyaltySegment?.avg_job_value - nonLoyaltySegment?.avg_job_value) / nonLoyaltySegment?.avg_job_value) * 100)
        : 0,
      customer_ltv_uplift: nonLoyaltySegment?.avg_revenue_per_customer > 0
        ? Math.round(((loyaltySegment?.avg_revenue_per_customer - nonLoyaltySegment?.avg_revenue_per_customer) / nonLoyaltySegment?.avg_revenue_per_customer) * 100)
        : 0,
      repeat_rate_uplift: nonLoyaltySegment?.avg_jobs_per_customer > 0
        ? Math.round(((loyaltySegment?.avg_jobs_per_customer - nonLoyaltySegment?.avg_jobs_per_customer) / nonLoyaltySegment?.avg_jobs_per_customer) * 100)
        : 0,
    }

    const analyticsData = {
      program_overview: programOverview,
      tier_distribution: tierDistribution || [],
      engagement_metrics: {
        earning_activities: earningActivities || [],
        popular_rewards: popularRewards || [],
        achievement_stats: achievementStats || [],
      },
      revenue_impact: {
        ...revenueImpact,
        uplift: revenueUplift,
        by_tier: revenueByTier || [],
        comparison: loyaltyComparison || [],
      },
      referral_performance: referralPerformance,
      top_referrers: topReferrers || [],
      charts: {
        points_timeline: pointsTimeline || [],
        tier_distribution: tierDistribution || [],
        earning_activities: (earningActivities || []).slice(0, 10),
      },
    }

    // Handle export formats
    if (exportFormat === 'csv') {
      return exportToCSV(analyticsData)
    } else if (exportFormat === 'json') {
      return new NextResponse(JSON.stringify(analyticsData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="loyalty-analytics-${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    return createSuccessResponse(analyticsData)
  } catch (error) {
    console.error('[Analytics API] Error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * Export analytics to CSV format
 */
function exportToCSV(data: any): NextResponse {
  const lines: string[] = []

  // Program Overview Section
  lines.push('PROGRAM OVERVIEW')
  lines.push('Metric,Value')
  if (data.program_overview) {
    lines.push(`Total Enrolled Customers,${data.program_overview.total_enrolled}`)
    lines.push(`Active Participants (90d),${data.program_overview.active_participants}`)
    lines.push(`Average Points Balance,${data.program_overview.avg_points_balance}`)
    lines.push(`Total Points Issued,${data.program_overview.total_points_issued}`)
    lines.push(`Total Points Redeemed,${data.program_overview.total_points_redeemed}`)
    lines.push(`Redemption Rate,%${data.program_overview.redemption_rate}`)
  }
  lines.push('')

  // Tier Distribution
  lines.push('TIER DISTRIBUTION')
  lines.push('Tier Name,Tier Level,Customer Count,Percentage')
  data.tier_distribution.forEach((tier: any) => {
    lines.push(`${tier.tier_name},${tier.tier_level},${tier.customer_count},${tier.percentage}%`)
  })
  lines.push('')

  // Revenue Impact
  lines.push('REVENUE IMPACT')
  lines.push('Metric,Value')
  if (data.revenue_impact) {
    lines.push(`Loyalty Revenue,$${data.revenue_impact.loyalty_revenue.toFixed(2)}`)
    lines.push(`Non-Loyalty Revenue,$${data.revenue_impact.non_loyalty_revenue.toFixed(2)}`)
    lines.push(`Loyalty AOV,$${data.revenue_impact.loyalty_avg_order_value.toFixed(2)}`)
    lines.push(`Non-Loyalty AOV,$${data.revenue_impact.non_loyalty_avg_order_value.toFixed(2)}`)
    lines.push(`AOV Uplift,${data.revenue_impact.uplift.avg_order_value_uplift}%`)
    lines.push(`LTV Uplift,${data.revenue_impact.uplift.customer_ltv_uplift}%`)
  }
  lines.push('')

  // Referral Performance
  lines.push('REFERRAL PERFORMANCE')
  lines.push('Metric,Value')
  if (data.referral_performance) {
    lines.push(`Total Sent,${data.referral_performance.total_sent}`)
    lines.push(`Registered,${data.referral_performance.registered}`)
    lines.push(`Booked,${data.referral_performance.booked}`)
    lines.push(`Completed,${data.referral_performance.completed}`)
    lines.push(`Overall Conversion,${data.referral_performance.overall_conversion_rate}%`)
  }
  lines.push('')

  const csvContent = lines.join('\n')
  const filename = `loyalty-analytics-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
