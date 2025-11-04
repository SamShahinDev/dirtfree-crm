/**
 * Portal Loyalty Balance API
 *
 * GET /api/portal/loyalty/balance - Get customer's loyalty points balance
 *
 * Cached for 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { getCached, invalidateCache, loyaltyCacheKey } from '@/lib/cache/redis-cache'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const serviceSupabase = getServiceSupabase()

    // Get customer ID
    const { data: customer } = await serviceSupabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customerId = (customer as any).id

    // Build cache key
    const cacheKey = loyaltyCacheKey(customerId, 'balance')

    // Use caching
    const loyaltyData = await getCached(cacheKey, 'loyalty', async () => {
      // Fetch loyalty balance
      const { data: loyalty, error } = await serviceSupabase
        .from('customer_loyalty')
        .select(
          `
          *,
          loyalty_tiers!current_tier_id(
            name,
            tier_rank,
            discount_percentage,
            points_threshold
          )
        `
        )
        .eq('customer_id', customerId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      // If no loyalty record, return defaults
      if (!loyalty) {
        return {
          currentPoints: 0,
          lifetimePoints: 0,
          tier: {
            name: 'Bronze',
            tierRank: 1,
            discountPercentage: 0,
            pointsThreshold: 0,
          },
          pointsToNextTier: 500,
          nextTier: 'Silver',
        }
      }

      // Calculate points to next tier
      const currentTierRank = (loyalty as any).loyalty_tiers?.tier_rank || 1
      const nextTierThreshold = currentTierRank === 1 ? 500 : currentTierRank === 2 ? 1000 : null
      const pointsToNextTier = nextTierThreshold
        ? nextTierThreshold - (loyalty as any).current_points
        : 0

      return {
        currentPoints: (loyalty as any).current_points,
        lifetimePoints: (loyalty as any).lifetime_points,
        tier: {
          name: (loyalty as any).loyalty_tiers?.name || 'Bronze',
          tierRank: currentTierRank,
          discountPercentage: (loyalty as any).loyalty_tiers?.discount_percentage || 0,
          pointsThreshold: (loyalty as any).loyalty_tiers?.points_threshold || 0,
        },
        pointsToNextTier: Math.max(0, pointsToNextTier),
        nextTier: currentTierRank === 1 ? 'Silver' : currentTierRank === 2 ? 'Gold' : null,
      }
    })

    return NextResponse.json({
      success: true,
      data: loyaltyData,
    })
  } catch (error: any) {
    console.error('Error fetching loyalty balance:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/portal/loyalty/balance/invalidate
 *
 * Manually invalidate cache (for testing or after points update)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const serviceSupabase = getServiceSupabase()

    const { data: customer } = await serviceSupabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const customerId = (customer as any).id
    const cacheKey = loyaltyCacheKey(customerId, 'balance')

    // Invalidate cache
    invalidateCache(cacheKey, 'loyalty')

    return NextResponse.json({
      success: true,
      message: 'Cache invalidated',
    })
  } catch (error: any) {
    console.error('Error invalidating cache:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
