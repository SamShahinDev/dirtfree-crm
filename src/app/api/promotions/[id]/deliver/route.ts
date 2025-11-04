import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { queuePromotionDeliveries } from '@/lib/promotions/delivery'
import { getTargetedCustomers, calculateEstimatedReach } from '@/lib/promotions/targeting'

/**
 * Promotion Delivery API
 *
 * POST /api/promotions/[id]/deliver - Trigger promotion delivery
 *
 * Features:
 * - Filters recipients based on targeting criteria
 * - Queues deliveries for batch processing
 * - Returns delivery job statistics
 * - Validates promotion is ready for delivery
 *
 * Authentication: Required (staff only - admin, manager)
 */

const API_VERSION = 'v1'

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

    const hasAccess = await checkUserRole(user.id, ['admin', 'manager'])
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

    // Validate promotion status
    if ((promotion as any).status !== 'active') {
      return createErrorResponse(
        'invalid_status',
        'Only active promotions can be delivered',
        400
      )
    }

    // Check if promotion has started
    const startDate = new Date((promotion as any).start_date)
    const now = new Date()
    if (startDate > now) {
      return createErrorResponse(
        'not_started',
        'Promotion has not started yet',
        400
      )
    }

    // Check if promotion has expired
    const endDate = new Date((promotion as any).end_date)
    if (endDate < now) {
      return createErrorResponse(
        'expired',
        'Promotion has already expired',
        400
      )
    }

    // Parse delivery channels
    let deliveryChannels: ('portal' | 'email' | 'sms')[]
    try {
      const channelsData = (promotion as any).delivery_channels
      deliveryChannels = typeof channelsData === 'string'
        ? JSON.parse(channelsData)
        : channelsData || ['portal']
    } catch (error) {
      deliveryChannels = ['portal']
    }

    if (deliveryChannels.length === 0) {
      return createErrorResponse(
        'no_channels',
        'No delivery channels specified',
        400
      )
    }

    // Build targeting criteria
    const targetingCriteria = {
      targetAudience: (promotion as any).target_audience || 'all_customers',
      targetZones: (promotion as any).target_zones || [],
      targetServiceTypes: (promotion as any).target_service_types || [],
      minJobValue: (promotion as any).min_job_value,
      maxJobValue: (promotion as any).max_job_value,
    }

    // Get targeted customers (returns array of customer IDs)
    const customerIds = await getTargetedCustomers(targetingCriteria)

    if (customerIds.length === 0) {
      return createErrorResponse(
        'no_recipients',
        'No eligible customers found for this promotion',
        400
      )
    }

    // Check if we've reached max redemptions
    const currentRedemptions = (promotion as any).current_redemptions || 0
    const maxRedemptions = (promotion as any).max_redemptions

    if (maxRedemptions && currentRedemptions >= maxRedemptions) {
      return createErrorResponse(
        'max_redemptions_reached',
        'Promotion has reached maximum redemptions',
        400
      )
    }

    // Queue deliveries
    const queueResult = await queuePromotionDeliveries(
      promotionId,
      customerIds,
      deliveryChannels
    )

    if (!queueResult.success) {
      return createErrorResponse(
        'queue_failed',
        'Failed to queue deliveries',
        500
      )
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'promotion_delivered',
      resource_type: 'promotion',
      resource_id: promotionId,
      metadata: {
        customers: customerIds.length,
        channels: deliveryChannels,
        queued: queueResult.queuedCount,
        skipped: queueResult.skippedCount,
      },
    } as any)

    return createSuccessResponse({
      message: 'Promotion delivery queued successfully',
      deliveryJob: {
        promotionId,
        promotionTitle: (promotion as any).title,
        totalCustomers: customerIds.length,
        deliveryChannels,
        queuedDeliveries: queueResult.queuedCount,
        skippedDeliveries: queueResult.skippedCount,
        estimatedCompletionTime: '5-10 minutes',
        status: 'queued',
      },
    })
  } catch (error) {
    console.error('[Promotions] POST /api/promotions/[id]/deliver error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
