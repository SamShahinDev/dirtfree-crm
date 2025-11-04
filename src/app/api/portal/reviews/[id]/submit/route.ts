import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'
import { sendCustomEmail } from '@/lib/email/service'
import { renderReviewThankYouEmail } from '@/lib/email/templates/review-thank-you'
import { z } from 'zod'

/**
 * Smart Review Submission API
 *
 * POST /api/portal/reviews/[id]/submit
 *
 * Handles review submission with intelligent routing:
 * - 4-5 stars: Request Google review, optional feedback
 * - 1-3 stars: Create support ticket, required feedback
 *
 * Features:
 * - Rating-based conditional logic
 * - Support ticket creation for low ratings
 * - Thank you email for all ratings
 * - Resolution tracking
 *
 * Authentication: Required (customer portal access)
 */

const API_VERSION = 'v1'

const SubmitSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  feedback: z.string().max(2000, 'Feedback must be 2000 characters or less').optional(),
  resolutionRequest: z.string().max(500, 'Resolution request must be 500 characters or less').optional(),
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

/**
 * Create support ticket for low-rating reviews
 */
async function createSupportTicket(
  customerId: string,
  jobId: string,
  reviewRequestId: string,
  rating: number,
  feedback: string,
  resolutionRequest?: string
): Promise<{ success: boolean; ticketId?: string }> {
  try {
    const supabase = getServiceSupabase()

    // Get customer and job details
    const { data: customer } = await supabase
      .from('customers')
      .select('full_name, email, phone')
      .eq('id', customerId)
      .single()

    const { data: job } = await supabase
      .from('jobs')
      .select('service_type, service_address, completed_at')
      .eq('id', jobId)
      .single()

    // Create support ticket
    const { data: ticket, error: ticketError } = await (supabase as any)
      .from('support_tickets')
      .insert({
        customer_id: customerId,
        job_id: jobId,
        title: `Low Review Rating (${rating}/5) - ${(job as any)?.service_type || 'Service'}`,
        description: `Customer left a ${rating}/5 star review with the following feedback:\n\n${feedback}\n\n${resolutionRequest ? `Resolution Request: ${resolutionRequest}` : ''}`,
        category: 'service_quality',
        priority: rating === 1 ? 'high' : 'medium',
        status: 'open',
        source: 'review_system',
        metadata: {
          review_request_id: reviewRequestId,
          rating,
          feedback,
          resolution_request: resolutionRequest || null,
          auto_created: true,
        },
      })
      .select('id')
      .single()

    if (ticketError) {
      console.error('[Review Submit] Error creating support ticket:', ticketError)
      return { success: false }
    }

    console.log(`[Review Submit] Created support ticket ${(ticket as any).id} for low review`)

    return {
      success: true,
      ticketId: (ticket as any).id,
    }
  } catch (error) {
    console.error('[Review Submit] Error creating support ticket:', error)
    return { success: false }
  }
}

/**
 * Generate unique promo code
 */
