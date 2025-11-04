import { getServiceSupabase } from '@/lib/supabase/server'
import { createReviewRequest } from './request'

/**
 * Automated Review Request System
 *
 * Triggers review requests after job completion with eligibility checks.
 * Ensures only qualified jobs receive review requests.
 */

export interface EligibilityCheck {
  eligible: boolean
  reason?: string
  jobId: string
  customerId?: string
}

export interface AutoRequestResult {
  success: boolean
  reviewRequestId?: string
  delivered?: boolean
  error?: string
  skipped?: boolean
  skipReason?: string
}

/**
 * Minimum job value to request review
 * Jobs below this amount won't trigger review requests
 */
const MIN_JOB_VALUE = 50

/**
 * Check if customer is eligible for review request
 */
export async function checkReviewEligibility(jobId: string): Promise<EligibilityCheck> {
  try {
    const supabase = getServiceSupabase()

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        customer_id,
        status,
        total_amount,
        completed_at,
        customers (
          id,
          full_name,
          email,
          phone,
          communication_preferences
        )
      `)
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return {
        eligible: false,
        reason: 'Job not found',
        jobId,
      }
    }

    const customer = (job as any).customers

    if (!customer) {
      return {
        eligible: false,
        reason: 'Customer not found',
        jobId,
      }
    }

    // Check 1: Job must be completed
    if ((job as any).status !== 'completed') {
      return {
        eligible: false,
        reason: 'Job not completed',
        jobId,
        customerId: customer.id,
      }
    }

    // Check 2: Job must have completion date
    if (!(job as any).completed_at) {
      return {
        eligible: false,
        reason: 'No completion date',
        jobId,
        customerId: customer.id,
      }
    }

    // Check 3: Job value must meet minimum threshold
    const jobValue = parseFloat((job as any).total_amount) || 0
    if (jobValue < MIN_JOB_VALUE) {
      return {
        eligible: false,
        reason: `Job value ($${jobValue}) below minimum threshold ($${MIN_JOB_VALUE})`,
        jobId,
        customerId: customer.id,
      }
    }

    // Check 4: No existing review request for this job
    const { data: existingRequest } = await supabase
      .from('review_requests')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('job_id', jobId)
      .single()

    if (existingRequest) {
      return {
        eligible: false,
        reason: 'Review request already exists',
        jobId,
        customerId: customer.id,
      }
    }

    // Check 5: Customer hasn't opted out of review requests
    const preferences = customer.communication_preferences || {}

    // Check if customer has explicitly opted out of reviews
    if (preferences.review_requests_enabled === false) {
      return {
        eligible: false,
        reason: 'Customer opted out of review requests',
        jobId,
        customerId: customer.id,
      }
    }

    // Check if customer has opted out of ALL communications
    if (
      preferences.email_enabled === false &&
      preferences.sms_enabled === false &&
      preferences.portal_notifications_enabled === false
    ) {
      return {
        eligible: false,
        reason: 'Customer opted out of all communications',
        jobId,
        customerId: customer.id,
      }
    }

    // All checks passed
    return {
      eligible: true,
      jobId,
      customerId: customer.id,
    }
  } catch (error) {
    console.error('[Auto-Request] Error checking eligibility:', error)
    return {
      eligible: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
      jobId,
    }
  }
}

/**
 * Determine if customer is high-value for SMS eligibility
 */
export async function isHighValueCustomer(customerId: string): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()

    const { data: customer } = await supabase
      .from('customers')
      .select('lifetime_value, total_jobs')
      .eq('id', customerId)
      .single()

    if (!customer) return false

    const lifetimeValue = (customer as any).lifetime_value || 0
    const totalJobs = (customer as any).total_jobs || 0

    // High-value criteria:
    // - Lifetime value > $500 OR
    // - Total jobs >= 3
    return lifetimeValue > 500 || totalJobs >= 3
  } catch (error) {
    console.error('[Auto-Request] Error checking high-value status:', error)
    return false
  }
}

/**
 * Determine best delivery method for review request
 */
export async function determineDeliveryMethod(
  customerId: string
): Promise<{
  method: 'portal' | 'email' | 'sms'
  useSMS: boolean
  useEmail: boolean
  usePortal: boolean
}> {
  try {
    const supabase = getServiceSupabase()

    const { data: customer } = await supabase
      .from('customers')
      .select('email, phone, communication_preferences')
      .eq('id', customerId)
      .single()

    if (!customer) {
      return {
        method: 'portal',
        useSMS: false,
        useEmail: false,
        usePortal: true,
      }
    }

    const preferences = (customer as any).communication_preferences || {}
    const hasEmail = !!(customer as any).email
    const hasPhone = !!(customer as any).phone

    // Always use portal notification
    const usePortal = preferences.portal_notifications_enabled !== false

    // Email preferred if enabled and available
    const useEmail =
      preferences.email_enabled !== false &&
      hasEmail

    // SMS only for high-value customers
    const isHighValue = await isHighValueCustomer(customerId)
    const useSMS =
      preferences.sms_enabled !== false &&
      hasPhone &&
      isHighValue

    // Determine primary method
    let method: 'portal' | 'email' | 'sms' = 'portal'
    if (useEmail) {
      method = 'email'
    } else if (useSMS) {
      method = 'sms'
    }

    return {
      method,
      useSMS,
      useEmail,
      usePortal,
    }
  } catch (error) {
    console.error('[Auto-Request] Error determining delivery method:', error)
    return {
      method: 'portal',
      useSMS: false,
      useEmail: false,
      usePortal: true,
    }
  }
}

/**
 * Create automated review request for eligible job
 */
export async function createAutoReviewRequest(jobId: string): Promise<AutoRequestResult> {
  try {
    // Check eligibility
    const eligibility = await checkReviewEligibility(jobId)

    if (!eligibility.eligible) {
      console.log(`[Auto-Request] Job ${jobId} not eligible: ${eligibility.reason}`)
      return {
        success: false,
        skipped: true,
        skipReason: eligibility.reason,
      }
    }

    if (!eligibility.customerId) {
      return {
        success: false,
        error: 'Customer ID not found',
      }
    }

    // Determine delivery method
    const delivery = await determineDeliveryMethod(eligibility.customerId)

    console.log(`[Auto-Request] Creating review request for job ${jobId}`)
    console.log(`  - Customer: ${eligibility.customerId}`)
    console.log(`  - Primary method: ${delivery.method}`)
    console.log(`  - Email: ${delivery.useEmail}`)
    console.log(`  - SMS: ${delivery.useSMS}`)
    console.log(`  - Portal: ${delivery.usePortal}`)

    // Create review request
    const result = await createReviewRequest({
      customerId: eligibility.customerId,
      jobId,
      requestMethod: delivery.method,
      googleReviewRequested: true, // Always request Google review
    })

    if (result.success) {
      console.log(`[Auto-Request] Successfully created review request ${result.reviewRequestId}`)
    } else {
      console.error(`[Auto-Request] Failed to create review request:`, result.error)
    }

    return {
      success: result.success,
      reviewRequestId: result.reviewRequestId,
      delivered: result.delivered,
      error: result.error,
    }
  } catch (error) {
    console.error('[Auto-Request] Error creating auto review request:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process batch of jobs for auto review requests
 */
export async function processBatchAutoReviewRequests(
  jobIds: string[]
): Promise<{
  totalProcessed: number
  successful: number
  failed: number
  skipped: number
  results: AutoRequestResult[]
}> {
  const results: AutoRequestResult[] = []
  let successful = 0
  let failed = 0
  let skipped = 0

  for (const jobId of jobIds) {
    const result = await createAutoReviewRequest(jobId)
    results.push(result)

    if (result.skipped) {
      skipped++
    } else if (result.success) {
      successful++
    } else {
      failed++
    }

    // Rate limiting: 50ms delay between requests
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  return {
    totalProcessed: jobIds.length,
    successful,
    failed,
    skipped,
    results,
  }
}

/**
 * Get eligible jobs for auto review requests
 * Finds jobs completed 24-48 hours ago
 */
export async function getEligibleJobsForReview(): Promise<string[]> {
  try {
    const supabase = getServiceSupabase()

    // Time window: 24-48 hours ago
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    console.log(`[Auto-Request] Looking for jobs completed between:`)
    console.log(`  - Start: ${fortyEightHoursAgo.toISOString()}`)
    console.log(`  - End: ${twentyFourHoursAgo.toISOString()}`)

    // Find completed jobs in the time window
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('id, completed_at, total_amount')
      .eq('status', 'completed')
      .gte('completed_at', fortyEightHoursAgo.toISOString())
      .lte('completed_at', twentyFourHoursAgo.toISOString())
      .gte('total_amount', MIN_JOB_VALUE) // Pre-filter by job value

    if (error) {
      console.error('[Auto-Request] Error fetching eligible jobs:', error)
      return []
    }

    if (!jobs || jobs.length === 0) {
      console.log('[Auto-Request] No eligible jobs found in time window')
      return []
    }

    console.log(`[Auto-Request] Found ${jobs.length} potential jobs`)

    return jobs.map((job: any) => job.id)
  } catch (error) {
    console.error('[Auto-Request] Error getting eligible jobs:', error)
    return []
  }
}
