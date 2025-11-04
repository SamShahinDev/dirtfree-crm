import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Customer Analytics API
 *
 * GET /api/analytics/customers
 * Returns comprehensive customer analytics and segmentation
 *
 * Query params:
 * - segment: Filter by customer segment (VIP, Regular, One-time, At-risk, Active)
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
 * GET - Fetch customer analytics
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
        'Only staff can view customer analytics',
        403
      )
    }

    const { searchParams } = new URL(request.url)
    const segmentFilter = searchParams.get('segment')
    const exportFormat = searchParams.get('export')

    // 1. Get customer overview metrics
    const { data: overview, error: overviewError } = await supabase
      .from('customer_overview_metrics')
      .select('*')
      .single()

    if (overviewError) {
      console.error('[Customer Analytics API] Overview error:', overviewError)
    }

    // 2. Get segment distribution
    const { data: segmentDistribution, error: segmentError } = await supabase
      .from('customer_segment_distribution')
      .select('*')

    if (segmentError) {
      console.error('[Customer Analytics API] Segment error:', segmentError)
    }

    // 3. Get acquisition sources
    const { data: acquisitionSources, error: acquisitionError } = await supabase
      .from('customer_acquisition_sources')
      .select('*')

    if (acquisitionError) {
      console.error('[Customer Analytics API] Acquisition error:', acquisitionError)
    }

    // 4. Get geographic distribution
    const { data: geographicDist, error: geoError } = await supabase
      .from('customer_geographic_distribution')
      .select('*')

    if (geoError) {
      console.error('[Customer Analytics API] Geographic error:', geoError)
    }

    // 5. Get behavior patterns
    const { data: behaviorPatterns, error: behaviorError } = await supabase
      .from('customer_behavior_patterns')
      .select('*')

    if (behaviorError) {
      console.error('[Customer Analytics API] Behavior error:', behaviorError)
    }

    // 6. Get favorite services by segment
    const { data: favoriteServices, error: servicesError } = await supabase
      .from('favorite_services_by_segment')
      .select('*')
      .lte('rank', 5)

    if (servicesError) {
      console.error('[Customer Analytics API] Services error:', servicesError)
    }

    // 7. Get average time between bookings
    const { data: avgTimeBetween, error: timeError } = await (supabase as any)
      .rpc('get_avg_time_between_bookings')

    if (timeError) {
      console.error('[Customer Analytics API] Time between error:', timeError)
    }

    // 8. Get customer growth trend
    const { data: growthTrend, error: growthError } = await (supabase as any)
      .rpc('get_customer_growth_trend', { months_back: 12 })

    if (growthError) {
      console.error('[Customer Analytics API] Growth trend error:', growthError)
    }

    // 9. Get retention cohorts
    const { data: retentionCohorts, error: cohortError } = await (supabase as any)
      .rpc('get_customer_retention_cohorts', { months_back: 12 })

    if (cohortError) {
      console.error('[Customer Analytics API] Retention cohort error:', cohortError)
    }

    // 10. If segment filter is provided, get customer list
    let customerList = null
    if (segmentFilter) {
      const { data: customers, error: customerError } = await (supabase as any)
        .rpc('get_customers_by_segment', {
          target_segment: segmentFilter,
          limit_count: 100,
        })

      if (customerError) {
        console.error('[Customer Analytics API] Customer list error:', customerError)
      } else {
        customerList = customers
      }
    }

    // Build response
    const analyticsData = {
      overview: {
        total_customers: (overview as any)?.total_customers || 0,
        new_customers_this_month: (overview as any)?.new_customers_this_month || 0,
        active_customers: (overview as any)?.active_customers_90d || 0,
        churned_customers: (overview as any)?.churned_customers || 0,
        churn_rate: parseFloat((overview as any)?.churn_rate_pct || '0'),
        avg_bookings_per_customer: parseFloat((overview as any)?.avg_bookings_per_customer || '0'),
        avg_customer_ltv: parseFloat((overview as any)?.avg_customer_ltv || '0'),
      },
      segments: {
        distribution: (segmentDistribution || []).map((seg: any) => ({
          segment: seg.segment,
          customer_count: parseInt(seg.customer_count || 0, 10),
          avg_lifetime_value: parseFloat(seg.avg_lifetime_value || 0),
          avg_bookings: parseFloat(seg.avg_bookings || 0),
          percentage: parseFloat(seg.percentage || 0),
        })),
        customers_by_segment: customerList,
      },
      acquisition: {
        sources: (acquisitionSources || []).map((source: any) => ({
          source: source.source,
          customer_count: parseInt(source.customer_count || 0, 10),
          avg_bookings: parseFloat(source.avg_bookings_per_customer || 0),
          avg_ltv: parseFloat(source.avg_lifetime_value || 0),
          total_revenue: parseFloat(source.total_revenue || 0),
          percentage: parseFloat(source.percentage || 0),
        })),
      },
      behavior: {
        booking_patterns: (behaviorPatterns || []).map((pattern: any) => ({
          day_of_week: parseInt(pattern.day_of_week || 0, 10),
          day_name: pattern.day_name,
          booking_count: parseInt(pattern.booking_count || 0, 10),
          unique_customers: parseInt(pattern.unique_customers || 0, 10),
          avg_value: parseFloat(pattern.avg_booking_value || 0),
        })),
        favorite_services: favoriteServices || [],
        avg_time_between_bookings: (avgTimeBetween || []).map((item: any) => ({
          segment: item.segment,
          avg_days: parseFloat(item.avg_days_between_bookings || 0),
        })),
      },
      geographic: {
        distribution: (geographicDist || []).map((geo: any) => ({
          zone_id: geo.zone_id,
          zone_name: geo.zone_name,
          customer_count: parseInt(geo.customer_count || 0, 10),
          total_jobs: parseInt(geo.total_jobs || 0, 10),
          total_revenue: parseFloat(geo.total_revenue || 0),
          avg_job_value: parseFloat(geo.avg_job_value || 0),
          percentage: parseFloat(geo.percentage_of_customers || 0),
        })),
      },
      trends: {
        growth: (growthTrend || []).map((trend: any) => ({
          month: trend.month,
          new_customers: parseInt(trend.new_customers || 0, 10),
          churned_customers: parseInt(trend.churned_customers || 0, 10),
          net_growth: parseInt(trend.net_growth || 0, 10),
          total_customers: parseInt(trend.total_customers || 0, 10),
        })),
        retention_cohorts: retentionCohorts || [],
      },
    }

    // Handle export formats
    if (exportFormat === 'csv') {
      return exportToCSV(analyticsData, segmentFilter)
    } else if (exportFormat === 'json') {
      return new NextResponse(JSON.stringify(analyticsData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="customer-analytics-${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    return createSuccessResponse(analyticsData)
  } catch (error) {
    console.error('[Customer Analytics API] Error:', error)
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
function exportToCSV(data: any, segmentFilter: string | null): NextResponse {
  const lines: string[] = []

  // Customer Overview
  lines.push('CUSTOMER OVERVIEW')
  lines.push('Metric,Value')
  lines.push(`Total Customers,${data.overview.total_customers}`)
  lines.push(`New Customers (This Month),${data.overview.new_customers_this_month}`)
  lines.push(`Active Customers (90d),${data.overview.active_customers}`)
  lines.push(`Churned Customers,${data.overview.churned_customers}`)
  lines.push(`Churn Rate,${data.overview.churn_rate.toFixed(2)}%`)
  lines.push(`Avg Bookings/Customer,${data.overview.avg_bookings_per_customer.toFixed(2)}`)
  lines.push(`Avg Customer LTV,$${data.overview.avg_customer_ltv.toFixed(2)}`)
  lines.push('')

  // Segment Distribution
  lines.push('SEGMENT DISTRIBUTION')
  lines.push('Segment,Customers,Avg LTV,Avg Bookings,Percentage')
  data.segments.distribution.forEach((seg: any) => {
    lines.push(
      `${seg.segment},${seg.customer_count},$${seg.avg_lifetime_value.toFixed(2)},${seg.avg_bookings.toFixed(1)},${seg.percentage.toFixed(1)}%`
    )
  })
  lines.push('')

  // Acquisition Sources
  lines.push('ACQUISITION SOURCES')
  lines.push('Source,Customers,Avg Bookings,Avg LTV,Total Revenue,Percentage')
  data.acquisition.sources.forEach((source: any) => {
    lines.push(
      `${source.source},${source.customer_count},${source.avg_bookings.toFixed(1)},$${source.avg_ltv.toFixed(2)},$${source.total_revenue.toFixed(2)},${source.percentage.toFixed(1)}%`
    )
  })
  lines.push('')

  // Booking Patterns
  lines.push('BOOKING PATTERNS BY DAY')
  lines.push('Day,Bookings,Unique Customers,Avg Value')
  data.behavior.booking_patterns.forEach((pattern: any) => {
    lines.push(
      `${pattern.day_name},${pattern.booking_count},${pattern.unique_customers},$${pattern.avg_value.toFixed(2)}`
    )
  })
  lines.push('')

  // Geographic Distribution
  lines.push('GEOGRAPHIC DISTRIBUTION')
  lines.push('Zone,Customers,Jobs,Revenue,Avg Job Value,% of Customers')
  data.geographic.distribution.forEach((geo: any) => {
    lines.push(
      `${geo.zone_name},${geo.customer_count},${geo.total_jobs},$${geo.total_revenue.toFixed(2)},$${geo.avg_job_value.toFixed(2)},${geo.percentage.toFixed(1)}%`
    )
  })
  lines.push('')

  // Customer Growth Trend
  lines.push('CUSTOMER GROWTH TREND')
  lines.push('Month,New Customers,Churned,Net Growth,Total Customers')
  data.trends.growth.forEach((trend: any) => {
    lines.push(
      `${new Date(trend.month).toLocaleDateString()},${trend.new_customers},${trend.churned_customers},${trend.net_growth},${trend.total_customers}`
    )
  })
  lines.push('')

  // If segment filter is applied and customer list is available
  if (segmentFilter && data.segments.customers_by_segment) {
    lines.push(`CUSTOMERS IN SEGMENT: ${segmentFilter}`)
    lines.push('Name,Email,Phone,Bookings,Lifetime Value,Last Booking,Days Since Last Booking,Loyalty Tier')
    data.segments.customers_by_segment.forEach((customer: any) => {
      lines.push(
        `${customer.customer_name},${customer.customer_email},${customer.customer_phone || ''},${customer.total_bookings},$${parseFloat(customer.lifetime_value || 0).toFixed(2)},${customer.last_booking_date ? new Date(customer.last_booking_date).toLocaleDateString() : 'N/A'},${customer.days_since_last_booking ? customer.days_since_last_booking.toFixed(0) : 'N/A'},${customer.loyalty_tier}`
      )
    })
  }

  const csvContent = lines.join('\n')
  const filename = segmentFilter
    ? `customer-analytics-${segmentFilter.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`
    : `customer-analytics-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
