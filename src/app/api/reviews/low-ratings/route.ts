import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'

/**
 * Low Ratings API
 *
 * GET /api/reviews/low-ratings
 *
 * Returns reviews with 1-3 star ratings requiring follow-up.
 *
 * Features:
 * - Filters for ratings <= 3 stars
 * - Includes customer info, feedback, and support ticket status
 * - Shows resolution status
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
        'Only staff members can view low-rating reviews',
        403
      )
    }

    const serviceSupabase = getServiceSupabase()

    // Get low-rating reviews (1-3 stars) with customer and job info
    const { data: reviews, error: reviewsError } = await serviceSupabase
      .from('review_requests')
      .select(`
        id,
        customer_id,
        job_id,
        portal_review_rating,
        portal_review_text,
        portal_review_submitted_at,
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
      .lte('portal_review_rating', 3)
      .not('portal_review_rating', 'is', null)
      .order('portal_review_submitted_at', { ascending: false })

    if (reviewsError) {
      console.error('[Low Ratings] Error fetching reviews:', reviewsError)
      return createErrorResponse('fetch_failed', 'Failed to fetch low-rating reviews', 500)
    }

    // For each review, check if there's a support ticket
    const reviewsWithTickets = await Promise.all(
      (reviews || []).map(async (review: any) => {
        // Find associated support ticket
        const { data: ticket } = await serviceSupabase
          .from('support_tickets')
          .select('id, status, priority, assigned_to')
          .eq('metadata->>review_request_id', review.id)
          .single()

        // Calculate priority based on rating
        const priority = review.portal_review_rating === 1 ? 'high' : 'medium'

        // Get assigned user info if ticket exists and is assigned
        let assignedUser = null
        if (ticket && ticket.assigned_to) {
          const { data: assignedUserData } = await serviceSupabase
            .from('users')
            .select('id, first_name, last_name')
            .eq('id', ticket.assigned_to)
            .single()

          assignedUser = assignedUserData
        }

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
          rating: review.portal_review_rating,
          feedback: review.portal_review_text,
          submitted_at: review.portal_review_submitted_at,
          requested_at: review.requested_at,
          priority,
          support_ticket: ticket ? {
            id: ticket.id,
            status: ticket.status,
            priority: ticket.priority,
            assigned_to: assignedUser ? {
              id: assignedUser.id,
              name: `${assignedUser.first_name || ''} ${assignedUser.last_name || ''}`.trim(),
            } : null,
          } : null,
        }
      })
    )

    console.log(`[Low Ratings] Found ${reviewsWithTickets.length} low-rating reviews`)

    return createSuccessResponse({
      reviews: reviewsWithTickets,
      count: reviewsWithTickets.length,
    })
  } catch (error) {
    console.error('[Low Ratings] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
