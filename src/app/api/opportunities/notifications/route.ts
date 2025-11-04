import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Opportunity Notification Preferences API
 *
 * GET /api/opportunities/notifications
 * Returns the user's current notification preferences
 *
 * POST /api/opportunities/notifications
 * Updates the user's notification preferences
 *
 * Authentication: Required
 */

const API_VERSION = 'v1'

const UpdatePreferencesSchema = z.object({
  notify_new_opportunity_assigned: z.boolean().optional(),
  notify_follow_up_due_today: z.boolean().optional(),
  notify_follow_up_overdue: z.boolean().optional(),
  notify_offer_claimed: z.boolean().optional(),
  notify_opportunity_expiring: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  sms_notifications: z.boolean().optional(),
  portal_notifications: z.boolean().optional(),
  reminder_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(), // HH:MM:SS format
  overdue_escalation_days: z.number().int().min(1).max(30).optional(),
  expiring_warning_days: z.number().int().min(1).max(30).optional(),
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
 * GET - Retrieve user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Get or create user preferences using the database function
    const { data: preferences, error: prefsError } = await (supabase as any)
      .rpc('get_user_notification_preferences', { p_user_id: user.id })
      .single()

    if (prefsError) {
      console.error('[Notification Preferences] GET error:', prefsError)
      return createErrorResponse(
        'fetch_failed',
        'Failed to retrieve notification preferences',
        500
      )
    }

    return createSuccessResponse({
      preferences: preferences || null,
    })
  } catch (error) {
    console.error('[Notification Preferences] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Update user's notification preferences
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
    const validation = UpdatePreferencesSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const updates = validation.data

    // Check if preferences exist
    const { data: existingPrefs } = await supabase
      .from('user_notification_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let result

    if (existingPrefs) {
      // Update existing preferences
      const { data, error } = await (supabase as any)
        .from('user_notification_preferences')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('[Notification Preferences] Update error:', error)
        return createErrorResponse('update_failed', 'Failed to update preferences', 500)
      }

      result = data
    } else {
      // Create new preferences
      const { data, error } = await (supabase as any)
        .from('user_notification_preferences')
        .insert({
          user_id: user.id,
          ...updates,
        })
        .select()
        .single()

      if (error) {
        console.error('[Notification Preferences] Create error:', error)
        return createErrorResponse('create_failed', 'Failed to create preferences', 500)
      }

      result = data
    }

    return createSuccessResponse({
      message: 'Notification preferences updated successfully',
      preferences: result,
    })
  } catch (error) {
    console.error('[Notification Preferences] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * PUT - Alias for POST (same functionality)
 */
export async function PUT(request: NextRequest) {
  return POST(request)
}
