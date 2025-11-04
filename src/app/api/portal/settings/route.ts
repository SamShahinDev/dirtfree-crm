import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import { z } from 'zod'
import Stripe from 'stripe'

/**
 * Portal Settings API
 *
 * GET /api/portal/settings
 * - Returns comprehensive customer portal settings
 * - Includes: notifications, communication, auto-booking, payment methods, preferences
 *
 * PATCH /api/portal/settings
 * - Update customer portal settings
 * - Validates all changes
 * - Records changes in settings history
 *
 * Authentication: Portal Access Token (X-Portal-Token header)
 */

const API_VERSION = 'v1'

// Initialize Stripe
// @ts-ignore - Using older API version for compatibility
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
})

/**
 * Validation schema for settings update
 */
const UpdateSettingsSchema = z.object({
  notifications: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
  }).optional(),
  communication: z.object({
    preferredMethod: z.enum(['email', 'phone', 'both']).optional(),
    marketingOptOut: z.boolean().optional(),
  }).optional(),
  autoBooking: z.object({
    enabled: z.boolean().optional(),
  }).optional(),
  preferredTechnician: z.object({
    id: z.string().uuid().nullable().optional(),
  }).optional(),
  preferences: z.object({
    language: z.enum(['en', 'es']).optional(),
    timezone: z.string().optional(),
  }).optional(),
})

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json({ success: false, error, message, version: API_VERSION }, { status })
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status: 200 }
  )
}

/**
 * Authenticate portal request and get customer ID
 */
async function authenticatePortalRequest(request: NextRequest): Promise<{ customerId: string; error?: NextResponse }> {
  const authHeader = request.headers.get('authorization')
  const portalToken = request.headers.get('x-portal-token')

  const token = authHeader?.replace('Bearer ', '') || portalToken

  if (!token) {
    return {
      customerId: '',
      error: createErrorResponse('authentication_required', 'Authentication required', 401)
    }
  }

  const supabase = getServiceSupabase()

  // Validate token via portal_sessions
  const { data: session, error: sessionError } = await supabase
    .from('portal_sessions')
    .select('customer_id, expires_at')
    .eq('token_hash', Buffer.from(token).toString('base64'))
    .single()

  if (sessionError || !session) {
    return {
      customerId: '',
      error: createErrorResponse('unauthorized', 'Invalid or expired token', 401)
    }
  }

  // Check if session expired
  if (new Date((session as any).expires_at) < new Date()) {
    return {
      customerId: '',
      error: createErrorResponse('token_expired', 'Session has expired', 401)
    }
  }

  return { customerId: (session as any).customer_id }
}

/**
 * Get customer's Stripe payment methods
 */
async function getCustomerPaymentMethods(stripeCustomerId: string | null): Promise<any[]> {
  if (!stripeCustomerId) {
    return []
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    })

    // Get customer to check default payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId)
    const defaultPaymentMethodId = (customer as any).deleted !== true && (customer as any).invoice_settings?.default_payment_method
      ? (customer as any).invoice_settings.default_payment_method
      : null

    return paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      } : null,
      isDefault: pm.id === defaultPaymentMethodId,
      createdAt: new Date(pm.created * 1000).toISOString(),
    }))
  } catch (error) {
    console.error('[Portal Settings] Failed to fetch payment methods:', error)
    return []
  }
}

/**
 * GET - Retrieve customer portal settings
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { customerId, error: authError } = await authenticatePortalRequest(request)
    if (authError) {
      return authError
    }

    const supabase = getServiceSupabase()

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select(`
        id,
        email_notifications,
        sms_notifications,
        preferred_communication,
        marketing_opt_out,
        auto_booking_enabled,
        preferred_technician_id,
        portal_language,
        timezone,
        stripe_customer_id
      `)
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      console.error('[Portal Settings] Failed to fetch customer:', customerError)
      return createErrorResponse('customer_not_found', 'Customer not found', 404)
    }

    // Get preferred technician details if set
    let preferredTechnician = null
    if ((customer as any).preferred_technician_id) {
      const { data: techData } = await supabase
        .from('users')
        .select('id, name, email, phone')
        .eq('id', (customer as any).preferred_technician_id)
        .single()

      if (techData) {
        preferredTechnician = {
          id: (techData as any).id,
          name: (techData as any).name,
          email: (techData as any).email,
          phone: (techData as any).phone,
        }
      }
    }

    // Get payment methods from Stripe
    const paymentMethods = await getCustomerPaymentMethods((customer as any).stripe_customer_id)

    // Compile settings response
    const settings = {
      customerId: (customer as any).id,
      notifications: {
        email: (customer as any).email_notifications ?? true,
        sms: (customer as any).sms_notifications ?? true,
        push: true, // Always enabled for portal
      },
      communication: {
        preferredMethod: (customer as any).preferred_communication || 'email',
        marketingOptOut: (customer as any).marketing_opt_out ?? false,
      },
      autoBooking: {
        enabled: (customer as any).auto_booking_enabled ?? false,
      },
      preferredTechnician,
      preferences: {
        language: (customer as any).portal_language || 'en',
        timezone: (customer as any).timezone || 'America/Los_Angeles',
      },
      paymentMethods,
    }

    return createSuccessResponse(settings)

  } catch (error) {
    console.error('[Portal Settings] GET /api/portal/settings error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * PATCH - Update customer portal settings
 */
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate request
    const { customerId, error: authError } = await authenticatePortalRequest(request)
    if (authError) {
      return authError
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateSettingsSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid settings data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const updates = validation.data
    const supabase = getServiceSupabase()

    // Build update object
    const customerUpdates: Record<string, any> = {}

    if (updates.notifications) {
      if (updates.notifications.email !== undefined) {
        customerUpdates.email_notifications = updates.notifications.email
      }
      if (updates.notifications.sms !== undefined) {
        customerUpdates.sms_notifications = updates.notifications.sms
      }
    }

    if (updates.communication) {
      if (updates.communication.preferredMethod !== undefined) {
        customerUpdates.preferred_communication = updates.communication.preferredMethod
      }
      if (updates.communication.marketingOptOut !== undefined) {
        customerUpdates.marketing_opt_out = updates.communication.marketingOptOut
      }
    }

    if (updates.autoBooking) {
      if (updates.autoBooking.enabled !== undefined) {
        customerUpdates.auto_booking_enabled = updates.autoBooking.enabled
      }
    }

    if (updates.preferredTechnician) {
      if (updates.preferredTechnician.id !== undefined) {
        customerUpdates.preferred_technician_id = updates.preferredTechnician.id
      }
    }

    if (updates.preferences) {
      if (updates.preferences.language !== undefined) {
        customerUpdates.portal_language = updates.preferences.language
      }
      if (updates.preferences.timezone !== undefined) {
        customerUpdates.timezone = updates.preferences.timezone
      }
    }

    // Update customer record (trigger will record history)
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      // @ts-ignore - Supabase type inference issue
      .update(customerUpdates as any)
      .eq('id', customerId)
      .select()
      .single()

    if (updateError || !updatedCustomer) {
      console.error('[Portal Settings] Failed to update customer:', updateError)
      return createErrorResponse('update_failed', 'Failed to update settings', 500)
    }

    // Get IP address and user agent for audit logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Create audit log entry
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'portal_settings_updated',
      resource_type: 'customer',
      resource_id: customerId,
      metadata: {
        updates: customerUpdates,
        ipAddress,
        userAgent,
      },
    } as any)

    // Return updated settings using GET endpoint logic
    return GET(request)

  } catch (error) {
    console.error('[Portal Settings] PATCH /api/portal/settings error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
