import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'

/**
 * Review Statistics API
 *
 * GET /api/reviews/statistics
 *
 * Returns comprehensive review system statistics.
 *
 * Features:
 * - Total requests sent
 * - Completion rates (portal and Google)
 * - Average rating
 * - Google review click-through rate
 * - Pending review count
 * - Rating distribution
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
        'Only staff members can view review statistics',
        403
      )
    }

    const serviceSupabase = getServiceSupabase()

    // Get review statistics from database function
    const { data: stats, error: statsError } = await (serviceSupabase as any)
      .rpc('get_review_statistics')
      .single()

    if (statsError) {
      console.error('[Reviews API] Error fetching statistics:', statsError)
      return createErrorResponse(
        'fetch_failed',
        'Failed to fetch review statistics',
        500
      )
    }

    // Get rating distribution
    const { data: ratingDistribution, error: ratingError } = await serviceSupabase
      .from('review_requests')
      .select('portal_review_rating')
      .not('portal_review_rating', 'is', null)

    const distribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: (ratingDistribution || []).filter(
        (r: any) => r.portal_review_rating === rating
      ).length,
    }))

    // Get recent pending reviews
    const { data: pendingReviews } = await (serviceSupabase as any)
      .rpc('get_pending_review_requests', { days_old: 3 })

    return createSuccessResponse({
      overview: {
        totalRequests: stats.total_requests || 0,
        pendingRequests: stats.pending_requests || 0,
        portalCompleted: stats.portal_completed || 0,
        googleCompleted: stats.google_completed || 0,
        averageRating: stats.average_portal_rating || 0,
        completionRate: stats.completion_rate || 0,
        googleClickRate: stats.google_click_rate || 0,
      },
      ratingDistribution: distribution,
      pendingReviews: (pendingReviews || []).slice(0, 10), // Top 10 pending
    })
  } catch (error) {
    console.error('[Reviews API] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
