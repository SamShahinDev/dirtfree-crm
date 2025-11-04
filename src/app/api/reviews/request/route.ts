import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createReviewRequest } from '@/lib/reviews/request'
import { z } from 'zod'

/**
 * Review Request API
 *
 * POST /api/reviews/request
 *
 * Create and send a review request to a customer after job completion.
 *
 * Features:
 * - Creates review request record
 * - Sends notification via email, SMS, or portal
 * - Supports both portal and Google review requests
 * - Prevents duplicate requests per job
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

const RequestSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  jobId: z.string().uuid('Invalid job ID'),
  requestMethod: z.enum(['portal', 'email', 'sms'], {
    errorMap: () => ({ message: 'Request method must be portal, email, or sms' }),
  }),
  googleReviewRequested: z.boolean().optional().default(false),
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

export async function POST(request: NextRequest) {
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
        'Only staff members can request reviews',
        403
      )
    }

    // Parse request body
    const body = await request.json()
    const validation = RequestSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { customerId, jobId, requestMethod, googleReviewRequested } = validation.data

    // Create review request
    const result = await createReviewRequest({
      customerId,
      jobId,
      requestMethod,
      googleReviewRequested,
    })

    if (!result.success) {
      return createErrorResponse(
        'request_failed',
        result.error || 'Failed to create review request',
        400
      )
    }

    return createSuccessResponse(
      {
        message: 'Review request created successfully',
        reviewRequestId: result.reviewRequestId,
        delivered: result.delivered,
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
