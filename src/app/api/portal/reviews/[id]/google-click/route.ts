import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'

/**
 * Google Review Click Tracking API
 *
 * POST /api/portal/reviews/[id]/google-click
 *
 * Tracks when a customer clicks the Google review link.
 *
 * Features:
 * - Updates google_review_link_clicked flag
 * - Records timestamp of click
 * - Verifies customer ownership
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

    // Verify review request ownership
    const { data: reviewRequest, error: requestError } = await serviceSupabase
      .from('review_requests')
      .select('id, customer_id, google_review_requested')
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

    // Check if Google review was actually requested
    if (!(reviewRequest as any).google_review_requested) {
      console.warn(`[Google Click] Google review was not requested for review ${reviewRequestId}`)
      // Still track the click even if not formally requested
    }

    // Update click tracking
    const { error: updateError } = await (serviceSupabase as any)
      .from('review_requests')
      .update({
        google_review_link_clicked: true,
        google_review_clicked_at: new Date().toISOString(),
      })
      .eq('id', reviewRequestId)

    if (updateError) {
      console.error('[Google Click] Error updating click tracking:', updateError)
      return createErrorResponse('update_failed', 'Failed to track click', 500)
    }

    console.log(`[Google Click] Tracked Google review click for review ${reviewRequestId}`)

    return createSuccessResponse({
      message: 'Google review click tracked successfully',
    })
  } catch (error) {
    console.error('[Google Click] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
