import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'

/**
 * Portal Analytics Stats
 *
 * GET /api/portal/analytics/stats
 * - Returns portal adoption and engagement metrics
 * - Includes daily, weekly, monthly aggregations
 * - Provides ROI and conversion metrics
 *
 * Requires admin authentication via Supabase
 */

const API_VERSION = 'v1'

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ success: false, error, message, version: API_VERSION }, { status })
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status: 200 }
  )
}

/**
 * GET - Retrieve portal analytics stats
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return createErrorResponse('authentication_required', 'Authentication required', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = getServiceSupabase()

    // Validate user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Invalid authentication', 401)
    }

    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (roleError || !userRole) {
      return createErrorResponse('forbidden', 'Admin access required', 403)
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // days
    const periodDays = parseInt(period, 10)

    // Get portal adoption rate
    const { data: adoptionData } = await supabase.rpc('get_portal_adoption_rate')

    const adoption = adoptionData?.[0] || {
      total_customers: 0,
      registered_portal_users: 0,
      adoption_rate: 0,
    }

    // Get daily stats for the period
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    const { data: dailyStats, error: dailyError } = await supabase
      .from('portal_analytics_daily')
      .select('*')
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: false })

    if (dailyError) {
      console.error('[Portal Analytics] Failed to fetch daily stats:', dailyError)
      return createErrorResponse('query_failed', 'Failed to fetch statistics', 500)
    }

    // Calculate aggregate metrics
    const stats = dailyStats || []

    const totalActiveUsers = stats.reduce((sum, day) => sum + (day.total_active_users || 0), 0)
    const avgDailyActiveUsers = stats.length > 0 ? totalActiveUsers / stats.length : 0

    const totalPageViews = stats.reduce((sum, day) => sum + (day.total_page_views || 0), 0)
    const avgPageViews = stats.length > 0 ? totalPageViews / stats.length : 0

    const totalBookingsInitiated = stats.reduce((sum, day) => sum + (day.bookings_initiated || 0), 0)
    const totalBookingsCompleted = stats.reduce((sum, day) => sum + (day.bookings_completed || 0), 0)
    const bookingConversionRate = totalBookingsInitiated > 0
      ? (totalBookingsCompleted / totalBookingsInitiated * 100)
      : 0

    const totalPaymentsInitiated = stats.reduce((sum, day) => sum + (day.payments_initiated || 0), 0)
    const totalPaymentsCompleted = stats.reduce((sum, day) => sum + (day.payments_completed || 0), 0)
    const paymentConversionRate = totalPaymentsInitiated > 0
      ? (totalPaymentsCompleted / totalPaymentsInitiated * 100)
      : 0

    const totalPaymentAmount = stats.reduce((sum, day) => sum + parseFloat(day.total_payment_amount || '0'), 0)

    const totalMessagesSent = stats.reduce((sum, day) => sum + (day.messages_sent || 0), 0)

    const totalSessions = stats.reduce((sum, day) => sum + (day.total_sessions || 0), 0)
    const totalSessionDuration = stats.reduce((sum, day) => sum + parseFloat(day.avg_session_duration_minutes || '0') * (day.total_sessions || 0), 0)
    const avgSessionDuration = totalSessions > 0 ? totalSessionDuration / totalSessions : 0

    // Get monthly active users (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: mauData } = await supabase
      .from('portal_analytics')
      .select('customer_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('customer_id', 'is', null)

    const uniqueCustomerIds = new Set((mauData || []).map(row => row.customer_id))
    const monthlyActiveUsers = uniqueCustomerIds.size

    // Get feature usage breakdown
    const { data: featureUsage } = await supabase
      .from('portal_analytics')
      .select('event_type')
      .gte('created_at', startDate.toISOString())
      .eq('event_type', 'feature_usage')

    const featureBreakdown = (featureUsage || []).reduce((acc, row) => {
      const eventType = row.event_type
      acc[eventType] = (acc[eventType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Compile response
    const response = {
      period: {
        days: periodDays,
        startDate: startDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      },
      adoption: {
        totalCustomers: Number(adoption.total_customers) || 0,
        registeredPortalUsers: Number(adoption.registered_portal_users) || 0,
        adoptionRate: parseFloat(adoption.adoption_rate?.toString() || '0'),
      },
      engagement: {
        monthlyActiveUsers,
        avgDailyActiveUsers: Math.round(avgDailyActiveUsers),
        totalSessions,
        avgSessionDurationMinutes: parseFloat(avgSessionDuration.toFixed(2)),
        totalPageViews,
        avgDailyPageViews: Math.round(avgPageViews),
      },
      bookings: {
        initiated: totalBookingsInitiated,
        completed: totalBookingsCompleted,
        cancelled: stats.reduce((sum, day) => sum + (day.bookings_cancelled || 0), 0),
        conversionRate: parseFloat(bookingConversionRate.toFixed(2)),
      },
      payments: {
        initiated: totalPaymentsInitiated,
        completed: totalPaymentsCompleted,
        failed: stats.reduce((sum, day) => sum + (day.payments_failed || 0), 0),
        conversionRate: parseFloat(paymentConversionRate.toFixed(2)),
        totalAmount: parseFloat(totalPaymentAmount.toFixed(2)),
      },
      communication: {
        messagesSent: totalMessagesSent,
        messagesViewed: stats.reduce((sum, day) => sum + (day.messages_viewed || 0), 0),
      },
      invoices: {
        viewed: stats.reduce((sum, day) => sum + (day.invoices_viewed || 0), 0),
        downloaded: stats.reduce((sum, day) => sum + (day.invoices_downloaded || 0), 0),
      },
      notifications: {
        clicked: stats.reduce((sum, day) => sum + (day.notifications_clicked || 0), 0),
      },
      featureUsage: featureBreakdown,
      dailyStats: stats.slice(0, 30), // Last 30 days
    }

    return createSuccessResponse(response)

  } catch (error) {
    console.error('[Portal Analytics] GET /api/portal/analytics/stats error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
