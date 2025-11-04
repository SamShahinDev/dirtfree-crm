import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { validateClaimCode, validateJobValue, validateServiceTypeRestrictions } from '@/lib/promotions/validation'
import { z } from 'zod'

/**
 * Portal Promotion Redeem API
 *
 * POST /api/portal/promotions/redeem
 *
 * Allows customers to redeem promotions during checkout.
 *
 * Features:
 * - Validates claim code
 * - Checks promotion eligibility
 * - Applies discount to booking/invoice
 * - Marks promotion as redeemed
 * - Returns discount details
 *
 * Authentication: Required (customer portal access)
 */

const API_VERSION = 'v1'

const RedeemSchema = z.object({
  claimCode: z.string().min(1, 'Claim code is required'),
  jobId: z.string().uuid().optional(),
  jobValue: z.number().positive().optional(),
  serviceTypes: z.array(z.string()).optional(),
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
    const validation = RedeemSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { claimCode, jobId, jobValue, serviceTypes } = validation.data
    const serviceSupabase = getServiceSupabase()

    // Get customer associated with user
    const { data: customer, error: customerError } = await serviceSupabase
      .from('customers')
      .select('id, full_name')
      .eq('auth_user_id', user.id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer profile not found', 404)
    }

    const customerId = (customer as any).id

    // Validate claim code
    const claimValidation = await validateClaimCode(claimCode)

    if (!claimValidation.valid) {
      return createErrorResponse(
        claimValidation.code || 'invalid_claim_code',
        claimValidation.reason || 'Invalid or expired claim code',
        400
      )
    }

    const delivery = claimValidation.delivery
    const promotion = claimValidation.promotion

    // Verify claim code belongs to this customer
    if ((delivery as any).customer_id !== customerId) {
      return createErrorResponse(
        'unauthorized_claim',
        'This claim code does not belong to you',
        403
      )
    }

    // Validate job value if provided
    if (jobValue !== undefined) {
      const jobValueValidation = await validateJobValue(promotion.id, jobValue)
      if (!jobValueValidation.valid) {
        return createErrorResponse(
          jobValueValidation.code || 'invalid_job_value',
          jobValueValidation.reason || 'Job value does not meet promotion requirements',
          400
        )
      }
    }

    // Validate service types if provided
    if (serviceTypes && serviceTypes.length > 0) {
      const serviceValidation = await validateServiceTypeRestrictions(
        promotion.id,
        serviceTypes
      )
      if (!serviceValidation.valid) {
        return createErrorResponse(
          serviceValidation.code || 'invalid_service_type',
          serviceValidation.reason || 'Service type does not qualify for this promotion',
          400
        )
      }
    }

    // Calculate discount amount
    let discountAmount = 0
    if (promotion.promotion_type === 'percentage_off' && promotion.discount_percentage) {
      if (jobValue) {
        discountAmount = (jobValue * promotion.discount_percentage) / 100
      } else {
        // Return percentage for calculation later
        discountAmount = promotion.discount_percentage
      }
    } else if (promotion.promotion_type === 'dollar_off' && promotion.discount_value) {
      discountAmount = promotion.discount_value
    }

    // Update delivery record to redeemed
    const { error: updateError } = await (serviceSupabase as any)
      .from('promotion_deliveries')
      .update({
        redeemed_at: new Date().toISOString(),
        discount_amount: discountAmount,
        job_id: jobId || null,
        metadata: {
          ...((delivery as any).metadata || {}),
          redemption_source: 'customer_portal',
          redeemed_via: 'portal_checkout',
        },
      })
      .eq('id', (delivery as any).id)

    if (updateError) {
      console.error('[Portal Redeem] Error updating delivery:', updateError)
      return createErrorResponse('update_failed', 'Failed to redeem promotion', 500)
    }

    // Update promotion current redemptions counter
    const { error: promoUpdateError } = await (serviceSupabase as any)
      .from('promotions')
      .update({
        current_redemptions: (promotion.current_redemptions || 0) + 1,
      })
      .eq('id', promotion.id)

    if (promoUpdateError) {
      console.error('[Portal Redeem] Error updating promotion counter:', promoUpdateError)
    }

    return createSuccessResponse({
      message: 'Promotion redeemed successfully',
      redemption: {
        promotionId: promotion.id,
        promotionTitle: promotion.title,
        discountType: promotion.promotion_type,
        discountAmount,
        discountPercentage: promotion.discount_percentage,
        discountValue: promotion.discount_value,
        appliedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[Portal Redeem] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
