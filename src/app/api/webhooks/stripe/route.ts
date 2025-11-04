import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { headers } from 'next/headers'
import { getServiceSupabase } from '@/lib/supabase/server'
import { sendInvoiceReceipt } from '@/lib/email/service'
import type { Database } from '@/types/supabase'

/**
 * Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe
 * - Handles Stripe webhook events
 * - Verifies webhook signature for security
 * - Processes payment completion
 * - Awards loyalty points
 * - Sends receipt emails
 * - Creates audit logs
 *
 * Webhook Events Handled:
 * - checkout.session.completed: Payment successful
 * - payment_intent.payment_failed: Payment failed
 *
 * Setup Instructions:
 * 1. Add STRIPE_WEBHOOK_SECRET to environment variables
 * 2. Configure webhook in Stripe Dashboard:
 *    URL: https://crm.dirtfreecarpet.com/api/webhooks/stripe
 *    Events: checkout.session.completed, payment_intent.payment_failed
 * 3. Copy webhook signing secret to STRIPE_WEBHOOK_SECRET
 */

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

/**
 * Award loyalty points for invoice payment
 * Returns transaction ID or null if failed
 */
async function awardLoyaltyPoints(
  customerId: string,
  invoiceId: string,
  invoiceNumber: string,
  amountCents: number
): Promise<{ points: number; transactionId: string | null }> {
  const supabase = getServiceSupabase()

  try {
    // Calculate points: 1 point per dollar spent (rounded down)
    const pointsEarned = Math.floor(amountCents / 100)

    if (pointsEarned <= 0) {
      console.log(`[Stripe Webhook] No loyalty points to award for invoice ${invoiceNumber} (amount: ${amountCents} cents)`)
      return { points: 0, transactionId: null }
    }

    // Call the award_loyalty_points function
    const { data: transactionId, error } = await supabase.rpc('award_loyalty_points', {
      p_customer_id: customerId,
      p_points: pointsEarned,
      p_transaction_type: 'invoice_payment',
      p_reference_id: invoiceId,
      p_reference_number: invoiceNumber,
      p_description: `Payment received for Invoice #${invoiceNumber}`,
      p_notes: `Earned ${pointsEarned} loyalty points ($1 = 1 point)`,
      p_metadata: {
        amount_cents: amountCents,
        amount_dollars: amountCents / 100,
        points_rate: '1 point per dollar'
      }
    })

    if (error) {
      console.error('[Stripe Webhook] Failed to award loyalty points:', error)
      return { points: pointsEarned, transactionId: null }
    }

    console.log(`[Stripe Webhook] Awarded ${pointsEarned} loyalty points to customer ${customerId}`)
    return { points: pointsEarned, transactionId: transactionId as string }
  } catch (error) {
    console.error('[Stripe Webhook] Error awarding loyalty points:', error)
    return { points: 0, transactionId: null }
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const supabase = getServiceSupabase()

  console.log('[Stripe Webhook] Processing checkout.session.completed:', session.id)

  // Extract metadata
  const invoiceId = session.metadata?.invoice_id
  const customerId = session.metadata?.customer_id
  const invoiceNumber = session.metadata?.invoice_number

  if (!invoiceId || !customerId) {
    console.error('[Stripe Webhook] Missing required metadata in checkout session:', {
      invoiceId,
      customerId,
      sessionId: session.id
    })
    return { success: false, error: 'Missing metadata' }
  }

  // Fetch invoice to check if already processed (idempotency)
  const { data: existingInvoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, status, number, total_cents, currency, customer:customers(id, name, email)')
    .eq('id', invoiceId)
    .single()

  if (fetchError || !existingInvoice) {
    console.error('[Stripe Webhook] Invoice not found:', invoiceId)
    return { success: false, error: 'Invoice not found' }
  }

  // Check if already paid (idempotency check)
  if (existingInvoice.status === 'paid') {
    console.log('[Stripe Webhook] Invoice already marked as paid, skipping:', invoiceId)
    return { success: true, message: 'Already processed' }
  }

  const customer = existingInvoice.customer as Database['public']['Tables']['customers']['Row']

  try {
    // 1. Update invoice status to paid
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_link: session.url || existingInvoice.payment_link,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('[Stripe Webhook] Failed to update invoice status:', updateError)
      return { success: false, error: 'Failed to update invoice' }
    }

    console.log(`[Stripe Webhook] Invoice ${invoiceNumber} marked as paid`)

    // 2. Create payment record
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        invoice_id: invoiceId,
        customer_id: customerId,
        amount_cents: existingInvoice.total_cents,
        currency: existingInvoice.currency,
        status: 'succeeded',
        provider: 'stripe',
        provider_data: {
          checkout_session_id: session.id,
          payment_intent_id: session.payment_intent,
          payment_status: session.payment_status,
          payment_method: session.payment_method_types?.[0] || 'card'
        },
        processed_at: new Date().toISOString()
      })

    if (paymentError) {
      console.error('[Stripe Webhook] Failed to create payment record:', paymentError)
      // Don't fail the webhook - invoice is already marked as paid
    }

    // 3. Award loyalty points
    const { points: loyaltyPoints, transactionId } = await awardLoyaltyPoints(
      customerId,
      invoiceId,
      existingInvoice.number,
      existingInvoice.total_cents
    )

    // 4. Create audit log
    const { error: auditError } = await supabase
      .from('audit_log')
      .insert({
        actor_id: customerId,
        action: 'UPDATE',
        entity: 'invoice',
        entity_id: invoiceId,
        meta: {
          source: 'stripe_webhook',
          action: 'invoice_paid',
          invoiceNumber: existingInvoice.number,
          amount: existingInvoice.total_cents,
          loyaltyPointsAwarded: loyaltyPoints,
          stripeSessionId: session.id,
          stripePaymentIntent: session.payment_intent,
          timestamp: new Date().toISOString()
        }
      })

    if (auditError) {
      console.error('[Stripe Webhook] Failed to create audit log:', auditError)
      // Don't fail the webhook
    }

    // 5. Fetch next appointment (if any)
    const { data: nextJob } = await supabase
      .from('jobs')
      .select('id, scheduled_date, scheduled_time, service_type')
      .eq('customer_id', customerId)
      .eq('status', 'scheduled')
      .gte('scheduled_date', new Date().toISOString())
      .order('scheduled_date', { ascending: true })
      .limit(1)
      .maybeSingle()

    // 6. Send receipt email
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL
    const invoiceUrl = `${portalUrl}/invoices/${invoiceId}`
    const invoicePdfUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/portal/invoices/${invoiceId}/pdf`

    const emailResult = await sendInvoiceReceipt(
      customer.email || '',
      customer.name,
      existingInvoice.number,
      existingInvoice.total_cents / 100,
      existingInvoice.currency,
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      {
        paymentMethod: session.payment_method_types?.[0] || 'card',
        loyaltyPointsEarned: loyaltyPoints,
        invoiceUrl,
        invoicePdfUrl,
        nextAppointment: nextJob ? {
          date: new Date(nextJob.scheduled_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          time: nextJob.scheduled_time || 'TBD',
          serviceType: nextJob.service_type || 'Service'
        } : undefined
      }
    )

    if (!emailResult.success) {
      console.error('[Stripe Webhook] Failed to send receipt email:', emailResult.error)
      // Don't fail the webhook - payment is complete
    } else {
      console.log('[Stripe Webhook] Receipt email sent successfully to:', customer.email)
    }

    return {
      success: true,
      invoiceId,
      loyaltyPoints,
      emailSent: emailResult.success
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error processing checkout.session.completed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const supabase = getServiceSupabase()

  console.log('[Stripe Webhook] Processing payment_intent.payment_failed:', paymentIntent.id)

  // Extract metadata (if available from checkout session)
  const invoiceId = paymentIntent.metadata?.invoice_id

  if (!invoiceId) {
    console.warn('[Stripe Webhook] No invoice_id in payment_intent metadata')
    return { success: true, message: 'No invoice to update' }
  }

  // Log payment failure
  const { error: paymentError } = await supabase
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      customer_id: paymentIntent.metadata?.customer_id || null,
      amount_cents: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'failed',
      provider: 'stripe',
      provider_data: {
        payment_intent_id: paymentIntent.id,
        failure_code: paymentIntent.last_payment_error?.code,
        failure_message: paymentIntent.last_payment_error?.message
      },
      processed_at: new Date().toISOString()
    })

  if (paymentError) {
    console.error('[Stripe Webhook] Failed to log payment failure:', paymentError)
  }

  // Create audit log
  await supabase
    .from('audit_log')
    .insert({
      actor_id: paymentIntent.metadata?.customer_id || null,
      action: 'UPDATE',
      entity: 'invoice',
      entity_id: invoiceId,
      meta: {
        source: 'stripe_webhook',
        action: 'payment_failed',
        paymentIntentId: paymentIntent.id,
        failureCode: paymentIntent.last_payment_error?.code,
        failureMessage: paymentIntent.last_payment_error?.message,
        timestamp: new Date().toISOString()
      }
    })

  console.log('[Stripe Webhook] Payment failure logged for invoice:', invoiceId)

  return { success: true }
}

/**
 * POST - Stripe webhook endpoint
 */
export async function POST(request: NextRequest) {
  if (!stripe) {
    console.error('[Stripe Webhook] Stripe not configured')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  if (!webhookSecret) {
    console.error('[Stripe Webhook] Webhook secret not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  try {
    // Get the raw body
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      console.error('[Stripe Webhook] No signature header')
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err)
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      )
    }

    console.log('[Stripe Webhook] Received event:', event.type, event.id)

    // Handle the event
    let result
    switch (event.type) {
      case 'checkout.session.completed':
        result = await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'payment_intent.payment_failed':
        result = await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
        break

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type)
        return NextResponse.json({ received: true })
    }

    if (!result.success) {
      console.error('[Stripe Webhook] Event processing failed:', result.error)
      // Still return 200 to avoid Stripe retries for permanent failures
      return NextResponse.json({ received: true, error: result.error }, { status: 200 })
    }

    return NextResponse.json({ received: true, result })
  } catch (error) {
    console.error('[Stripe Webhook] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

/**
 * GET - Webhook info (for debugging)
 */
export async function GET() {
  return NextResponse.json({
    name: 'Stripe Webhook Handler',
    configured: !!(stripe && webhookSecret),
    events: [
      'checkout.session.completed',
      'payment_intent.payment_failed'
    ],
    setup: {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`,
      secret: webhookSecret ? 'Configured' : 'Not configured',
      instructions: [
        '1. Go to Stripe Dashboard > Developers > Webhooks',
        '2. Click "Add endpoint"',
        '3. Enter webhook URL',
        '4. Select events: checkout.session.completed, payment_intent.payment_failed',
        '5. Copy signing secret to STRIPE_WEBHOOK_SECRET environment variable'
      ]
    }
  })
}
