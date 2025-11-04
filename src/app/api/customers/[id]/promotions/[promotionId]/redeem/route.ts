import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Redeem Promotion API
 *
 * POST /api/customers/[id]/promotions/[promotionId]/redeem
 *
 * Manually redeem a promotion for a customer (staff-assisted).
 *
 * Features:
 * - Associates promotion with job
 * - Applies discount to job
 * - Updates promotion delivery status
 * - Tracks redemption source (staff_assisted)
 * - Validates promotion can be redeemed
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

const RedeemSchema = z.object({
  jobId: z.string().uuid().optional(),
  discountAmount: z.number().positive().optional(),
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

async function checkUserRole(userId: string, requiredRoles: string[]): Promise<boolean> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', requiredRoles)
    .single()
  return !error && !!data
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; promotionId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const hasAccess = await checkUserRole(user.id, ['admin', 'manager', 'dispatcher'])
    if (!hasAccess) {
      return createErrorResponse('forbidden', 'Insufficient permissions', 403)
    }

    const customerId = params.id
    const promotionId = params.promotionId

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

    const { jobId, discountAmount } = validation.data
    const serviceSupabase = getServiceSupabase()

    // Validate customer exists
    const { data: customer, error: customerError } = await serviceSupabase
      .from('customers')
      .select('id, full_name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer not found', 404)
    }

    // Validate promotion exists
    const { data: promotion, error: promoError } = await serviceSupabase
      .from('promotions')
      .select('*')
      .eq('id', promotionId)
      .single()

    if (promoError || !promotion) {
      return createErrorResponse('not_found', 'Promotion not found', 404)
    }

    // Get delivery record
    const { data: delivery, error: deliveryError } = await serviceSupabase
      .from('promotion_deliveries')
      .select('*')
      .eq('promotion_id', promotionId)
      .eq('customer_id', customerId)
      .single()

    if (deliveryError || !delivery) {
      return createErrorResponse(
        'not_claimed',
        'Promotion has not been claimed by this customer',
        400
      )
    }

    // Check if already redeemed
    if ((delivery as any).redeemed_at) {
      return createErrorResponse(
        'already_redeemed',
        'Promotion has already been redeemed',
        400
      )
    }

    // Calculate discount amount
    let finalDiscountAmount = discountAmount
    if (!finalDiscountAmount) {
      // Calculate from promotion
      if ((promotion as any).promotion_type === 'percentage_off') {
        // For percentage discounts, we need job amount (can be calculated later on job)
        finalDiscountAmount = (promotion as any).discount_percentage || 0
      } else if ((promotion as any).promotion_type === 'dollar_off') {
        finalDiscountAmount = (promotion as any).discount_value || 0
      } else {
        finalDiscountAmount = 0
      }
    }

    // Validate job if provided
    if (jobId) {
      const { data: job, error: jobError } = await serviceSupabase
        .from('jobs')
        .select('id, customer_id, status')
        .eq('id', jobId)
        .single()

      if (jobError || !job) {
        return createErrorResponse('invalid_job', 'Job not found', 400)
      }

      if ((job as any).customer_id !== customerId) {
        return createErrorResponse(
          'invalid_job',
          'Job does not belong to this customer',
          400
        )
      }
    }

    // Update delivery record
    const { error: updateError } = await (serviceSupabase as any)
      .from('promotion_deliveries')
      .update({
        redeemed_at: new Date().toISOString(),
        discount_amount: finalDiscountAmount,
        job_id: jobId || null,
        metadata: {
          ...((delivery as any).metadata || {}),
          redemption_source: 'staff_assisted',
          redeemed_by_user_id: user.id,
        },
      })
      .eq('id', (delivery as any).id)

    if (updateError) {
      console.error('[Redeem] Error updating delivery:', updateError)
      return createErrorResponse('update_failed', 'Failed to redeem promotion', 500)
    }

    // Update promotion current redemptions counter
    const { error: promoUpdateError } = await (serviceSupabase as any)
      .from('promotions')
      .update({
        current_redemptions: ((promotion as any).current_redemptions || 0) + 1,
      })
      .eq('id', promotionId)

    if (promoUpdateError) {
      console.error('[Redeem] Error updating promotion counter:', promoUpdateError)
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'promotion_redeemed',
      resource_type: 'promotion_delivery',
      resource_id: (delivery as any).id,
      metadata: {
        promotion_id: promotionId,
        customer_id: customerId,
        job_id: jobId,
        discount_amount: finalDiscountAmount,
        redemption_source: 'staff_assisted',
      },
    } as any)

    return createSuccessResponse({
      message: 'Promotion redeemed successfully',
      redemption: {
        deliveryId: (delivery as any).id,
        promotionId,
        customerId,
        jobId,
        discountAmount: finalDiscountAmount,
        redeemedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[Redeem] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
