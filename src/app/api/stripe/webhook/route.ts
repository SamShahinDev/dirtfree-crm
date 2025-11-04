/**
 * Stripe Webhook Handler
 * Processes Stripe payment events and updates invoice status
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { InvoiceStatus, PaymentStatus } from '@/types/invoice'

// =============================================================================
// CONFIGURATION
// =============================================================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY not configured')
}

if (!STRIPE_WEBHOOK_SECRET) {
  console.error('STRIPE_WEBHOOK_SECRET not configured')
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
}) : null

// =============================================================================
// WEBHOOK PROCESSING
// =============================================================================

/**
 * Process payment completion events
 */
async function handlePaymentSuccess(
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent | Stripe.Checkout.Session
): Promise<void> {
  try {
    const supabase = createClient()

    // Extract invoice ID from metadata
    let invoiceId: string | null = null
    let paymentAmount: number = 0
    let currency: string = 'usd'
    let providerRef: string = ''

    if (event.type === 'payment_intent.succeeded') {
      const pi = paymentIntent as Stripe.PaymentIntent
      invoiceId = pi.metadata?.invoice_id || null
      paymentAmount = pi.amount
      currency = pi.currency
      providerRef = pi.id
    } else if (event.type === 'checkout.session.completed') {
      const session = paymentIntent as Stripe.Checkout.Session
      invoiceId = session.metadata?.invoice_id || null
      paymentAmount = session.amount_total || 0
      currency = session.currency || 'usd'
      providerRef = session.id

      // If session has a payment intent, use that instead
      if (session.payment_intent && typeof session.payment_intent === 'string') {
        providerRef = session.payment_intent
      }
    }

    if (!invoiceId) {
      console.warn('No invoice_id in payment metadata:', {
        event_type: event.type,
        provider_ref: providerRef
      })
      return
    }

    // Find the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice not found for payment:', {
        invoice_id: invoiceId,
        provider_ref: providerRef,
        error: invoiceError?.message
      })
      return
    }

    // Check if invoice is already paid
    if (invoice.status === InvoiceStatus.PAID) {
      console.log('Invoice already marked as paid:', {
        invoice_id: invoiceId,
        invoice_number: invoice.number
      })
      return
    }

    // Check if payment already exists
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('provider_ref', providerRef)
      .single()

    if (existingPayment) {
      console.log('Payment already recorded:', {
        payment_id: existingPayment.id,
        provider_ref: providerRef
      })
      return
    }

    // Verify payment amount matches invoice total (with small tolerance for rounding)
    const amountDifference = Math.abs(paymentAmount - invoice.total_cents)
    if (amountDifference > 1) { // Allow 1 cent difference for rounding
      console.warn('Payment amount mismatch:', {
        invoice_id: invoiceId,
        invoice_total: invoice.total_cents,
        payment_amount: paymentAmount,
        difference: amountDifference
      })
    }

    // Start transaction
    const { error: transactionError } = await supabase.rpc('process_payment_transaction', {
      p_invoice_id: invoiceId,
      p_provider_ref: providerRef,
      p_amount_cents: paymentAmount,
      p_currency: currency,
      p_provider_data: JSON.stringify({
        event_id: event.id,
        event_type: event.type,
        payment_method: event.type === 'checkout.session.completed'
          ? (paymentIntent as Stripe.Checkout.Session).payment_method_types
          : undefined
      })
    })

    if (transactionError) {
      console.error('Transaction processing error:', {
        invoice_id: invoiceId,
        error: transactionError.message
      })
      throw new Error('Failed to process payment transaction')
    }

    // If transaction succeeded, update invoice
    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: InvoiceStatus.PAID,
        paid_at: now
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Invoice update error:', {
        invoice_id: invoiceId,
        error: updateError.message
      })
      throw new Error('Failed to update invoice status')
    }

    // Record payment
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        invoice_id: invoiceId,
        provider: 'stripe',
        provider_ref: providerRef,
        amount_cents: paymentAmount,
        currency: currency,
        status: PaymentStatus.SUCCEEDED,
        provider_data: {
          event_id: event.id,
          event_type: event.type,
          processed_at: now
        },
        processed_at: now
      })

    if (paymentError) {
      console.error('Payment record error:', {
        invoice_id: invoiceId,
        error: paymentError.message
      })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      table_name: 'invoices',
      record_id: invoiceId,
      action: 'invoice_paid',
      old_values: { status: invoice.status },
      new_values: {
        status: InvoiceStatus.PAID,
        paid_at: now,
        payment_provider_ref: providerRef
      },
      user_id: null, // System action
      user_role: 'system',
      ip_address: null,
      user_agent: 'stripe-webhook'
    })

    console.log('Payment processed successfully:', {
      invoice_id: invoiceId,
      invoice_number: invoice.number,
      amount_cents: paymentAmount,
      provider_ref: providerRef
    })

  } catch (error) {
    console.error('Payment processing error:', error)
    throw error
  }
}

