import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { generateClaimCode } from '@/lib/promotions/delivery'

/**
 * Claim Promotion API
 *
 * POST /api/customers/[id]/promotions/[promotionId]/claim
 *
 * Manually claim a promotion for a customer (staff-assisted).
 *
 * Features:
 * - Generates unique claim code
 * - Creates or updates delivery record
 * - Tracks claim source (staff_assisted)
 * - Validates promotion eligibility
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

    // Validate promotion exists and is active
    const { data: promotion, error: promoError } = await serviceSupabase
      .from('promotions')
      .select('*')
      .eq('id', promotionId)
      .single()

    if (promoError || !promotion) {
      return createErrorResponse('not_found', 'Promotion not found', 404)
    }

    // Check promotion status
    if ((promotion as any).status !== 'active') {
      return createErrorResponse(
        'invalid_status',
        'Promotion is not active',
        400
      )
    }

    // Check if promotion has expired
    const endDate = new Date((promotion as any).end_date)
    const now = new Date()
    if (endDate < now) {
      return createErrorResponse(
        'expired',
        'Promotion has expired',
        400
      )
    }

    // Check if promotion has started
    const startDate = new Date((promotion as any).start_date)
    if (startDate > now) {
      return createErrorResponse(
        'not_started',
        'Promotion has not started yet',
        400
      )
    }

    // Check if customer has already claimed this promotion
    const { data: existingDelivery } = await serviceSupabase
      .from('promotion_deliveries')
      .select('id, claim_code, claimed_at, redeemed_at')
      .eq('promotion_id', promotionId)
      .eq('customer_id', customerId)
      .single()

    if (existingDelivery) {
      if ((existingDelivery as any).redeemed_at) {
        return createErrorResponse(
          'already_redeemed',
          'Promotion has already been redeemed by this customer',
          400
        )
      }

      if ((existingDelivery as any).claimed_at) {
        // Already claimed, return existing claim code
        return createSuccessResponse({
          message: 'Promotion already claimed',
          delivery: {
            id: (existingDelivery as any).id,
            claimCode: (existingDelivery as any).claim_code,
            claimedAt: (existingDelivery as any).claimed_at,
            alreadyClaimed: true,
          },
        })
      }

      // Update existing delivery to claimed
      const { error: updateError } = await (serviceSupabase as any)
        .from('promotion_deliveries')
        .update({
          claimed_at: new Date().toISOString(),
          metadata: {
            claim_source: 'staff_assisted',
            claimed_by_user_id: user.id,
          },
        })
        .eq('id', (existingDelivery as any).id)

      if (updateError) {
        console.error('[Claim] Error updating delivery:', updateError)
        return createErrorResponse('update_failed', 'Failed to claim promotion', 500)
      }

      // Log audit event
      await serviceSupabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'promotion_claimed',
        resource_type: 'promotion_delivery',
        resource_id: (existingDelivery as any).id,
        metadata: {
          promotion_id: promotionId,
          customer_id: customerId,
          claim_source: 'staff_assisted',
        },
      } as any)

      return createSuccessResponse({
        message: 'Promotion claimed successfully',
        delivery: {
          id: (existingDelivery as any).id,
          claimCode: (existingDelivery as any).claim_code,
          claimedAt: new Date().toISOString(),
          alreadyClaimed: false,
        },
      })
    }

    // Create new delivery record with claimed status
    const claimCode = generateClaimCode(promotionId, customerId)

    const { data: newDelivery, error: createError } = await (serviceSupabase as any)
      .from('promotion_deliveries')
      .insert({
        promotion_id: promotionId,
        customer_id: customerId,
        claim_code: claimCode,
        delivered_at: new Date().toISOString(),
        claimed_at: new Date().toISOString(),
        delivery_channel: 'portal',
        metadata: {
          claim_source: 'staff_assisted',
          claimed_by_user_id: user.id,
        },
      })
      .select()
      .single()

    if (createError) {
      console.error('[Claim] Error creating delivery:', createError)
      return createErrorResponse('create_failed', 'Failed to claim promotion', 500)
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'promotion_claimed',
      resource_type: 'promotion_delivery',
      resource_id: (newDelivery as any).id,
      metadata: {
        promotion_id: promotionId,
        customer_id: customerId,
        claim_source: 'staff_assisted',
      },
    } as any)

    return createSuccessResponse({
      message: 'Promotion claimed successfully',
      delivery: {
        id: (newDelivery as any).id,
        claimCode: (newDelivery as any).claim_code,
        claimedAt: (newDelivery as any).claimed_at,
        alreadyClaimed: false,
      },
    }, 201)
  } catch (error) {
    console.error('[Claim] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
