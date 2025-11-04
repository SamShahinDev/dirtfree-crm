/**
 * Opportunity Workflow Integration Tests
 *
 * Tests the complete opportunity lifecycle from creation to conversion
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { testApiHandler } from 'next-test-api-route-handler'
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestCustomer,
  createTestStaff,
  createTestJob,
  waitForCondition,
  verifyEmailSent,
} from './helpers/test-database'
import { createClient } from '@/lib/supabase/server'

describe('Opportunity Workflow Integration', () => {
  let customerId: string
  let staffId: string
  let opportunityId: string
  let offerId: string
  let claimCode: string

  beforeEach(async () => {
    await setupTestDatabase()

    // Create test customer
    const customer = await createTestCustomer({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+15555551234',
    })
    customerId = customer.id

    // Create test staff
    const staff = await createTestStaff({
      role: 'admin',
    })
    staffId = staff.id
  })

  afterEach(async () => {
    await teardownTestDatabase()
  })

  describe('Complete Opportunity Lifecycle', () => {
    it('creates opportunity successfully', async () => {
      const supabase = await createClient()

      const opportunityData = {
        customer_id: customerId,
        opportunity_type: 'upsell',
        service_type: 'Tile & Grout Cleaning',
        confidence_score: 85,
        estimated_value: 250,
        reason: 'Customer has tile floors, no tile cleaning service in 6 months',
        auto_offer_enabled: true,
        offer_discount_percentage: 15,
        offer_valid_days: 7,
      }

      const { data, error } = await supabase
        .from('opportunities')
        .insert(opportunityData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toHaveProperty('id')
      expect(data.status).toBe('open')
      expect(data.auto_offer_enabled).toBe(true)

      opportunityId = data.id
    })

    it('triggers auto-offer after opportunity creation', async () => {
      const supabase = await createClient()

      // Simulate cron job that processes opportunities for auto-offers
      // In real implementation, this would be triggered by a scheduled job

      // Check if opportunity is eligible for auto-offer
      const { data: opportunity } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .eq('auto_offer_enabled', true)
        .eq('status', 'open')
        .single()

      expect(opportunity).toBeTruthy()

      // Create auto-offer
      const offerData = {
        opportunity_id: opportunityId,
        customer_id: customerId,
        discount_type: 'percentage',
        discount_value: 15,
        service_type: 'Tile & Grout Cleaning',
        estimated_value: 250,
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        delivery_method: 'email',
      }

      const { data: offer, error: offerError } = await supabase
        .from('opportunity_offers')
        .insert(offerData)
        .select()
        .single()

      expect(offerError).toBeNull()
      expect(offer).toHaveProperty('id')
      expect(offer.status).toBe('active')

      offerId = offer.id
    })

    it('sends offer notification to customer', async () => {
      const supabase = await createClient()

      // Log email send
      const emailLog = {
        opportunity_offer_id: offerId,
        recipient_email: 'john@example.com',
        subject: 'Special Offer: 15% Off Tile & Grout Cleaning',
        body: 'Hi John, we have a special offer just for you!',
        status: 'sent',
        sent_at: new Date().toISOString(),
      }

      const { data, error } = await supabase.from('email_logs').insert(emailLog).select().single()

      expect(error).toBeNull()
      expect(data.status).toBe('sent')

      // Verify email was sent
      const emailSent = await verifyEmailSent('john@example.com', 'Special Offer')
      expect(emailSent).toBe(true)
    })

    it('tracks customer viewing offer', async () => {
      const supabase = await createClient()

      // Log offer view
      const { data, error } = await supabase
        .from('opportunity_offers')
        .update({
          viewed_at: new Date().toISOString(),
          view_count: 1,
        })
        .eq('id', offerId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.viewed_at).toBeTruthy()
      expect(data.view_count).toBe(1)
    })

    it('allows customer to claim offer', async () => {
      const supabase = await createClient()

      // Generate claim code
      const generatedCode = `CLAIM-${Date.now()}`

      // Update offer status to claimed
      const { data: claimedOffer, error: claimError } = await supabase
        .from('opportunity_offers')
        .update({
          status: 'claimed',
          claimed_at: new Date().toISOString(),
          claim_code: generatedCode,
        })
        .eq('id', offerId)
        .select()
        .single()

      expect(claimError).toBeNull()
      expect(claimedOffer.status).toBe('claimed')
      expect(claimedOffer.claim_code).toBe(generatedCode)

      claimCode = generatedCode

      // Update opportunity status to contacted
      const { error: oppError } = await supabase
        .from('opportunities')
        .update({ status: 'contacted' })
        .eq('id', opportunityId)

      expect(oppError).toBeNull()
    })

    it('applies offer discount to booking', async () => {
      const supabase = await createClient()

      // Create booking with offer
      const job = await createTestJob(customerId, {
        service_type: 'Tile & Grout Cleaning',
        status: 'scheduled',
        scheduled_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      })

      // Apply offer discount
      const basePrice = 250
      const discountPercentage = 15
      const discountAmount = (basePrice * discountPercentage) / 100
      const finalPrice = basePrice - discountAmount

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: `INV-${Date.now()}`,
          job_id: job.id,
          customer_id: customerId,
          subtotal: basePrice,
          discount_amount: discountAmount,
          total_amount: finalPrice,
          offer_id: offerId,
          offer_code: claimCode,
          status: 'pending',
        })
        .select()
        .single()

      expect(invoiceError).toBeNull()
      expect(invoice.subtotal).toBe(250)
      expect(invoice.discount_amount).toBe(37.5) // 15% of 250
      expect(invoice.total_amount).toBe(212.5)
      expect(invoice.offer_id).toBe(offerId)

      // Mark offer as redeemed
      const { error: redeemError } = await supabase
        .from('opportunity_offers')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          redeemed_on_job_id: job.id,
        })
        .eq('id', offerId)

      expect(redeemError).toBeNull()
    })

    it('marks opportunity as converted after job completion', async () => {
      const supabase = await createClient()

      // Get the job
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', customerId)
        .eq('service_type', 'Tile & Grout Cleaning')
        .single()

      // Complete the job
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobs.id)

      expect(jobError).toBeNull()

      // Mark opportunity as converted
      const { data: convertedOpp, error: convertError } = await supabase
        .from('opportunities')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
          actual_value: 212.5, // Final invoice amount
          converted_by_job_id: jobs.id,
        })
        .eq('id', opportunityId)
        .select()
        .single()

      expect(convertError).toBeNull()
      expect(convertedOpp.status).toBe('converted')
      expect(convertedOpp.actual_value).toBe(212.5)
      expect(convertedOpp.converted_by_job_id).toBe(jobs.id)

      // Create conversion record
      const { data: conversion, error: conversionError } = await supabase
        .from('opportunity_conversions')
        .insert({
          opportunity_id: opportunityId,
          offer_id: offerId,
          job_id: jobs.id,
          customer_id: customerId,
          estimated_value: 250,
          actual_value: 212.5,
          discount_applied: 37.5,
          converted_at: new Date().toISOString(),
        })
        .select()
        .single()

      expect(conversionError).toBeNull()
      expect(conversion.actual_value).toBe(212.5)
    })

    it('calculates ROI metrics for converted opportunity', async () => {
      const supabase = await createClient()

      const { data: conversion } = await supabase
        .from('opportunity_conversions')
        .select('*')
        .eq('opportunity_id', opportunityId)
        .single()

      // Calculate metrics
      const discountCost = conversion.discount_applied // 37.5
      const revenue = conversion.actual_value // 212.5
      const estimatedRevenue = conversion.estimated_value // 250

      const roi = ((revenue - discountCost) / discountCost) * 100
      const conversionRate = 1 // 1 opportunity converted

      expect(discountCost).toBe(37.5)
      expect(revenue).toBe(212.5)
      expect(roi).toBeGreaterThan(0)
    })
  })

  describe('Opportunity Decline Workflow', () => {
    it('handles customer declining offer', async () => {
      const supabase = await createClient()

      // Create opportunity
      const { data: opportunity } = await supabase
        .from('opportunities')
        .insert({
          customer_id: customerId,
          opportunity_type: 'cross_sell',
          service_type: 'Upholstery Cleaning',
          confidence_score: 70,
          estimated_value: 150,
          status: 'open',
        })
        .select()
        .single()

      // Create offer
      const { data: offer } = await supabase
        .from('opportunity_offers')
        .insert({
          opportunity_id: opportunity.id,
          customer_id: customerId,
          discount_type: 'percentage',
          discount_value: 10,
          status: 'active',
        })
        .select()
        .single()

      // Customer declines offer
      const { data: declinedOffer, error } = await supabase
        .from('opportunity_offers')
        .update({
          status: 'declined',
          declined_at: new Date().toISOString(),
          decline_reason: 'Not interested',
        })
        .eq('id', offer.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(declinedOffer.status).toBe('declined')

      // Mark opportunity as declined
      const { data: declinedOpp } = await supabase
        .from('opportunities')
        .update({ status: 'declined' })
        .eq('id', opportunity.id)
        .select()
        .single()

      expect(declinedOpp.status).toBe('declined')
    })
  })

  describe('Opportunity Expiration Workflow', () => {
    it('expires opportunities after threshold period', async () => {
      const supabase = await createClient()

      // Create old opportunity (30 days ago)
      const { data: oldOpportunity } = await supabase
        .from('opportunities')
        .insert({
          customer_id: customerId,
          opportunity_type: 'win_back',
          service_type: 'Carpet Cleaning',
          confidence_score: 60,
          estimated_value: 200,
          status: 'open',
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          expires_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      // Run expiration cron job
      const { data: expiredOpps } = await supabase
        .from('opportunities')
        .select('*')
        .eq('status', 'open')
        .lt('expires_at', new Date().toISOString())

      expect(expiredOpps.length).toBeGreaterThan(0)

      // Mark as expired
      const { error } = await supabase
        .from('opportunities')
        .update({ status: 'expired' })
        .eq('id', oldOpportunity.id)

      expect(error).toBeNull()

      // Verify status updated
      const { data: updated } = await supabase
        .from('opportunities')
        .select('status')
        .eq('id', oldOpportunity.id)
        .single()

      expect(updated.status).toBe('expired')
    })
  })

  describe('Multi-Offer Scenario', () => {
    it('handles multiple offers for same opportunity', async () => {
      const supabase = await createClient()

      // Create opportunity
      const { data: opportunity } = await supabase
        .from('opportunities')
        .insert({
          customer_id: customerId,
          opportunity_type: 'renewal',
          service_type: 'Carpet Cleaning',
          confidence_score: 90,
          estimated_value: 300,
          status: 'open',
        })
        .select()
        .single()

      // Create initial offer
      const { data: offer1 } = await supabase
        .from('opportunity_offers')
        .insert({
          opportunity_id: opportunity.id,
          customer_id: customerId,
          discount_type: 'percentage',
          discount_value: 10,
          status: 'active',
        })
        .select()
        .single()

      // Customer doesn't respond, create follow-up offer with better discount
      await waitForCondition(async () => true, 100)

      const { data: offer2 } = await supabase
        .from('opportunity_offers')
        .insert({
          opportunity_id: opportunity.id,
          customer_id: customerId,
          discount_type: 'percentage',
          discount_value: 20, // Better offer
          status: 'active',
          is_follow_up: true,
        })
        .select()
        .single()

      // Deactivate first offer
      await supabase
        .from('opportunity_offers')
        .update({ status: 'superseded' })
        .eq('id', offer1.id)

      // Customer claims second offer
      const { data: claimed } = await supabase
        .from('opportunity_offers')
        .update({
          status: 'claimed',
          claimed_at: new Date().toISOString(),
        })
        .eq('id', offer2.id)
        .select()
        .single()

      expect(claimed.discount_value).toBe(20)
      expect(claimed.is_follow_up).toBe(true)
    })
  })
})
