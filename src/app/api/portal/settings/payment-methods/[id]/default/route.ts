import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/server'
import Stripe from 'stripe'

/**
 * Portal Payment Method Default API
 *
 * PATCH /api/portal/settings/payment-methods/[id]/default
 * - Set payment method as default for customer
 * - Updates Stripe customer default payment method
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
 * PATCH - Set payment method as default
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate request
    const { customerId, error: authError } = await authenticatePortalRequest(request)
    if (authError) {
      return authError
    }

    const paymentMethodId = params.id

    // Get customer's Stripe customer ID
    const supabase = getServiceSupabase()
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('stripe_customer_id')
      .eq('id', customerId)
      .single()

    if (customerError || !customer || !(customer as any).stripe_customer_id) {
      return createErrorResponse('customer_not_found', 'Customer not found', 404)
    }

    // Verify payment method belongs to this customer
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)

      if (paymentMethod.customer !== (customer as any).stripe_customer_id) {
        return createErrorResponse('forbidden', 'Payment method does not belong to this customer', 403)
      }

      // Set as default payment method
      await stripe.customers.update((customer as any).stripe_customer_id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      })

      // Get IP address for audit logging
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                       request.headers.get('x-real-ip') ||
                       'unknown'

      // Create audit log entry
      await supabase.from('audit_logs').insert({
        user_id: null,
        action: 'payment_method_set_default',
        resource_type: 'customer',
        resource_id: customerId,
        metadata: {
          paymentMethodId,
          ipAddress,
        },
      } as any)

      return createSuccessResponse({
        message: 'Default payment method updated successfully',
        paymentMethodId,
      })

    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        if (error.code === 'resource_missing') {
          return createErrorResponse('payment_method_not_found', 'Payment method not found', 404)
        }
        return createErrorResponse('stripe_error', error.message, 400)
      }
      throw error
    }

  } catch (error) {
    console.error('[Payment Methods] PATCH /api/portal/settings/payment-methods/[id]/default error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
