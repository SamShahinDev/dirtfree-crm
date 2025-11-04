import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Loyalty Rewards API
 *
 * GET /api/loyalty/rewards
 * Returns all available rewards
 *
 * POST /api/loyalty/rewards
 * Creates a new reward
 *
 * Authentication: Required
 */

const API_VERSION = 'v1'

const CreateRewardSchema = z.object({
  reward_name: z.string().min(1).max(255),
  reward_description: z.string().optional(),
  reward_type: z.enum(['discount', 'free_service', 'upgrade', 'gift_card', 'merchandise', 'priority_access']),
  points_required: z.number().int().min(1),
  reward_value: z.number().optional(),
  quantity_available: z.number().int().min(0).optional().nullable(),
  terms_conditions: z.string().optional(),
  expiry_days: z.number().int().min(1).default(90),
  active: z.boolean().default(true),
})

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
 * Verify staff authentication
 */
async function verifyStaffAuth(supabase: any, userId: string): Promise<boolean> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return userRole && ['admin', 'manager', 'dispatcher'].includes((userRole as any).role)
}

/**
 * Verify admin/manager authentication
 */
async function verifyAdminAuth(supabase: any, userId: string): Promise<boolean> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return userRole && ['admin', 'manager'].includes((userRole as any).role)
}

/**
 * GET - List all rewards
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active_only') === 'true'
    const rewardType = searchParams.get('reward_type')

    let query = supabase
      .from('loyalty_rewards')
      .select('*')
      .order('points_required', { ascending: true })

    // Apply filters
    if (activeOnly) {
      query = query.eq('active', true)
    }

    if (rewardType) {
      query = query.eq('reward_type', rewardType)
    }

    const { data: rewards, error: fetchError } = await query

    if (fetchError) {
      console.error('[Rewards API] GET error:', fetchError)
      return createErrorResponse('fetch_failed', 'Failed to fetch rewards', 500)
    }

    // Get redemption statistics for each reward
    const { data: redemptionStats } = await supabase
      .from('loyalty_redemptions')
      .select('reward_id, used')

    const redemptionCounts = (redemptionStats || []).reduce((acc: any, stat: any) => {
      if (!acc[stat.reward_id]) {
        acc[stat.reward_id] = { total: 0, used: 0, pending: 0 }
      }
      acc[stat.reward_id].total++
      if (stat.used) {
        acc[stat.reward_id].used++
      } else {
        acc[stat.reward_id].pending++
      }
      return acc
    }, {})

    // Enrich rewards with stats
    const enrichedRewards = (rewards || []).map((reward: any) => ({
      ...reward,
      redemption_stats: redemptionCounts[reward.id] || { total: 0, used: 0, pending: 0 },
      available: reward.quantity_available
        ? reward.quantity_available - (reward.quantity_redeemed || 0)
        : null, // null means unlimited
    }))

    // Calculate overall statistics
    const stats = {
      total_rewards: rewards?.length || 0,
      active_rewards: rewards?.filter((r: any) => r.active).length || 0,
      inactive_rewards: rewards?.filter((r: any) => !r.active).length || 0,
      by_type: {
        discount: rewards?.filter((r: any) => r.reward_type === 'discount').length || 0,
        free_service: rewards?.filter((r: any) => r.reward_type === 'free_service').length || 0,
        upgrade: rewards?.filter((r: any) => r.reward_type === 'upgrade').length || 0,
        gift_card: rewards?.filter((r: any) => r.reward_type === 'gift_card').length || 0,
        merchandise: rewards?.filter((r: any) => r.reward_type === 'merchandise').length || 0,
        priority_access: rewards?.filter((r: any) => r.reward_type === 'priority_access').length || 0,
      },
      total_redemptions: Object.values(redemptionCounts).reduce(
        (sum: number, stat: any) => sum + stat.total,
        0
      ),
    }

    return createSuccessResponse({
      rewards: enrichedRewards,
      stats,
    })
  } catch (error) {
    console.error('[Rewards API] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Create new reward
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify admin/manager permissions
    const isAdmin = await verifyAdminAuth(supabase, user.id)
    if (!isAdmin) {
      return createErrorResponse(
        'forbidden',
        'Only admin/manager can create rewards',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateRewardSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const rewardData = validation.data

    // Create reward
    const { data: reward, error: createError } = await (supabase as any)
      .from('loyalty_rewards')
      .insert({
        ...rewardData,
        quantity_redeemed: 0,
      })
      .select()
      .single()

    if (createError) {
      console.error('[Rewards API] Create error:', createError)
      return createErrorResponse('create_failed', 'Failed to create reward', 500)
    }

    // Create audit log
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'loyalty_reward_created',
        entity: 'loyalty_rewards',
        entity_id: (reward as any).id,
        meta: rewardData,
      } as any)

    console.log(`[Rewards API] Created reward: ${(reward as any).reward_name} (${(reward as any).id})`)

    return createSuccessResponse({
      message: 'Reward created successfully',
      reward,
    })
  } catch (error) {
    console.error('[Rewards API] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
