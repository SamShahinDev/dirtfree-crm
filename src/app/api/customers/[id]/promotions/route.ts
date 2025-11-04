import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'

/**
 * Customer Promotions API
 *
 * GET /api/customers/[id]/promotions - List customer's promotions
 *
 * Returns:
 * - Available promotions (eligible, not claimed)
 * - Claimed promotions (claimed, not redeemed)
 * - Redeemed promotions (redemption history)
 * - Expired promotions
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    const serviceSupabase = getServiceSupabase()

    // Check if customer exists
    const { data: customer, error: customerError } = await serviceSupabase
      .from('customers')
      .select('id, full_name, email')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer not found', 404)
    }

    // Get customer's promotion deliveries
    const { data: deliveries, error: deliveriesError } = await serviceSupabase
      .from('promotion_deliveries')
      .select(`
        id,
        promotion_id,
        claim_code,
        delivered_at,
        viewed_at,
        claimed_at,
        redeemed_at,
        discount_amount,
        delivery_channel,
        promotions (
          id,
          title,
          description,
          promotion_type,
          discount_value,
          discount_percentage,
          promo_code,
          start_date,
          end_date,
          status,
          terms_and_conditions
        )
      `)
      .eq('customer_id', customerId)
      .order('delivered_at', { ascending: false })

    if (deliveriesError) {
      console.error('[Customer Promotions] Error fetching deliveries:', deliveriesError)
      return createErrorResponse(
        'fetch_error',
        'Failed to fetch customer promotions',
        500
      )
    }

    // Get eligible promotions (not yet delivered to this customer)
    const { data: eligiblePromotions, error: eligibleError } = await (serviceSupabase as any).rpc(
      'get_eligible_promotions',
      { p_customer_id: customerId }
    )

    // Categorize promotions
    const now = new Date()
    const available: any[] = []
    const claimed: any[] = []
    const redeemed: any[] = []
    const expired: any[] = []

    // Process deliveries
    if (deliveries) {
      for (const delivery of deliveries) {
        const promo = (delivery as any).promotions
        if (!promo) continue

        const endDate = new Date(promo.end_date)
        const isExpired = endDate < now || promo.status === 'expired' || promo.status === 'cancelled'

        const promotionData = {
          deliveryId: (delivery as any).id,
          promotionId: promo.id,
          title: promo.title,
          description: promo.description,
          promotionType: promo.promotion_type,
          discountValue: promo.discount_value,
          discountPercentage: promo.discount_percentage,
          promoCode: promo.promo_code,
          claimCode: (delivery as any).claim_code,
          startDate: promo.start_date,
          endDate: promo.end_date,
          status: promo.status,
          termsAndConditions: promo.terms_and_conditions,
          deliveredAt: (delivery as any).delivered_at,
          viewedAt: (delivery as any).viewed_at,
          claimedAt: (delivery as any).claimed_at,
          redeemedAt: (delivery as any).redeemed_at,
          discountAmount: (delivery as any).discount_amount,
          deliveryChannel: (delivery as any).delivery_channel,
        }

        if ((delivery as any).redeemed_at) {
          redeemed.push(promotionData)
        } else if (isExpired) {
          expired.push(promotionData)
        } else if ((delivery as any).claimed_at) {
          claimed.push(promotionData)
        } else {
          available.push(promotionData)
        }
      }
    }

    // Add eligible promotions (not yet delivered)
    if (eligiblePromotions && Array.isArray(eligiblePromotions)) {
      for (const promo of eligiblePromotions) {
        const endDate = new Date(promo.end_date)
        const isExpired = endDate < now || promo.status === 'expired' || promo.status === 'cancelled'

        if (!isExpired && promo.status === 'active') {
          available.push({
            deliveryId: null,
            promotionId: promo.id,
            title: promo.title,
            description: promo.description,
            promotionType: promo.promotion_type,
            discountValue: promo.discount_value,
            discountPercentage: promo.discount_percentage,
            promoCode: promo.promo_code,
            claimCode: null,
            startDate: promo.start_date,
            endDate: promo.end_date,
            status: promo.status,
            termsAndConditions: promo.terms_and_conditions,
            deliveredAt: null,
            viewedAt: null,
            claimedAt: null,
            redeemedAt: null,
            discountAmount: null,
            deliveryChannel: null,
            isEligible: true,
          })
        }
      }
    }

    // Apply status filter if specified
    let filteredPromotions: any
    if (statusFilter) {
      switch (statusFilter) {
        case 'available':
          filteredPromotions = { available }
          break
        case 'claimed':
          filteredPromotions = { claimed }
          break
        case 'redeemed':
          filteredPromotions = { redeemed }
          break
        case 'expired':
          filteredPromotions = { expired }
          break
        default:
          filteredPromotions = { available, claimed, redeemed, expired }
      }
    } else {
      filteredPromotions = { available, claimed, redeemed, expired }
    }

    return createSuccessResponse({
      customer: {
        id: (customer as any).id,
        fullName: (customer as any).full_name,
        email: (customer as any).email,
      },
      promotions: filteredPromotions,
      counts: {
        available: available.length,
        claimed: claimed.length,
        redeemed: redeemed.length,
        expired: expired.length,
        total: available.length + claimed.length + redeemed.length + expired.length,
      },
    })
  } catch (error) {
    console.error('[Customer Promotions] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
