import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Opportunity Conversion API
 *
 * POST /api/opportunities/[id]/convert
 *
 * Marks opportunity as converted, links to job, tracks metrics
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

const ConvertOpportunitySchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
  conversionValue: z.number().min(0, 'Conversion value must be positive'),
  notes: z.string().optional(),
  successFactors: z.string().optional(),
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
 * Award gamification points to staff member
 */
async function awardConversionPoints(
  supabase: any,
  userId: string,
  conversionValue: number
): Promise<void> {
  try {
    // Base points: 100 for conversion
    let points = 100

    // Bonus points based on value (1 point per $10)
    points += Math.floor(conversionValue / 10)

    // Check if gamification table exists
    const { data: gamificationExists } = await supabase
      .from('user_gamification')
      .select('user_id')
      .limit(1)

    if (gamificationExists !== null) {
      // Award points
      await supabase.rpc('award_points', {
        p_user_id: userId,
        p_points: points,
        p_reason: 'Opportunity Conversion',
      })

      console.log(`[Opportunity Convert] Awarded ${points} points to user ${userId}`)
    }
  } catch (error) {
    console.error('[Opportunity Convert] Gamification error:', error)
    // Don't fail the conversion if gamification fails
  }
}

/**
 * Send success notification
 */
async function sendConversionNotification(
  supabase: any,
  opportunityId: string,
  customerName: string,
  conversionValue: number,
  userId: string
): Promise<void> {
  try {
    // Create notification for the staff member
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'opportunity_converted',
      title: 'Opportunity Converted!',
      message: `Great job! ${customerName} has converted with a value of $${conversionValue.toFixed(2)}`,
      link: `/dashboard/opportunities/${opportunityId}`,
      metadata: {
        opportunity_id: opportunityId,
        conversion_value: conversionValue,
      } as any,
    } as any)

    console.log(`[Opportunity Convert] Notification sent to user ${userId}`)
  } catch (error) {
    console.error('[Opportunity Convert] Notification error:', error)
    // Don't fail the conversion if notification fails
  }
}

/**
 * Update revenue metrics
 */
async function updateRevenueMetrics(
  supabase: any,
  conversionValue: number,
  opportunityType: string
): Promise<void> {
  try {
    // Check if metrics table exists
    const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM

    // Try to update or insert metrics
    await supabase.rpc('track_opportunity_revenue', {
      p_month: currentMonth,
      p_opportunity_type: opportunityType,
      p_revenue: conversionValue,
    })

    console.log(`[Opportunity Convert] Updated revenue metrics: $${conversionValue}`)
  } catch (error) {
    console.error('[Opportunity Convert] Metrics error:', error)
    // Don't fail the conversion if metrics fail
  }
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
        'Only staff members can convert opportunities',
        403
      )
    }

    const opportunityId = params.id

    // Parse and validate request body
    const body = await request.json()
    const validation = ConvertOpportunitySchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { jobId, conversionValue, notes, successFactors } = validation.data

    // Get opportunity
    const { data: opportunity, error: fetchError } = await supabase
      .from('missed_opportunities')
      .select('*, customer:customers(full_name)')
      .eq('id', opportunityId)
      .single()

    if (fetchError || !opportunity) {
      return createErrorResponse('not_found', 'Opportunity not found', 404)
    }

    // Verify job exists and belongs to the same customer
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, customer_id, total_amount')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return createErrorResponse('not_found', 'Job not found', 404)
    }

    if ((job as any).customer_id !== (opportunity as any).customer_id) {
      return createErrorResponse(
        'invalid_job',
        'Job does not belong to the same customer',
        400
      )
    }

    // Mark opportunity as converted
    const { error: updateError } = await (supabase as any)
      .from('missed_opportunities')
      .update({
        converted: true,
        conversion_date: new Date().toISOString(),
        conversion_job_id: jobId,
        conversion_value: conversionValue,
        status: 'converted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', opportunityId)

    if (updateError) {
      console.error('[Opportunity Convert] Update error:', updateError)
      return createErrorResponse('update_failed', 'Failed to convert opportunity', 500)
    }

    // Log the conversion interaction
    await supabase.from('opportunity_interactions').insert({
      opportunity_id: opportunityId,
      interaction_type: 'converted',
      interaction_method: 'portal',
      performed_by_user_id: user.id,
      notes: notes || `Converted to job ${jobId}. ${successFactors || ''}`,
      metadata: {
        job_id: jobId,
        conversion_value: conversionValue,
        success_factors: successFactors,
      } as any,
    } as any)

    // Award points to staff member
    await awardConversionPoints(supabase, user.id, conversionValue)

    // Send success notification
    await sendConversionNotification(
      supabase,
      opportunityId,
      (opportunity as any).customer?.full_name || 'Customer',
      conversionValue,
      user.id
    )

    // Update revenue metrics
    await updateRevenueMetrics(
      supabase,
      conversionValue,
      (opportunity as any).opportunity_type
    )

    // Cancel any pending offers
    await (supabase as any)
      .from('promotion_delivery_queue')
      .update({ status: 'completed' })
      .eq('customer_id', (opportunity as any).customer_id)
      .eq('status', 'pending')

    return createSuccessResponse({
      message: 'Opportunity converted successfully',
      opportunityId,
      jobId,
      conversionValue,
      pointsAwarded: 100 + Math.floor(conversionValue / 10),
    })
  } catch (error) {
    console.error('[Opportunity Convert] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
