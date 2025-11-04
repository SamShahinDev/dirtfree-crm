import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createReviewResponse } from '@/lib/reviews/request'
import { z } from 'zod'

/**
 * Review Response API
 *
 * POST /api/reviews/[id]/respond
 *
 * Allows staff to respond to customer reviews.
 *
 * Request Body:
 * - responseType: thank_you | issue_follow_up | general
 * - responseText: Response message
 * - deliveryMethod: email | sms | phone | portal (optional)
 *
 * Features:
 * - Creates staff response record
 * - Links to review request
 * - Tracks who responded
 * - Optional delivery tracking
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

const ResponseSchema = z.object({
  responseType: z.enum(['thank_you', 'issue_follow_up', 'general'], {
    errorMap: () => ({ message: 'Response type must be thank_you, issue_follow_up, or general' }),
  }),
  responseText: z
    .string()
    .min(1, 'Response text is required')
    .max(2000, 'Response text must be 2000 characters or less'),
  deliveryMethod: z.enum(['email', 'sms', 'phone', 'portal']).optional(),
})

function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
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
        'Only staff members can respond to reviews',
        403
      )
    }

    const reviewRequestId = params.id

    // Parse request body
    const body = await request.json()
    const validation = ResponseSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { responseType, responseText, deliveryMethod } = validation.data

    // Create response
    const result = await createReviewResponse(
      reviewRequestId,
      responseType,
      responseText,
      user.id,
      deliveryMethod
    )

    if (!result.success) {
      return createErrorResponse(
        'response_failed',
        result.error || 'Failed to create review response',
        400
      )
    }

    return createSuccessResponse(
      {
        message: 'Review response created successfully',
      },
      201
    )
  } catch (error) {
    console.error('[Reviews API] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
