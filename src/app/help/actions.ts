'use server'

import { createClient } from '@/lib/supabase/server'

interface FeedbackData {
  type: string
  priority: string
  subject: string
  description: string
  steps?: string
  email?: string
  name?: string
}

export async function submitFeedback(data: FeedbackData) {
  const supabase = createClient()

  try {
    // Get current user context if available
    const { data: { user } } = await supabase.auth.getUser()

    // Insert feedback into database
    const { error } = await supabase
      .from('feedback')
      .insert({
        type: data.type,
        priority: data.priority,
        subject: data.subject,
        description: data.description,
        steps_to_reproduce: data.steps || null,
        submitted_by_email: data.email || user?.email || null,
        submitted_by_name: data.name || null,
        submitted_by_user_id: user?.id || null,
        status: 'open',
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('Database error:', error)
      throw new Error('Failed to submit feedback')
    }

    // If this is a critical priority feedback, we could send immediate notifications
    if (data.priority === 'critical') {
      // In a real implementation, you might:
      // - Send email to administrators
      // - Create Slack notification
      // - Trigger incident response workflow
      console.log('Critical feedback submitted - notification should be sent')
    }

    return { success: true }
  } catch (error) {
    console.error('Error submitting feedback:', error)
    throw new Error('Failed to submit feedback. Please try again or contact support.')
  }
}

export async function getFeedbackList() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      throw new Error('Failed to fetch feedback')
    }

    return data
  } catch (error) {
    console.error('Error fetching feedback:', error)
    throw new Error('Failed to fetch feedback list')
  }
}

export async function updateFeedbackStatus(id: string, status: string, adminNotes?: string) {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from('feedback')
      .update({
        status,
        admin_notes: adminNotes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      throw new Error('Failed to update feedback status')
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating feedback status:', error)
    throw new Error('Failed to update feedback status')
  }
}