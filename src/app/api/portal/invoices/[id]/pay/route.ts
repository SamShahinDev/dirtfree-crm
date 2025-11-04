import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { createPortalAuditLog } from '@/lib/audit/portal-audit'

/**
 * Invoice Payment API
 *
 * POST /api/portal/invoices/[id]/pay
 * - Creates Stripe Checkout Session for invoice payment
 * - Updates invoice status when webhook received
 * - Awards loyalty points (TODO: implement when loyalty system ready)
 * - Sends receipt email (handled by Stripe)
 * - Creates audit log
 */

const rateLimiter = getPortalRateLimiter()
const API_VERSION = 'v1'
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' }) : null

function getCorsHeaders(origin?: string | null): HeadersInit {
  const envOrigins = process.env.ALLOWED_PORTAL_ORIGINS?.split(',').map(o => o.trim()) || []
  const allowedOrigins = [
    ...envOrigins,
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null,
  ].filter(Boolean) as string[]

  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

function createErrorResponse(error: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error, message, version: API_VERSION }, { status, headers })
}

function createSuccessResponse<T>(data: T, headers?: HeadersInit) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status: 200, headers }
  )
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request.headers.get('origin')) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    if (!stripe) {
      return createErrorResponse('stripe_not_configured', 'Payment system not configured', 500, corsHeaders)
    }

    const portalToken = request.headers.get('X-Portal-Token') ||
                        request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!portalToken) {
      return createErrorResponse('authentication_required', 'Portal token required', 401, corsHeaders)
    }

    const auth = await validatePortalToken(portalToken)
    const rateLimitResult = await rateLimiter.limit(auth.customerId)
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
      return createErrorResponse('rate_limit_exceeded', 'Too many requests', 429, { ...corsHeaders, ...rateLimitHeaders })
    }

    const { id: invoiceId } = await params

    // Fetch invoice
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        items:invoice_items(description, quantity, unit_cents, line_total_cents),
        customer:customers(name, email)
      `)
      .eq('id', invoiceId)
      .eq('customer_id', auth.customerId)
      .single()

    if (invoiceError || !invoice) {
      return createErrorResponse('invoice_not_found', 'Invoice not found or access denied', 404, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return createErrorResponse('invoice_already_paid', 'This invoice has already been paid', 400, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Check if invoice is void
    if (invoice.status === 'void') {
      return createErrorResponse('invoice_void', 'This invoice has been voided', 400, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Create Stripe Checkout Session
    const successUrl = `${process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}/success`
    const cancelUrl = `${process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}`

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: (invoice.items || []).map((item: any) => ({
        price_data: {
          currency: invoice.currency,
          product_data: {
            name: item.description,
          },
          unit_amount: item.unit_cents,
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: invoice.customer?.email || auth.email,
      metadata: {
        invoice_id: invoiceId,
        customer_id: auth.customerId,
        invoice_number: invoice.number,
      },
      // Apply discounts if any
      ...(invoice.discount_cents > 0 && {
        discounts: [{
          coupon: await stripe.coupons.create({
            amount_off: invoice.discount_cents,
            currency: invoice.currency,
            duration: 'once',
            name: 'Invoice Discount',
          }).then(c => c.id),
        }],
      }),
    })

    // Update invoice with payment link
    await supabase
      .from('invoices')
      .update({ payment_link: session.url })
      .eq('id', invoiceId)

    // Create audit log
    await createPortalAuditLog({
      actorId: auth.userId,
      action: 'CREATE',
      entity: 'customer',
      entityId: invoiceId,
      meta: {
        action: 'payment_initiated',
        invoiceNumber: invoice.number,
        amount: invoice.total_cents,
        stripeSessionId: session.id,
      },
    })

    return createSuccessResponse(
      {
        sessionId: session.id,
        sessionUrl: session.url,
        message: 'Payment session created successfully',
      },
      { ...corsHeaders, ...rateLimitHeaders }
    )

  } catch (error) {
    console.error('[Portal API] POST /api/portal/invoices/[id]/pay error:', error)

    if (error instanceof Stripe.errors.StripeError) {
      return createErrorResponse('stripe_error', error.message, 500, corsHeaders)
    }

    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500, corsHeaders)
  }
}
