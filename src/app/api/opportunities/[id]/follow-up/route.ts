import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Opportunity Follow-up API
 *
 * POST /api/opportunities/[id]/follow-up
 *
 * Log follow-up interactions, update status, and schedule next actions
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

const FollowUpSchema = z.object({
  interactionType: z.enum(['call', 'email', 'sms', 'meeting', 'note']),
  notes: z.string().min(1, 'Notes are required'),
  outcome: z.enum(['interested', 'not_interested', 'callback_requested', 'no_answer', 'converted', 'declined']),
  nextFollowUpDate: z.string().optional().nullable(),
  nextFollowUpMethod: z.enum(['call', 'email', 'sms', 'portal_offer']).optional().nullable(),
  updateStatus: z.boolean().default(false),
  newStatus: z.enum([
    'pending',
    'offer_scheduled',
    'offer_sent',
    'follow_up_scheduled',
    'contacted',
    'converted',
    'declined',
    'expired',
  ]).optional(),
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
        'Only staff members can log follow-ups',
        403
      )
    }

    const opportunityId = params.id

    // Get opportunity
    const { data: opportunity, error: fetchError } = await supabase
      .from('missed_opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single()

    if (fetchError || !opportunity) {
      return createErrorResponse('not_found', 'Opportunity not found', 404)
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = FollowUpSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const {
      interactionType,
      notes,
      outcome,
      nextFollowUpDate,
      nextFollowUpMethod,
      updateStatus,
      newStatus,
    } = validation.data

    // Log the interaction
    await supabase.from('opportunity_interactions').insert({
      opportunity_id: opportunityId,
      interaction_type: 'manual_follow_up',
      interaction_method: interactionType,
      performed_by_user_id: user.id,
      notes,
      metadata: {
        outcome,
        next_follow_up_date: nextFollowUpDate,
        next_follow_up_method: nextFollowUpMethod,
      } as any,
    } as any)

    // Update opportunity
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    // Update follow-up schedule if provided
    if (nextFollowUpDate) {
      updates.follow_up_scheduled_date = nextFollowUpDate
      updates.follow_up_method = nextFollowUpMethod
      updates.status = 'follow_up_scheduled'
    }

    // Update status if requested
    if (updateStatus && newStatus) {
      updates.status = newStatus

      // If converting, mark as converted
      if (newStatus === 'converted') {
        updates.converted = true
        updates.conversion_date = new Date().toISOString()
      }
    }

    // Handle outcome-based status updates
    if (outcome === 'converted' && !updateStatus) {
      updates.status = 'converted'
      updates.converted = true
      updates.conversion_date = new Date().toISOString()
    } else if (outcome === 'declined' && !updateStatus) {
      updates.status = 'declined'
    } else if (outcome === 'interested' && !updateStatus) {
      updates.status = 'contacted'
    }

    await (supabase as any)
      .from('missed_opportunities')
      .update(updates)
      .eq('id', opportunityId)

    // Get user details for response
    const { data: userData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single()

    return createSuccessResponse({
      message: 'Follow-up logged successfully',
      interaction: {
        type: interactionType,
        outcome,
        performedBy: (userData as any)?.full_name || 'Unknown',
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[Opportunity Follow-up] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
