import { createHash, randomBytes } from 'crypto'
import { getServiceSupabase } from '@/lib/supabase/server'

export interface SurveyData {
  id: string
  jobId: string
  customerId: string
  status: 'pending' | 'sent' | 'responded'
  score: number | null
  feedback: string | null
  reviewRequested: boolean
  sentAt: string | null
  respondedAt: string | null
  // Customer and job info for display
  customerName: string
  customerEmail: string | null
  jobDate: string | null
  jobDescription: string | null
  technicianName: string | null
}

/**
 * Generate a cryptographically secure survey token
 */
function generateSecureToken(): string {
  // Create a token using current timestamp + random bytes for uniqueness and security
  const timestamp = Date.now().toString()
  const randomData = randomBytes(32).toString('hex')
  const combined = timestamp + randomData

  // Hash the combined data to create a fixed-length token
  return createHash('sha256').update(combined).digest('hex')
}

/**
 * Create a survey token for a specific job
 * Upserts the satisfaction_surveys row and generates a unique token
 */
export async function createSurveyToken(jobId: string): Promise<string> {
  const supabase = getServiceSupabase()

  try {
    // First, get job and customer information
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        customer_id,
        scheduled_date,
        description,
        customers!inner(
          id,
          name,
          email
        )
      `)
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobError?.message || 'Job does not exist'}`)
    }

    // Generate a unique token
    let token: string
    let attempts = 0
    const maxAttempts = 5

    do {
      token = generateSecureToken()
      attempts++

      // Check if token already exists
      const { data: existingToken } = await supabase
        .from('satisfaction_surveys')
        .select('token')
        .eq('token', token)
        .single()

      if (!existingToken) {
        break // Token is unique
      }

      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique token after multiple attempts')
      }
    } while (attempts < maxAttempts)

    // Upsert the satisfaction_surveys row
    const { data: survey, error: upsertError } = await supabase
      .from('satisfaction_surveys')
      .upsert({
        job_id: jobId,
        customer_id: job.customer_id,
        token,
        status: 'sent',
        sent_at: new Date().toISOString(),
        // Don't overwrite existing responses
        score: null,
        feedback: null,
        review_requested: false,
        responded_at: null
      }, {
        onConflict: 'job_id',
        ignoreDuplicates: false
      })
      .select('token')
      .single()

    if (upsertError) {
      throw new Error(`Failed to create survey token: ${upsertError.message}`)
    }

    if (!survey?.token) {
      throw new Error('Survey token was not created properly')
    }

    return survey.token

  } catch (error) {
    console.error('Error creating survey token:', error)
    throw error
  }
}

/**
 * Get survey data by token with job and customer information
 * Returns minimal safe fields for public access
 */
export async function getSurveyByToken(token: string): Promise<SurveyData | null> {
  if (!token || typeof token !== 'string') {
    return null
  }

  const supabase = getServiceSupabase()

  try {
    const { data: survey, error } = await supabase
      .from('satisfaction_surveys')
      .select(`
        id,
        job_id,
        customer_id,
        status,
        score,
        feedback,
        review_requested,
        sent_at,
        responded_at,
        jobs!inner(
          id,
          scheduled_date,
          description,
          technicians:users(name)
        ),
        customers!inner(
          id,
          name,
          email
        )
      `)
      .eq('token', token)
      .single()

    if (error || !survey) {
      return null
    }

    // Transform the data to our interface
    const surveyData: SurveyData = {
      id: survey.id,
      jobId: survey.job_id,
      customerId: survey.customer_id,
      status: survey.status,
      score: survey.score,
      feedback: survey.feedback,
      reviewRequested: survey.review_requested,
      sentAt: survey.sent_at,
      respondedAt: survey.responded_at,
      customerName: survey.customers.name,
      customerEmail: survey.customers.email,
      jobDate: survey.jobs.scheduled_date,
      jobDescription: survey.jobs.description,
      technicianName: survey.jobs.technicians?.name || null
    }

    return surveyData

  } catch (error) {
    console.error('Error fetching survey by token:', error)
    return null
  }
}

/**
 * Update survey response
 * Used internally by the survey submission process
 */
export async function updateSurveyResponse(
  token: string,
  score: number,
  feedback: string | null,
  reviewRequested: boolean = false
): Promise<boolean> {
  if (!token || typeof token !== 'string') {
    return false
  }

  if (score < 1 || score > 5) {
    throw new Error('Score must be between 1 and 5')
  }

  const supabase = getServiceSupabase()

  try {
    const { error } = await supabase
      .from('satisfaction_surveys')
      .update({
        status: 'responded',
        score,
        feedback: feedback?.trim() || null,
        review_requested: reviewRequested,
        responded_at: new Date().toISOString()
      })
      .eq('token', token)
      .eq('status', 'sent') // Only allow updating sent surveys

    if (error) {
      console.error('Error updating survey response:', error)
      return false
    }

    return true

  } catch (error) {
    console.error('Error updating survey response:', error)
    return false
  }
}

/**
 * Check if a survey token is valid and hasn't been used
 */
export async function isSurveyTokenValid(token: string): Promise<boolean> {
  if (!token || typeof token !== 'string') {
    return false
  }

  const supabase = getServiceSupabase()

  try {
    const { data, error } = await supabase
      .from('satisfaction_surveys')
      .select('status')
      .eq('token', token)
      .single()

    if (error || !data) {
      return false
    }

    // Token is valid if status is 'sent' (not yet responded)
    return data.status === 'sent'

  } catch (error) {
    console.error('Error validating survey token:', error)
    return false
  }
}

/**
 * Generate a complete survey URL for a job
 * Useful for SMS messaging or email links
 */
export async function createSurveyUrl(jobId: string, baseUrl?: string): Promise<string> {
  const token = await createSurveyToken(jobId)
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base}/survey/${token}`
}