function generatePromoCode(): string {
  const prefix = 'THANKS'
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}${randomPart}`
}

/**
 * Create promotion for high-rating review
 */
async function createReviewPromotion(
  customerId: string,
  promoCode: string
): Promise<{ success: boolean; promoId?: string }> {
  try {
    const supabase = getServiceSupabase()

    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 30) // 30 days from now

    const { data: promotion, error: promoError } = await (supabase as any)
      .from('promotions')
      .insert({
        code: promoCode,
        title: 'Thank You for Your 5-Star Review!',
        description: 'As a thank you for your positive review, enjoy 15% off your next service.',
        type: 'percentage_off',
        discount_percentage: 15,
        target_audience: 'specific',
        customer_ids: [customerId],
        valid_from: new Date().toISOString(),
        valid_until: expiryDate.toISOString(),
        max_uses_per_customer: 1,
        total_uses: 0,
        is_active: true,
        created_from: 'review_system',
      })
      .select('id')
      .single()

    if (promoError) {
      console.error('[Review Submit] Error creating promotion:', promoError)
      return { success: false }
    }

    console.log(`[Review Submit] Created promotion ${(promotion as any).id} with code ${promoCode}`)

    return {
      success: true,
      promoId: (promotion as any).id,
    }
  } catch (error) {
    console.error('[Review Submit] Error creating promotion:', error)
    return { success: false }
  }
}

/**
 * Send thank you email after review submission
 */
async function sendThankYouEmail(
  customerEmail: string,
  customerName: string,
  rating: number,
  googleReviewRequested: boolean,
  promoCode?: string
): Promise<void> {
  try {
    const subject = rating >= 4
      ? "Thank you for your positive feedback! ⭐"
      : "We're committed to making this right"

    const googleReviewUrl = googleReviewRequested
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/reviews/google/redirect/${customerEmail}`
      : undefined

    const html = renderReviewThankYouEmail({
      customerName,
      rating,
      googleReviewRequested,
      promoCode,
      promoDiscountPercent: 15,
      promoExpiryDays: 30,
      googleReviewUrl,
    })

    await sendCustomEmail(customerEmail, subject, html)
    console.log(`[Review Submit] Thank you email sent to ${customerEmail}`)
  } catch (error) {
    console.error('[Review Submit] Error sending thank you email:', error)
    // Don't fail the whole request if email fails
  }
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

    const { rating, feedback, resolutionRequest } = validation.data
    const serviceSupabase = getServiceSupabase()

    // Get customer associated with user
    const { data: customer, error: customerError } = await serviceSupabase
      .from('customers')
      .select('id, full_name, email')
      .eq('auth_user_id', user.id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer profile not found', 404)
    }

    const customerId = (customer as any).id

    // Get review request and verify ownership
    const { data: reviewRequest, error: requestError } = await serviceSupabase
      .from('review_requests')
      .select('id, customer_id, job_id, portal_review_completed')
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
        'Review already submitted',
        400
      )
    }

    // Determine if Google review should be requested (4-5 stars)
    const googleReviewRequested = rating >= 4

    // Update review request
    const { error: updateError } = await (serviceSupabase as any)
      .from('review_requests')
      .update({
        portal_review_completed: true,
        portal_review_rating: rating,
        portal_review_text: feedback || '',
        portal_review_submitted_at: new Date().toISOString(),
        google_review_requested: googleReviewRequested,
      })
      .eq('id', reviewRequestId)

    if (updateError) {
      console.error('[Review Submit] Error updating review request:', updateError)
      return createErrorResponse('update_failed', 'Failed to submit review', 500)
    }

    // If low rating (1-3 stars), create support ticket
    let supportTicketCreated = false
    let supportTicketId: string | undefined

    if (rating <= 3) {
      const ticketResult = await createSupportTicket(
        customerId,
        (reviewRequest as any).job_id,
        reviewRequestId,
        rating,
        feedback || 'No feedback provided',
        resolutionRequest
      )

      supportTicketCreated = ticketResult.success
      supportTicketId = ticketResult.ticketId

      if (!supportTicketCreated) {
        console.warn('[Review Submit] Failed to create support ticket for low review')
      }
    }

    // If high rating (4-5 stars), create discount promotion
    let promoCode: string | undefined
    let promoCreated = false

    if (rating >= 4) {
      promoCode = generatePromoCode()
      const promoResult = await createReviewPromotion(customerId, promoCode)

      promoCreated = promoResult.success

      if (!promoCreated) {
        console.warn('[Review Submit] Failed to create promo code for high review')
        // Still send thank you email without promo code
        promoCode = undefined
      }
    }

    // Send thank you email (async, don't wait)
    sendThankYouEmail(
      (customer as any).email,
      (customer as any).full_name,
      rating,
      googleReviewRequested,
      promoCode
    ).catch(console.error)

    return createSuccessResponse({
      message: 'Review submitted successfully',
      googleReviewRequested,
      supportTicketCreated: rating <= 3 ? supportTicketCreated : undefined,
      supportTicketId: rating <= 3 ? supportTicketId : undefined,
      promoCode: rating >= 4 ? promoCode : undefined,
      promoCreated: rating >= 4 ? promoCreated : undefined,
    })
  } catch (error) {
    console.error('[Review Submit] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
