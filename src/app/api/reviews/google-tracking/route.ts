import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'

/**
 * Google Review Tracking API
 *
 * GET /api/reviews/google-tracking
 *
 * Returns customers who clicked the Google review link.
 *
 * Features:
 * - Filters for google_review_link_clicked = true
 * - Includes customer info and click timestamp
 * - Calculates days since click
 * - Shows completion status
 * - Staff only
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

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string, date2: Date = new Date()): number {
  const d1 = new Date(date1)
  const d2 = date2
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
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
        'Only staff members can view Google review tracking',
        403
      )
    }

    const serviceSupabase = getServiceSupabase()

    // Get reviews where Google link was clicked
    const { data: reviews, error: reviewsError } = await serviceSupabase
      .from('review_requests')
      .select(`
        id,
        customer_id,
        job_id,
        google_review_link_clicked,
        google_review_clicked_at,
        portal_review_rating,
        portal_review_completed,
        requested_at,
        customers (
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        jobs (
          id,
          service_type,
          scheduled_date,
          completion_date
        )
      `)
      .eq('google_review_link_clicked', true)
      .order('google_review_clicked_at', { ascending: false })

    if (reviewsError) {
      console.error('[Google Tracking] Error fetching reviews:', reviewsError)
      return createErrorResponse('fetch_failed', 'Failed to fetch Google review tracking', 500)
    }

    // Process reviews to add calculated fields
    const processedReviews = (reviews || []).map((review: any) => {
      const daysSinceClick = review.google_review_clicked_at
        ? daysBetween(review.google_review_clicked_at)
        : null

      return {
        id: review.id,
        customer: {
          id: review.customers?.id,
          name: `${review.customers?.first_name || ''} ${review.customers?.last_name || ''}`.trim(),
          email: review.customers?.email,
          phone: review.customers?.phone,
        },
        job: {
          id: review.jobs?.id,
          service_type: review.jobs?.service_type,
          scheduled_date: review.jobs?.scheduled_date,
          completion_date: review.jobs?.completion_date,
        },
        clicked_at: review.google_review_clicked_at,
        days_since_click: daysSinceClick,
        portal_review_completed: review.portal_review_completed,
        portal_review_rating: review.portal_review_rating,
        requested_at: review.requested_at,
        // Estimate completion status
        // Note: We can't directly verify Google review completion without Google API integration
        // This is a best-effort estimate based on portal review completion
        estimated_completion_status: review.portal_review_completed
          ? 'Portal review completed'
          : daysSinceClick && daysSinceClick > 7
            ? 'Likely not completed'
            : 'Pending',
      }
    })

    console.log(`[Google Tracking] Found ${processedReviews.length} Google review clicks`)

    return createSuccessResponse({
      reviews: processedReviews,
      count: processedReviews.length,
      summary: {
        total_clicks: processedReviews.length,
        recent_clicks_7_days: processedReviews.filter(r => r.days_since_click !== null && r.days_since_click <= 7).length,
        portal_completed: processedReviews.filter(r => r.portal_review_completed).length,
      },
    })
  } catch (error) {
    console.error('[Google Tracking] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
