import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllTiers, getTierBenefits, checkTierUpgrade, awardTierUpgradeBonus } from '@/lib/loyalty/tiers'

/**
 * Loyalty Tiers API
 *
 * GET /api/loyalty/tiers
 * Returns all active loyalty tiers and their benefits
 *
 * POST /api/loyalty/tiers/check-upgrades
 * Checks all customers for tier upgrades and awards bonuses
 *
 * Authentication: Required
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

/**
 * GET - List all tiers and benefits
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Get all active tiers
    const tiers = await getAllTiers()

    // Format tiers with benefits
    const formattedTiers = tiers.map((tier) => ({
      ...tier,
      formatted_benefits: getTierBenefits(tier),
    }))

    return createSuccessResponse({
      tiers: formattedTiers,
      total: tiers.length,
    })
  } catch (error) {
    console.error('[Tiers API] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Check all customers for tier upgrades
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify staff permissions (only staff can trigger bulk tier checks)
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const isStaff = userRole && ['admin', 'manager'].includes((userRole as any).role)
    if (!isStaff) {
      return createErrorResponse(
        'forbidden',
        'Only admin/manager can check tier upgrades',
        403
      )
    }

    // Get all customers with loyalty records
    const { data: customers, error: customersError } = await supabase
      .from('customer_loyalty')
      .select('customer_id, total_points, current_tier_level')

    if (customersError) {
      console.error('[Tiers API] Get customers error:', customersError)
      return createErrorResponse('fetch_failed', 'Failed to fetch customers', 500)
    }

    const results = {
      total_checked: customers?.length || 0,
      upgrades_found: 0,
      upgrades_processed: 0,
      errors: 0,
      upgraded_customers: [] as any[],
    }

    if (!customers || customers.length === 0) {
      return createSuccessResponse(results)
    }

    // Check each customer for upgrades
    for (const customer of customers) {
      try {
        const customerId = (customer as any).customer_id
        const upgradeResult = await checkTierUpgrade(customerId)

        if (upgradeResult && upgradeResult.upgraded) {
          results.upgrades_found++

          // Award upgrade bonus
          const bonusResult = await awardTierUpgradeBonus(
            customerId,
            upgradeResult.new_tier
          )

          if (bonusResult.success) {
            results.upgrades_processed++
            results.upgraded_customers.push({
              customer_id: customerId,
              previous_tier: upgradeResult.previous_tier?.tier_name,
              new_tier: upgradeResult.new_tier.tier_name,
              bonus_points: bonusResult.bonus_points,
            })
          } else {
            results.errors++
          }
        }
      } catch (error) {
        console.error(`[Tiers API] Error processing customer ${(customer as any).customer_id}:`, error)
        results.errors++
      }
    }

    return createSuccessResponse({
      message: `Processed ${results.total_checked} customers, found ${results.upgrades_found} upgrades`,
      results,
    })
  } catch (error) {
    console.error('[Tiers API] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
