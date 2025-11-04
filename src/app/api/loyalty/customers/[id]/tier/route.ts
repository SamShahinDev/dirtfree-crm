import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCustomerTierProgress, getTierBenefits, formatTierBenefitsForDisplay } from '@/lib/loyalty/tiers'

/**
 * Customer Tier API
 *
 * GET /api/loyalty/customers/[id]/tier
 * Returns customer's current tier, progress to next tier, and unlocked benefits
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
 * GET - Get customer's tier information and progress
 */
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

    const customerId = params.id

    if (!customerId) {
      return createErrorResponse('invalid_request', 'Customer ID is required', 400)
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer not found', 404)
    }

    // Get tier progress
    const tierProgress = await getCustomerTierProgress(customerId)

    if (!tierProgress) {
      return createErrorResponse(
        'fetch_failed',
        'Failed to fetch tier information',
        500
      )
    }

    // Format current tier benefits
    const currentTierBenefits = getTierBenefits(tierProgress.current_tier)
    const currentTierBenefitsList = formatTierBenefitsForDisplay(tierProgress.current_tier)

    // Format next tier benefits if available
    let nextTierBenefits = null
    let nextTierBenefitsList: string[] = []

    if (tierProgress.next_tier) {
      nextTierBenefits = getTierBenefits(tierProgress.next_tier)
      nextTierBenefitsList = formatTierBenefitsForDisplay(tierProgress.next_tier)
    }

    // Get recent tier history
    const { data: recentHistory } = await supabase
      .from('loyalty_history')
      .select('*')
      .eq('customer_id', customerId)
      .eq('transaction_type', 'tier_upgrade_bonus')
      .order('created_at', { ascending: false })
      .limit(5)

    return createSuccessResponse({
      customer: {
        id: (customer as any).id,
        name: `${(customer as any).first_name} ${(customer as any).last_name}`,
      },
      current_tier: {
        ...tierProgress.current_tier,
        benefits: currentTierBenefits,
        benefits_list: currentTierBenefitsList,
      },
      next_tier: tierProgress.next_tier
        ? {
            ...tierProgress.next_tier,
            benefits: nextTierBenefits,
            benefits_list: nextTierBenefitsList,
          }
        : null,
      progress: {
        current_points: tierProgress.current_points,
        points_to_next_tier: tierProgress.points_to_next_tier,
        progress_percentage: tierProgress.progress_percentage,
        is_max_tier: tierProgress.next_tier === null,
      },
      recent_upgrades: recentHistory || [],
    })
  } catch (error) {
    console.error('[Customer Tier API] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
