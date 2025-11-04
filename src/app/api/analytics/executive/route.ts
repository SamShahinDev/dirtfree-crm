import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Executive Dashboard API
 *
 * GET /api/analytics/executive
 * Returns high-level executive KPIs with period-over-period comparison
 *
 * Query params:
 * - period: 'mtd' | 'qtd' | 'ytd' | 'custom' (default: 'mtd')
 * - start_date: ISO date string (for custom period)
 * - end_date: ISO date string (for custom period)
 *
 * Authentication: Required (admin/manager only)
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
 * Verify admin/manager authentication
 */
async function verifyExecutiveAuth(supabase: any, userId: string): Promise<boolean> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return userRole && ['admin', 'manager'].includes((userRole as any).role)
}

/**
 * Calculate period dates based on period type
 */
function getPeriodDates(period: string, customStart?: string, customEnd?: string) {
  const now = new Date()
  let startDate: Date
  let endDate: Date = now

  switch (period) {
    case 'mtd': // Month to Date
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'qtd': // Quarter to Date
      const quarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), quarter * 3, 1)
      break
    case 'ytd': // Year to Date
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    case 'custom':
      if (!customStart || !customEnd) {
        throw new Error('start_date and end_date required for custom period')
      }
      startDate = new Date(customStart)
      endDate = new Date(customEnd)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }
}

/**
 * Calculate trend indicator
 */
function getTrendIndicator(current: number, previous: number) {
  if (previous === 0) {
    return { direction: 'neutral' as const, change: 0, color: 'gray' }
  }

  const change = ((current - previous) / previous) * 100

  return {
    direction: change > 0 ? ('up' as const) : change < 0 ? ('down' as const) : ('neutral' as const),
    change: Math.abs(change),
    color: change > 0 ? 'green' : change < 0 ? 'red' : 'gray',
  }
}

