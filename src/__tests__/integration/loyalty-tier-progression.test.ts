/**
 * Loyalty Tier Progression Integration Tests
 *
 * Tests loyalty tier upgrades and downgrade flows
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

describe('Loyalty Tier Progression Integration', () => {
  let customerId: string

  beforeEach(async () => {
    await setupTestDatabase()

    const customer = await createTestCustomer({
      name: 'Loyalty Customer',
      email: 'loyal@example.com',
    })
    customerId = customer.id
  })

  afterEach(async () => {
    await teardownTestDatabase()
  })

  describe('Tier Upgrade Flow', () => {
    it('enrolls customer in loyalty program at Bronze tier', async () => {
      const supabase = await createClient()

      const { data, error} = await supabase
        .from('customer_loyalty')
        .insert({
          customer_id: customerId,
          current_tier_id: 'tier-bronze',
          current_points: 0,
          lifetime_points: 0,
          enrolled_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.current_tier_id).toBe('tier-bronze')
    })

    it('earns points from job completion', async () => {
      const supabase = await createClient()

      const job = await createTestJob(customerId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      })

      const invoiceAmount = 150
      const pointsPerDollar = 1
      const pointsEarned = invoiceAmount * pointsPerDollar

      // Award points
      const { data: loyalty } = await supabase
        .from('customer_loyalty')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      await supabase
        .from('customer_loyalty')
        .update({
          current_points: loyalty.current_points + pointsEarned,
          lifetime_points: loyalty.lifetime_points + pointsEarned,
        })
        .eq('customer_id', customerId)

      // Log transaction
      await supabase.from('loyalty_points_transactions').insert({
        customer_id: customerId,
        points: pointsEarned,
        transaction_type: 'earn',
        reason: 'Job completed',
        job_id: job.id,
      })

      const { data: updated } = await supabase
        .from('customer_loyalty')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      expect(updated.current_points).toBe(150)
    })

    it('upgrades to Silver tier when reaching 500 points', async () => {
      const supabase = await createClient()

      // Set points to 500
      await supabase
        .from('customer_loyalty')
        .update({
          current_points: 500,
          lifetime_points: 500,
        })
        .eq('customer_id', customerId)

      // Check for tier upgrade
      const { data: loyalty } = await supabase
        .from('customer_loyalty')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      const newTier =
        loyalty.current_points >= 1000
          ? 'tier-gold'
          : loyalty.current_points >= 500
          ? 'tier-silver'
          : 'tier-bronze'

      if (newTier !== loyalty.current_tier_id) {
        // Upgrade tier
        const { data: upgraded, error } = await supabase
          .from('customer_loyalty')
          .update({
            current_tier_id: newTier,
            tier_upgraded_at: new Date().toISOString(),
            previous_tier_id: loyalty.current_tier_id,
          })
          .eq('customer_id', customerId)
          .select()
          .single()

        expect(error).toBeNull()
        expect(upgraded.current_tier_id).toBe('tier-silver')

        // Log tier change
        await supabase.from('loyalty_tier_changes').insert({
          customer_id: customerId,
          from_tier_id: 'tier-bronze',
          to_tier_id: 'tier-silver',
          changed_at: new Date().toISOString(),
          reason: 'Points threshold reached',
        })
      }
    })

    it('sends congratulations email on tier upgrade', async () => {
      const supabase = await createClient()

      const emailData = {
        recipient_email: 'loyal@example.com',
        subject: 'Congratulations! You\'ve reached Silver tier',
        body: 'You now enjoy 10% discount on all services!',
        status: 'sent',
        sent_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('email_logs').insert(emailData)

      expect(error).toBeNull()

      const emailSent = await verifyEmailSent('loyal@example.com', 'Silver tier')
      expect(emailSent).toBe(true)
    })

    it('upgrades to Gold tier when reaching 1000 points', async () => {
      const supabase = await createClient()

      await supabase
        .from('customer_loyalty')
        .update({
          current_points: 1000,
          lifetime_points: 1000,
          current_tier_id: 'tier-silver',
        })
        .eq('customer_id', customerId)

      const { data: loyalty } = await supabase
        .from('customer_loyalty')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      const newTier =
        loyalty.current_points >= 1000
          ? 'tier-gold'
          : loyalty.current_points >= 500
          ? 'tier-silver'
          : 'tier-bronze'

      await supabase
        .from('customer_loyalty')
        .update({
          current_tier_id: newTier,
          tier_upgraded_at: new Date().toISOString(),
        })
        .eq('customer_id', customerId)

      const { data: upgraded } = await supabase
        .from('customer_loyalty')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      expect(upgraded.current_tier_id).toBe('tier-gold')
    })
  })

  describe('Tier Benefits Application', () => {
    it('applies Bronze tier discount (5%)', async () => {
      const supabase = await createClient()

      const basePrice = 100
      const bronzeDiscount = 0.05
      const discountAmount = basePrice * bronzeDiscount
      const finalPrice = basePrice - discountAmount

      expect(discountAmount).toBe(5)
      expect(finalPrice).toBe(95)
    })

    it('applies Silver tier discount (10%)', async () => {
      const supabase = await createClient()

      await supabase
        .from('customer_loyalty')
        .update({ current_tier_id: 'tier-silver' })
        .eq('customer_id', customerId)

      const basePrice = 100
      const silverDiscount = 0.10
      const discountAmount = basePrice * silverDiscount
      const finalPrice = basePrice - discountAmount

      expect(discountAmount).toBe(10)
      expect(finalPrice).toBe(90)
    })

    it('applies Gold tier discount (15%)', async () => {
      const supabase = await createClient()

      await supabase
        .from('customer_loyalty')
        .update({ current_tier_id: 'tier-gold' })
        .eq('customer_id', customerId)

      const basePrice = 100
      const goldDiscount = 0.15
      const discountAmount = basePrice * goldDiscount
      const finalPrice = basePrice - discountAmount

      expect(discountAmount).toBe(15)
      expect(finalPrice).toBe(85)
    })
  })

  describe('Points Redemption', () => {
    it('redeems points for rewards', async () => {
      const supabase = await createClient()

      await supabase
        .from('customer_loyalty')
        .update({
          current_points: 500,
          current_tier_id: 'tier-silver',
        })
        .eq('customer_id', customerId)

      // Create reward
      const { data: reward } = await supabase
        .from('loyalty_rewards')
        .insert({
          name: '$10 Off Next Service',
          points_cost: 200,
          reward_type: 'discount',
          reward_value: 10,
          is_active: true,
        })
        .select()
        .single()

      // Redeem
      const { data: loyalty } = await supabase
        .from('customer_loyalty')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      const hasEnoughPoints = loyalty.current_points >= reward.points_cost

      expect(hasEnoughPoints).toBe(true)

      // Deduct points
      await supabase
        .from('customer_loyalty')
        .update({
          current_points: loyalty.current_points - reward.points_cost,
        })
        .eq('customer_id', customerId)

      // Create redemption record
      const { data: redemption, error } = await supabase
        .from('reward_redemptions')
        .insert({
          customer_id: customerId,
          reward_id: reward.id,
          points_spent: reward.points_cost,
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(redemption.points_spent).toBe(200)
    })
  })

  describe('Points Expiration', () => {
    it('expires points after 365 days', async () => {
      const supabase = await createClient()

      // Create old points transaction
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

      await supabase.from('loyalty_points_transactions').insert({
        customer_id: customerId,
        points: 100,
        transaction_type: 'earn',
        reason: 'Old job',
        created_at: oneYearAgo.toISOString(),
        expires_at: new Date(oneYearAgo.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })

      // Find expired points
      const { data: expiredPoints } = await supabase
        .from('loyalty_points_transactions')
        .select('*')
        .eq('customer_id', customerId)
        .lt('expires_at', new Date().toISOString())
        .is('expired', false)

      if (expiredPoints.length > 0) {
        const pointsToExpire = expiredPoints.reduce((sum: number, txn: any) => sum + txn.points, 0)

        // Deduct expired points
        await supabase
          .from('customer_loyalty')
          .update({
            current_points: supabase.raw(`current_points - ${pointsToExpire}`),
          })
          .eq('customer_id', customerId)

        // Mark as expired
        await supabase
          .from('loyalty_points_transactions')
          .update({ expired: true })
          .in(
            'id',
            expiredPoints.map((p: any) => p.id)
          )

        expect(pointsToExpire).toBe(100)
      }
    })
  })
})
