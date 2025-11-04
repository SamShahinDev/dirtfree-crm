import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'

/**
 * Customer Portal Pending Reviews API
 *
 * GET /api/portal/reviews/pending
 *
 * Returns customer's pending review requests.
 *
 * Features:
 * - Returns pending reviews for authenticated customer
 * - Includes job details
 * - Shows days since request
 * - Filters out completed/expired reviews
 *
 * Authentication: Required (customer portal access)
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const serviceSupabase = getServiceSupabase()

    // Get customer associated with user
    const { data: customer, error: customerError } = await serviceSupabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer profile not found', 404)
    }

    const customerId = (customer as any).id

    // Get pending review requests
    const { data: pendingReviews, error: reviewsError } = await serviceSupabase
      .from('review_requests')
      .select(`
        id,
        job_id,
        requested_at,
        request_method,
        portal_review_completed,
        google_review_requested,
        google_review_link_clicked,
        status,
        jobs (
          id,
          service_type,
          completed_at,
          total_amount,
          service_address
        )
      `)
      .eq('customer_id', customerId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false })

    if (reviewsError) {
      console.error('[Portal Reviews] Error fetching pending reviews:', reviewsError)
      return createErrorResponse(
        'fetch_failed',
        'Failed to fetch pending reviews',
        500
      )
    }

    // Calculate days since request for each review
    const reviewsWithMetadata = (pendingReviews || []).map((review: any) => ({
      ...review,
      daysSinceRequest: Math.floor(
        (Date.now() - new Date(review.requested_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))

    return createSuccessResponse({
      pendingReviews: reviewsWithMetadata,
      count: reviewsWithMetadata.length,
    })
  } catch (error) {
    console.error('[Portal Reviews] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