/**
 * Process payment failure events
 */
async function handlePaymentFailure(
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  try {
    const supabase = createClient()

    const invoiceId = paymentIntent.metadata?.invoice_id
    if (!invoiceId) {
      console.warn('No invoice_id in failed payment metadata:', {
        payment_intent_id: paymentIntent.id
      })
      return
    }

    // Record failed payment attempt
    await supabase.from('payments').insert({
      invoice_id: invoiceId,
      provider: 'stripe',
      provider_ref: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: PaymentStatus.FAILED,
      provider_data: {
        event_id: event.id,
        event_type: event.type,
        failure_reason: paymentIntent.last_payment_error?.message,
        failure_code: paymentIntent.last_payment_error?.code
      }
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      table_name: 'invoices',
      record_id: invoiceId,
      action: 'payment_failed',
      new_values: {
        payment_provider_ref: paymentIntent.id,
        failure_reason: paymentIntent.last_payment_error?.message
      },
      user_id: null,
      user_role: 'system',
      ip_address: null,
      user_agent: 'stripe-webhook'
    })

    console.log('Payment failure recorded:', {
      invoice_id: invoiceId,
      payment_intent_id: paymentIntent.id,
      failure_reason: paymentIntent.last_payment_error?.message
    })

  } catch (error) {
    console.error('Payment failure processing error:', error)
  }
}

// =============================================================================
// DATABASE FUNCTIONS
// =============================================================================

/**
 * Create the payment transaction function in the database
 * This should be added to the migration, but defining here for reference
 */
const PAYMENT_TRANSACTION_FUNCTION = `
CREATE OR REPLACE FUNCTION process_payment_transaction(
  p_invoice_id UUID,
  p_provider_ref TEXT,
  p_amount_cents INTEGER,
  p_currency TEXT,
  p_provider_data JSONB
) RETURNS VOID AS $$
BEGIN
  -- Check if payment already exists
  IF EXISTS (
    SELECT 1 FROM payments
    WHERE provider_ref = p_provider_ref
  ) THEN
    RAISE EXCEPTION 'Payment already exists with provider_ref: %', p_provider_ref;
  END IF;

  -- Check if invoice exists and is not already paid
  IF NOT EXISTS (
    SELECT 1 FROM invoices
    WHERE id = p_invoice_id
    AND status != 'paid'
  ) THEN
    RAISE EXCEPTION 'Invoice not found or already paid: %', p_invoice_id;
  END IF;

  -- All checks passed
  RETURN;
END;
$$ LANGUAGE plpgsql;
`

// =============================================================================
// WEBHOOK ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      console.error('Stripe webhook not configured')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    // Get raw body
    const body = await request.text()

    // Get signature from headers
    const headersList = headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      console.error('Missing Stripe signature')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET
      )
    } catch (error) {
      console.error('Webhook signature verification failed:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Log event (without sensitive data)
    console.log('Stripe webhook received:', {
      event_id: event.id,
      event_type: event.type,
      created: event.created
    })

    // Process different event types
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(event, event.data.object as Stripe.PaymentIntent)
          break

        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session
          // Only process if payment was successful
          if (session.payment_status === 'paid') {
            await handlePaymentSuccess(event, session)
          }
          break

        case 'payment_intent.payment_failed':
          await handlePaymentFailure(event, event.data.object as Stripe.PaymentIntent)
          break

        case 'invoice.payment_succeeded':
          // Handle Stripe invoice payments (if using Stripe invoices in the future)
          console.log('Stripe invoice payment succeeded:', event.id)
          break

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          // Handle subscription events (if adding subscriptions in the future)
          console.log('Subscription event:', event.type, event.id)
          break

        default:
          console.log('Unhandled webhook event:', event.type)
      }

      return NextResponse.json({ received: true })

    } catch (processingError) {
      console.error('Webhook processing error:', {
        event_id: event.id,
        event_type: event.type,
        error: processingError instanceof Error ? processingError.message : 'Unknown error'
      })

      // Return 500 to trigger Stripe retry
      return NextResponse.json(
        { error: 'Processing failed' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Webhook handler error:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// =============================================================================
// UTILITY ENDPOINT FOR WEBHOOK TESTING
// =============================================================================

export async function GET(): Promise<NextResponse> {
  // Only available in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    message: 'Stripe webhook endpoint is configured',
    webhook_url: '/api/stripe/webhook',
    methods: ['POST'],
    events_supported: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'checkout.session.completed'
    ],
    configuration: {
      stripe_configured: Boolean(STRIPE_SECRET_KEY),
      webhook_secret_configured: Boolean(STRIPE_WEBHOOK_SECRET)
    }
  })
}