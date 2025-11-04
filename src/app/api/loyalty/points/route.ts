import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Loyalty Points API
 *
 * GET /api/loyalty/points?customer_id=[id]
 * Returns customer's point balance and history
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
 * GET - Get customer point balance and history
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify staff permissions
    const isStaff = await verifyStaffAuth(supabase, user.id)
    if (!isStaff) {
      return createErrorResponse(
        'forbidden',
        'Only staff members can view loyalty points',
        403
      )
    }

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customer_id')

    if (!customerId) {
      return createErrorResponse('invalid_request', 'customer_id is required', 400)
    }

    // Get customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer not found', 404)
    }

    // Get loyalty info
    const { data: loyalty, error: loyaltyError } = await supabase
      .from('customer_loyalty')
      .select('*')
      .eq('customer_id', customerId)
      .single()

    if (loyaltyError || !loyalty) {
      return createErrorResponse('not_found', 'Loyalty record not found', 404)
    }

    // Get points history (from loyalty_history)
    const { data: history, error: historyError } = await supabase
      .from('loyalty_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50)

    // Get manual adjustments
    const { data: adjustments, error: adjustmentsError } = await supabase
      .from('loyalty_point_adjustments')
      .select(`
        *,
        adjusted_by:users!loyalty_point_adjustments_adjusted_by_user_id_fkey (
          first_name,
          last_name,
          email
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)

    // Calculate statistics
    const pointsEarned = (history || [])
      .filter((h: any) => h.points_change > 0)
      .reduce((sum: number, h: any) => sum + h.points_change, 0)

    const pointsSpent = (history || [])
      .filter((h: any) => h.points_change < 0)
      .reduce((sum: number, h: any) => sum + Math.abs(h.points_change), 0)

    const manualAdjustments = (adjustments || []).reduce(
      (sum: number, a: any) => sum + a.points_change,
      0
    )

    return createSuccessResponse({
      customer: {
        id: (customer as any).id,
        name: `${(customer as any).first_name} ${(customer as any).last_name}`,
        email: (customer as any).email,
      },
      points: {
        current_balance: (loyalty as any).total_points || 0,
        lifetime_earned: pointsEarned,
        lifetime_spent: pointsSpent,
        manual_adjustments: manualAdjustments,
      },
      tier: {
        current_tier_level: (loyalty as any).current_tier_level || 1,
        current_tier_id: (loyalty as any).current_tier_id,
      },
      history: history || [],
      adjustments: (adjustments || []).map((a: any) => ({
        ...a,
        adjusted_by_name: a.adjusted_by
          ? `${a.adjusted_by.first_name} ${a.adjusted_by.last_name}`
          : 'Unknown',
      })),
    })
  } catch (error) {
    console.error('[Loyalty Points API] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