/**
 * GET - Fetch executive dashboard KPIs
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify executive permissions
    const isExecutive = await verifyExecutiveAuth(supabase, user.id)
    if (!isExecutive) {
      return createErrorResponse(
        'forbidden',
        'Only admins and managers can view executive dashboard',
        403
      )
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'mtd'
    const customStart = searchParams.get('start_date')
    const customEnd = searchParams.get('end_date')

    // Calculate period dates
    const { startDate, endDate } = getPeriodDates(period, customStart || undefined, customEnd || undefined)

    // Fetch all KPIs in parallel
    const [
      financialResult,
      customerResult,
      operationalResult,
      marketingResult,
      revenueTrendResult,
      customerTrendResult,
    ] = await Promise.all([
      (supabase as any).rpc('get_financial_kpis', {
        period_start: startDate,
        period_end: endDate,
      }),
      (supabase as any).rpc('get_customer_kpis', {
        period_start: startDate,
        period_end: endDate,
      }),
      (supabase as any).rpc('get_operational_kpis', {
        period_start: startDate,
        period_end: endDate,
      }),
      (supabase as any).rpc('get_marketing_kpis', {
        period_start: startDate,
        period_end: endDate,
      }),
      (supabase as any).rpc('get_revenue_trend_12m'),
      (supabase as any).rpc('get_customer_acquisition_trend_12m'),
    ])

    // Handle errors
    if (financialResult.error) {
      console.error('[Executive API] Financial KPIs error:', financialResult.error)
    }
    if (customerResult.error) {
      console.error('[Executive API] Customer KPIs error:', customerResult.error)
    }
    if (operationalResult.error) {
      console.error('[Executive API] Operational KPIs error:', operationalResult.error)
    }
    if (marketingResult.error) {
      console.error('[Executive API] Marketing KPIs error:', marketingResult.error)
    }

    // Extract KPI data
    const financial = financialResult.data?.[0] || {}
    const customer = customerResult.data?.[0] || {}
    const operational = operationalResult.data?.[0] || {}
    const marketing = marketingResult.data?.[0] || {}

    // Build response with formatted KPIs
    const dashboardData = {
      period: {
        type: period,
        start_date: startDate,
        end_date: endDate,
      },

      // Financial KPIs
      financial: {
        revenue: {
          value: parseFloat(financial.current_revenue || 0),
          previous: parseFloat(financial.previous_revenue || 0),
          trend: getTrendIndicator(
            parseFloat(financial.current_revenue || 0),
            parseFloat(financial.previous_revenue || 0)
          ),
          growth_pct: parseFloat(financial.revenue_growth_pct || 0),
          target: null, // Will be populated from goals table
        },
        avg_invoice_value: {
          value: parseFloat(financial.avg_invoice_value || 0),
          previous: parseFloat(financial.previous_avg_invoice_value || 0),
          trend: getTrendIndicator(
            parseFloat(financial.avg_invoice_value || 0),
            parseFloat(financial.previous_avg_invoice_value || 0)
          ),
        },
        outstanding_receivables: {
          value: parseFloat(financial.outstanding_receivables || 0),
          overdue: parseFloat(financial.overdue_amount || 0),
        },
        profit_margin: {
          value: parseFloat(financial.profit_margin_estimate || 0),
          revenue: parseFloat(financial.current_revenue || 0),
          costs: parseFloat(financial.total_costs || 0),
          margin_pct: parseFloat(financial.current_revenue || 0) > 0
            ? (parseFloat(financial.profit_margin_estimate || 0) / parseFloat(financial.current_revenue || 0)) * 100
            : 0,
        },
      },

      // Customer KPIs
      customer: {
        total_customers: {
          value: parseInt(customer.total_customers || 0, 10),
        },
        new_customers: {
          value: parseInt(customer.new_customers || 0, 10),
          previous: parseInt(customer.previous_new_customers || 0, 10),
          trend: getTrendIndicator(
            parseInt(customer.new_customers || 0, 10),
            parseInt(customer.previous_new_customers || 0, 10)
          ),
          growth_pct: parseFloat(customer.customer_growth_pct || 0),
        },
        retention_rate: {
          value: parseFloat(customer.retention_rate || 0),
        },
        customer_ltv: {
          value: parseFloat(customer.avg_customer_ltv || 0),
        },
        nps_score: {
          value: parseFloat(customer.nps_score || 0),
          status: parseFloat(customer.nps_score || 0) >= 50 ? 'excellent' :
                  parseFloat(customer.nps_score || 0) >= 30 ? 'good' :
                  parseFloat(customer.nps_score || 0) >= 0 ? 'fair' : 'poor',
        },
        active_customers: {
          value: parseInt(customer.active_customers || 0, 10),
        },
        churned_customers: {
          value: parseInt(customer.churned_customers || 0, 10),
        },
      },

      // Operational KPIs
      operational: {
        jobs_completed: {
          value: parseInt(operational.total_jobs_completed || 0, 10),
          previous: parseInt(operational.previous_jobs_completed || 0, 10),
          trend: getTrendIndicator(
            parseInt(operational.total_jobs_completed || 0, 10),
            parseInt(operational.previous_jobs_completed || 0, 10)
          ),
          growth_pct: parseFloat(operational.jobs_growth_pct || 0),
        },
        avg_jobs_per_day: {
          value: parseFloat(operational.avg_jobs_per_day || 0),
        },
        technician_utilization: {
          value: parseFloat(operational.technician_utilization_rate || 0),
          status: parseFloat(operational.technician_utilization_rate || 0) >= 85 ? 'excellent' :
                  parseFloat(operational.technician_utilization_rate || 0) >= 70 ? 'good' :
                  parseFloat(operational.technician_utilization_rate || 0) >= 50 ? 'fair' : 'poor',
        },
        completion_rate: {
          value: parseFloat(operational.service_completion_rate || 0),
        },
        avg_rating: {
          value: parseFloat(operational.avg_customer_rating || 0),
          previous: parseFloat(operational.previous_avg_rating || 0),
          trend: getTrendIndicator(
            parseFloat(operational.avg_customer_rating || 0),
            parseFloat(operational.previous_avg_rating || 0)
          ),
        },
        on_time_rate: {
          value: parseFloat(operational.on_time_completion_rate || 0),
        },
      },

      // Marketing KPIs
      marketing: {
        portal_adoption: {
          value: parseFloat(marketing.portal_adoption_rate || 0),
          bookings: parseInt(marketing.portal_bookings || 0, 10),
          total_bookings: parseInt(marketing.total_bookings || 0, 10),
        },
        campaign_roi: {
          value: parseFloat(marketing.campaign_avg_roi || 0),
        },
        referral_conversion: {
          value: parseFloat(marketing.referral_conversion_rate || 0),
          total: parseInt(marketing.total_referrals || 0, 10),
          converted: parseInt(marketing.converted_referrals || 0, 10),
        },
        avg_review_score: {
          value: parseFloat(marketing.avg_review_score || 0),
          count: parseInt(marketing.review_count || 0, 10),
        },
        email_performance: {
          open_rate: parseFloat(marketing.email_open_rate || 0),
          click_rate: parseFloat(marketing.email_click_rate || 0),
        },
      },

      // Growth Indicators
      growth: {
        revenue_trend: (revenueTrendResult.data || []).map((item: any) => ({
          month: item.month,
          revenue: parseFloat(item.revenue || 0),
          job_count: parseInt(item.job_count || 0, 10),
          avg_invoice_value: parseFloat(item.avg_invoice_value || 0),
        })),
        customer_trend: (customerTrendResult.data || []).map((item: any) => ({
          month: item.month,
          new_customers: parseInt(item.new_customers || 0, 10),
          total_customers: parseInt(item.total_customers || 0, 10),
          growth_rate: parseFloat(item.growth_rate || 0),
        })),
      },
    }

    // Fetch goals from database
    const { data: goals } = await supabase
      .from('executive_goals')
      .select('*')
      .gte('period_end', startDate)
      .lte('period_start', endDate)
      .order('metric_category', { ascending: true })

    return createSuccessResponse({
      dashboard: dashboardData,
      goals: goals || [],
    })
  } catch (error) {
    console.error('[Executive API] Error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
