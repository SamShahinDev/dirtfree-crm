import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Revenue Analytics API
 *
 * GET /api/analytics/revenue
 * Returns comprehensive revenue analytics
 *
 * Query params:
 * - start_date: ISO date string (default: 30 days ago)
 * - end_date: ISO date string (default: today)
 * - group_by: 'day' | 'week' | 'month' (default: 'day')
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
 * GET - Fetch revenue analytics
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
        'Only staff can view revenue analytics',
        403
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse date range
    const endDate = searchParams.get('end_date')
      ? new Date(searchParams.get('end_date')!)
      : new Date()
    const startDate = searchParams.get('start_date')
      ? new Date(searchParams.get('start_date')!)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    const groupBy = searchParams.get('group_by') || 'day'
    const exportFormat = searchParams.get('export')

    // 1. Get revenue analytics for date range
    const { data: revenueData, error: revenueError } = await (supabase as any)
      .rpc('get_revenue_analytics', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        group_by: groupBy,
      })

    if (revenueError) {
      console.error('[Revenue Analytics API] Revenue data error:', revenueError)
    }

    // 2. Get YoY comparison
    const { data: yoyData, error: yoyError } = await (supabase as any)
      .rpc('get_yoy_revenue_comparison', {
        current_start_date: startDate.toISOString(),
        current_end_date: endDate.toISOString(),
      })

    if (yoyError) {
      console.error('[Revenue Analytics API] YoY error:', yoyError)
    }

    // 3. Get revenue by service
    const { data: revenueByService, error: serviceError } = await supabase
      .from('revenue_by_service')
      .select('*')

    if (serviceError) {
      console.error('[Revenue Analytics API] Service error:', serviceError)
    }

    // 4. Get revenue by zone
    const { data: revenueByZone, error: zoneError } = await supabase
      .from('revenue_by_zone')
      .select('*')

    if (zoneError) {
      console.error('[Revenue Analytics API] Zone error:', zoneError)
    }

    // 5. Get payment method analytics
    const { data: paymentMethods, error: paymentError } = await supabase
      .from('payment_method_analytics')
      .select('*')

    if (paymentError) {
      console.error('[Revenue Analytics API] Payment error:', paymentError)
    }

    // 6. Get outstanding invoices summary
    const { data: outstandingInvoices, error: outstandingError } = await supabase
      .from('outstanding_invoices_summary')
      .select('*')
      .single()

    if (outstandingError) {
      console.error('[Revenue Analytics API] Outstanding error:', outstandingError)
    }

    // 7. Get customer LTV by tier
    const { data: ltvByTier, error: ltvError } = await supabase
      .from('customer_ltv_by_tier')
      .select('*')

    if (ltvError) {
      console.error('[Revenue Analytics API] LTV error:', ltvError)
    }

    // 8. Get service performance trend
    const { data: serviceTrend, error: trendError } = await (supabase as any)
      .rpc('get_service_performance_trend', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        group_by: groupBy,
      })

    if (trendError) {
      console.error('[Revenue Analytics API] Service trend error:', trendError)
    }

    // 9. Get top revenue customers
    const { data: topCustomers, error: topCustomersError } = await (supabase as any)
      .rpc('get_top_revenue_customers', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        limit_count: 20,
      })

    if (topCustomersError) {
      console.error('[Revenue Analytics API] Top customers error:', topCustomersError)
    }

    // Calculate overview metrics from revenue data
    const totalRevenue = (revenueData || []).reduce(
      (sum: number, item: any) => sum + parseFloat(item.total_revenue || 0),
      0
    )
    const totalInvoices = (revenueData || []).reduce(
      (sum: number, item: any) => sum + parseInt(item.total_invoices || 0, 10),
      0
    )
    const uniqueCustomers = Math.max(
      ...(revenueData || []).map((item: any) => parseInt(item.unique_customers || 0, 10)),
      0
    )
    const avgInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0

    // Calculate revenue sources breakdown
    const portalRevenue = (revenueData || []).reduce(
      (sum: number, item: any) => sum + parseFloat(item.portal_revenue || 0),
      0
    )
    const phoneRevenue = (revenueData || []).reduce(
      (sum: number, item: any) => sum + parseFloat(item.phone_revenue || 0),
      0
    )
    const repeatRevenue = (revenueData || []).reduce(
      (sum: number, item: any) => sum + parseFloat(item.repeat_customer_revenue || 0),
      0
    )
    const newRevenue = (revenueData || []).reduce(
      (sum: number, item: any) => sum + parseFloat(item.new_customer_revenue || 0),
      0
    )
    const referralRevenue = (revenueData || []).reduce(
      (sum: number, item: any) => sum + parseFloat(item.referral_revenue || 0),
      0
    )

    // Build response
    const analyticsData = {
      date_range: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        group_by: groupBy,
      },
      overview: {
        total_revenue: totalRevenue,
        total_invoices: totalInvoices,
        unique_customers: uniqueCustomers,
        avg_invoice_value: avgInvoiceValue,
        yoy_comparison: yoyData?.[0] || null,
      },
      revenue_sources: {
        portal_bookings: portalRevenue,
        phone_bookings: phoneRevenue,
        repeat_customers: repeatRevenue,
        new_customers: newRevenue,
        referrals: referralRevenue,
        breakdown: [
          { source: 'Portal Bookings', revenue: portalRevenue },
          { source: 'Phone Bookings', revenue: phoneRevenue },
          { source: 'Repeat Customers', revenue: repeatRevenue },
          { source: 'New Customers', revenue: newRevenue },
          { source: 'Referrals', revenue: referralRevenue },
        ],
      },
      payment_analytics: {
        methods: paymentMethods || [],
        outstanding: {
          count: (outstandingInvoices as any)?.outstanding_count || 0,
          total: parseFloat((outstandingInvoices as any)?.outstanding_total || '0'),
        },
        overdue: {
          count: (outstandingInvoices as any)?.overdue_count || 0,
          total: parseFloat((outstandingInvoices as any)?.overdue_total || '0'),
        },
        avg_days_outstanding: parseFloat((outstandingInvoices as any)?.avg_days_outstanding || '0'),
      },
      service_performance: {
        by_service: revenueByService || [],
        trend: serviceTrend || [],
        top_services: (revenueByService || []).slice(0, 5),
        bottom_services: (revenueByService || []).slice(-3),
      },
      customer_value: {
        ltv_by_tier: ltvByTier || [],
        top_customers: topCustomers || [],
        avg_ltv: (ltvByTier || []).reduce(
          (sum: number, tier: any) => sum + parseFloat(tier.avg_lifetime_value || 0),
          0
        ) / Math.max((ltvByTier || []).length, 1),
        overall_repeat_rate: (ltvByTier || []).reduce(
          (sum: number, tier: any) => sum + parseFloat(tier.repeat_purchase_rate_pct || 0),
          0
        ) / Math.max((ltvByTier || []).length, 1),
      },
      charts: {
        revenue_trend: (revenueData || []).map((item: any) => ({
          date: item.period,
          revenue: parseFloat(item.total_revenue || 0),
          invoices: parseInt(item.total_invoices || 0, 10),
          customers: parseInt(item.unique_customers || 0, 10),
        })),
        revenue_by_zone: revenueByZone || [],
        revenue_by_service: revenueByService || [],
      },
    }

    // Handle export formats
    if (exportFormat === 'csv') {
      return exportToCSV(analyticsData)
    } else if (exportFormat === 'json') {
      return new NextResponse(JSON.stringify(analyticsData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="revenue-analytics-${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    return createSuccessResponse(analyticsData)
  } catch (error) {
    console.error('[Revenue Analytics API] Error:', error)
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

  // Revenue Overview
  lines.push('REVENUE OVERVIEW')
  lines.push('Metric,Value')
  lines.push(`Date Range,"${data.date_range.start_date} to ${data.date_range.end_date}"`)
  lines.push(`Total Revenue,$${data.overview.total_revenue.toFixed(2)}`)
  lines.push(`Total Invoices,${data.overview.total_invoices}`)
  lines.push(`Unique Customers,${data.overview.unique_customers}`)
  lines.push(`Average Invoice Value,$${data.overview.avg_invoice_value.toFixed(2)}`)
  if (data.overview.yoy_comparison) {
    lines.push(`YoY Revenue Change,$${parseFloat(data.overview.yoy_comparison.revenue_change || 0).toFixed(2)}`)
    lines.push(`YoY Growth Rate,${parseFloat(data.overview.yoy_comparison.revenue_change_pct || 0).toFixed(2)}%`)
  }
  lines.push('')

  // Revenue Sources
  lines.push('REVENUE SOURCES')
  lines.push('Source,Revenue')
  data.revenue_sources.breakdown.forEach((source: any) => {
    lines.push(`${source.source},$${source.revenue.toFixed(2)}`)
  })
  lines.push('')

  // Payment Methods
  lines.push('PAYMENT METHODS')
  lines.push('Method,Transactions,Revenue,Avg Transaction,% of Transactions,% of Revenue')
  data.payment_analytics.methods.forEach((method: any) => {
    lines.push(
      `${method.payment_method},${method.transaction_count},$${parseFloat(method.total_revenue).toFixed(2)},$${parseFloat(method.avg_transaction_value).toFixed(2)},${parseFloat(method.percentage_of_transactions).toFixed(2)}%,${parseFloat(method.percentage_of_revenue).toFixed(2)}%`
    )
  })
  lines.push('')

  // Service Performance
  lines.push('SERVICE PERFORMANCE')
  lines.push('Service,Jobs,Customers,Revenue,Avg Revenue,Profit,Profit Margin %')
  data.service_performance.by_service.forEach((service: any) => {
    lines.push(
      `${service.service_type},${service.job_count},${service.unique_customers},$${parseFloat(service.total_revenue).toFixed(2)},$${parseFloat(service.avg_revenue_per_job).toFixed(2)},$${parseFloat(service.total_profit).toFixed(2)},${parseFloat(service.profit_margin_pct).toFixed(2)}%`
    )
  })
  lines.push('')

  // Customer LTV by Tier
  lines.push('CUSTOMER LIFETIME VALUE BY TIER')
  lines.push('Tier,Customers,Avg LTV,Avg Jobs,Avg Order Value,Repeat Rate %')
  data.customer_value.ltv_by_tier.forEach((tier: any) => {
    lines.push(
      `${tier.tier_name},${tier.customer_count},$${parseFloat(tier.avg_lifetime_value).toFixed(2)},${parseFloat(tier.avg_jobs_per_customer).toFixed(2)},$${parseFloat(tier.avg_order_value).toFixed(2)},${parseFloat(tier.repeat_purchase_rate_pct).toFixed(2)}%`
    )
  })
  lines.push('')

  // Revenue Trend
  lines.push('REVENUE TREND')
  lines.push('Date,Revenue,Invoices,Customers')
  data.charts.revenue_trend.forEach((point: any) => {
    lines.push(
      `${new Date(point.date).toLocaleDateString()},$${point.revenue.toFixed(2)},${point.invoices},${point.customers}`
    )
  })

  const csvContent = lines.join('\n')
  const filename = `revenue-analytics-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
