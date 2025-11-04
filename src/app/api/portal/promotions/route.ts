import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import {
  getCached,
  invalidateCachePattern,
  promotionCacheKey,
} from '@/lib/cache/redis-cache'

/**
 * Portal Promotions API
 *
 * GET /api/portal/promotions - List customer's available promotions
 *
 * Returns:
 * - Active promotions eligible for the customer
 * - Not expired
 * - Not yet claimed (or within claim limit)
 * - Includes claim button data
 *
 * Authentication: Required (customer portal access)
 * Caching: 10 minutes
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
      .select('id, full_name, email, zone_id')
      .eq('auth_user_id', user.id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer profile not found', 404)
    }

    const customerId = (customer as any).id

    // Build cache key for this customer's promotions
    const cacheKey = promotionCacheKey('active', customerId)

    // Use caching for the expensive promotion fetch
    const promotionsData = await getCached(cacheKey, 'promotions', async () => {
      return await fetchPromotionsForCustomer(serviceSupabase, customerId)
    })

    return createSuccessResponse({
      promotions: promotionsData,
      customer: {
        id: (customer as any).id,
        fullName: (customer as any).full_name,
      },
    })
  } catch (error) {
    console.error('[Portal Promotions] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * Fetch promotions for a specific customer
 * This function is wrapped with caching
 */
async function fetchPromotionsForCustomer(serviceSupabase: any, customerId: string) {
  const now = new Date()

  // Get eligible promotions using database function
  const { data: eligiblePromotions, error: eligibleError } = await (serviceSupabase as any).rpc(
    'get_eligible_promotions',
    { p_customer_id: customerId }
  )

  if (eligibleError) {
    console.error('[Portal Promotions] Error fetching eligible promotions:', eligibleError)
    throw new Error('Failed to fetch promotions')
  }

  // Get customer's existing deliveries to check claim status
  const { data: deliveries, error: deliveriesError } = await serviceSupabase
    .from('promotion_deliveries')
    .select('promotion_id, claim_code, claimed_at, redeemed_at')
    .eq('customer_id', customerId)

  if (deliveriesError) {
    console.error('[Portal Promotions] Error fetching deliveries:', deliveriesError)
  }

  // Create a map of promotion statuses
  const deliveryMap = new Map()
  if (deliveries) {
    for (const delivery of deliveries) {
      deliveryMap.set((delivery as any).promotion_id, delivery)
    }
  }

  // Format promotions for portal
  const availablePromotions = (eligiblePromotions || [])
    .filter((promo: any) => {
      // Filter out expired
      const endDate = new Date(promo.end_date)
      if (endDate < now) return false

      // Check if promotion is active
      if (promo.status !== 'active') return false

      // Check if already claimed/redeemed
      const delivery = deliveryMap.get(promo.id)
      if (delivery && (delivery as any).redeemed_at) {
        // Already redeemed, don't show
        return false
      }

      return true
    })
    .map((promo: any) => {
      const delivery = deliveryMap.get(promo.id)
      const isClaimed = delivery && (delivery as any).claimed_at

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
        id: promo.id,
        title: promo.title,
        description: promo.description,
        promotionType: promo.promotion_type,
        discountValue: promo.discount_value,
        discountPercentage: promo.discount_percentage,
        discountDisplay,
        promoCode: promo.promo_code,
        startDate: promo.start_date,
        endDate: promo.end_date,
        daysUntilExpiration,
        termsAndConditions: promo.terms_and_conditions,
        isClaimed,
        claimCode: isClaimed ? (delivery as any).claim_code : null,
        canClaim: !isClaimed,
      }
    })

  return availablePromotions
}

/**
 * POST /api/portal/promotions/claim
 *
 * Claim a promotion and invalidate cache
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const body = await request.json()
    const { promotionId } = body

    if (!promotionId) {
      return createErrorResponse('bad_request', 'Promotion ID required', 400)
    }

    const serviceSupabase = getServiceSupabase()

    // Get customer ID
    const { data: customer } = await serviceSupabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!customer) {
      return createErrorResponse('not_found', 'Customer profile not found', 404)
    }

    const customerId = (customer as any).id

    // Check if already claimed
    const { data: existing } = await serviceSupabase
      .from('promotion_deliveries')
      .select('*')
      .eq('promotion_id', promotionId)
      .eq('customer_id', customerId)
      .single()

    if (existing && (existing as any).claimed_at) {
      return createErrorResponse('already_claimed', 'Promotion already claimed', 400)
    }

    // Create or update delivery record
    if (existing) {
      await serviceSupabase
        .from('promotion_deliveries')
        .update({ claimed_at: new Date().toISOString() })
        .eq('id', (existing as any).id)
    } else {
      await serviceSupabase.from('promotion_deliveries').insert({
        promotion_id: promotionId,
        customer_id: customerId,
        claimed_at: new Date().toISOString(),
        delivery_method: 'portal',
      })
    }

    // Invalidate cache for this customer's promotions
    invalidateCachePattern(customerId, 'promotions')

    return createSuccessResponse({
      message: 'Promotion claimed successfully',
    })
  } catch (error) {
    console.error('[Portal Promotions] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
