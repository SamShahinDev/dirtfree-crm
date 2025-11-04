import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Marketing Analytics API
 *
 * GET /api/analytics/marketing
 * Returns comprehensive marketing campaign and channel analytics
 *
 * Query params:
 * - start_date: ISO date string (default: 30 days ago)
 * - end_date: ISO date string (default: today)
 * - attribution_model: 'first_touch' | 'last_touch' | 'linear' (default: 'last_touch')
 * - export: 'csv' | 'json' for export
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
 * GET - Fetch marketing analytics
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
        'Only staff can view marketing analytics',
        403
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse parameters
    const endDate = searchParams.get('end_date')
      ? new Date(searchParams.get('end_date')!)
      : new Date()
    const startDate = searchParams.get('start_date')
      ? new Date(searchParams.get('start_date')!)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

    const attributionModel = searchParams.get('attribution_model') || 'last_touch'
    const exportFormat = searchParams.get('export')

    // 1. Get campaign performance
    const { data: campaignPerformance, error: campaignError } = await (supabase as any)
      .rpc('get_campaign_performance_trend', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })

    if (campaignError) {
      console.error('[Marketing Analytics API] Campaign error:', campaignError)
    }

    // 2. Get channel performance
    const { data: channelPerformance, error: channelError } = await supabase
      .from('marketing_channel_performance')
      .select('*')

    if (channelError) {
      console.error('[Marketing Analytics API] Channel error:', channelError)
    }

    // 3. Get promotion effectiveness
    const { data: promotionEffectiveness, error: promoError } = await supabase
      .from('promotion_effectiveness')
      .select('*')
      .order('revenue_generated', { ascending: false })

    if (promoError) {
      console.error('[Marketing Analytics API] Promotion error:', promoError)
    }

    // 4. Get communication performance
    const { data: commPerformance, error: commError } = await supabase
      .from('communication_performance')
      .select('*')

    if (commError) {
      console.error('[Marketing Analytics API] Communication error:', commError)
    }

    // 5. Get top performing content
    const { data: topContent, error: contentError } = await (supabase as any)
      .rpc('get_top_performing_content', {
        content_type: null,
        limit_count: 10,
      })

    if (contentError) {
      console.error('[Marketing Analytics API] Content error:', contentError)
    }

    // 6. Get attribution revenue
    const { data: attributionData, error: attrError } = await (supabase as any)
      .rpc('get_attribution_revenue', {
        attribution_model: attributionModel,
      })

    if (attrError) {
      console.error('[Marketing Analytics API] Attribution error:', attrError)
    }

    // 7. Get customer channel preferences
    const { data: channelPreferences, error: prefError } = await (supabase as any)
      .rpc('get_customer_channel_preferences')

    if (prefError) {
      console.error('[Marketing Analytics API] Preferences error:', prefError)
    }

    // 8. Get portal engagement metrics
    const { data: portalEngagement, error: portalError } = await supabase
      .from('portal_engagement_metrics')
      .select('*')
      .order('week', { ascending: false })
      .limit(12)

    if (portalError) {
      console.error('[Marketing Analytics API] Portal error:', portalError)
    }

    // Calculate summary statistics
    const totalCampaigns = (campaignPerformance || []).length
    const totalRevenue = (campaignPerformance || []).reduce(
      (sum: number, camp: any) => sum + parseFloat(camp.revenue || 0),
      0
    )
    const totalCost = (campaignPerformance || []).reduce(
      (sum: number, camp: any) => sum + parseFloat(camp.campaign_cost || 0),
      0
    )
    const avgROI = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0

    // Build response
    const analyticsData = {
      date_range: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        attribution_model: attributionModel,
      },
      overview: {
        total_campaigns: totalCampaigns,
        total_revenue: totalRevenue,
        total_cost: totalCost,
        net_revenue: totalRevenue - totalCost,
        avg_roi: avgROI,
      },
      campaign_performance: (campaignPerformance || []).map((camp: any) => ({
        campaign_id: camp.campaign_id,
        campaign_name: camp.campaign_name,
        channel: camp.channel,
        total_sent: parseInt(camp.total_sent || 0, 10),
        total_converted: parseInt(camp.total_converted || 0, 10),
        conversion_rate: parseFloat(camp.conversion_rate || 0),
        revenue: parseFloat(camp.revenue || 0),
        roi: parseFloat(camp.roi || 0),
      })),
      channel_performance: (channelPerformance || []).map((channel: any) => ({
        channel: channel.channel,
        total_campaigns: parseInt(channel.total_campaigns || 0, 10),
        total_sent: parseInt(channel.total_sent || 0, 10),
        total_opened: parseInt(channel.total_opened || 0, 10),
        total_clicked: parseInt(channel.total_clicked || 0, 10),
        total_converted: parseInt(channel.total_converted || 0, 10),
        avg_open_rate: parseFloat(channel.avg_open_rate_pct || 0),
        avg_click_rate: parseFloat(channel.avg_click_through_rate_pct || 0),
        avg_conversion_rate: parseFloat(channel.avg_conversion_rate_pct || 0),
        total_revenue: parseFloat(channel.total_revenue || 0),
        total_cost: parseFloat(channel.total_cost || 0),
        avg_roi: parseFloat(channel.avg_roi_pct || 0),
      })),
      promotion_effectiveness: (promotionEffectiveness || []).map((promo: any) => ({
        promotion_id: promo.promotion_id,
        promotion_name: promo.promotion_name,
        discount_type: promo.discount_type,
        discount_value: parseFloat(promo.discount_value || 0),
        times_claimed: parseInt(promo.times_claimed || 0, 10),
        times_redeemed: parseInt(promo.times_redeemed || 0, 10),
        redemption_rate: parseFloat(promo.redemption_rate_pct || 0),
        revenue_generated: parseFloat(promo.revenue_generated || 0),
        total_discount: parseFloat(promo.total_discount_given || 0),
        net_revenue: parseFloat(promo.net_revenue || 0),
        active: promo.active,
      })),
      content_performance: {
        by_template: (commPerformance || []).map((comm: any) => ({
          type: comm.communication_type,
          template_name: comm.template_name,
          total_sent: parseInt(comm.total_sent || 0, 10),
          open_rate: parseFloat(comm.open_rate_pct || 0),
          click_rate: parseFloat(comm.click_rate_pct || 0),
          response_rate: parseFloat(comm.response_rate_pct || 0),
        })),
        top_performing: (topContent || []).map((content: any) => ({
          type: content.type,
          template_name: content.template_name,
          total_sent: parseInt(content.total_sent || 0, 10),
          open_rate: parseFloat(content.open_rate || 0),
          click_rate: parseFloat(content.click_rate || 0),
          response_rate: parseFloat(content.response_rate || 0),
          performance_score: parseFloat(content.performance_score || 0),
        })),
      },
      attribution: {
        model: attributionModel,
        by_source: (attributionData || []).map((attr: any) => ({
          source: attr.source,
          customer_count: parseInt(attr.customer_count || 0, 10),
          total_revenue: parseFloat(attr.total_revenue || 0),
          avg_revenue_per_customer: parseFloat(attr.avg_revenue_per_customer || 0),
        })),
      },
      channel_preferences: (channelPreferences || []).map((pref: any) => ({
        channel: pref.channel,
        customers_reached: parseInt(pref.customers_reached || 0, 10),
        total_interactions: parseInt(pref.total_interactions || 0, 10),
        avg_engagement_rate: parseFloat(pref.avg_engagement_rate || 0),
        preferred_by_count: parseInt(pref.preferred_by_count || 0, 10),
      })),
      portal_engagement: (portalEngagement || []).map((portal: any) => ({
        week: portal.week,
        unique_visitors: parseInt(portal.unique_visitors || 0, 10),
        total_pageviews: parseInt(portal.total_pageviews || 0, 10),
        booking_conversion_rate: parseFloat(portal.booking_conversion_rate_pct || 0),
        avg_session_duration: parseFloat(portal.avg_session_duration_mins || 0),
      })),
    }

    // Handle export formats
    if (exportFormat === 'csv') {
      return exportToCSV(analyticsData)
    } else if (exportFormat === 'json') {
      return new NextResponse(JSON.stringify(analyticsData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="marketing-analytics-${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    return createSuccessResponse(analyticsData)
  } catch (error) {
    console.error('[Marketing Analytics API] Error:', error)
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

  // Overview
  lines.push('MARKETING OVERVIEW')
  lines.push('Metric,Value')
  lines.push(`Date Range,"${data.date_range.start_date} to ${data.date_range.end_date}"`)
  lines.push(`Attribution Model,${data.date_range.attribution_model}`)
  lines.push(`Total Campaigns,${data.overview.total_campaigns}`)
  lines.push(`Total Revenue,$${data.overview.total_revenue.toFixed(2)}`)
  lines.push(`Total Cost,$${data.overview.total_cost.toFixed(2)}`)
  lines.push(`Net Revenue,$${data.overview.net_revenue.toFixed(2)}`)
  lines.push(`Average ROI,${data.overview.avg_roi.toFixed(2)}%`)
  lines.push('')

  // Campaign Performance
  lines.push('CAMPAIGN PERFORMANCE')
  lines.push('Campaign,Channel,Sent,Converted,Conversion Rate %,Revenue,ROI %')
  data.campaign_performance.forEach((camp: any) => {
    lines.push(
      `${camp.campaign_name},${camp.channel},${camp.total_sent},${camp.total_converted},${camp.conversion_rate.toFixed(2)}%,$${camp.revenue.toFixed(2)},${camp.roi.toFixed(2)}%`
    )
  })
  lines.push('')

  // Channel Performance
  lines.push('CHANNEL PERFORMANCE')
  lines.push('Channel,Campaigns,Sent,Opened,Clicked,Converted,Open Rate %,Click Rate %,Conversion %,Revenue,ROI %')
  data.channel_performance.forEach((channel: any) => {
    lines.push(
      `${channel.channel},${channel.total_campaigns},${channel.total_sent},${channel.total_opened},${channel.total_clicked},${channel.total_converted},${channel.avg_open_rate.toFixed(1)}%,${channel.avg_click_rate.toFixed(1)}%,${channel.avg_conversion_rate.toFixed(1)}%,$${channel.total_revenue.toFixed(2)},${channel.avg_roi.toFixed(2)}%`
    )
  })
  lines.push('')

  // Promotion Effectiveness
  lines.push('PROMOTION EFFECTIVENESS')
  lines.push('Promotion,Type,Value,Claimed,Redeemed,Redemption %,Revenue,Discount Given,Net Revenue,Active')
  data.promotion_effectiveness.forEach((promo: any) => {
    lines.push(
      `${promo.promotion_name},${promo.discount_type},${promo.discount_value},${promo.times_claimed},${promo.times_redeemed},${promo.redemption_rate.toFixed(1)}%,$${promo.revenue_generated.toFixed(2)},$${promo.total_discount.toFixed(2)},$${promo.net_revenue.toFixed(2)},${promo.active}`
    )
  })
  lines.push('')

  // Attribution
  lines.push(`ATTRIBUTION (${data.attribution.model.toUpperCase()})`)
  lines.push('Source,Customers,Total Revenue,Avg Revenue/Customer')
  data.attribution.by_source.forEach((attr: any) => {
    lines.push(
      `${attr.source},${attr.customer_count},$${attr.total_revenue.toFixed(2)},$${attr.avg_revenue_per_customer.toFixed(2)}`
    )
  })
  lines.push('')

  // Channel Preferences
  lines.push('CHANNEL PREFERENCES')
  lines.push('Channel,Customers Reached,Interactions,Engagement Rate %,Preferred By')
  data.channel_preferences.forEach((pref: any) => {
    lines.push(
      `${pref.channel},${pref.customers_reached},${pref.total_interactions},${pref.avg_engagement_rate.toFixed(1)}%,${pref.preferred_by_count}`
    )
  })

  const csvContent = lines.join('\n')
  const filename = `marketing-analytics-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
