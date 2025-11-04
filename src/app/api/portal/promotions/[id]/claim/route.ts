import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { generateClaimCode } from '@/lib/promotions/delivery'
import { validatePromotion } from '@/lib/promotions/validation'

/**
 * Portal Promotion Claim API
 *
 * POST /api/portal/promotions/[id]/claim
 *
 * Allows customers to claim promotions from the portal.
 *
 * Features:
 * - Validates promotion eligibility
 * - Generates unique claim code
 * - Creates/updates delivery record
 * - Marks promotion as viewed and claimed
 * - Returns claim code and redemption instructions
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

function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
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

    const promotionId = params.id
    const serviceSupabase = getServiceSupabase()

    // Get customer associated with user
    const { data: customer, error: customerError } = await serviceSupabase
      .from('customers')
      .select('id, full_name, zone_id')
      .eq('auth_user_id', user.id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer profile not found', 404)
    }

    const customerId = (customer as any).id
    const zoneId = (customer as any).zone_id

    // Validate promotion eligibility
    const validation = await validatePromotion({
      promotionId,
      customerId,
      zoneId,
    })

    if (!validation.valid) {
      return createErrorResponse(
        validation.code || 'validation_failed',
        validation.reason || 'Promotion is not eligible',
        400
      )
    }

    // Check if customer already has a delivery for this promotion
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
          'You have already redeemed this promotion',
          400
        )
      }

      if ((existingDelivery as any).claimed_at) {
        // Already claimed, return existing claim code
        return createSuccessResponse({
          message: 'Promotion already claimed',
          claimCode: (existingDelivery as any).claim_code,
          alreadyClaimed: true,
          instructions: 'Use this claim code when booking your service or during checkout.',
        })
      }

      // Update existing delivery to claimed
      const { error: updateError } = await (serviceSupabase as any)
        .from('promotion_deliveries')
        .update({
          viewed_at: (existingDelivery as any).viewed_at || new Date().toISOString(),
          claimed_at: new Date().toISOString(),
          metadata: {
            claim_source: 'customer_portal',
          },
        })
        .eq('id', (existingDelivery as any).id)

      if (updateError) {
        console.error('[Portal Claim] Error updating delivery:', updateError)
        return createErrorResponse('update_failed', 'Failed to claim promotion', 500)
      }

      return createSuccessResponse({
        message: 'Promotion claimed successfully',
        claimCode: (existingDelivery as any).claim_code,
        alreadyClaimed: false,
        instructions: 'Use this claim code when booking your service or during checkout.',
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
        viewed_at: new Date().toISOString(),
        claimed_at: new Date().toISOString(),
        delivery_channel: 'portal',
        metadata: {
          claim_source: 'customer_portal',
        },
      })
      .select()
      .single()

    if (createError) {
      console.error('[Portal Claim] Error creating delivery:', createError)
      return createErrorResponse('create_failed', 'Failed to claim promotion', 500)
    }

    return createSuccessResponse({
      message: 'Promotion claimed successfully',
      claimCode: (newDelivery as any).claim_code,
      alreadyClaimed: false,
      instructions: 'Use this claim code when booking your service or during checkout.',
    }, 201)
  } catch (error) {
    console.error('[Portal Claim] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
