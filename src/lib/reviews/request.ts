import { getServiceSupabase } from '@/lib/supabase/server'
import { sendCustomEmail } from '@/lib/email/service'
import { sendSms } from '@/lib/sms/service'
import { renderReviewRequestEmail } from '@/lib/email/templates/review-request'
import { renderReviewRequestSMS } from '@/lib/sms/templates/review-request'

/**
 * Review Request System
 *
 * Handles creation and delivery of review requests to customers.
 * Supports both portal (internal) and Google review flows.
 */

export interface ReviewRequestData {
  customerId: string
  jobId: string
  requestMethod: 'portal' | 'email' | 'sms'
  googleReviewRequested?: boolean
}

export interface ReviewRequestResult {
  success: boolean
  reviewRequestId?: string
  error?: string
  delivered?: boolean
}

/**
 * Create review request
 */
export async function createReviewRequest(
  data: ReviewRequestData
): Promise<ReviewRequestResult> {
  try {
    const supabase = getServiceSupabase()

    // Check if review request already exists for this job
    const { data: existingRequest } = await supabase
      .from('review_requests')
      .select('id')
      .eq('customer_id', data.customerId)
      .eq('job_id', data.jobId)
      .single()

    if (existingRequest) {
      return {
        success: false,
        error: 'Review request already exists for this job',
      }
    }

    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, communication_preferences')
      .eq('id', data.customerId)
      .single()

    if (customerError || !customer) {
      return {
        success: false,
        error: 'Customer not found',
      }
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, service_type, completed_at, total_amount')
      .eq('id', data.jobId)
      .single()

    if (jobError || !job) {
      return {
        success: false,
        error: 'Job not found',
      }
    }

    // Create review request
    const { data: reviewRequest, error: createError } = await (supabase as any)
      .from('review_requests')
      .insert({
        customer_id: data.customerId,
        job_id: data.jobId,
        request_method: data.requestMethod,
        google_review_requested: data.googleReviewRequested || false,
        status: 'pending',
      })
      .select('id')
      .single()

    if (createError || !reviewRequest) {
      return {
        success: false,
        error: createError?.message || 'Failed to create review request',
      }
    }

    // Send review request notification
    const delivered = await sendReviewRequestNotification(
      reviewRequest.id,
      customer,
      job,
      data.requestMethod
    )

    return {
      success: true,
      reviewRequestId: reviewRequest.id,
      delivered,
    }
  } catch (error) {
    console.error('[Reviews] Error creating review request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send review request notification
 */
async function sendReviewRequestNotification(
  reviewRequestId: string,
  customer: any,
  job: any,
  method: 'portal' | 'email' | 'sms'
): Promise<boolean> {
  try {
    const preferences = customer.communication_preferences || {}

    if (method === 'email') {
      // Check if email is enabled and customer has email
      const canEmail = preferences.email_enabled !== false && customer.email
      if (!canEmail) {
        console.log('[Reviews] Cannot send email to customer:', customer.id)
        return false
      }

      // Send email
      const emailSent = await sendReviewRequestEmail(
        reviewRequestId,
        customer,
        job
      )
      return emailSent
    } else if (method === 'sms') {
      // Check if SMS is enabled and customer has phone
      const canSms = preferences.sms_enabled !== false && customer.phone
      if (!canSms) {
        console.log('[Reviews] Cannot send SMS to customer:', customer.id)
        return false
      }

      // Send SMS
      const smsSent = await sendReviewRequestSMS(
        reviewRequestId,
        customer,
        job
      )
      return smsSent
    } else {
      // Portal notification - just create portal notification
      const notificationCreated = await createPortalNotification(
        reviewRequestId,
        customer.id
      )
      return notificationCreated
    }
  } catch (error) {
    console.error('[Reviews] Error sending notification:', error)
    return false
  }
}

/**
 * Send review request email
 */
async function sendReviewRequestEmail(
  reviewRequestId: string,
  customer: any,
  job: any
): Promise<boolean> {
  try {
    const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/reviews/${reviewRequestId}`
    const googleReviewUrl = process.env.GOOGLE_REVIEW_URL

    const subject = "We'd love your feedback! ⭐"

    // Use the new professional template
    const html = renderReviewRequestEmail({
      customerName: customer.full_name,
      serviceType: job.service_type,
      serviceDate: new Date(job.completed_at).toLocaleDateString(),
      jobValue: parseFloat(job.total_amount) || 0,
      reviewUrl,
      googleReviewUrl,
    })

    const result = await sendCustomEmail(
      customer.email,
      subject,
      html
    )

    if (result.success) {
      console.log(`[Reviews] Review request email sent to ${customer.email}`)
      return true
    } else {
      console.error(`[Reviews] Failed to send email: ${result.error}`)
      return false
    }
  } catch (error) {
    console.error('[Reviews] Error sending review email:', error)
    return false
  }
}

/**
 * Send review request SMS
 */
async function sendReviewRequestSMS(
  reviewRequestId: string,
  customer: any,
  job: any
): Promise<boolean> {
  try {
    const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/reviews/${reviewRequestId}`

    // Use the new optimized SMS template
    const message = renderReviewRequestSMS({
      customerName: customer.full_name,
      serviceType: job.service_type,
      reviewUrl,
    })

    await sendSms({
      to: customer.phone,
      message,
    })

    console.log(`[Reviews] Review request SMS sent to ${customer.phone}`)
    return true
  } catch (error) {
    console.error('[Reviews] Error sending review SMS:', error)
    return false
  }
}

/**
 * Create portal notification
 */
async function createPortalNotification(
  reviewRequestId: string,
  customerId: string
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()

    await (supabase as any)
      .from('portal_notifications')
      .insert({
        customer_id: customerId,
        type: 'review_request',
        title: 'Share Your Feedback',
        message: 'We\'d love to hear about your recent service experience!',
        action_url: `/portal/reviews/${reviewRequestId}`,
        action_label: 'Leave Review',
      })

    return true
  } catch (error) {
    console.error('[Reviews] Error creating portal notification:', error)
    return false
  }
}

/**
 * Send follow-up reminder
 */
export async function sendReviewReminder(
  reviewRequestId: string
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()

    // Get review request
    const { data: reviewRequest, error: requestError } = await supabase
      .from('review_requests')
      .select(`
        id,
        request_method,
        customer_id,
        job_id,
        customers (
          id,
          full_name,
          email,
          phone
        ),
        jobs (
          id,
          service_type,
          completed_at
        )
      `)
      .eq('id', reviewRequestId)
      .single()

    if (requestError || !reviewRequest) {
      return false
    }

    const customer = (reviewRequest as any).customers
    const job = (reviewRequest as any).jobs

    // Send reminder via original method
    const sent = await sendReviewRequestNotification(
      reviewRequestId,
      customer,
      job,
      (reviewRequest as any).request_method
    )

    if (sent) {
      // Update reminder_sent flag
      await (supabase as any)
        .from('review_requests')
        .update({
          reminder_sent: true,
          reminder_sent_at: new Date().toISOString(),
        })
        .eq('id', reviewRequestId)
    }

    return sent
  } catch (error) {
    console.error('[Reviews] Error sending reminder:', error)
    return false
  }
}

/**
 * Submit portal review
 */
export async function submitPortalReview(
  reviewRequestId: string,
  rating: number,
  reviewText: string
): Promise<{ success: boolean; error?: string; googleReviewRequested?: boolean }> {
  try {
    const supabase = getServiceSupabase()

    // Validate rating
    if (rating < 1 || rating > 5) {
      return {
        success: false,
        error: 'Rating must be between 1 and 5',
      }
    }

    // Get review request
    const { data: reviewRequest, error: requestError } = await supabase
      .from('review_requests')
      .select('id, google_review_requested, status')
      .eq('id', reviewRequestId)
      .single()

    if (requestError || !reviewRequest) {
      return {
        success: false,
        error: 'Review request not found',
      }
    }

    if ((reviewRequest as any).portal_review_completed) {
      return {
        success: false,
        error: 'Review already submitted',
      }
    }

    // Update review request with portal review
    const { error: updateError } = await (supabase as any)
      .from('review_requests')
      .update({
        portal_review_completed: true,
        portal_review_rating: rating,
        portal_review_text: reviewText,
        portal_review_submitted_at: new Date().toISOString(),
      })
      .eq('id', reviewRequestId)

    if (updateError) {
      return {
        success: false,
        error: updateError.message,
      }
    }

    return {
      success: true,
      googleReviewRequested: (reviewRequest as any).google_review_requested,
    }
  } catch (error) {
    console.error('[Reviews] Error submitting portal review:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Track Google review link click
 */
export async function trackGoogleReviewClick(
  reviewRequestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    const { error } = await (supabase as any)
      .from('review_requests')
      .update({
        google_review_link_clicked: true,
        google_review_clicked_at: new Date().toISOString(),
      })
      .eq('id', reviewRequestId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Reviews] Error tracking Google review click:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Create staff response to review
 */
export async function createReviewResponse(
  reviewRequestId: string,
  responseType: 'thank_you' | 'issue_follow_up' | 'general',
  responseText: string,
  userId: string,
  deliveryMethod?: 'email' | 'sms' | 'phone' | 'portal'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getServiceSupabase()

    const { error } = await (supabase as any)
      .from('review_responses')
      .insert({
        review_request_id: reviewRequestId,
        response_type: responseType,
        response_text: responseText,
        responded_by_user_id: userId,
        delivery_method: deliveryMethod || 'portal',
        sent_at: new Date().toISOString(),
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Reviews] Error creating review response:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
