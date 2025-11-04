import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'

/**
 * Portal Claimed Promotions API
 *
 * GET /api/portal/promotions/claimed
 *
 * Returns customer's claimed promotions (not yet redeemed).
 *
 * Includes:
 * - Claim code
 * - Redemption status
 * - Expiration date
 * - Usage instructions
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
      .select('id, full_name')
      .eq('auth_user_id', user.id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer profile not found', 404)
    }

    const customerId = (customer as any).id

    // Get claimed promotions (claimed but not redeemed)
    const { data: deliveries, error: deliveriesError } = await serviceSupabase
      .from('promotion_deliveries')
      .select(`
        id,
        claim_code,
        claimed_at,
        redeemed_at,
        discount_amount,
        promotions (
          id,
          title,
          description,
          promotion_type,
          discount_value,
          discount_percentage,
          promo_code,
          end_date,
          terms_and_conditions
        )
      `)
      .eq('customer_id', customerId)
      .not('claimed_at', 'is', null)
      .is('redeemed_at', null)
      .order('claimed_at', { ascending: false })

    if (deliveriesError) {
      console.error('[Portal Claimed] Error fetching claimed promotions:', deliveriesError)
      return createErrorResponse(
        'fetch_error',
        'Failed to fetch claimed promotions',
        500
      )
    }

    // Format claimed promotions
    const now = new Date()
    const claimedPromotions = (deliveries || [])
      .filter((delivery: any) => {
        // Filter out expired promotions
        const promo = delivery.promotions
        if (!promo) return false

        const endDate = new Date(promo.end_date)
        return endDate >= now
      })
      .map((delivery: any) => {
        const promo = delivery.promotions

        // Calculate discount display
        let discountDisplay = ''
        if (promo.promotion_type === 'percentage_off' && promo.discount_percentage) {
          discountDisplay = `${promo.discount_percentage}% OFF`
        } else if (promo.promotion_type === 'dollar_off' && promo.discount_value) {
          discountDisplay = `$${promo.discount_value} OFF`
        } else {
          discountDisplay = promo.title
        }

        // Calculate days until expiration
        const endDate = new Date(promo.end_date)
        const daysUntilExpiration = Math.ceil(
          (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        return {
          deliveryId: delivery.id,
          promotionId: promo.id,
          title: promo.title,
          description: promo.description,
          promotionType: promo.promotion_type,
          discountValue: promo.discount_value,
          discountPercentage: promo.discount_percentage,
          discountDisplay,
          promoCode: promo.promo_code,
          claimCode: delivery.claim_code,
          claimedAt: delivery.claimed_at,
          expiresAt: promo.end_date,
          daysUntilExpiration,
          isExpiringSoon: daysUntilExpiration <= 7,
          termsAndConditions: promo.terms_and_conditions,
          instructions: 'Use this claim code when booking your service or add it during checkout to apply the discount.',
        }
      })

    return createSuccessResponse({
      promotions: claimedPromotions,
      count: claimedPromotions.length,
      customer: {
        id: (customer as any).id,
        fullName: (customer as any).full_name,
      },
    })
  } catch (error) {
    console.error('[Portal Claimed] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
