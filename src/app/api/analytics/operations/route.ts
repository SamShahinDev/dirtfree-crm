import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Operational Analytics API
 *
 * GET /api/analytics/operations
 * Returns comprehensive operational efficiency analytics
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
 * GET - Fetch operational analytics
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
        'Only staff can view operational analytics',
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
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)

    const groupBy = searchParams.get('group_by') || 'day'
    const exportFormat = searchParams.get('export')

    // 1. Get job performance overview
    const { data: jobOverview, error: overviewError } = await supabase
      .from('job_performance_overview')
      .select('*')
      .single()

    if (overviewError) {
      console.error('[Operations Analytics API] Overview error:', overviewError)
    }

    // 2. Get operational metrics for date range
    const { data: operationalMetrics, error: metricsError } = await (supabase as any)
      .rpc('get_operational_metrics', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })

    if (metricsError) {
      console.error('[Operations Analytics API] Metrics error:', metricsError)
    }

    // 3. Get technician performance
    const { data: technicianPerf, error: techError } = await supabase
      .from('technician_performance')
      .select('*')

    if (techError) {
      console.error('[Operations Analytics API] Technician error:', techError)
    }

    // 4. Get service time analysis
    const { data: serviceTimeAnalysis, error: serviceError } = await supabase
      .from('service_time_analysis')
      .select('*')

    if (serviceError) {
      console.error('[Operations Analytics API] Service time error:', serviceError)
    }

    // 5. Get cancellation analysis
    const { data: cancellationData, error: cancelError } = await supabase
      .from('cancellation_analysis')
      .select('*')

    if (cancelError) {
      console.error('[Operations Analytics API] Cancellation error:', cancelError)
    }

    // 6. Get scheduling efficiency by zone
    const { data: schedulingEfficiency, error: schedError } = await supabase
      .from('scheduling_efficiency_by_zone')
      .select('*')

    if (schedError) {
      console.error('[Operations Analytics API] Scheduling error:', schedError)
    }

    // 7. Get daily utilization metrics
    const { data: utilizationMetrics, error: utilError } = await supabase
      .from('daily_utilization_metrics')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (utilError) {
      console.error('[Operations Analytics API] Utilization error:', utilError)
    }

    // 8. Get job status trend
    const { data: statusTrend, error: trendError } = await (supabase as any)
      .rpc('get_job_status_trend', {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        group_by: groupBy,
      })

    if (trendError) {
      console.error('[Operations Analytics API] Status trend error:', trendError)
    }

    // 9. Get optimization opportunities
    const { data: opportunities, error: oppError } = await (supabase as any)
      .rpc('identify_optimization_opportunities')

    if (oppError) {
      console.error('[Operations Analytics API] Opportunities error:', oppError)
    }

    // Build response
    const analyticsData = {
      date_range: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        group_by: groupBy,
      },
      job_performance: {
        overview: {
          total_jobs: parseInt((jobOverview as any)?.total_jobs || 0, 10),
          completed_jobs: parseInt((jobOverview as any)?.completed_jobs || 0, 10),
          scheduled_jobs: parseInt((jobOverview as any)?.scheduled_jobs || 0, 10),
          cancelled_jobs: parseInt((jobOverview as any)?.cancelled_jobs || 0, 10),
          in_progress_jobs: parseInt((jobOverview as any)?.in_progress_jobs || 0, 10),
          completion_rate: parseFloat((jobOverview as any)?.completion_rate_pct || 0),
          cancellation_rate: parseFloat((jobOverview as any)?.cancellation_rate_pct || 0),
          avg_job_duration: parseFloat((jobOverview as any)?.avg_job_duration_mins || 0),
          total_technicians: parseInt((jobOverview as any)?.total_technicians || 0, 10),
        },
        period_metrics: operationalMetrics?.[0] || null,
        status_trend: (statusTrend || []).map((trend: any) => ({
          period: trend.period,
          total: parseInt(trend.total_jobs || 0, 10),
          completed: parseInt(trend.completed || 0, 10),
          cancelled: parseInt(trend.cancelled || 0, 10),
          scheduled: parseInt(trend.scheduled || 0, 10),
          in_progress: parseInt(trend.in_progress || 0, 10),
        })),
      },
      scheduling_efficiency: {
        by_zone: (schedulingEfficiency || []).map((zone: any) => ({
          zone_id: zone.zone_id,
          zone_name: zone.zone_name,
          total_jobs: parseInt(zone.total_jobs || 0, 10),
          avg_job_duration: parseFloat(zone.avg_job_duration || 0),
          avg_travel_time: parseFloat(zone.avg_travel_time || 0),
          travel_vs_service_ratio: parseFloat(zone.travel_vs_service_ratio_pct || 0),
          jobs_per_day: parseFloat(zone.jobs_per_day || 0),
        })),
        utilization: (utilizationMetrics || []).map((util: any) => ({
          date: util.date,
          total_jobs: parseInt(util.total_jobs || 0, 10),
          technicians_working: parseInt(util.technicians_working || 0, 10),
          utilization_rate: parseFloat(util.utilization_rate_pct || 0),
          jobs_per_technician: parseFloat(util.jobs_per_technician || 0),
        })),
      },
      technician_performance: (technicianPerf || []).map((tech: any) => ({
        technician_id: tech.technician_id,
        technician_name: tech.technician_name,
        total_jobs: parseInt(tech.total_jobs || 0, 10),
        completed_jobs: parseInt(tech.completed_jobs || 0, 10),
        cancelled_jobs: parseInt(tech.cancelled_jobs || 0, 10),
        completion_rate: parseFloat(tech.completion_rate_pct || 0),
        avg_job_duration: parseFloat(tech.avg_job_duration_mins || 0),
        total_revenue: parseFloat(tech.total_revenue || 0),
        avg_rating: parseFloat(tech.avg_rating || 0),
        rating_count: parseInt(tech.rating_count || 0, 10),
        efficiency_score: parseFloat(tech.efficiency_score || 0),
      })),
      service_time_analysis: (serviceTimeAnalysis || []).map((service: any) => ({
        service_type: service.service_type,
        job_count: parseInt(service.job_count || 0, 10),
        avg_estimated_duration: parseFloat(service.avg_estimated_duration || 0),
        avg_actual_duration: parseFloat(service.avg_actual_duration || 0),
        avg_variance: parseFloat(service.avg_variance || 0),
        actual_vs_estimated_pct: parseFloat(service.actual_vs_estimated_pct || 0),
        runs_over_count: parseInt(service.runs_over_count || 0, 10),
        on_time_count: parseInt(service.on_time_count || 0, 10),
        on_time_rate: parseFloat(service.on_time_rate_pct || 0),
      })),
      cancellation_analysis: {
        by_reason: (cancellationData || []).map((cancel: any) => ({
          reason: cancel.cancellation_reason || 'Unspecified',
          count: parseInt(cancel.cancellation_count || 0, 10),
          percentage: parseFloat(cancel.percentage || 0),
          avg_days_before: parseFloat(cancel.avg_days_before_cancellation || 0),
          lost_revenue: parseFloat(cancel.potential_lost_revenue || 0),
        })),
        total_cancelled: parseInt((jobOverview as any)?.cancelled_jobs || 0, 10),
        cancellation_rate: parseFloat((jobOverview as any)?.cancellation_rate_pct || 0),
        total_lost_revenue: (cancellationData || []).reduce(
          (sum: number, item: any) => sum + parseFloat(item.potential_lost_revenue || 0),
          0
        ),
      },
      optimization_opportunities: (opportunities || []).map((opp: any) => ({
        type: opp.opportunity_type,
        description: opp.description,
        impact_level: opp.impact_level,
        affected_count: opp.affected_count,
        recommendation: opp.potential_improvement,
      })),
    }

    // Handle export formats
    if (exportFormat === 'csv') {
      return exportToCSV(analyticsData)
    } else if (exportFormat === 'json') {
      return new NextResponse(JSON.stringify(analyticsData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="operational-analytics-${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }

    return createSuccessResponse(analyticsData)
  } catch (error) {
    console.error('[Operations Analytics API] Error:', error)
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

  // Job Performance Overview
  lines.push('JOB PERFORMANCE OVERVIEW')
  lines.push('Metric,Value')
  lines.push(`Date Range,"${data.date_range.start_date} to ${data.date_range.end_date}"`)
  lines.push(`Total Jobs,${data.job_performance.overview.total_jobs}`)
  lines.push(`Completed Jobs,${data.job_performance.overview.completed_jobs}`)
  lines.push(`Scheduled Jobs,${data.job_performance.overview.scheduled_jobs}`)
  lines.push(`Cancelled Jobs,${data.job_performance.overview.cancelled_jobs}`)
  lines.push(`In Progress,${data.job_performance.overview.in_progress_jobs}`)
  lines.push(`Completion Rate,${data.job_performance.overview.completion_rate.toFixed(2)}%`)
  lines.push(`Cancellation Rate,${data.job_performance.overview.cancellation_rate.toFixed(2)}%`)
  lines.push(`Avg Job Duration,${data.job_performance.overview.avg_job_duration.toFixed(0)} mins`)
  lines.push(`Total Technicians,${data.job_performance.overview.total_technicians}`)
  lines.push('')

  // Technician Performance
  lines.push('TECHNICIAN PERFORMANCE')
  lines.push('Technician,Jobs,Completed,Cancelled,Completion Rate %,Avg Duration,Revenue,Avg Rating,Efficiency Score')
  data.technician_performance.forEach((tech: any) => {
    lines.push(
      `${tech.technician_name},${tech.total_jobs},${tech.completed_jobs},${tech.cancelled_jobs},${tech.completion_rate.toFixed(1)}%,${tech.avg_job_duration.toFixed(0)} mins,$${tech.total_revenue.toFixed(2)},${tech.avg_rating.toFixed(1)},${tech.efficiency_score.toFixed(0)}`
    )
  })
  lines.push('')

  // Service Time Analysis
  lines.push('SERVICE TIME ANALYSIS')
  lines.push('Service,Jobs,Est Duration,Actual Duration,Variance,Actual vs Est %,Runs Over,On Time,On Time Rate %')
  data.service_time_analysis.forEach((service: any) => {
    lines.push(
      `${service.service_type},${service.job_count},${service.avg_estimated_duration.toFixed(0)},${service.avg_actual_duration.toFixed(0)},${service.avg_variance.toFixed(0)},${service.actual_vs_estimated_pct.toFixed(1)}%,${service.runs_over_count},${service.on_time_count},${service.on_time_rate.toFixed(1)}%`
    )
  })
  lines.push('')

  // Scheduling Efficiency
  lines.push('SCHEDULING EFFICIENCY BY ZONE')
  lines.push('Zone,Jobs,Avg Job Duration,Avg Travel Time,Travel vs Service %,Jobs/Day')
  data.scheduling_efficiency.by_zone.forEach((zone: any) => {
    lines.push(
      `${zone.zone_name},${zone.total_jobs},${zone.avg_job_duration.toFixed(0)} mins,${zone.avg_travel_time.toFixed(0)} mins,${zone.travel_vs_service_ratio.toFixed(1)}%,${zone.jobs_per_day.toFixed(1)}`
    )
  })
  lines.push('')

  // Cancellation Analysis
  lines.push('CANCELLATION ANALYSIS')
  lines.push('Reason,Count,Percentage,Avg Days Before,Lost Revenue')
  data.cancellation_analysis.by_reason.forEach((cancel: any) => {
    lines.push(
      `${cancel.reason},${cancel.count},${cancel.percentage.toFixed(1)}%,${cancel.avg_days_before.toFixed(1)},$${cancel.lost_revenue.toFixed(2)}`
    )
  })
  lines.push('')

  // Optimization Opportunities
  lines.push('OPTIMIZATION OPPORTUNITIES')
  lines.push('Type,Impact,Description,Affected Count,Recommendation')
  data.optimization_opportunities.forEach((opp: any) => {
    lines.push(
      `${opp.type},${opp.impact_level},"${opp.description}",${opp.affected_count},"${opp.recommendation}"`
    )
  })

  const csvContent = lines.join('\n')
  const filename = `operational-analytics-${new Date().toISOString().split('T')[0]}.csv`

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
