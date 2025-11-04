import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAchievements, AchievementEventType } from '@/lib/loyalty/achievements'
import { z } from 'zod'

/**
 * Achievement Check API
 *
 * POST /api/loyalty/achievements/check
 * Triggers achievement check for a specific event and awards if qualified
 *
 * Authentication: Required
 */

const API_VERSION = 'v1'

const CheckAchievementsSchema = z.object({
  customer_id: z.string().uuid(),
  event_type: z.enum([
    'service_completed',
    'booking_created',
    'referral_completed',
    'review_submitted',
    'social_share',
    'social_tag',
  ]),
  event_data: z.record(z.string(), z.any()).optional(),
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

  return userRole && ['admin', 'manager', 'dispatcher', 'technician'].includes((userRole as any).role)
}

/**
 * POST - Check and award achievements
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CheckAchievementsSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { customer_id, event_type, event_data } = validation.data

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, email')
      .eq('id', customer_id)
      .single()

    if (customerError || !customer) {
      return createErrorResponse('not_found', 'Customer not found', 404)
    }

    // Check for achievements
    console.log(
      `[Achievement Check] Checking achievements for customer ${customer_id}, event: ${event_type}`
    )

    const results = await checkAchievements(customer_id, event_type as AchievementEventType, event_data)

    if (results.length === 0) {
      return createSuccessResponse({
        message: 'No new achievements earned',
        customer_id,
        event_type,
        achievements_earned: [],
      })
    }

    // Log successful achievements
    console.log(
      `[Achievement Check] Awarded ${results.length} achievement(s) to customer ${customer_id}`
    )

    // TODO: Send achievement unlocked emails
    // For each result, we could send an email notification
    // This will be implemented when the email template is created

    return createSuccessResponse({
      message: `${results.length} achievement(s) unlocked!`,
      customer_id,
      event_type,
      achievements_earned: results.map((r) => ({
        achievement: r.achievement,
        points_awarded: r.points_awarded,
        message: r.message,
      })),
      total_points_awarded: results.reduce((sum, r) => sum + r.points_awarded, 0),
    })
  } catch (error) {
    console.error('[Achievement Check API] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
