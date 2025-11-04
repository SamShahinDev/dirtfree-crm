import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'

/**
 * Review Metrics API
 *
 * GET /api/reviews/metrics
 *
 * Returns dashboard metrics for review management.
 *
 * Metrics:
 * - Total requests sent this month
 * - Portal reviews received
 * - Google conversion rate (click-through)
 * - Average rating
 * - Reviews requiring follow-up (low ratings)
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
        'Only staff members can view review metrics',
        403
      )
    }

    const serviceSupabase = getServiceSupabase()

    // Calculate start of current month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Total requests sent this month
    const { count: totalRequestsThisMonth } = await serviceSupabase
      .from('review_requests')
      .select('*', { count: 'exact', head: true })
      .gte('requested_at', startOfMonth.toISOString())

    // Portal reviews received (completed)
    const { count: portalReviewsReceived } = await serviceSupabase
      .from('review_requests')
      .select('*', { count: 'exact', head: true })
      .eq('portal_review_completed', true)
      .gte('requested_at', startOfMonth.toISOString())

    // Google conversion rate (clicks / requests where Google was requested)
    const { data: googleStats } = await serviceSupabase
      .from('review_requests')
      .select('google_review_requested, google_review_link_clicked')
      .gte('requested_at', startOfMonth.toISOString())

    const googleRequested = (googleStats || []).filter((r: any) => r.google_review_requested).length
    const googleClicked = (googleStats || []).filter((r: any) => r.google_review_link_clicked).length
    const googleConversionRate = googleRequested > 0 ? (googleClicked / googleRequested) * 100 : 0

    // Average rating
    const { data: ratings } = await serviceSupabase
      .from('review_requests')
      .select('portal_review_rating')
      .not('portal_review_rating', 'is', null)
      .gte('requested_at', startOfMonth.toISOString())

    const totalRating = (ratings || []).reduce((sum: number, r: any) => sum + r.portal_review_rating, 0)
    const averageRating = ratings && ratings.length > 0 ? totalRating / ratings.length : 0

    // Reviews requiring follow-up (1-3 stars)
    const { count: reviewsRequiringFollowup } = await serviceSupabase
      .from('review_requests')
      .select('*', { count: 'exact', head: true })
      .lte('portal_review_rating', 3)
      .gte('requested_at', startOfMonth.toISOString())

    return createSuccessResponse({
      totalRequestsThisMonth: totalRequestsThisMonth || 0,
      portalReviewsReceived: portalReviewsReceived || 0,
      googleConversionRate,
      averageRating,
      reviewsRequiringFollowup: reviewsRequiringFollowup || 0,
    })
  } catch (error) {
    console.error('[Review Metrics] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
