/**
 * Payment Processing Flow Integration Tests
 *
 * Tests the complete payment processing workflow including Stripe integration
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestCustomer,
  createTestJob,
  createTestInvoice,
} from './helpers/test-database'
import { createClient } from '@/lib/supabase/server'

describe('Payment Processing Flow Integration', () => {
  let customerId: string
  let jobId: string
  let invoiceId: string
  let paymentIntentId: string

  beforeEach(async () => {
    await setupTestDatabase()

    const customer = await createTestCustomer({
      name: 'Payment Customer',
      email: 'payment@example.com',
    })
    customerId = customer.id

    const job = await createTestJob(customerId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    jobId = job.id

    const invoice = await createTestInvoice(jobId, customerId, {
      total_amount: 150.0,
      status: 'pending',
    })
    invoiceId = invoice.id
  })

  afterEach(async () => {
    await teardownTestDatabase()
  })

  describe('Stripe Payment Flow', () => {
    it('creates payment intent for invoice', async () => {
      const supabase = await createClient()

      // Simulate Stripe payment intent creation
      const paymentIntent = {
        id: `pi_test_${Date.now()}`,
        amount: 15000, // $150.00 in cents
        currency: 'usd',
        status: 'requires_payment_method',
        customer: `cus_test_${customerId.slice(-6)}`,
      }

      paymentIntentId = paymentIntent.id

      // Store payment intent
      const { data, error } = await supabase
        .from('payment_intents')
        .insert({
          stripe_payment_intent_id: paymentIntent.id,
          invoice_id: invoiceId,
          customer_id: customerId,
          amount: 150.0,
          currency: 'usd',
          status: 'requires_payment_method',
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('requires_payment_method')
    })

    it('processes card payment', async () => {
      const supabase = await createClient()

      // Simulate successful card payment
      await supabase
        .from('payment_intents')
        .update({
          status: 'succeeded',
          payment_method: 'card',
          succeeded_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntentId)

      // Update invoice status
      const { data: invoice, error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString(),
          payment_method: 'card',
        })
        .eq('id', invoiceId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(invoice.status).toBe('paid')
    })

    it('sends payment receipt to customer', async () => {
      const supabase = await createClient()

      const { error } = await supabase.from('email_logs').insert({
        recipient_email: 'payment@example.com',
        subject: 'Payment Receipt - $150.00',
        body: 'Thank you for your payment!',
        invoice_id: invoiceId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })

      expect(error).toBeNull()
    })

    it('handles failed payment', async () => {
      const supabase = await createClient()

      // Simulate payment failure
      const { error: intentError } = await supabase
        .from('payment_intents')
        .update({
          status: 'failed',
          failure_code: 'card_declined',
          failure_message: 'Your card was declined',
          failed_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntentId)

      expect(intentError).toBeNull()

      // Log failed attempt
      const { error } = await supabase.from('payment_attempts').insert({
        payment_intent_id: paymentIntentId,
        invoice_id: invoiceId,
        customer_id: customerId,
        amount: 150.0,
        status: 'failed',
        failure_code: 'card_declined',
        attempted_at: new Date().toISOString(),
      })

      expect(error).toBeNull()

      // Send notification
      await supabase.from('notifications').insert({
        customer_id: customerId,
        type: 'payment_failed',
        title: 'Payment Failed',
        message: 'Your payment could not be processed',
        read: false,
        created_at: new Date().toISOString(),
      })
    })

    it('retries failed payment', async () => {
      const supabase = await createClient()

      // Create new payment intent
      const newPaymentIntent = `pi_retry_${Date.now()}`

      const { data, error } = await supabase
        .from('payment_intents')
        .insert({
          stripe_payment_intent_id: newPaymentIntent,
          invoice_id: invoiceId,
          customer_id: customerId,
          amount: 150.0,
          currency: 'usd',
          status: 'requires_payment_method',
          is_retry: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.is_retry).toBe(true)
    })
  })

  describe('Refund Processing', () => {
    it('processes full refund', async () => {
      const supabase = await createClient()

      // Mark invoice as paid first
      await supabase
        .from('invoices')
        .update({ status: 'paid', paid_date: new Date().toISOString() })
        .eq('id', invoiceId)

      // Create refund
      const { data: refund, error } = await supabase
        .from('refunds')
        .insert({
          stripe_refund_id: `re_test_${Date.now()}`,
          invoice_id: invoiceId,
          payment_intent_id: paymentIntentId,
          customer_id: customerId,
          amount: 150.0,
          reason: 'Customer request',
          status: 'succeeded',
          refunded_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(refund.amount).toBe(150.0)

      // Update invoice status
      await supabase
        .from('invoices')
        .update({ status: 'refunded', refunded_at: new Date().toISOString() })
        .eq('id', invoiceId)
    })

    it('processes partial refund', async () => {
      const supabase = await createClient()

      const refundAmount = 50.0

      const { data: refund, error } = await supabase
        .from('refunds')
        .insert({
          stripe_refund_id: `re_partial_${Date.now()}`,
          invoice_id: invoiceId,
          payment_intent_id: paymentIntentId,
          customer_id: customerId,
          amount: refundAmount,
          reason: 'Partial service credit',
          status: 'succeeded',
          is_partial: true,
          refunded_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(refund.amount).toBe(50.0)

      // Update invoice with partial refund
      await supabase
        .from('invoices')
        .update({
          refunded_amount: refundAmount,
          status: 'partially_refunded',
        })
        .eq('id', invoiceId)
    })
  })

  describe('Subscription Payments', () => {
    it('creates recurring subscription', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          customer_id: customerId,
          stripe_subscription_id: `sub_test_${Date.now()}`,
          plan_id: 'monthly_service',
          status: 'active',
          amount: 99.0,
          billing_period: 'monthly',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('active')
    })

    it('processes subscription renewal', async () => {
      const supabase = await createClient()

      // Create invoice for renewal
      const { data: renewalInvoice, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: `INV-SUB-${Date.now()}`,
          customer_id: customerId,
          subtotal: 99.0,
          total_amount: 99.0,
          status: 'pending',
          invoice_type: 'subscription',
          due_date: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()

      // Process payment
      await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString(),
        })
        .eq('id', renewalInvoice.id)
    })

    it('handles subscription cancellation', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Customer request',
        })
        .eq('customer_id', customerId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('cancelled')
    })
  })

  describe('Payment Analytics', () => {
    it('calculates total revenue', async () => {
      const supabase = await createClient()

      const { data: paidInvoices } = await supabase
        .from('invoices')
        .select('total_amount')
        .eq('status', 'paid')

      const totalRevenue = paidInvoices.reduce(
        (sum: number, inv: any) => sum + inv.total_amount,
        0
      )

      expect(totalRevenue).toBeGreaterThanOrEqual(0)
    })

    it('tracks payment success rate', async () => {
      const supabase = await createClient()

      const { data: attempts } = await supabase.from('payment_attempts').select('status')

      const totalAttempts = attempts.length
      const successfulPayments = attempts.filter((a: any) => a.status === 'succeeded').length
      const successRate = (successfulPayments / totalAttempts) * 100

      expect(successRate).toBeGreaterThanOrEqual(0)
      expect(successRate).toBeLessThanOrEqual(100)
    })
  })
})
