import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Opportunities API
 *
 * POST /api/opportunities - Create new opportunity
 * GET /api/opportunities - List opportunities with filters
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

// Validation schema for creating opportunities
const CreateOpportunitySchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  opportunityType: z.enum([
    'declined_service',
    'partial_booking',
    'price_objection',
    'postponed_booking',
    'competitor_mention',
    'service_upsell',
  ]),
  originalJobId: z.string().uuid().optional().nullable(),
  declinedServices: z.array(z.string()).optional().default([]),
  estimatedValue: z.number().min(0).optional().nullable(),
  reason: z.string().optional().nullable(),
  followUpScheduledDate: z.string().optional().nullable(), // ISO date string
  followUpMethod: z.enum(['call', 'email', 'sms', 'portal_offer']).optional().nullable(),
  followUpAssignedTo: z.string().uuid().optional().nullable(),
  autoOfferEnabled: z.boolean().optional().default(false),
  offerDiscountPercentage: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
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
 * Send notification to assigned user
 */
async function sendFollowUpNotification(
  supabase: any,
  assignedToUserId: string,
  opportunityId: string,
  customerName: string,
  followUpDate: string
) {
  try {
    // Get assigned user details
    const { data: assignedUser } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', assignedToUserId)
      .single()

    if (!assignedUser) return

    // Create in-app notification
    await supabase.from('notifications').insert({
      user_id: assignedToUserId,
      type: 'opportunity_assigned',
      title: 'New Opportunity Assigned',
      message: `You have been assigned to follow up with ${customerName} on ${new Date(followUpDate).toLocaleDateString()}`,
      link: `/dashboard/opportunities/${opportunityId}`,
      metadata: {
        opportunity_id: opportunityId,
        follow_up_date: followUpDate,
      },
    })

    console.log(`[Opportunities] Notification sent to ${assignedUser.full_name}`)
  } catch (error) {
    console.error('[Opportunities] Failed to send notification:', error)
    // Don't fail the whole request if notification fails
  }
}

/**
 * Queue auto-offer for delivery
 */
async function queueAutoOffer(
  supabase: any,
  opportunityId: string,
  customerId: string,
  discountPercentage: number
) {
  try {
    // Create a promotion for this opportunity
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 14) // 14 day offer

    const { data: promotion, error: promoError } = await supabase
      .from('promotions')
      .insert({
        code: `OPP${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        name: 'Opportunity Recovery Offer',
        description: `Special ${discountPercentage}% discount offer`,
        type: 'percentage',
        value: discountPercentage,
        start_date: new Date().toISOString(),
        end_date: expiryDate.toISOString(),
        max_uses: 1,
        customer_id: customerId,
        active: true,
        metadata: {
          opportunity_id: opportunityId,
          auto_generated: true,
        },
      })
      .select()
      .single()

    if (promoError) {
      console.error('[Opportunities] Failed to create promotion:', promoError)
      return
    }

    // Queue for delivery via portal notification
    await supabase.from('promotion_delivery_queue').insert({
      promotion_id: promotion.id,
      customer_id: customerId,
      delivery_method: 'portal',
      scheduled_for: new Date().toISOString(),
      status: 'pending',
    })

    // Update opportunity with offer sent timestamp
    await supabase
      .from('missed_opportunities')
      .update({
        offer_sent_at: new Date().toISOString(),
        status: 'offer_sent',
      })
      .eq('id', opportunityId)

    console.log(`[Opportunities] Auto-offer queued for opportunity ${opportunityId}`)
  } catch (error) {
    console.error('[Opportunities] Failed to queue auto-offer:', error)
    // Don't fail the whole request if offer queueing fails
  }
}

/**
 * POST /api/opportunities
 * Create new opportunity
 */
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
        'Only staff members can create opportunities',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateOpportunitySchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const data = validation.data

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, full_name')
      .eq('id', data.customerId)
      .single()

    if (customerError || !customer) {
      return createErrorResponse(
        'not_found',
        'Customer not found',
        404
      )
    }

    // Create opportunity record
    const { data: opportunity, error: createError } = await supabase
      .from('missed_opportunities')
      .insert({
        customer_id: data.customerId,
        opportunity_type: data.opportunityType,
        original_job_id: data.originalJobId,
        declined_services: data.declinedServices,
        estimated_value: data.estimatedValue,
        reason: data.reason,
        follow_up_scheduled_date: data.followUpScheduledDate,
        follow_up_method: data.followUpMethod,
        follow_up_assigned_to: data.followUpAssignedTo,
        auto_offer_enabled: data.autoOfferEnabled,
        offer_discount_percentage: data.offerDiscountPercentage,
        notes: data.notes,
        created_by_user_id: user.id,
        status: data.followUpScheduledDate ? 'follow_up_scheduled' : 'pending',
      } as any)
      .select()
      .single()

    if (createError) {
      console.error('[Opportunities] Create error:', createError)
      return createErrorResponse(
        'create_failed',
        'Failed to create opportunity',
        500
      )
    }

    // Log interaction
    await supabase.from('opportunity_interactions').insert({
      opportunity_id: (opportunity as any).id,
      interaction_type: 'manual_follow_up',
      interaction_method: 'portal',
      performed_by_user_id: user.id,
      notes: 'Opportunity created',
      metadata: {
        opportunity_type: data.opportunityType,
      } as any,
    } as any)

    // Send notification to assigned user
    if (data.followUpAssignedTo && data.followUpScheduledDate) {
      await sendFollowUpNotification(
        supabase,
        data.followUpAssignedTo,
        (opportunity as any).id,
        (customer as any).full_name,
        data.followUpScheduledDate
      )
    }

    // Queue auto-offer if enabled
    if (data.autoOfferEnabled && data.offerDiscountPercentage) {
      await queueAutoOffer(
        supabase,
        (opportunity as any).id,
        data.customerId,
        data.offerDiscountPercentage
      )
    }

    return createSuccessResponse({
      opportunity,
      message: 'Opportunity created successfully',
    })
  } catch (error) {
    console.error('[Opportunities] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * GET /api/opportunities
 * List opportunities with filters
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
        'Only staff members can view opportunities',
        403
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse filters
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const opportunityType = searchParams.get('opportunityType')
    const assignedTo = searchParams.get('assignedTo')
    const converted = searchParams.get('converted')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('missed_opportunities')
      .select(`
        *,
        customer:customers(id, full_name, email, phone),
        assigned_user:users!follow_up_assigned_to(id, full_name, email),
        created_by:users!created_by_user_id(id, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (customerId) {
      query = query.eq('customer_id', customerId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (opportunityType) {
      query = query.eq('opportunity_type', opportunityType)
    }
    if (assignedTo) {
      query = query.eq('follow_up_assigned_to', assignedTo)
    }
    if (converted !== null && converted !== undefined) {
      query = query.eq('converted', converted === 'true')
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: opportunities, error: queryError, count } = await query

    if (queryError) {
      console.error('[Opportunities] Query error:', queryError)
      return createErrorResponse(
        'query_failed',
        'Failed to fetch opportunities',
        500
      )
    }

    return createSuccessResponse({
      opportunities: opportunities || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('[Opportunities] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
