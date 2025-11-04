import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Loyalty Reward Management API
 *
 * PATCH /api/loyalty/rewards/[id]
 * Updates a reward
 *
 * DELETE /api/loyalty/rewards/[id]
 * Deletes a reward
 *
 * Authentication: Required (admin/manager only)
 */

const API_VERSION = 'v1'

const UpdateRewardSchema = z.object({
  reward_name: z.string().min(1).max(255).optional(),
  reward_description: z.string().optional(),
  reward_type: z.enum(['discount', 'free_service', 'upgrade', 'gift_card', 'merchandise', 'priority_access']).optional(),
  points_required: z.number().int().min(1).optional(),
  reward_value: z.number().optional(),
  quantity_available: z.number().int().min(0).optional().nullable(),
  terms_conditions: z.string().optional(),
  expiry_days: z.number().int().min(1).optional(),
  active: z.boolean().optional(),
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
 * Verify admin authentication (delete requires admin)
 */
async function verifyAdminOnly(supabase: any, userId: string): Promise<boolean> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return userRole && (userRole as any).role === 'admin'
}

/**
 * PATCH - Update reward
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        'Only admin/manager can update rewards',
        403
      )
    }

    const rewardId = params.id

    if (!rewardId) {
      return createErrorResponse('invalid_request', 'Reward ID is required', 400)
    }

    // Verify reward exists
    const { data: existingReward, error: fetchError } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('id', rewardId)
      .single()

    if (fetchError || !existingReward) {
      return createErrorResponse('not_found', 'Reward not found', 404)
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateRewardSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const updateData = validation.data

    // Update reward
    const { data: reward, error: updateError } = await (supabase as any)
      .from('loyalty_rewards')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rewardId)
      .select()
      .single()

    if (updateError) {
      console.error('[Rewards API] Update error:', updateError)
      return createErrorResponse('update_failed', 'Failed to update reward', 500)
    }

    // Create audit log
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'loyalty_reward_updated',
        entity: 'loyalty_rewards',
        entity_id: rewardId,
        meta: {
          previous: existingReward,
          updated: updateData,
        },
      } as any)

    console.log(`[Rewards API] Updated reward: ${(reward as any).reward_name} (${rewardId})`)

    return createSuccessResponse({
      message: 'Reward updated successfully',
      reward,
    })
  } catch (error) {
    console.error('[Rewards API] PATCH error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * DELETE - Delete reward
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify admin permissions (only admins can delete)
    const isAdmin = await verifyAdminOnly(supabase, user.id)
    if (!isAdmin) {
      return createErrorResponse(
        'forbidden',
        'Only admins can delete rewards',
        403
      )
    }

    const rewardId = params.id

    if (!rewardId) {
      return createErrorResponse('invalid_request', 'Reward ID is required', 400)
    }

    // Verify reward exists
    const { data: existingReward, error: fetchError } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('id', rewardId)
      .single()

    if (fetchError || !existingReward) {
      return createErrorResponse('not_found', 'Reward not found', 404)
    }

    // Check if reward has been redeemed
    const { count: redemptionCount } = await supabase
      .from('loyalty_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('reward_id', rewardId)

    if (redemptionCount && redemptionCount > 0) {
      return createErrorResponse(
        'has_redemptions',
        `Cannot delete reward with ${redemptionCount} redemption(s). Deactivate instead.`,
        400
      )
    }

    // Delete reward
    const { error: deleteError } = await supabase
      .from('loyalty_rewards')
      .delete()
      .eq('id', rewardId)

    if (deleteError) {
      console.error('[Rewards API] Delete error:', deleteError)
      return createErrorResponse('delete_failed', 'Failed to delete reward', 500)
    }

    // Create audit log
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'loyalty_reward_deleted',
        entity: 'loyalty_rewards',
        entity_id: rewardId,
        meta: {
          deleted_reward: existingReward,
        },
      } as any)

    console.log(`[Rewards API] Deleted reward: ${(existingReward as any).reward_name} (${rewardId})`)

    return createSuccessResponse({
      message: 'Reward deleted successfully',
      deleted_reward_id: rewardId,
    })
  } catch (error) {
    console.error('[Rewards API] DELETE error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
