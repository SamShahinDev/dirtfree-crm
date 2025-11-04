import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Broadcast Preview API
 *
 * POST /api/messaging/broadcast/preview
 * - Preview recipients based on filter
 * - Estimate costs
 * - No actual broadcast created
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for preview request
 */
const PreviewRequestSchema = z.object({
  recipientFilter: z.object({
    zones: z.array(z.string().uuid()).optional(),
    serviceTypes: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    lastVisitStart: z.string().optional(),
    lastVisitEnd: z.string().optional(),
    specificIds: z.array(z.string().uuid()).optional(),
  }).optional().default({}),
  messageText: z.string().optional(),
  deliveryMethods: z.array(z.enum(['portal', 'email', 'sms'])).optional().default(['portal']),
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
 * POST - Preview broadcast recipients
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
      'dispatcher',
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
    const validation = PreviewRequestSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid preview request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const { recipientFilter, messageText, deliveryMethods } = validation.data

    const serviceSupabase = getServiceSupabase()

    // Get recipient list (limited to 100 for preview)
    const { data: recipients, error: recipientsError } = await (serviceSupabase as any).rpc(
      'get_broadcast_recipients',
      { p_filter: recipientFilter }
    )

    if (recipientsError) {
      console.error('[Broadcast Preview] Error getting recipients:', recipientsError)
      return createErrorResponse(
        'database_error',
        'Failed to get recipients',
        500
      )
    }

    const recipientsArray: any[] = (recipients as any) || []

    // Count recipients by delivery method
    const emailCount = deliveryMethods.includes('email')
      ? recipientsArray.filter((r) => r.email).length
      : 0

    const smsCount = deliveryMethods.includes('sms')
      ? recipientsArray.filter((r) => r.phone).length
      : 0

    const portalCount = deliveryMethods.includes('portal')
      ? recipientsArray.length
      : 0

    // Estimate costs
    let estimatedCostUsd = 0
    let smsCost = 0

    if (messageText && smsCount > 0) {
      const { data: costData } = await serviceSupabase.rpc(
        'estimate_sms_cost',
        {
          p_message_text: messageText,
          p_recipient_count: smsCount,
        } as any
      )
      smsCost = parseFloat(costData || '0')
      estimatedCostUsd += smsCost
    }

    // Format recipients for preview
    const previewRecipients = recipientsArray.slice(0, 100).map((r) => ({
      customerId: r.customer_id,
      customerName: r.customer_name,
      email: r.email,
      phone: r.phone,
      zoneId: r.zone_id,
      canReceiveEmail: !!r.email,
      canReceiveSms: !!r.phone,
    }))

    return createSuccessResponse({
      totalRecipients: recipientsArray.length,
      previewRecipients,
      deliveryCounts: {
        portal: portalCount,
        email: emailCount,
        sms: smsCount,
      },
      costEstimate: {
        sms: smsCost,
        total: estimatedCostUsd,
      },
      warnings: [
        ...(deliveryMethods.includes('email') && recipientsArray.some((r) => !r.email)
          ? [`${recipientsArray.filter((r) => !r.email).length} recipients missing email address`]
          : []),
        ...(deliveryMethods.includes('sms') && recipientsArray.some((r) => !r.phone)
          ? [`${recipientsArray.filter((r) => !r.phone).length} recipients missing phone number`]
          : []),
      ],
    })
  } catch (error) {
    console.error('[Broadcast Preview] POST /api/messaging/broadcast/preview error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
