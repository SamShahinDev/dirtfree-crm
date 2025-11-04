import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Point Adjustment API
 *
 * POST /api/loyalty/points/adjust
 * Manually add/remove points with audit trail
 *
 * Authentication: Required (admin/manager only)
 */

const API_VERSION = 'v1'

const PointAdjustmentSchema = z.object({
  customer_id: z.string().uuid(),
  points_change: z.number().int().min(-100000).max(100000),
  adjustment_type: z.enum(['bonus', 'correction', 'promotion', 'compensation', 'other', 'tier_override', 'reset']),
  reason: z.string().min(3).max(500),
  notes: z.string().optional(),
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
 * POST - Adjust customer points
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
        'Only admin/manager can adjust points',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = PointAdjustmentSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { customer_id, points_change, adjustment_type, reason, notes } = validation.data

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer not found', 404)
    }

    // Get current loyalty info
    const { data: loyalty, error: loyaltyError } = await supabase
      .from('customer_loyalty')
      .select('total_points')
      .eq('customer_id', customer_id)
      .single()

    if (loyaltyError || !loyalty) {
      return createErrorResponse('not_found', 'Loyalty record not found', 404)
    }

    const currentPoints = (loyalty as any).total_points || 0
    const newPoints = currentPoints + points_change

    // Prevent negative point balances
    if (newPoints < 0) {
      return createErrorResponse(
        'invalid_adjustment',
        `Cannot adjust points: would result in negative balance (current: ${currentPoints}, change: ${points_change})`,
        400
      )
    }

    // Start transaction
    // 1. Update customer_loyalty points
    const { error: updateError } = await (supabase as any)
      .from('customer_loyalty')
      .update({
        total_points: newPoints,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customer_id)

    if (updateError) {
      console.error('[Point Adjustment] Update points error:', updateError)
      return createErrorResponse('update_failed', 'Failed to update points', 500)
    }

    // 2. Create adjustment record
    const { data: adjustment, error: adjustmentError } = await (supabase as any)
      .from('loyalty_point_adjustments')
      .insert({
        customer_id,
        points_change,
        adjustment_type,
        reason,
        notes: notes || null,
        adjusted_by_user_id: user.id,
      })
      .select()
      .single()

    if (adjustmentError) {
      console.error('[Point Adjustment] Create adjustment error:', adjustmentError)
      // Try to rollback points update
      await (supabase as any)
        .from('customer_loyalty')
        .update({
          total_points: currentPoints,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_id', customer_id)

      return createErrorResponse('adjustment_failed', 'Failed to create adjustment record', 500)
    }

    // 3. Add to loyalty history
    const { error: historyError } = await supabase
      .from('loyalty_history')
      .insert({
        customer_id,
        points_change,
        reason: `Manual adjustment: ${reason}`,
        transaction_type: 'manual_adjustment',
        created_at: new Date().toISOString(),
      } as any)

    if (historyError) {
      console.error('[Point Adjustment] Create history error:', historyError)
      // Non-critical error, continue
    }

    // 4. Create audit log
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: points_change > 0 ? 'loyalty_points_added' : 'loyalty_points_removed',
        entity: 'customer_loyalty',
        entity_id: customer_id,
        meta: {
          points_change,
          adjustment_type,
          reason,
          notes,
          previous_balance: currentPoints,
          new_balance: newPoints,
        },
      } as any)

    if (auditError) {
      console.error('[Point Adjustment] Create audit log error:', auditError)
      // Non-critical error, continue
    }

    // 5. Check for tier upgrades if points were added
    if (points_change > 0) {
      const { checkTierUpgrade, awardTierUpgradeBonus } = await import('@/lib/loyalty/tiers')
      const upgradeResult = await checkTierUpgrade(customer_id)

      if (upgradeResult && upgradeResult.upgraded) {
        await awardTierUpgradeBonus(customer_id, upgradeResult.new_tier)
      }
    }

    console.log(
      `[Point Adjustment] ${user.id} adjusted ${points_change} points for customer ${customer_id} (${adjustment_type}: ${reason})`
    )

    return createSuccessResponse({
      message: `Points ${points_change > 0 ? 'added' : 'removed'} successfully`,
      adjustment: adjustment as any,
      previous_balance: currentPoints,
      new_balance: newPoints,
      customer: {
        id: (customer as any).id,
        name: `${(customer as any).first_name} ${(customer as any).last_name}`,
      },
    })
  } catch (error) {
    console.error('[Point Adjustment API] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
