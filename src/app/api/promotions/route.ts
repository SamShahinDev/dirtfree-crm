import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generatePromoCode, isPromoCodeAvailable } from '@/lib/promotions/targeting'

/**
 * Promotions API
 *
 * GET /api/promotions
 * - List all promotions
 * - Query params: status, type, limit, offset
 *
 * POST /api/promotions
 * - Create new promotion
 *
 * Authentication: Required (staff only - admin, manager)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for promotion creation
 */
const CreatePromotionSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  promotionType: z.enum([
    'percentage_off',
    'dollar_off',
    'free_addon',
    'bogo',
    'seasonal',
    'referral',
    'loyalty',
  ]),
  discountValue: z.number().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  freeAddonService: z.string().optional(),

  // Targeting
  targetAudience: z.enum([
    'all_customers',
    'inactive',
    'vip',
    'new',
    'zone_specific',
    'service_specific',
    'custom',
  ]).default('all_customers'),
  targetZones: z.array(z.string().uuid()).optional(),
  targetServiceTypes: z.array(z.string()).optional(),
  targetCustomerTags: z.array(z.string()).optional(),
  minJobValue: z.number().optional(),
  maxJobValue: z.number().optional(),

  // Validity
  startDate: z.string(),
  endDate: z.string(),
  maxRedemptions: z.number().int().min(1).optional(),
  redemptionsPerCustomer: z.number().int().min(1).default(1),

  // Delivery
  deliveryChannels: z.array(z.enum(['portal', 'email', 'sms'])).default(['portal']),
  autoDeliver: z.boolean().default(true),
  deliveryScheduledFor: z.string().optional(),

  // Promo code
  promoCode: z.string().max(50).optional(),
  caseSensitive: z.boolean().default(false),

  // Terms
  termsAndConditions: z.string().optional(),
  excludeOtherPromotions: z.boolean().default(false),

  // Status
  status: z.enum(['draft', 'scheduled', 'active']).default('draft'),
})

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
  )
}

/**
 * Check if user has required role
 */
