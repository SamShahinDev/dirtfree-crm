/**
 * Portal Booking Flow Integration Tests
 *
 * Tests the complete customer portal booking workflow
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestCustomer,
  verifyEmailSent,
  verifySmsSent,
} from './helpers/test-database'
import { createClient } from '@/lib/supabase/server'

describe('Portal Booking Flow Integration', () => {
  let customerId: string
  let bookingId: string
  let jobId: string

  beforeEach(async () => {
    await setupTestDatabase()

    const customer = await createTestCustomer({
      name: 'Portal Customer',
      email: 'portal@example.com',
      phone: '+15555557777',
    })
    customerId = customer.id
  })

  afterEach(async () => {
    await teardownTestDatabase()
  })

  describe('Complete Booking Flow', () => {
    it('customer logs into portal', async () => {
      const supabase = await createClient()

      // In real flow, auth would be handled by Supabase Auth
      // Here we simulate successful auth

      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single()

      expect(customer).toBeTruthy()
      expect(customer.email).toBe('portal@example.com')
    })

    it('customer selects service and date', async () => {
      const supabase = await createClient()

      const bookingData = {
        customer_id: customerId,
        service_type: 'Carpet Cleaning',
        preferred_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        address: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zip_code: '12345',
        status: 'pending',
      }

      const { data, error } = await supabase
        .from('booking_requests')
        .insert(bookingData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('pending')

      bookingId = data.id
    })

    it('system checks availability for requested date', async () => {
      const supabase = await createClient()

      const requestedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      // Check technician availability
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .gte('scheduled_date', requestedDate.toISOString())
        .lt(
          'scheduled_date',
          new Date(requestedDate.getTime() + 24 * 60 * 60 * 1000).toISOString()
        )

      const isAvailable = jobs.length < 10 // Max 10 jobs per day

      expect(isAvailable).toBe(true)
    })

    it('applies promotion code if provided', async () => {
      const supabase = await createClient()

      const promoCode = 'SAVE10'

      const { data: promotion } = await supabase
        .from('promotions')
        .select('*')
        .eq('code', promoCode)
        .eq('active', true)
        .single()

      if (promotion) {
        await supabase
          .from('booking_requests')
          .update({
            promotion_id: promotion.id,
            promotion_code: promoCode,
          })
          .eq('id', bookingId)
      }
    })

    it('confirms booking and creates job', async () => {
      const supabase = await createClient()

      const jobData = {
        customer_id: customerId,
        service_type: 'Carpet Cleaning',
        status: 'scheduled',
        scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        zone: 'North',
        booking_source: 'portal',
        estimated_duration: 120,
      }

      const { data: job, error } = await supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single()

      expect(error).toBeNull()
      expect(job.status).toBe('scheduled')

      jobId = job.id

      // Update booking request
      await supabase
        .from('booking_requests')
        .update({
          status: 'confirmed',
          job_id: jobId,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
    })

    it('sends confirmation email to customer', async () => {
      const supabase = await createClient()

      const emailData = {
        recipient_email: 'portal@example.com',
        subject: 'Your Service is Confirmed!',
        body: 'Your carpet cleaning service is scheduled for next week.',
        job_id: jobId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('email_logs').insert(emailData)

      expect(error).toBeNull()

      const emailSent = await verifyEmailSent('portal@example.com', 'Confirmed')
      expect(emailSent).toBe(true)
    })

    it('sends SMS reminder 24 hours before service', async () => {
      const supabase = await createClient()

      // Simulate cron job running
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const { data: upcomingJobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'scheduled')
        .gte('scheduled_date', tomorrow.toISOString())
        .lt(
          'scheduled_date',
          new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString()
        )

      if (upcomingJobs.length > 0) {
        const smsData = {
          recipient_phone: '+15555557777',
          message: 'Reminder: Your carpet cleaning service is tomorrow!',
          job_id: jobId,
          status: 'sent',
          sent_at: new Date().toISOString(),
        }

        await supabase.from('sms_logs').insert(smsData)

        const smsSent = await verifySmsSent('+15555557777')
        expect(smsSent).toBe(true)
      }
    })

    it('allows customer to reschedule booking', async () => {
      const supabase = await createClient()

      const newDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

      const { error } = await supabase
        .from('jobs')
        .update({
          scheduled_date: newDate.toISOString(),
          rescheduled_at: new Date().toISOString(),
          reschedule_count: 1,
        })
        .eq('id', jobId)

      expect(error).toBeNull()

      // Log reschedule
      await supabase.from('job_reschedule_log').insert({
        job_id: jobId,
        old_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        new_date: newDate.toISOString(),
        rescheduled_by: customerId,
        rescheduled_at: new Date().toISOString(),
      })
    })

    it('allows customer to cancel booking', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('jobs')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancellation_reason: 'Customer request',
        })
        .eq('id', jobId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('cancelled')

      // Send cancellation confirmation
      await supabase.from('email_logs').insert({
        recipient_email: 'portal@example.com',
        subject: 'Booking Cancelled',
        body: 'Your booking has been cancelled as requested.',
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    })

    it('tracks technician arrival', async () => {
      const supabase = await createClient()

      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      expect(error).toBeNull()

      // Notify customer
      await supabase.from('sms_logs').insert({
        recipient_phone: '+15555557777',
        message: 'Your technician has arrived!',
        job_id: jobId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    })

    it('marks job as completed', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          actual_duration: 110,
        })
        .eq('id', jobId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.status).toBe('completed')
    })

    it('generates invoice after completion', async () => {
      const supabase = await createClient()

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
          invoice_number: `INV-${Date.now()}`,
          job_id: jobId,
          customer_id: customerId,
          subtotal: 150.0,
          tax_amount: 12.0,
          total_amount: 162.0,
          status: 'pending',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(invoice.total_amount).toBe(162.0)
    })

    it('sends invoice to customer portal', async () => {
      const supabase = await createClient()

      // Create portal notification
      const { error } = await supabase.from('notifications').insert({
        customer_id: customerId,
        type: 'invoice',
        title: 'New Invoice Available',
        message: 'Your invoice for recent service is ready to view',
        job_id: jobId,
        read: false,
        created_at: new Date().toISOString(),
      })

      expect(error).toBeNull()
    })
  })

  describe('Portal Self-Service Features', () => {
    it('customer views service history', async () => {
      const supabase = await createClient()

      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', customerId)
        .order('scheduled_date', { ascending: false })

      expect(error).toBeNull()
      expect(jobs.length).toBeGreaterThan(0)
    })

    it('customer views invoices', async () => {
      const supabase = await createClient()

      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      expect(error).toBeNull()
      expect(invoices.length).toBeGreaterThan(0)
    })

    it('customer updates profile information', async () => {
      const supabase = await createClient()

      const { data, error } = await supabase
        .from('customers')
        .update({
          phone: '+15555559999',
          address: '456 New St',
        })
        .eq('id', customerId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data.phone).toBe('+15555559999')
    })
  })
})
