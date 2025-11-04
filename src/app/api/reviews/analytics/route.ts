import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'

/**
 * Review Analytics API
 *
 * GET /api/reviews/analytics
 *
 * Returns comprehensive analytics and reporting data for reviews.
 *
 * Query Parameters:
 * - period: Time period granularity (daily, weekly, monthly) - default: weekly
 * - start_date: Start date for analysis (ISO format) - default: 90 days ago
 * - end_date: End date for analysis (ISO format) - default: today
 *
 * Features:
 * - Review request performance trends
 * - Rating distribution analysis
 * - Review source breakdown
 * - Response time metrics
 * - Follow-up effectiveness
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

  return userRole && ['admin', 'manager', 'dispatcher'].includes(userRole.role)
}

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
        'Only staff members can view review analytics',
        403
      )
    }

    const serviceSupabase = getServiceSupabase()
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const period = searchParams.get('period') || 'weekly'
    const endDate = searchParams.get('end_date') || new Date().toISOString()
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    console.log(`[Review Analytics] Fetching analytics for period: ${period}, range: ${startDate} to ${endDate}`)

    // Determine which view to query
    const viewName = period === 'daily'
      ? 'review_analytics_daily'
      : period === 'monthly'
      ? 'review_analytics_monthly'
      : 'review_analytics_weekly'

    const periodColumn = period === 'daily' ? 'day' : period === 'monthly' ? 'month' : 'week'

    // Fetch trend data from view
    const { data: trendData, error: trendError } = await serviceSupabase
      .from(viewName)
      .select('*')
      .gte(periodColumn, startDate)
      .lte(periodColumn, endDate)
      .order(periodColumn, { ascending: true })

    if (trendError) {
      console.error('[Review Analytics] Error fetching trend data:', trendError)
      return createErrorResponse('fetch_failed', 'Failed to fetch trend data', 500)
    }

    // Calculate overall statistics
    const { data: allReviews, error: reviewsError } = await serviceSupabase
      .from('review_requests')
      .select('*')
      .gte('requested_at', startDate)
      .lte('requested_at', endDate)

    if (reviewsError) {
      console.error('[Review Analytics] Error fetching reviews:', reviewsError)
      return createErrorResponse('fetch_failed', 'Failed to fetch reviews', 500)
    }

    // Rating Distribution
    const ratingDistribution = {
      rating_1: (allReviews || []).filter((r: any) => r.portal_review_rating === 1).length,
      rating_2: (allReviews || []).filter((r: any) => r.portal_review_rating === 2).length,
      rating_3: (allReviews || []).filter((r: any) => r.portal_review_rating === 3).length,
      rating_4: (allReviews || []).filter((r: any) => r.portal_review_rating === 4).length,
      rating_5: (allReviews || []).filter((r: any) => r.portal_review_rating === 5).length,
    }

    // Review Source Breakdown
    const sourceBreakdown = {
      portal_reviews: (allReviews || []).filter((r: any) => r.portal_review_completed).length,
      google_reviews: (allReviews || []).filter((r: any) => r.google_review_completed).length,
      email_requests: (allReviews || []).filter((r: any) => r.request_method === 'email').length,
      sms_requests: (allReviews || []).filter((r: any) => r.request_method === 'sms').length,
      portal_requests: (allReviews || []).filter((r: any) => r.request_method === 'portal').length,
    }

    // Response Time Metrics
    const reviewsWithPortalResponse = (allReviews || []).filter(
      (r: any) => r.portal_review_completed && r.portal_review_submitted_at && r.requested_at
    )

    const requestToPortalTimes = reviewsWithPortalResponse.map((r: any) => {
      const requestedAt = new Date(r.requested_at).getTime()
      const submittedAt = new Date(r.portal_review_submitted_at).getTime()
      return (submittedAt - requestedAt) / (1000 * 60 * 60) // Convert to hours
    })

    const avgRequestToPortal = requestToPortalTimes.length > 0
      ? requestToPortalTimes.reduce((sum, time) => sum + time, 0) / requestToPortalTimes.length
      : 0

    const reviewsWithGoogleClick = (allReviews || []).filter(
      (r: any) => r.google_review_link_clicked && r.google_review_clicked_at && r.portal_review_submitted_at
    )

    const portalToGoogleTimes = reviewsWithGoogleClick.map((r: any) => {
      const submittedAt = new Date(r.portal_review_submitted_at).getTime()
      const clickedAt = new Date(r.google_review_clicked_at).getTime()
      return (clickedAt - submittedAt) / (1000 * 60) // Convert to minutes
    })

    const avgPortalToGoogle = portalToGoogleTimes.length > 0
      ? portalToGoogleTimes.reduce((sum, time) => sum + time, 0) / portalToGoogleTimes.length
      : 0

    const responseTimes = {
      avg_request_to_portal_hours: Math.round(avgRequestToPortal * 10) / 10,
      avg_portal_to_google_minutes: Math.round(avgPortalToGoogle * 10) / 10,
      total_portal_responses: reviewsWithPortalResponse.length,
      total_google_clicks: reviewsWithGoogleClick.length,
    }

    // Follow-up Effectiveness
    // Get low-rating reviews with associated support tickets
    const lowRatingReviews = (allReviews || []).filter(
      (r: any) => r.portal_review_rating && r.portal_review_rating <= 3
    )

    // For each low-rating review, check if there's a resolved support ticket
    const lowRatingReviewIds = lowRatingReviews.map((r: any) => r.id)

    let resolvedLowRatings = 0
    if (lowRatingReviewIds.length > 0) {
      // Query support tickets that reference these reviews
      const { data: supportTickets } = await serviceSupabase
        .from('support_tickets')
        .select('id, status, metadata')
        .in('status', ['resolved', 'closed'])

      // Count how many low-rating reviews have resolved tickets
      const resolvedReviewIds = new Set(
        (supportTickets || [])
          .filter((ticket: any) => {
            try {
              const metadata = typeof ticket.metadata === 'string'
                ? JSON.parse(ticket.metadata)
                : ticket.metadata
              return metadata?.review_request_id && lowRatingReviewIds.includes(metadata.review_request_id)
            } catch {
              return false
            }
          })
          .map((ticket: any) => {
            const metadata = typeof ticket.metadata === 'string'
              ? JSON.parse(ticket.metadata)
              : ticket.metadata
            return metadata?.review_request_id
          })
      )

      resolvedLowRatings = resolvedReviewIds.size
    }

    const followUpEffectiveness = {
      total_low_ratings: lowRatingReviews.length,
      resolved_count: resolvedLowRatings,
      resolution_rate: lowRatingReviews.length > 0
        ? Math.round((resolvedLowRatings / lowRatingReviews.length) * 100 * 10) / 10
        : 0,
      pending_count: lowRatingReviews.length - resolvedLowRatings,
    }

    // Overall Summary
    const summary = {
      total_requests: (allReviews || []).length,
      total_responses: (allReviews || []).filter((r: any) => r.portal_review_completed).length,
      response_rate: (allReviews || []).length > 0
        ? Math.round(
            ((allReviews || []).filter((r: any) => r.portal_review_completed).length /
            (allReviews || []).length) * 100 * 10
          ) / 10
        : 0,
      avg_rating: reviewsWithPortalResponse.length > 0
        ? Math.round(
            (reviewsWithPortalResponse.reduce((sum: number, r: any) => sum + r.portal_review_rating, 0) /
            reviewsWithPortalResponse.length) * 10
          ) / 10
        : 0,
      google_conversion_rate: (allReviews || []).filter((r: any) => r.google_review_requested).length > 0
        ? Math.round(
            ((allReviews || []).filter((r: any) => r.google_review_link_clicked).length /
            (allReviews || []).filter((r: any) => r.google_review_requested).length) * 100 * 10
          ) / 10
        : 0,
    }

    console.log(`[Review Analytics] Processed ${allReviews?.length || 0} reviews, ${trendData?.length || 0} periods`)

    return createSuccessResponse({
      period,
      date_range: {
        start: startDate,
        end: endDate,
      },
      summary,
      trends: trendData || [],
      rating_distribution: ratingDistribution,
      source_breakdown: sourceBreakdown,
      response_times: responseTimes,
      follow_up_effectiveness: followUpEffectiveness,
    })
  } catch (error) {
    console.error('[Review Analytics] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