async function checkUserRole(
  userId: string,
  requiredRoles: string[]
): Promise<boolean> {
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
 * GET - List promotions
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Check if user has staff role
    const hasAccess = await checkUserRole(user.id, [
      'admin',
      'manager',
      'dispatcher',
    ])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const serviceSupabase = getServiceSupabase()

    // Build query
    let query = serviceSupabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (type) {
      query = query.eq('promotion_type', type)
    }

    const { data: promotions, error: promotionsError } = await query

    if (promotionsError) {
      console.error('[Promotions] Error fetching promotions:', promotionsError)
      return createErrorResponse(
        'database_error',
        'Failed to fetch promotions',
        500
      )
    }

    // Transform to camelCase
    const transformedPromotions = (promotions || []).map((promo: any) => ({
      id: promo.id,
      title: promo.title,
      description: promo.description,
      promotionType: promo.promotion_type,
      discountValue: promo.discount_value,
      discountPercentage: promo.discount_percentage,
      freeAddonService: promo.free_addon_service,
      targetAudience: promo.target_audience,
      targetZones: promo.target_zones,
      targetServiceTypes: promo.target_service_types,
      targetCustomerTags: promo.target_customer_tags,
      minJobValue: promo.min_job_value,
      maxJobValue: promo.max_job_value,
      startDate: promo.start_date,
      endDate: promo.end_date,
      maxRedemptions: promo.max_redemptions,
      redemptionsPerCustomer: promo.redemptions_per_customer,
      currentRedemptions: promo.current_redemptions,
      deliveryChannels: promo.delivery_channels,
      autoDeliver: promo.auto_deliver,
      deliveryScheduledFor: promo.delivery_scheduled_for,
      lastDeliveredAt: promo.last_delivered_at,
      promoCode: promo.promo_code,
      caseSensitive: promo.case_sensitive,
      status: promo.status,
      termsAndConditions: promo.terms_and_conditions,
      excludeOtherPromotions: promo.exclude_other_promotions,
      createdByUserId: promo.created_by_user_id,
      approvedByUserId: promo.approved_by_user_id,
      approvedAt: promo.approved_at,
      createdAt: promo.created_at,
      updatedAt: promo.updated_at,
    }))

    return createSuccessResponse({
      promotions: transformedPromotions,
      pagination: {
        limit,
        offset,
        total: transformedPromotions.length,
      },
    })
  } catch (error) {
    console.error('[Promotions] GET /api/promotions error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Create new promotion
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Check if user has staff role
    const hasAccess = await checkUserRole(user.id, [
      'admin',
      'manager',
    ])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CreatePromotionSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid promotion data: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const data = validation.data

    // Validate discount based on type
    if (data.promotionType === 'percentage_off' && !data.discountPercentage) {
      return createErrorResponse(
        'validation_failed',
        'Discount percentage is required for percentage_off promotions',
        400
      )
    }

    if (data.promotionType === 'dollar_off' && !data.discountValue) {
      return createErrorResponse(
        'validation_failed',
        'Discount value is required for dollar_off promotions',
        400
      )
    }

    // Generate promo code if not provided
    let promoCode = data.promoCode
    if (!promoCode) {
      promoCode = generatePromoCode(data.title)

      // Ensure uniqueness
      let attempts = 0
      while (!(await isPromoCodeAvailable(promoCode)) && attempts < 10) {
        promoCode = generatePromoCode(data.title)
        attempts++
      }

      if (attempts >= 10) {
        return createErrorResponse(
          'generation_failed',
          'Could not generate unique promo code',
          500
        )
      }
    } else {
      // Check if provided promo code is available
      const available = await isPromoCodeAvailable(promoCode)
      if (!available) {
        return createErrorResponse(
          'validation_failed',
          'Promo code already exists',
          400
        )
      }
    }

    const serviceSupabase = getServiceSupabase()

    // Create promotion
    const { data: promotion, error: createError } = await (serviceSupabase as any)
      .from('promotions')
      .insert({
        title: data.title,
        description: data.description,
        promotion_type: data.promotionType,
        discount_value: data.discountValue,
        discount_percentage: data.discountPercentage,
        free_addon_service: data.freeAddonService,
        target_audience: data.targetAudience,
        target_zones: data.targetZones,
        target_service_types: data.targetServiceTypes,
        target_customer_tags: data.targetCustomerTags,
        min_job_value: data.minJobValue,
        max_job_value: data.maxJobValue,
        start_date: data.startDate,
        end_date: data.endDate,
        max_redemptions: data.maxRedemptions,
        redemptions_per_customer: data.redemptionsPerCustomer,
        delivery_channels: JSON.stringify(data.deliveryChannels),
        auto_deliver: data.autoDeliver,
        delivery_scheduled_for: data.deliveryScheduledFor,
        promo_code: promoCode,
        case_sensitive: data.caseSensitive,
        status: data.status,
        terms_and_conditions: data.termsAndConditions,
        exclude_other_promotions: data.excludeOtherPromotions,
        created_by_user_id: user.id,
      })
      .select()
      .single()

    if (createError || !promotion) {
      console.error('[Promotions] Error creating promotion:', createError)
      return createErrorResponse(
        'creation_failed',
        'Failed to create promotion',
        500
      )
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'promotion_created',
      resource_type: 'promotion',
      resource_id: promotion.id,
      metadata: {
        title: data.title,
        promotionType: data.promotionType,
        status: data.status,
      },
    } as any)

    return createSuccessResponse(
      {
        message: 'Promotion created successfully',
        promotion: {
          id: promotion.id,
          title: promotion.title,
          promotionType: promotion.promotion_type,
          promoCode: promotion.promo_code,
          status: promotion.status,
          startDate: promotion.start_date,
          endDate: promotion.end_date,
        },
      },
      201
    )
  } catch (error) {
    console.error('[Promotions] POST /api/promotions error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
