import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Update Opportunity Status API
 *
 * PATCH /api/opportunities/[id]/status
 *
 * Updates opportunity status and triggers relevant automations
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

const UpdateStatusSchema = z.object({
  status: z.enum([
    'pending',
    'offer_scheduled',
    'offer_sent',
    'follow_up_scheduled',
    'contacted',
    'converted',
    'declined',
    'expired',
  ]),
  notes: z.string().optional(),
  conversionJobId: z.string().uuid().optional(),
  conversionValue: z.number().min(0).optional(),
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

  return userRole && ['admin', 'manager', 'dispatcher', 'technician'].includes(userRole.role)
}

/**
 * Log status change interaction
 */
async function logStatusChange(
  supabase: any,
  opportunityId: string,
  userId: string,
  oldStatus: string,
  newStatus: string,
  notes?: string
) {
  await supabase.from('opportunity_interactions').insert({
    opportunity_id: opportunityId,
    interaction_type: newStatus === 'converted' ? 'converted' : 'manual_follow_up',
    interaction_method: 'portal',
    performed_by_user_id: userId,
    notes: notes || `Status changed from ${oldStatus} to ${newStatus}`,
    metadata: {
      old_status: oldStatus,
      new_status: newStatus,
    } as any,
  } as any)
}

/**
 * Handle conversion automation
 */
async function handleConversion(
  supabase: any,
  opportunityId: string,
  customerId: string,
  jobId?: string,
  value?: number
) {
  // Update opportunity as converted
  const updates: any = {
    converted: true,
    conversion_date: new Date().toISOString(),
    status: 'converted',
  }

  if (jobId) updates.conversion_job_id = jobId
  if (value) updates.conversion_value = value

  await supabase
    .from('missed_opportunities')
    .update(updates)
    .eq('id', opportunityId)

  // Mark any pending offers as completed
  await supabase
    .from('promotion_delivery_queue')
    .update({ status: 'completed' })
    .eq('customer_id', customerId)
    .eq('status', 'pending')
}

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

    // Verify staff permissions
    const isStaff = await verifyStaffAuth(supabase, user.id)
    if (!isStaff) {
      return createErrorResponse(
        'forbidden',
        'Only staff members can update opportunities',
        403
      )
    }

    const opportunityId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateStatusSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { status, notes, conversionJobId, conversionValue } = validation.data

    // Get current opportunity
    const { data: opportunity, error: fetchError } = await supabase
      .from('missed_opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single()

    if (fetchError || !opportunity) {
      return createErrorResponse('not_found', 'Opportunity not found', 404)
    }

    const oldStatus = (opportunity as any).status

    // Handle conversion status
    if (status === 'converted') {
      await handleConversion(
        supabase,
        opportunityId,
        (opportunity as any).customer_id,
        conversionJobId,
        conversionValue
      )
    } else {
      // Regular status update
      await (supabase as any)
        .from('missed_opportunities')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', opportunityId)
    }

    // Log the status change
    await logStatusChange(supabase, opportunityId, user.id, oldStatus, status, notes)

    // Trigger automations based on new status
    if (status === 'declined') {
      // Cancel any pending offers
      await (supabase as any)
        .from('promotion_delivery_queue')
        .update({ status: 'cancelled' })
        .eq('customer_id', (opportunity as any).customer_id)
        .eq('status', 'pending')
    }

    return createSuccessResponse({
      message: 'Opportunity status updated successfully',
      oldStatus,
      newStatus: status,
    })
  } catch (error) {
    console.error('[Opportunity Status] PATCH error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
