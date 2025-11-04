import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import { z } from 'zod'
import Stripe from 'stripe'

/**
 * Portal Payment Methods API
 *
 * GET /api/portal/settings/payment-methods
 * - List customer's saved payment methods
 * - Returns card details, default status
 *
 * POST /api/portal/settings/payment-methods
 * - Add new payment method via Stripe
 * - Attach to customer
 * - Optionally set as default
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
 * Validation schema for adding payment method
 */
const AddPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
  setAsDefault: z.boolean().optional().default(false),
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
function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
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
 * Get customer's Stripe customer ID
 */
async function getStripeCustomerId(customerId: string): Promise<{ stripeCustomerId: string | null; error?: NextResponse }> {
  const supabase = getServiceSupabase()

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('stripe_customer_id, email, name')
    .eq('id', customerId)
    .single()

  if (customerError || !customer) {
    return {
      stripeCustomerId: null,
      error: createErrorResponse('customer_not_found', 'Customer not found', 404)
    }
  }

  // Create Stripe customer if doesn't exist
  if (!(customer as any).stripe_customer_id) {
    try {
      const stripeCustomer = await stripe.customers.create({
        email: (customer as any).email,
        name: (customer as any).name,
        metadata: {
          crm_customer_id: customerId,
        },
      })

      // Update customer record with Stripe customer ID
      await supabase
        .from('customers')
        // @ts-ignore - Supabase type inference issue
        .update({ stripe_customer_id: stripeCustomer.id } as any)
        .eq('id', customerId)

      return { stripeCustomerId: stripeCustomer.id }
    } catch (error) {
      console.error('[Payment Methods] Failed to create Stripe customer:', error)
      return {
        stripeCustomerId: null,
        error: createErrorResponse('stripe_error', 'Failed to create Stripe customer', 500)
      }
    }
  }

  return { stripeCustomerId: (customer as any).stripe_customer_id }
}

/**
 * Format payment method for API response
 */
function formatPaymentMethod(pm: Stripe.PaymentMethod, defaultPaymentMethodId: string | null) {
  return {
    id: pm.id,
    type: pm.type,
    card: pm.card ? {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
      funding: pm.card.funding,
    } : null,
    billingDetails: {
      name: pm.billing_details.name,
      email: pm.billing_details.email,
      phone: pm.billing_details.phone,
      address: pm.billing_details.address,
    },
    isDefault: pm.id === defaultPaymentMethodId,
    createdAt: new Date(pm.created * 1000).toISOString(),
  }
}

/**
 * GET - List customer's payment methods
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const { customerId, error: authError } = await authenticatePortalRequest(request)
    if (authError) {
      return authError
    }

    // Get Stripe customer ID
    const { stripeCustomerId, error: stripeError } = await getStripeCustomerId(customerId)
    if (stripeError) {
      return stripeError
    }

    if (!stripeCustomerId) {
      return createSuccessResponse({ paymentMethods: [] })
    }

    // Fetch payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    })

    // Get customer to check default payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId)
    const defaultPaymentMethodId = (customer as any).deleted !== true && (customer as any).invoice_settings?.default_payment_method
      ? (customer as any).invoice_settings.default_payment_method
      : null

    // Format payment methods
    const formattedPaymentMethods = paymentMethods.data.map(pm =>
      formatPaymentMethod(pm, typeof defaultPaymentMethodId === 'string' ? defaultPaymentMethodId : null)
    )

    return createSuccessResponse({
      paymentMethods: formattedPaymentMethods,
      defaultPaymentMethodId,
    })

  } catch (error) {
    console.error('[Payment Methods] GET /api/portal/settings/payment-methods error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Add new payment method
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const { customerId, error: authError } = await authenticatePortalRequest(request)
    if (authError) {
      return authError
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = AddPaymentMethodSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid payment method data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const { paymentMethodId, setAsDefault } = validation.data

    // Get Stripe customer ID
    const { stripeCustomerId, error: stripeError } = await getStripeCustomerId(customerId)
    if (stripeError) {
      return stripeError
    }

    if (!stripeCustomerId) {
      return createErrorResponse('stripe_customer_required', 'Stripe customer not found', 404)
    }

    // Attach payment method to customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    })

    // Set as default if requested
    if (setAsDefault) {
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      })
    }

    // Get updated default payment method ID
    const customer = await stripe.customers.retrieve(stripeCustomerId)
    const defaultPaymentMethodId = (customer as any).deleted !== true && (customer as any).invoice_settings?.default_payment_method
      ? (customer as any).invoice_settings.default_payment_method
      : null

    // Get IP address for audit logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown'

    // Create audit log entry
    const supabase = getServiceSupabase()
    await supabase.from('audit_logs').insert({
      user_id: null,
      action: 'payment_method_added',
      resource_type: 'customer',
      resource_id: customerId,
      metadata: {
        paymentMethodId,
        setAsDefault,
        ipAddress,
      },
    } as any)

    return createSuccessResponse(
      {
        paymentMethod: formatPaymentMethod(paymentMethod, typeof defaultPaymentMethodId === 'string' ? defaultPaymentMethodId : null),
        message: 'Payment method added successfully',
      },
      201
    )

  } catch (error) {
    console.error('[Payment Methods] POST /api/portal/settings/payment-methods error:', error)

    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      return createErrorResponse('stripe_error', error.message, 400)
    }

    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
