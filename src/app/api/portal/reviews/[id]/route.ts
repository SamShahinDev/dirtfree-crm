import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'

/**
 * Get Single Review Request API
 *
 * GET /api/portal/reviews/[id]
 *
 * Returns a specific review request for the authenticated customer.
 *
 * Features:
 * - Verifies customer ownership
 * - Returns review request with job details
 * - Checks completion status
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const reviewRequestId = params.id
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

    // Get review request
    const { data: reviewRequest, error: requestError } = await serviceSupabase
      .from('review_requests')
      .select(`
        id,
        customer_id,
        job_id,
        requested_at,
        request_method,
        portal_review_completed,
        portal_review_rating,
        portal_review_text,
        portal_review_submitted_at,
        google_review_requested,
        google_review_link_clicked,
        status,
        jobs (
          id,
          service_type,
          completed_at,
          service_address,
          total_amount
        )
      `)
      .eq('id', reviewRequestId)
      .single()

    if (requestError || !reviewRequest) {
      return createErrorResponse('not_found', 'Review request not found', 404)
    }

    // Verify this review request belongs to the customer
    if ((reviewRequest as any).customer_id !== customerId) {
      return createErrorResponse(
        'forbidden',
        'This review request does not belong to you',
        403
      )
    }

    return createSuccessResponse({
      reviewRequest,
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
