'use server'

import { z } from 'zod'
import { getSurveyByToken, updateSurveyResponse } from '@/lib/surveys/token'
import { getReviewLinks } from '@/lib/settings/reviews'
import { getServiceSupabase } from '@/lib/supabase/server'

// Types for survey submission
export interface SurveySubmissionResult {
  success: boolean
  positive: boolean
  links?: {
    google?: string
    yelp?: string
  }
  error?: string
}

// Input validation schema
const SubmitSurveySchema = z.object({
  token: z.string().min(10, 'Invalid token'),
  score: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional()
})

/**
 * Submit survey response
 * Handles both positive (>=4) and negative (<=3) responses
 */
export async function submitSurvey(input: {
  token: string
  score: number
  feedback?: string
}): Promise<SurveySubmissionResult> {
  try {
    // Validate input
    const validated = SubmitSurveySchema.parse(input)
    const { token, score, feedback } = validated

    // Get survey data to verify token and get job/customer info
    const survey = await getSurveyByToken(token)

    if (!survey) {
      return {
        success: false,
        positive: false,
        error: 'Survey not found or invalid token'
      }
    }

    // Check if survey was already responded to
    if (survey.status === 'responded') {
      return {
        success: false,
        positive: false,
        error: 'This survey has already been completed'
      }
    }

    // Determine if this is a positive response
    const isPositive = score >= 4
    const reviewRequested = isPositive

    // Update the survey response
    const updateSuccess = await updateSurveyResponse(
      token,
      score,
      feedback || null,
      reviewRequested
    )

    if (!updateSuccess) {
      return {
        success: false,
        positive: false,
        error: 'Failed to save survey response'
      }
    }

    // Handle positive responses (score >= 4)
    if (isPositive) {
      // Get review links for the customer
      const reviewLinks = await getReviewLinks()

      return {
        success: true,
        positive: true,
        links: reviewLinks
      }
    }

    // Handle negative responses (score <= 3)
    // Create a follow-up reminder for the office
    await createFollowUpReminder(survey.jobId, survey.customerId, score, feedback)

    return {
      success: true,
      positive: false
    }

  } catch (error) {
    console.error('Error submitting survey:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        positive: false,
        error: 'Invalid survey data provided'
      }
    }

    return {
      success: false,
      positive: false,
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}

/**
 * Create a follow-up reminder for negative survey responses
 * This will be assigned to dispatchers to follow up with the customer
 */
async function createFollowUpReminder(
  jobId: string,
  customerId: string,
  score: number,
  feedback?: string
): Promise<void> {
  const supabase = getServiceSupabase()

  try {
    // Get customer name for the reminder title
    const { data: customer } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single()

    const customerName = customer?.name || 'Customer'

    // Create the follow-up reminder
    const { data: reminder, error: reminderError } = await supabase
      .from('reminders')
      .insert({
        customer_id: customerId,
        job_id: jobId,
        type: 'follow_up',
        title: `Follow up: ${customerName} - Low survey score (${score}/5)`,
        body: feedback
          ? `Customer feedback: "${feedback}"\n\nPlease follow up to address their concerns and improve their experience.`
          : `Customer gave a ${score}/5 rating. Please follow up to address any concerns and improve their experience.`,
        status: 'pending',
        scheduled_date: getTomorrowDate(),
        attempt_count: 0
      })
      .select('id')
      .single()

    if (reminderError) {
      console.error('Failed to create follow-up reminder:', reminderError)
      return
    }

    // Create audit log entry
    if (reminder?.id) {
      await supabase
        .from('audit_logs')
        .insert({
          action: 'create_followup_from_survey',
          entity: 'reminder',
          entity_id: reminder.id,
          meta: {
            job_id: jobId,
            customer_id: customerId,
            survey_score: score,
            has_feedback: !!feedback,
            trigger: 'negative_survey_response'
          }
        })
    }

  } catch (error) {
    console.error('Error creating follow-up reminder:', error)
    // Don't throw - we don't want survey submission to fail if reminder creation fails
  }
}

/**
 * Get tomorrow's date in YYYY-MM-DD format
 * Used for scheduling follow-up reminders
 */
function getTomorrowDate(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}

/**
 * Get next business day (Monday-Friday)
 * Alternative to getTomorrowDate if you want to schedule only on business days
 */
function getNextBusinessDay(): string {
  const date = new Date()
  let daysToAdd = 1

  // If today is Friday (5), schedule for Monday (add 3 days)
  // If today is Saturday (6), schedule for Monday (add 2 days)
  // Otherwise, just add 1 day
  const dayOfWeek = date.getDay()

  if (dayOfWeek === 5) { // Friday
    daysToAdd = 3
  } else if (dayOfWeek === 6) { // Saturday
    daysToAdd = 2
  }

  date.setDate(date.getDate() + daysToAdd)
  return date.toISOString().split('T')[0]
}

/**
 * Validate survey token without exposing survey data
 * Used for client-side validation
 */
export async function validateSurveyToken(token: string): Promise<{
  valid: boolean
  completed: boolean
}> {
  if (!token || typeof token !== 'string') {
    return { valid: false, completed: false }
  }

  try {
    const survey = await getSurveyByToken(token)

    if (!survey) {
      return { valid: false, completed: false }
    }

    return {
      valid: true,
      completed: survey.status === 'responded'
    }

  } catch (error) {
    console.error('Error validating survey token:', error)
    return { valid: false, completed: false }
  }
}