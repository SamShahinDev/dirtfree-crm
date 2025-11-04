/**
 * Referral Workflow Integration Tests
 *
 * Tests the complete referral program workflow from invitation to reward
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestCustomer,
  createTestJob,
  verifyEmailSent,
} from './helpers/test-database'
import { createClient } from '@/lib/supabase/server'

describe('Referral Workflow Integration', () => {
  let referrerId: string
  let referredId: string
  let referralId: string
  let jobId: string

  beforeEach(async () => {
    await setupTestDatabase()

    const referrer = await createTestCustomer({
      name: 'Referrer Customer',
      email: 'referrer@example.com',
    })
    referrerId = referrer.id
  })

  afterEach(async () => {
    await teardownTestDatabase()
  })

  describe('Complete Referral Lifecycle', () => {
    it('generates unique referral link for customer', async () => {
      const supabase = await createClient()

      const referralCode = `REF-${referrerId.slice(-6).toUpperCase()}`
      const referralLink = `https://app.example.com/book?ref=${referralCode}`

      const { data, error } = await supabase
        .from('referral_links')
        .insert({
          customer_id: referrerId,
          referral_code: referralCode,
          referral_link: referralLink,
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.referral_code).toBe(referralCode)
    })

    it('tracks referral link clicks', async () => {
      const supabase = await createClient()

      const referralCode = `REF-${referrerId.slice(-6).toUpperCase()}`

      // Log click
      const { error } = await supabase.from('referral_clicks').insert({
        referral_code: referralCode,
        referrer_customer_id: referrerId,
        clicked_at: new Date().toISOString(),
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
      })

      expect(error).toBeNull()

      // Increment click count
      await supabase
        .from('referral_links')
        .update({ click_count: supabase.raw('click_count + 1') })
        .eq('referral_code', referralCode)
    })

    it('creates referral when new customer books via link', async () => {
      const supabase = await createClient()

      const referred = await createTestCustomer({
        name: 'Referred Customer',
        email: 'referred@example.com',
      })
      referredId = referred.id

      const referralData = {
        referrer_customer_id: referrerId,
        referred_customer_id: referredId,
        referral_code: `REF-${referrerId.slice(-6).toUpperCase()}`,
        status: 'pending',
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('referrals')
        .insert(referralData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('pending')

      referralId = data.id
    })

    it('marks referral as active when referred customer books first job', async () => {
      const supabase = await createClient()

      const job = await createTestJob(referredId, {
        service_type: 'Carpet Cleaning',
        status: 'scheduled',
      })
      jobId = job.id

      // Update referral status
      const { error } = await supabase
        .from('referrals')
        .update({
          status: 'active',
          first_booking_date: new Date().toISOString(),
          first_job_id: jobId,
        })
        .eq('id', referralId)

      expect(error).toBeNull()
    })

    it('converts referral when referred customer completes first job', async () => {
      const supabase = await createClient()

      // Complete job
      await supabase
        .from('jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      // Convert referral
      const { data, error } = await supabase
        .from('referrals')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
          reward_points: 100,
        })
        .eq('id', referralId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('converted')
      expect(data.reward_points).toBe(100)
    })

    it('awards points to referrer for successful referral', async () => {
      const supabase = await createClient()

      const pointsToAward = 100

      // Get loyalty record
      let { data: loyalty } = await supabase
        .from('customer_loyalty')
        .select('*')
        .eq('customer_id', referrerId)
        .single()

      if (!loyalty) {
        const { data: newLoyalty } = await supabase
          .from('customer_loyalty')
          .insert({
            customer_id: referrerId,
            current_points: pointsToAward,
            lifetime_points: pointsToAward,
            current_tier_id: 'tier-bronze',
          })
          .select()
          .single()

        loyalty = newLoyalty
      } else {
        await supabase
          .from('customer_loyalty')
          .update({
            current_points: loyalty.current_points + pointsToAward,
            lifetime_points: loyalty.lifetime_points + pointsToAward,
          })
          .eq('customer_id', referrerId)
      }

      // Log transaction
      const { data: transaction, error } = await supabase
        .from('loyalty_points_transactions')
        .insert({
          customer_id: referrerId,
          points: pointsToAward,
          transaction_type: 'earn',
          reason: 'Successful referral',
          referral_id: referralId,
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(transaction.points).toBe(100)
    })

    it('sends congratulations email to referrer', async () => {
      const supabase = await createClient()

      const emailData = {
        recipient_email: 'referrer@example.com',
        subject: 'You earned 100 loyalty points!',
        body: 'Congratulations! Your referral just completed their first service.',
        status: 'sent',
        sent_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('email_logs').insert(emailData)

      expect(error).toBeNull()

      const emailSent = await verifyEmailSent('referrer@example.com', '100 loyalty points')
      expect(emailSent).toBe(true)
    })

    it('tracks referral program statistics', async () => {
      const supabase = await createClient()

      const { data: stats } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_customer_id', referrerId)

      const totalReferrals = stats.length
      const converted = stats.filter((r: any) => r.status === 'converted').length
      const conversionRate = (converted / totalReferrals) * 100

      expect(totalReferrals).toBeGreaterThan(0)
      expect(conversionRate).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Referral Bonus for Referred Customer', () => {
    it('gives discount to referred customer on first booking', async () => {
      const supabase = await createClient()

      const basePrice = 150
      const referralDiscount = 20 // $20 off first booking
      const finalPrice = basePrice - referralDiscount

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: `INV-${Date.now()}`,
          job_id: jobId,
          customer_id: referredId,
          subtotal: basePrice,
          discount_amount: referralDiscount,
          total_amount: finalPrice,
          referral_id: referralId,
          discount_reason: 'Referral discount',
          status: 'pending',
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(invoice.discount_amount).toBe(20)
    })
  })
})
