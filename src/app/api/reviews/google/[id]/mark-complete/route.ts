import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { linkReviewToCustomer } from '@/lib/integrations/google-reviews'
import { z } from 'zod'

/**
 * Mark Google Review as Complete API
 *
 * POST /api/reviews/google/[id]/mark-complete
 *
 * Manually link a Google review to a customer and mark associated
 * review request as completed.
 *
 * Request Body:
 * {
 *   "customerId": "uuid"  // Customer to link review to
 * }
 *
 * Process:
 * 1. Link Google review to customer
 * 2. Find most recent review_request for this customer with google_review_requested=true
 * 3. Mark review_request as google_review_completed=true
 * 4. Update google_reviews.matched_manually=true
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

const MarkCompleteSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
})

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        'Only staff members can mark reviews as complete',
        403
      )
    }

    const reviewId = params.id

    // Parse request body
    const body = await request.json()
    const validation = MarkCompleteSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { customerId } = validation.data

    console.log(`[Mark Complete] Linking Google review ${reviewId} to customer ${customerId}`)

    // Link review to customer (this also updates review_requests)
    const result = await linkReviewToCustomer(reviewId, customerId)

    if (!result.success) {
      return createErrorResponse(
        'link_failed',
        result.error || 'Failed to link review to customer',
        500
      )
    }

    console.log(`[Mark Complete] Successfully linked review ${reviewId}`)

    return createSuccessResponse({
      message: 'Review linked to customer and marked as complete',
    })
  } catch (error) {
    console.error('[Mark Complete] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
