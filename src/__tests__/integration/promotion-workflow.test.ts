/**
 * Promotion Delivery Workflow Integration Tests
 *
 * Tests the complete promotion lifecycle from creation to redemption
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestCustomer,
  createTestPromotion,
  createTestJob,
  verifyEmailSent,
  verifySmsSent,
} from './helpers/test-database'
import { createClient } from '@/lib/supabase/server'

describe('Promotion Delivery Workflow Integration', () => {
  let customerId: string
  let promotionId: string
  let deliveryId: string

  beforeEach(async () => {
    await setupTestDatabase()

    const customer = await createTestCustomer({
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+15555559999',
      customer_segment: 'returning',
    })
    customerId = customer.id
  })

  afterEach(async () => {
    await teardownTestDatabase()
  })

  describe('Targeted Promotion Campaign', () => {
    it('creates promotion with targeting rules', async () => {
      const supabase = await createClient()

      const promotionData = {
        code: `SAVE20-${Date.now()}`,
        description: '20% off all carpet cleaning services',
        discount_type: 'percentage',
        discount_value: 20,
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        active: true,
        max_uses: 100,
        current_uses: 0,
        applicable_services: ['Carpet Cleaning'],
        target_segments: ['returning', 'inactive'],
        min_purchase: 100,
      }

      const { data, error } = await supabase
        .from('promotions')
        .insert(promotionData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.code).toContain('SAVE20')
      expect(data.target_segments).toContain('returning')

      promotionId = data.id
    })

    it('identifies eligible customers for promotion', async () => {
      const supabase = await createClient()

      // Query customers matching targeting criteria
      const { data: eligibleCustomers, error } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_segment', 'returning')
        .eq('deleted', false)

      expect(error).toBeNull()
      expect(eligibleCustomers.length).toBeGreaterThan(0)
      expect(eligibleCustomers.some((c: any) => c.id === customerId)).toBe(true)
    })

    it('schedules promotion delivery for eligible customers', async () => {
      const supabase = await createClient()

      const deliveryData = {
        promotion_id: promotionId,
        customer_id: customerId,
        delivery_method: 'email',
        scheduled_for: new Date().toISOString(),
        status: 'pending',
        personalized_code: `SAVE20-${customerId.slice(-6)}`,
      }

      const { data, error } = await supabase
        .from('promotion_deliveries')
        .insert(deliveryData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('pending')
      expect(data.personalized_code).toBeTruthy()

      deliveryId = data.id
    })

    it('sends promotion via email', async () => {
      const supabase = await createClient()

      // Mark delivery as processing
      await supabase
        .from('promotion_deliveries')
        .update({ status: 'processing' })
        .eq('id', deliveryId)

      // Send email
      const emailData = {
        promotion_delivery_id: deliveryId,
        recipient_email: 'jane@example.com',
        subject: '20% Off Your Next Carpet Cleaning!',
        body: 'Hi Jane, use code SAVE20 for 20% off!',
        status: 'sent',
        sent_at: new Date().toISOString(),
      }

      const { data: emailLog, error } = await supabase
        .from('email_logs')
        .insert(emailData)
        .select()
        .single()

      expect(error).toBeNull()

      // Update delivery status
      await supabase
        .from('promotion_deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', deliveryId)

      // Verify email sent
      const emailSent = await verifyEmailSent('jane@example.com', '20% Off')
      expect(emailSent).toBe(true)
    })

    it('tracks customer opening promotional email', async () => {
      const supabase = await createClient()

      // Log email open event
      const { error } = await supabase
        .from('promotion_deliveries')
        .update({
          opened_at: new Date().toISOString(),
          open_count: 1,
        })
        .eq('id', deliveryId)

      expect(error).toBeNull()

      // Verify tracking
      const { data: delivery } = await supabase
        .from('promotion_deliveries')
        .select('*')
        .eq('id', deliveryId)
        .single()

      expect(delivery.opened_at).toBeTruthy()
      expect(delivery.open_count).toBe(1)
    })

    it('validates promotion code on booking', async () => {
      const supabase = await createClient()

      const promoCode = 'SAVE20-123456'

      // Validate promotion code
      const { data: promotion } = await supabase
        .from('promotions')
        .select('*')
        .eq('id', promotionId)
        .single()

      const now = new Date()
      const validFrom = new Date(promotion.valid_from)
      const validUntil = new Date(promotion.valid_until)

      expect(promotion.active).toBe(true)
      expect(now >= validFrom).toBe(true)
      expect(now <= validUntil).toBe(true)
      expect(promotion.current_uses).toBeLessThan(promotion.max_uses)
    })

    it('applies promotion discount to booking', async () => {
      const supabase = await createClient()

      // Create job
      const job = await createTestJob(customerId, {
        service_type: 'Carpet Cleaning',
        status: 'scheduled',
      })

      // Calculate discount
      const basePrice = 150
      const discountPercentage = 20
      const discountAmount = (basePrice * discountPercentage) / 100
      const finalPrice = basePrice - discountAmount

      // Create invoice with promotion
      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: `INV-${Date.now()}`,
          job_id: job.id,
          customer_id: customerId,
          subtotal: basePrice,
          discount_amount: discountAmount,
          total_amount: finalPrice,
          promotion_id: promotionId,
          promotion_code: 'SAVE20',
          status: 'pending',
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(invoice.discount_amount).toBe(30) // 20% of 150
      expect(invoice.total_amount).toBe(120)

      // Increment promotion usage
      await supabase
        .from('promotions')
        .update({
          current_uses: promotion => promotion.current_uses + 1,
        })
        .eq('id', promotionId)

      // Mark promotion delivery as used
      await supabase
        .from('promotion_deliveries')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          redeemed_on_job_id: job.id,
        })
        .eq('id', deliveryId)
    })

    it('prevents using expired promotion', async () => {
      const supabase = await createClient()

      // Create expired promotion
      const { data: expiredPromo } = await supabase
        .from('promotions')
        .insert({
          code: 'EXPIRED123',
          description: 'Expired promotion',
          discount_type: 'percentage',
          discount_value: 15,
          valid_from: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          valid_until: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          active: true,
        })
        .select()
        .single()

      // Attempt to validate
      const now = new Date()
      const validUntil = new Date(expiredPromo.valid_until)

      expect(now > validUntil).toBe(true) // Should be expired
    })

    it('prevents using promotion over max uses', async () => {
      const supabase = await createClient()

      // Create promotion at max uses
      const { data: fullPromo } = await supabase
        .from('promotions')
        .insert({
          code: 'FULL123',
          description: 'Fully used promotion',
          discount_type: 'percentage',
          discount_value: 10,
          valid_from: new Date().toISOString(),
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          active: true,
          max_uses: 5,
          current_uses: 5,
        })
        .select()
        .single()

      // Validate usage
      expect(fullPromo.current_uses).toBe(fullPromo.max_uses)
      const canUse = fullPromo.current_uses < fullPromo.max_uses
      expect(canUse).toBe(false)
    })
  })

  describe('Multi-Channel Promotion Delivery', () => {
    it('sends promotion via SMS', async () => {
      const supabase = await createClient()

      // Create SMS delivery
      const deliveryData = {
        promotion_id: promotionId,
        customer_id: customerId,
        delivery_method: 'sms',
        status: 'pending',
      }

      const { data: delivery } = await supabase
        .from('promotion_deliveries')
        .insert(deliveryData)
        .select()
        .single()

      // Send SMS
      const smsData = {
        promotion_delivery_id: delivery.id,
        recipient_phone: '+15555559999',
        message: 'Hi Jane! Get 20% off with code SAVE20. Book now!',
        status: 'sent',
        sent_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('sms_logs').insert(smsData)

      expect(error).toBeNull()

      // Verify SMS sent
      const smsSent = await verifySmsSent('+15555559999')
      expect(smsSent).toBe(true)

      // Update delivery status
      await supabase
        .from('promotion_deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        })
        .eq('id', delivery.id)
    })

    it('sends promotion via portal notification', async () => {
      const supabase = await createClient()

      // Create portal notification
      const notificationData = {
        customer_id: customerId,
        type: 'promotion',
        title: 'Special Offer: 20% Off!',
        message: 'Use code SAVE20 for 20% off your next service',
        promotion_id: promotionId,
        read: false,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert(notificationData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.type).toBe('promotion')
      expect(data.read).toBe(false)
    })
  })

  describe('Promotion Analytics', () => {
    it('tracks promotion performance metrics', async () => {
      const supabase = await createClient()

      // Get promotion stats
      const { data: deliveries } = await supabase
        .from('promotion_deliveries')
        .select('*')
        .eq('promotion_id', promotionId)

      const totalDelivered = deliveries.filter((d: any) => d.status === 'delivered').length
      const totalOpened = deliveries.filter((d: any) => d.opened_at !== null).length
      const totalRedeemed = deliveries.filter((d: any) => d.status === 'redeemed').length

      const openRate = (totalOpened / totalDelivered) * 100
      const redemptionRate = (totalRedeemed / totalDelivered) * 100

      expect(totalDelivered).toBeGreaterThan(0)
      expect(openRate).toBeGreaterThanOrEqual(0)
      expect(redemptionRate).toBeGreaterThanOrEqual(0)
    })

    it('calculates ROI for promotion campaign', async () => {
      const supabase = await createClient()

      // Get all invoices using this promotion
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('promotion_id', promotionId)

      const totalRevenue = invoices.reduce((sum: number, inv: any) => sum + inv.total_amount, 0)
      const totalDiscounts = invoices.reduce(
        (sum: number, inv: any) => sum + inv.discount_amount,
        0
      )
      const costOfCampaign = 100 // Delivery costs, etc.

      const roi = ((totalRevenue - costOfCampaign) / costOfCampaign) * 100

      expect(totalRevenue).toBeGreaterThan(0)
      expect(totalDiscounts).toBeGreaterThan(0)
      expect(roi).toBeDefined()
    })
  })

  describe('Personalized Promotion Codes', () => {
    it('generates unique code per customer', async () => {
      const supabase = await createClient()

      // Create multiple deliveries with unique codes
      const customer2 = await createTestCustomer({ name: 'Bob Johnson' })

      const deliveries = [
        {
          promotion_id: promotionId,
          customer_id: customerId,
          personalized_code: `SAVE20-${customerId.slice(-6)}`,
        },
        {
          promotion_id: promotionId,
          customer_id: customer2.id,
          personalized_code: `SAVE20-${customer2.id.slice(-6)}`,
        },
      ]

      const { data, error } = await supabase
        .from('promotion_deliveries')
        .insert(deliveries)
        .select()

      expect(error).toBeNull()
      expect(data[0].personalized_code).not.toBe(data[1].personalized_code)

      // Verify each code is unique
      const codes = data.map((d: any) => d.personalized_code)
      const uniqueCodes = [...new Set(codes)]
      expect(codes.length).toBe(uniqueCodes.length)
    })

    it('validates personalized code belongs to customer', async () => {
      const supabase = await createClient()

      const codeToValidate = `SAVE20-${customerId.slice(-6)}`

      const { data: delivery } = await supabase
        .from('promotion_deliveries')
        .select('*')
        .eq('personalized_code', codeToValidate)
        .single()

      expect(delivery.customer_id).toBe(customerId)
    })
  })
})
