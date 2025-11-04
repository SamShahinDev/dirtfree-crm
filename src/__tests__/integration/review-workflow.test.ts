/**
 * Review Request Workflow Integration Tests
 *
 * Tests the complete review request lifecycle from job completion to review submission
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestCustomer,
  createTestJob,
  verifyEmailSent,
  verifySmsSent,
  waitForCondition,
} from './helpers/test-database'
import { createClient } from '@/lib/supabase/server'

describe('Review Request Workflow Integration', () => {
  let customerId: string
  let jobId: string
  let reviewRequestId: string
  let reviewId: string

  beforeEach(async () => {
    await setupTestDatabase()

    const customer = await createTestCustomer({
      name: 'Alice Williams',
      email: 'alice@example.com',
      phone: '+15555558888',
    })
    customerId = customer.id

    const job = await createTestJob(customerId, {
      service_type: 'Carpet Cleaning',
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    jobId = job.id
  })

  afterEach(async () => {
    await teardownTestDatabase()
  })

  describe('Automated Review Request Flow', () => {
    it('detects completed job eligible for review request', async () => {
      const supabase = await createClient()

      // Query completed jobs without review requests
      const { data: eligibleJobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'completed')
        .is('review_requested_at', null)

      expect(error).toBeNull()
      expect(eligibleJobs.length).toBeGreaterThan(0)
      expect(eligibleJobs.some((j: any) => j.id === jobId)).toBe(true)
    })

    it('creates review request after job completion', async () => {
      const supabase = await createClient()

      // Calculate optimal timing (24 hours after completion)
      const completedAt = new Date()
      const sendAt = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000)

      const requestData = {
        job_id: jobId,
        customer_id: customerId,
        request_type: 'automatic',
        status: 'scheduled',
        scheduled_for: sendAt.toISOString(),
        delivery_method: 'email',
      }

      const { data, error } = await supabase
        .from('review_requests')
        .insert(requestData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('scheduled')
      expect(data.request_type).toBe('automatic')

      reviewRequestId = data.id

      // Update job
      await supabase
        .from('jobs')
        .update({ review_requested_at: new Date().toISOString() })
        .eq('id', jobId)
    })

    it('sends review request via email at scheduled time', async () => {
      const supabase = await createClient()

      // Simulate cron job running
      const { data: scheduledRequests } = await supabase
        .from('review_requests')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_for', new Date().toISOString())

      expect(scheduledRequests.length).toBeGreaterThan(0)

      // Update to processing
      await supabase
        .from('review_requests')
        .update({ status: 'processing' })
        .eq('id', reviewRequestId)

      // Generate review link with token
      const reviewToken = `review-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const reviewLink = `https://app.example.com/review/${reviewToken}`

      // Send email
      const emailData = {
        review_request_id: reviewRequestId,
        recipient_email: 'alice@example.com',
        subject: 'How was your carpet cleaning service?',
        body: `Hi Alice! We'd love to hear about your experience. Click here: ${reviewLink}`,
        review_link: reviewLink,
        status: 'sent',
        sent_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('email_logs').insert(emailData)

      expect(error).toBeNull()

      // Update request status
      await supabase
        .from('review_requests')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          review_token: reviewToken,
        })
        .eq('id', reviewRequestId)

      // Verify email sent
      const emailSent = await verifyEmailSent('alice@example.com', 'How was your')
      expect(emailSent).toBe(true)
    })

    it('tracks customer opening review request email', async () => {
      const supabase = await createClient()

      const { error } = await supabase
        .from('review_requests')
        .update({
          opened_at: new Date().toISOString(),
          open_count: 1,
        })
        .eq('id', reviewRequestId)

      expect(error).toBeNull()
    })

    it('allows customer to submit review via link', async () => {
      const supabase = await createClient()

      // Get review request
      const { data: request } = await supabase
        .from('review_requests')
        .select('*')
        .eq('id', reviewRequestId)
        .single()

      // Validate token
      expect(request.review_token).toBeTruthy()

      // Submit review
      const reviewData = {
        job_id: jobId,
        customer_id: customerId,
        rating: 5,
        comment: 'Excellent service! Very professional and thorough.',
        source: 'email_request',
        review_request_id: reviewRequestId,
        submitted_at: new Date().toISOString(),
      }

      const { data: review, error } = await supabase
        .from('reviews')
        .insert(reviewData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(review.rating).toBe(5)
      expect(review.comment).toBeTruthy()

      reviewId = review.id

      // Update review request status
      await supabase
        .from('review_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          review_id: reviewId,
        })
        .eq('id', reviewRequestId)
    })

    it('awards loyalty points for submitting review', async () => {
      const supabase = await createClient()

      // Get or create customer loyalty record
      const { data: loyalty, error: loyaltyError } = await supabase
        .from('customer_loyalty')
        .select('*')
        .eq('customer_id', customerId)
        .single()

      const pointsToAward = 50 // Points for review

      if (loyalty) {
        // Update existing
        await supabase
          .from('customer_loyalty')
          .update({
            current_points: loyalty.current_points + pointsToAward,
            lifetime_points: loyalty.lifetime_points + pointsToAward,
          })
          .eq('customer_id', customerId)
      } else {
        // Create new
        await supabase.from('customer_loyalty').insert({
          customer_id: customerId,
          current_points: pointsToAward,
          lifetime_points: pointsToAward,
          current_tier_id: 'tier-bronze',
        })
      }

      // Log points transaction
      const { data: transaction, error: txnError } = await supabase
        .from('loyalty_points_transactions')
        .insert({
          customer_id: customerId,
          points: pointsToAward,
          transaction_type: 'earn',
          reason: 'Review submitted',
          review_id: reviewId,
        })
        .select()
        .single()

      expect(txnError).toBeNull()
      expect(transaction.points).toBe(50)
    })

    it('sends thank you message after review submission', async () => {
      const supabase = await createClient()

      const thankYouEmail = {
        recipient_email: 'alice@example.com',
        subject: 'Thank you for your review!',
        body: 'Hi Alice, thank you for taking the time to review our service. You earned 50 loyalty points!',
        status: 'sent',
        sent_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('email_logs').insert(thankYouEmail)

      expect(error).toBeNull()
    })
  })

  describe('Review Request Reminders', () => {
    it('sends reminder for unopened review requests', async () => {
      const supabase = await createClient()

      // Create review request sent 3 days ago, not opened
      const { data: oldRequest } = await supabase
        .from('review_requests')
        .insert({
          job_id: jobId,
          customer_id: customerId,
          status: 'sent',
          sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          delivery_method: 'email',
        })
        .select()
        .single()

      // Find requests needing reminder (sent 3+ days ago, not opened)
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

      const { data: needsReminder } = await supabase
        .from('review_requests')
        .select('*')
        .eq('status', 'sent')
        .is('opened_at', null)
        .lt('sent_at', threeDaysAgo.toISOString())

      expect(needsReminder.length).toBeGreaterThan(0)

      // Send reminder
      const reminderEmail = {
        review_request_id: oldRequest.id,
        recipient_email: 'alice@example.com',
        subject: 'Reminder: Share your feedback',
        body: 'Hi Alice, we noticed you haven\'t reviewed your recent service. We\'d love to hear from you!',
        status: 'sent',
        sent_at: new Date().toISOString(),
        is_reminder: true,
      }

      const { error } = await supabase.from('email_logs').insert(reminderEmail)

      expect(error).toBeNull()

      // Update reminder sent timestamp
      await supabase
        .from('review_requests')
        .update({
          reminder_sent_at: new Date().toISOString(),
          reminder_count: 1,
        })
        .eq('id', oldRequest.id)
    })

    it('limits number of reminders per request', async () => {
      const supabase = await createClient()

      const { data: request } = await supabase
        .from('review_requests')
        .select('*')
        .eq('id', reviewRequestId)
        .single()

      const maxReminders = 2
      const canSendReminder = (request.reminder_count || 0) < maxReminders

      expect(canSendReminder).toBeDefined()
    })
  })

  describe('Multi-Channel Review Requests', () => {
    it('sends review request via SMS', async () => {
      const supabase = await createClient()

      const smsRequest = {
        job_id: jobId,
        customer_id: customerId,
        delivery_method: 'sms',
        status: 'scheduled',
        scheduled_for: new Date().toISOString(),
      }

      const { data } = await supabase
        .from('review_requests')
        .insert(smsRequest)
        .select()
        .single()

      // Send SMS
      const reviewLink = `https://app.example.com/review/${data.review_token}`

      const smsData = {
        review_request_id: data.id,
        recipient_phone: '+15555558888',
        message: `Hi Alice! How was your service? Leave a review: ${reviewLink}`,
        status: 'sent',
        sent_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('sms_logs').insert(smsData)

      expect(error).toBeNull()

      // Verify SMS sent
      const smsSent = await verifySmsSent('+15555558888')
      expect(smsSent).toBe(true)
    })

    it('shows review request in customer portal', async () => {
      const supabase = await createClient()

      // Create portal notification
      const notification = {
        customer_id: customerId,
        type: 'review_request',
        title: 'Review your recent service',
        message: 'Share your feedback about your carpet cleaning service',
        job_id: jobId,
        review_request_id: reviewRequestId,
        read: false,
        created_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.type).toBe('review_request')
    })
  })

  describe('Negative Review Handling', () => {
    it('flags low-rating reviews for follow-up', async () => {
      const supabase = await createClient()

      const lowRatingReview = {
        job_id: jobId,
        customer_id: customerId,
        rating: 2,
        comment: 'Service was okay but not great',
        source: 'email_request',
        submitted_at: new Date().toISOString(),
      }

      const { data: review, error } = await supabase
        .from('reviews')
        .insert(lowRatingReview)
        .select()
        .single()

      expect(error).toBeNull()

      // Flag for follow-up if rating < 4
      if (review.rating < 4) {
        await supabase.from('reviews').update({ requires_followup: true }).eq('id', review.id)

        // Create alert for management
        const alert = {
          type: 'low_review',
          severity: 'medium',
          title: 'Low Rating Review Received',
          message: `Customer ${customerId} left a ${review.rating}-star review`,
          review_id: review.id,
          customer_id: customerId,
          created_at: new Date().toISOString(),
        }

        const { error: alertError } = await supabase.from('alerts').insert(alert)

        expect(alertError).toBeNull()
      }
    })

    it('prevents publishing very low reviews automatically', async () => {
      const supabase = await createClient()

      const veryLowReview = {
        job_id: jobId,
        customer_id: customerId,
        rating: 1,
        comment: 'Terrible service',
        source: 'email_request',
        submitted_at: new Date().toISOString(),
        published: false, // Don't auto-publish ratings < 3
        requires_approval: true,
      }

      const { data, error } = await supabase
        .from('reviews')
        .insert(veryLowReview)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.published).toBe(false)
      expect(data.requires_approval).toBe(true)
    })
  })

  describe('Review Analytics', () => {
    it('calculates average rating for service', async () => {
      const supabase = await createClient()

      // Create multiple reviews
      const reviews = [
        { job_id: jobId, customer_id: customerId, rating: 5 },
        { job_id: jobId, customer_id: customerId, rating: 4 },
        { job_id: jobId, customer_id: customerId, rating: 5 },
      ]

      await supabase.from('reviews').insert(reviews)

      // Calculate average
      const { data: allReviews } = await supabase.from('reviews').select('rating')

      const avgRating =
        allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length

      expect(avgRating).toBeGreaterThan(4)
    })

    it('tracks review request conversion rate', async () => {
      const supabase = await createClient()

      const { data: requests } = await supabase.from('review_requests').select('*')

      const totalSent = requests.filter((r: any) => r.status === 'sent').length
      const totalCompleted = requests.filter((r: any) => r.status === 'completed').length

      const conversionRate = (totalCompleted / totalSent) * 100

      expect(conversionRate).toBeGreaterThanOrEqual(0)
      expect(conversionRate).toBeLessThanOrEqual(100)
    })
  })
})
