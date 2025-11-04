import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendReviewReminder } from '@/lib/reviews/request'

/**
 * Send Review Reminder API
 *
 * POST /api/reviews/[id]/reminder
 *
 * Sends a reminder to a customer to complete their pending review.
 *
 * Features:
 * - Sends notification via original request method (email/SMS/portal)
 * - Updates reminder_sent flag
 * - Records reminder timestamp
 * - Staff only
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

  return userRole && ['admin', 'manager', 'dispatcher'].includes(userRole.role)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        'Only staff members can send review reminders',
        403
      )
    }

    const reviewRequestId = params.id

    console.log(`[Review Reminder] Sending reminder for review ${reviewRequestId}`)

    // Send reminder using existing function
    const sent = await sendReviewReminder(reviewRequestId)

    if (!sent) {
      return createErrorResponse(
        'send_failed',
        'Failed to send review reminder',
        500
      )
    }

    console.log(`[Review Reminder] Successfully sent reminder for review ${reviewRequestId}`)

    return createSuccessResponse({
      message: 'Review reminder sent successfully',
    })
  } catch (error) {
    console.error('[Review Reminder] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
