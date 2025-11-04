import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'

/**
 * Messaging Analytics API
 *
 * GET /api/messaging/analytics
 * - Get comprehensive messaging analytics
 * - Query params: period (day/week/month), startDate, endDate
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
  )
}

/**
 * Check if user has required role
 */
async function checkUserRole(
  userId: string,
  requiredRoles: string[]
): Promise<boolean> {
  const supabase = getServiceSupabase()

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', requiredRoles)
    .single()

  return !error && !!data
}

/**
 * GET - Get messaging analytics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Check if user has staff role
    const hasAccess = await checkUserRole(user.id, [
      'admin',
      'manager',
      'dispatcher',
      'technician',
    ])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // day, week, month
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Calculate default date range based on period
    const now = new Date()
    let defaultStartDate: Date

    switch (period) {
      case 'day':
        defaultStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        defaultStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
      default:
        defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    const start = startDate ? new Date(startDate) : defaultStartDate
    const end = endDate ? new Date(endDate) : now

    const serviceSupabase = getServiceSupabase()

    // Fetch all analytics data in parallel
    const [
      overviewResult,
      timeSeriesResult,
      responseTimeResult,
      chatbotPerformanceResult,
      topicDistributionResult,
      escalationTrendsResult,
      satisfactionRatingsResult,
      resolutionTimeResult,
      hourlyVolumeResult,
      staffPerformanceResult,
    ] = await Promise.all([
      // Overview metrics
      serviceSupabase.rpc('get_messaging_overview', {
        p_period: period,
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any),

      // Time series data for charts
      serviceSupabase.rpc('get_message_volume_timeseries', {
        p_period: period === 'day' ? 'hour' : 'day',
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any),

      // Response time metrics
      serviceSupabase.rpc('get_average_response_time', {
        p_staff_id: null,
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any),

      // Chatbot performance
      serviceSupabase.rpc('get_chatbot_performance_metrics', {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any),

      // Topic distribution
      serviceSupabase.rpc('get_message_topic_distribution', {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any),

      // Escalation trends
      serviceSupabase.rpc('get_escalation_trends', {
        p_period: 'day',
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any),

      // Satisfaction ratings
      serviceSupabase.rpc('get_satisfaction_ratings', {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any),

      // Resolution time metrics
      serviceSupabase.rpc('get_resolution_time_metrics', {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any),

      // Hourly volume for busiest times
      serviceSupabase.from('message_volume_by_hour').select('*'),

      // Staff performance
      serviceSupabase.from('staff_performance_metrics').select('*'),
    ])

    // Check for errors
    if (overviewResult.error) {
      console.error('[Messaging Analytics] Overview error:', overviewResult.error)
      return createErrorResponse(
        'database_error',
        'Failed to fetch overview metrics',
        500
      )
    }

    // Extract data (with type assertions to handle Supabase typing)
    const overviewArray: any[] = (overviewResult.data as any) || []
    const overview: any = Array.isArray(overviewArray) && overviewArray.length > 0
      ? overviewArray[0]
      : {}

    const timeSeriesArray: any[] = (timeSeriesResult.data as any) || []
    const timeSeries = timeSeriesArray.map((item: any) => ({
      date: item.period_start,
      total: parseInt(item.total_messages || '0'),
      customer: parseInt(item.customer_messages || '0'),
      staff: parseInt(item.staff_messages || '0'),
      chatbot: parseInt(item.chatbot_messages || '0'),
    }))

    const responseTimeArray: any[] = (responseTimeResult.data as any) || []
    const responseTime = responseTimeArray.map((item: any) => ({
      staffId: item.staff_id,
      staffName: item.staff_name,
      avgResponseSeconds: parseFloat(item.avg_response_seconds || '0'),
      medianResponseSeconds: parseFloat(item.median_response_seconds || '0'),
      responseCount: parseInt(item.response_count || '0'),
    }))

    const chatbotPerformanceArray: any[] = (chatbotPerformanceResult.data as any) || []
    const chatbotPerformance: any = Array.isArray(chatbotPerformanceArray) && chatbotPerformanceArray.length > 0
      ? chatbotPerformanceArray[0]
      : {}

    const topicDistributionArray: any[] = (topicDistributionResult.data as any) || []
    const topicDistribution = topicDistributionArray.map((item: any) => ({
      intent: item.intent,
      count: parseInt(item.count || '0'),
      percentage: parseFloat(item.percentage || '0'),
    }))

    const escalationTrendsArray: any[] = (escalationTrendsResult.data as any) || []
    const escalationTrends = escalationTrendsArray.map((item: any) => ({
      date: item.period_start,
      totalSessions: parseInt(item.total_sessions || '0'),
      escalatedSessions: parseInt(item.escalated_sessions || '0'),
      escalationRate: parseFloat(item.escalation_rate || '0'),
      avgConfidence: parseFloat(item.avg_confidence || '0'),
    }))

    const satisfactionRatingsArray: any[] = (satisfactionRatingsResult.data as any) || []
    const satisfactionRatings = satisfactionRatingsArray.map((item: any) => ({
      rating: parseInt(item.rating || '0'),
      count: parseInt(item.count || '0'),
      percentage: parseFloat(item.percentage || '0'),
    }))

    const resolutionTimeArray: any[] = (resolutionTimeResult.data as any) || []
    const resolutionTime: any = Array.isArray(resolutionTimeArray) && resolutionTimeArray.length > 0
      ? resolutionTimeArray[0]
      : {}

    const hourlyVolumeArray: any[] = (hourlyVolumeResult.data as any) || []
    const hourlyVolume = hourlyVolumeArray.map((item: any) => ({
      hour: parseInt(item.hour_of_day || '0'),
      total: parseInt(item.message_count || '0'),
      customer: parseInt(item.customer_messages || '0'),
      staff: parseInt(item.staff_messages || '0'),
      chatbot: parseInt(item.chatbot_messages || '0'),
    }))

    const staffPerformanceArray: any[] = (staffPerformanceResult.data as any) || []
    const staffPerformance = staffPerformanceArray.map((item: any) => ({
      staffId: item.staff_id,
      staffName: item.staff_name,
      customersHandled: parseInt(item.customers_handled || '0'),
      totalMessagesSent: parseInt(item.total_messages_sent || '0'),
      daysActive: parseInt(item.days_active || '0'),
      firstMessageDate: item.first_message_date,
      lastMessageDate: item.last_message_date,
    }))

    // Calculate additional derived metrics
    const avgResponseTimeSeconds = responseTime.length > 0
      ? responseTime.reduce((sum, rt) => sum + rt.avgResponseSeconds, 0) / responseTime.length
      : 0

    const avgSatisfactionRating = satisfactionRatings.length > 0
      ? satisfactionRatings.reduce((sum, sr) => sum + (sr.rating * sr.count), 0) /
        satisfactionRatings.reduce((sum, sr) => sum + sr.count, 0)
      : 0

    // Format final response
    return createSuccessResponse({
      period,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      overview: {
        totalMessages: parseInt(overview.total_messages || '0'),
        customerMessages: parseInt(overview.customer_messages || '0'),
        staffMessages: parseInt(overview.staff_messages || '0'),
        chatbotMessages: parseInt(overview.chatbot_messages || '0'),
        uniqueCustomers: parseInt(overview.unique_customers || '0'),
        uniqueStaff: parseInt(overview.unique_staff || '0'),
        avgMessagesPerCustomer: parseFloat(overview.avg_messages_per_customer || '0'),
        chatbotPercentage: parseFloat(overview.chatbot_percentage || '0'),
        avgResponseTimeSeconds,
        avgSatisfactionRating: parseFloat(avgSatisfactionRating.toFixed(2)),
      },
      timeSeries,
      responseTime,
      chatbotPerformance: {
        totalSessions: parseInt(chatbotPerformance.total_sessions || '0'),
        totalInteractions: parseInt(chatbotPerformance.total_interactions || '0'),
        successfulSessions: parseInt(chatbotPerformance.successful_sessions || '0'),
        escalatedSessions: parseInt(chatbotPerformance.escalated_sessions || '0'),
        escalationRate: parseFloat(chatbotPerformance.escalation_rate || '0'),
        avgConfidence: parseFloat(chatbotPerformance.avg_confidence || '0'),
        avgInteractionsPerSession: parseFloat(chatbotPerformance.avg_interactions_per_session || '0'),
        topIntent: chatbotPerformance.top_intent || 'N/A',
        topIntentCount: parseInt(chatbotPerformance.top_intent_count || '0'),
      },
      topicDistribution,
      escalationTrends,
      satisfactionRatings,
      resolutionTime: {
        avgHours: parseFloat(resolutionTime.avg_resolution_hours || '0'),
        medianHours: parseFloat(resolutionTime.median_resolution_hours || '0'),
        minHours: parseFloat(resolutionTime.min_resolution_hours || '0'),
        maxHours: parseFloat(resolutionTime.max_resolution_hours || '0'),
        totalResolved: parseInt(resolutionTime.total_resolved || '0'),
      },
      hourlyVolume,
      staffPerformance,
    })
  } catch (error) {
    console.error('[Messaging Analytics] GET /api/messaging/analytics error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
