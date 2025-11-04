import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'
import { submitPortalReview } from '@/lib/reviews/request'
import { z } from 'zod'

/**
 * Customer Portal Review Submission API
 *
 * POST /api/portal/reviews/submit
 *
 * Allows customers to submit their review (rating + text).
 *
 * Request Body:
 * - reviewRequestId: UUID of review request
 * - rating: 1-5 star rating
 * - reviewText: Optional text feedback
 *
 * Features:
 * - Validates customer ownership
 * - Validates rating (1-5)
 * - Updates review request
 * - Returns whether Google review is requested
 *
 * Authentication: Required (customer portal access)
 */

const API_VERSION = 'v1'

const SubmitSchema = z.object({
  reviewRequestId: z.string().uuid('Invalid review request ID'),
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  reviewText: z.string().max(2000, 'Review text must be 2000 characters or less').optional(),
})

function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Parse request body
    const body = await request.json()
    const validation = SubmitSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { reviewRequestId, rating, reviewText } = validation.data
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

    // Verify review request belongs to this customer
    const { data: reviewRequest, error: requestError } = await serviceSupabase
      .from('review_requests')
      .select('id, customer_id, status, portal_review_completed')
      .eq('id', reviewRequestId)
      .single()

    if (requestError || !reviewRequest) {
      return createErrorResponse('not_found', 'Review request not found', 404)
    }

    if ((reviewRequest as any).customer_id !== customerId) {
      return createErrorResponse(
        'forbidden',
        'This review request does not belong to you',
        403
      )
    }

    if ((reviewRequest as any).portal_review_completed) {
      return createErrorResponse(
        'already_submitted',
        'You have already submitted a review for this request',
        400
      )
    }

    // Submit review
    const result = await submitPortalReview(
      reviewRequestId,
      rating,
      reviewText || ''
    )

    if (!result.success) {
      return createErrorResponse(
        'submit_failed',
        result.error || 'Failed to submit review',
        400
      )
    }

    return createSuccessResponse({
      message: 'Thank you for your feedback!',
      googleReviewRequested: result.googleReviewRequested,
    })
  } catch (error) {
    console.error('[Portal Reviews] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
