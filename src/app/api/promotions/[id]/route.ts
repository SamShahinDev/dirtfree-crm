import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Promotion Detail API
 *
 * GET /api/promotions/[id] - Get promotion details with statistics
 * PATCH /api/promotions/[id] - Update promotion
 * DELETE /api/promotions/[id] - Delete promotion (soft delete via status)
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for promotion updates
 */
const UpdatePromotionSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  discountValue: z.number().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  targetZones: z.array(z.string().uuid()).optional(),
  minJobValue: z.number().optional(),
  maxJobValue: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  redemptionsPerCustomer: z.number().int().min(1).optional(),
  deliveryChannels: z.array(z.enum(['portal', 'email', 'sms'])).optional(),
  autoDeliver: z.boolean().optional(),
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'cancelled']).optional(),
  termsAndConditions: z.string().optional(),
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

async function checkUserRole(userId: string, requiredRoles: string[]): Promise<boolean> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', requiredRoles)
    .single()
  return !error && !!data
}

/**
 * GET - Get promotion details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const hasAccess = await checkUserRole(user.id, ['admin', 'manager', 'dispatcher'])
    if (!hasAccess) {
      return createErrorResponse('forbidden', 'Insufficient permissions', 403)
    }

    const promotionId = params.id
    const serviceSupabase = getServiceSupabase()

    // Get promotion details
    const { data: promotion, error: promoError } = await serviceSupabase
      .from('promotions')
      .select('*')
      .eq('id', promotionId)
      .single()

    if (promoError || !promotion) {
      return createErrorResponse('not_found', 'Promotion not found', 404)
    }

    // Get statistics
    const { data: stats } = await (serviceSupabase as any).rpc('get_promotion_statistics', {
      p_promotion_id: promotionId,
    })

    const statsData: any = Array.isArray(stats) && stats.length > 0 ? stats[0] : {
      total_delivered: 0,
      total_viewed: 0,
      total_claimed: 0,
      total_redeemed: 0,
      total_discount_amount: 0,
      view_rate: 0,
      claim_rate: 0,
      redemption_rate: 0,
      avg_discount: 0,
    }

    // Get recent deliveries
    const { data: deliveries } = await serviceSupabase
      .from('promotion_deliveries')
      .select(`
        id,
        customer_id,
        delivered_at,
        viewed_at,
        claimed_at,
        redeemed_at,
        discount_amount,
        customers (full_name, email)
      `)
      .eq('promotion_id', promotionId)
      .order('delivered_at', { ascending: false })
      .limit(50)

    return createSuccessResponse({
      promotion: {
        id: (promotion as any).id,
        title: (promotion as any).title,
        description: (promotion as any).description,
        promotionType: (promotion as any).promotion_type,
        discountValue: (promotion as any).discount_value,
        discountPercentage: (promotion as any).discount_percentage,
        freeAddonService: (promotion as any).free_addon_service,
        targetAudience: (promotion as any).target_audience,
        targetZones: (promotion as any).target_zones,
        targetServiceTypes: (promotion as any).target_service_types,
        minJobValue: (promotion as any).min_job_value,
        maxJobValue: (promotion as any).max_job_value,
        startDate: (promotion as any).start_date,
        endDate: (promotion as any).end_date,
        maxRedemptions: (promotion as any).max_redemptions,
        redemptionsPerCustomer: (promotion as any).redemptions_per_customer,
        currentRedemptions: (promotion as any).current_redemptions,
        deliveryChannels: (promotion as any).delivery_channels,
        autoDeliver: (promotion as any).auto_deliver,
        promoCode: (promotion as any).promo_code,
        status: (promotion as any).status,
        termsAndConditions: (promotion as any).terms_and_conditions,
        createdAt: (promotion as any).created_at,
        updatedAt: (promotion as any).updated_at,
      },
      statistics: {
        totalDelivered: parseInt(statsData.total_delivered || '0'),
        totalViewed: parseInt(statsData.total_viewed || '0'),
        totalClaimed: parseInt(statsData.total_claimed || '0'),
        totalRedeemed: parseInt(statsData.total_redeemed || '0'),
        totalDiscountAmount: parseFloat(statsData.total_discount_amount || '0'),
        viewRate: parseFloat(statsData.view_rate || '0'),
        claimRate: parseFloat(statsData.claim_rate || '0'),
        redemptionRate: parseFloat(statsData.redemption_rate || '0'),
        avgDiscount: parseFloat(statsData.avg_discount || '0'),
      },
      deliveries: (deliveries || []).map((d: any) => ({
        id: d.id,
        customerId: d.customer_id,
        customerName: d.customers?.full_name,
        customerEmail: d.customers?.email,
        deliveredAt: d.delivered_at,
        viewedAt: d.viewed_at,
        claimedAt: d.claimed_at,
        redeemedAt: d.redeemed_at,
        discountAmount: d.discount_amount,
      })),
    })
  } catch (error) {
    console.error('[Promotions] GET /api/promotions/[id] error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500)
  }
}

/**
 * PATCH - Update promotion
 */
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

    const hasAccess = await checkUserRole(user.id, ['admin', 'manager'])
    if (!hasAccess) {
      return createErrorResponse('forbidden', 'Insufficient permissions', 403)
    }

    const body = await request.json()
    const validation = UpdatePromotionSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid update data: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const updates = validation.data
    const promotionId = params.id

    // Build update object
    const updateData: any = {}
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.discountValue !== undefined) updateData.discount_value = updates.discountValue
    if (updates.discountPercentage !== undefined) updateData.discount_percentage = updates.discountPercentage
    if (updates.targetZones !== undefined) updateData.target_zones = updates.targetZones
    if (updates.minJobValue !== undefined) updateData.min_job_value = updates.minJobValue
    if (updates.maxJobValue !== undefined) updateData.max_job_value = updates.maxJobValue
    if (updates.startDate !== undefined) updateData.start_date = updates.startDate
    if (updates.endDate !== undefined) updateData.end_date = updates.endDate
    if (updates.maxRedemptions !== undefined) updateData.max_redemptions = updates.maxRedemptions
    if (updates.redemptionsPerCustomer !== undefined) updateData.redemptions_per_customer = updates.redemptionsPerCustomer
    if (updates.deliveryChannels !== undefined) updateData.delivery_channels = JSON.stringify(updates.deliveryChannels)
    if (updates.autoDeliver !== undefined) updateData.auto_deliver = updates.autoDeliver
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.termsAndConditions !== undefined) updateData.terms_and_conditions = updates.termsAndConditions

    const serviceSupabase = getServiceSupabase()

    const { data: updated, error: updateError } = await (serviceSupabase as any)
      .from('promotions')
      .update(updateData)
      .eq('id', promotionId)
      .select()
      .single()

    if (updateError) {
      console.error('[Promotions] Error updating promotion:', updateError)
      return createErrorResponse('update_failed', 'Failed to update promotion', 500)
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'promotion_updated',
      resource_type: 'promotion',
      resource_id: promotionId,
      metadata: { updates },
    } as any)

    return createSuccessResponse({
      message: 'Promotion updated successfully',
      promotion: {
        id: (updated as any).id,
        status: (updated as any).status,
        updatedAt: (updated as any).updated_at,
      },
    })
  } catch (error) {
    console.error('[Promotions] PATCH /api/promotions/[id] error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500)
  }
}

/**
 * DELETE - Delete promotion (set status to cancelled)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const hasAccess = await checkUserRole(user.id, ['admin'])
    if (!hasAccess) {
      return createErrorResponse('forbidden', 'Only admins can delete promotions', 403)
    }

    const promotionId = params.id
    const serviceSupabase = getServiceSupabase()

    // Soft delete by setting status to cancelled
    const { error: updateError } = await (serviceSupabase as any)
      .from('promotions')
      .update({ status: 'cancelled' })
      .eq('id', promotionId)

    if (updateError) {
      console.error('[Promotions] Error deleting promotion:', updateError)
      return createErrorResponse('deletion_failed', 'Failed to delete promotion', 500)
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'promotion_deleted',
      resource_type: 'promotion',
      resource_id: promotionId,
    } as any)

    return createSuccessResponse({ message: 'Promotion deleted successfully' })
  } catch (error) {
    console.error('[Promotions] DELETE /api/promotions/[id] error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500)
  }
}
