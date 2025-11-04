'use server'

import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { makeAction, makeTechnicianAction } from '@/lib/actions'

// Types for satisfaction reports
export interface SatisfactionKPIs {
  thirtyDay: {
    responses: number
    sent: number
    responseRate: number
    avgScore: number
  }
  ninetyDay: {
    responses: number
    sent: number
    responseRate: number
    avgScore: number
  }
}

export interface RecentResponse {
  id: string
  date: string
  score: number
  feedback: string | null
  customerName: string
  technicianName: string | null
  zone: string | null
  jobDate: string | null
  jobId: string
  customerId: string
}

export interface UnresolvedNegative {
  id: string
  score: number
  respondedAt: string
  feedback: string | null
  customerName: string
  customerPhone: string | null
  jobId: string
  customerId: string
  jobDate: string | null
  technicianName: string | null
  zone: string | null
  existingReminderId: string | null
}

// Input validation schemas
const FilterSchema = z.object({
  zone: z.string().optional(),
  technicianId: z.string().uuid().optional()
})

const RecentResponsesSchema = FilterSchema.extend({
  limit: z.number().int().min(1).max(100).optional().default(50)
})

/**
 * Get satisfaction KPIs for 30-day and 90-day periods
 * Calculates response rates and average scores with optional filtering
 */
export const getSatisfactionKPIs = makeTechnicianAction(
  FilterSchema,
  async (filters, { user, role }): Promise<SatisfactionKPIs> => {
    const supabase = getServerSupabase()
    const { zone, technicianId } = filters

    // Calculate date ranges
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    try {
      // Base query for surveys with job/customer joins for filtering
      let baseQuery = supabase
        .from('satisfaction_surveys')
        .select(`
          status,
          score,
          sent_at,
          responded_at,
          jobs!inner(
            technician_id,
            customers!inner(zone)
          )
        `)

      // Apply RLS filtering based on role
      if (role === 'technician') {
        baseQuery = baseQuery.eq('jobs.technician_id', user.id)
      }

      // Apply zone filter
      if (zone) {
        baseQuery = baseQuery.eq('jobs.customers.zone', zone)
      }

      // Apply technician filter (dispatcher/admin only)
      if (technicianId && (role === 'dispatcher' || role === 'admin')) {
        baseQuery = baseQuery.eq('jobs.technician_id', technicianId)
      }

      // Get 30-day data
      const { data: thirtyDayData, error: thirtyDayError } = await baseQuery
        .gte('sent_at', thirtyDaysAgo.toISOString())

      if (thirtyDayError) {
        throw new Error(`Failed to fetch 30-day data: ${thirtyDayError.message}`)
      }

      // Get 90-day data
      const { data: ninetyDayData, error: ninetyDayError } = await baseQuery
        .gte('sent_at', ninetyDaysAgo.toISOString())

      if (ninetyDayError) {
        throw new Error(`Failed to fetch 90-day data: ${ninetyDayError.message}`)
      }

      // Calculate 30-day KPIs
      const thirtyDayResponses = thirtyDayData?.filter(s => s.status === 'responded') || []
      const thirtyDaySent = thirtyDayData?.filter(s => s.status === 'sent' || s.status === 'responded') || []
      const thirtyDayScores = thirtyDayResponses.filter(s => s.score !== null).map(s => s.score)

      const thirtyDayKPIs = {
        responses: thirtyDayResponses.length,
        sent: thirtyDaySent.length,
        responseRate: thirtyDaySent.length > 0 ? (thirtyDayResponses.length / thirtyDaySent.length) * 100 : 0,
        avgScore: thirtyDayScores.length > 0 ? thirtyDayScores.reduce((a, b) => a + b, 0) / thirtyDayScores.length : 0
      }

      // Calculate 90-day KPIs
      const ninetyDayResponses = ninetyDayData?.filter(s => s.status === 'responded') || []
      const ninetyDaySent = ninetyDayData?.filter(s => s.status === 'sent' || s.status === 'responded') || []
      const ninetyDayScores = ninetyDayResponses.filter(s => s.score !== null).map(s => s.score)

      const ninetyDayKPIs = {
        responses: ninetyDayResponses.length,
        sent: ninetyDaySent.length,
        responseRate: ninetyDaySent.length > 0 ? (ninetyDayResponses.length / ninetyDaySent.length) * 100 : 0,
        avgScore: ninetyDayScores.length > 0 ? ninetyDayScores.reduce((a, b) => a + b, 0) / ninetyDayScores.length : 0
      }

      return {
        thirtyDay: thirtyDayKPIs,
        ninetyDay: ninetyDayKPIs
      }

    } catch (error) {
      console.error('Error calculating satisfaction KPIs:', error)
      throw new Error('Failed to calculate satisfaction KPIs')
    }
  }
)

/**
 * List recent survey responses with customer, job, and technician details
 */
export const listRecentResponses = makeTechnicianAction(
  RecentResponsesSchema,
  async (filters, { user, role }): Promise<RecentResponse[]> => {
    const supabase = getServerSupabase()
    const { zone, technicianId, limit } = filters

    try {
      let query = supabase
        .from('satisfaction_surveys')
        .select(`
          id,
          score,
          feedback,
          responded_at,
          job_id,
          customer_id,
          jobs!inner(
            scheduled_date,
            technician_id,
            technicians:users(name),
            customers!inner(
              name,
              zone
            )
          )
        `)
        .eq('status', 'responded')
        .not('responded_at', 'is', null)
        .order('responded_at', { ascending: false })
        .limit(limit)

      // Apply RLS filtering based on role
      if (role === 'technician') {
        query = query.eq('jobs.technician_id', user.id)
      }

      // Apply zone filter
      if (zone) {
        query = query.eq('jobs.customers.zone', zone)
      }

      // Apply technician filter (dispatcher/admin only)
      if (technicianId && (role === 'dispatcher' || role === 'admin')) {
        query = query.eq('jobs.technician_id', technicianId)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`Failed to fetch recent responses: ${error.message}`)
      }

      // Transform the data
      const responses: RecentResponse[] = (data || []).map((response: any) => ({
        id: response.id,
        date: response.responded_at,
        score: response.score,
        feedback: response.feedback,
        customerName: response.jobs.customers.name,
        technicianName: response.jobs.technicians?.name || null,
        zone: response.jobs.customers.zone,
        jobDate: response.jobs.scheduled_date,
        jobId: response.job_id,
        customerId: response.customer_id
      }))

      return responses

    } catch (error) {
      console.error('Error fetching recent responses:', error)
      throw new Error('Failed to fetch recent responses')
    }
  }
)

/**
 * List unresolved negative survey responses (score ≤ 3 with no completed follow-up)
 */
export const listUnresolvedNegatives = makeTechnicianAction(
  FilterSchema,
  async (filters, { user, role }): Promise<UnresolvedNegative[]> => {
    const supabase = getServerSupabase()
    const { zone, technicianId } = filters

    try {
      let query = supabase
        .from('satisfaction_surveys')
        .select(`
          id,
          score,
          feedback,
          responded_at,
          job_id,
          customer_id,
          jobs!inner(
            scheduled_date,
            technician_id,
            technicians:users(name),
            customers!inner(
              name,
              phone_e164,
              zone
            )
          )
        `)
        .eq('status', 'responded')
        .lte('score', 3)
        .not('responded_at', 'is', null)
        .order('responded_at', { ascending: false })

      // Apply RLS filtering based on role
      if (role === 'technician') {
        query = query.eq('jobs.technician_id', user.id)
      }

      // Apply zone filter
      if (zone) {
        query = query.eq('jobs.customers.zone', zone)
      }

      // Apply technician filter (dispatcher/admin only)
      if (technicianId && (role === 'dispatcher' || role === 'admin')) {
        query = query.eq('jobs.technician_id', technicianId)
      }

      const { data: negativeSurveys, error: surveysError } = await query

      if (surveysError) {
        throw new Error(`Failed to fetch negative surveys: ${surveysError.message}`)
      }

      if (!negativeSurveys || negativeSurveys.length === 0) {
        return []
      }

      // Get follow-up reminders for these job/customer combinations
      const jobCustomerPairs = negativeSurveys.map(s => ({ job_id: s.job_id, customer_id: s.customer_id }))

      const { data: followUpReminders, error: remindersError } = await supabase
        .from('reminders')
        .select('id, job_id, customer_id, status, type')
        .eq('type', 'follow_up')
        .in('status', ['pending', 'snoozed', 'completed'])
        .or(
          jobCustomerPairs
            .map(pair => `and(job_id.eq.${pair.job_id},customer_id.eq.${pair.customer_id})`)
            .join(',')
        )

      if (remindersError) {
        console.error('Error fetching follow-up reminders:', remindersError)
        // Continue without reminder data rather than failing completely
      }

      // Build a map of completed follow-ups by job_id + customer_id
      const completedFollowUps = new Set<string>()
      const existingReminders = new Map<string, string>()

      if (followUpReminders) {
        followUpReminders.forEach(reminder => {
          const key = `${reminder.job_id}-${reminder.customer_id}`
          if (reminder.status === 'completed') {
            completedFollowUps.add(key)
          } else if (reminder.status === 'pending' || reminder.status === 'snoozed') {
            existingReminders.set(key, reminder.id)
          }
        })
      }

      // Filter out surveys that have completed follow-ups
      const unresolvedNegatives: UnresolvedNegative[] = negativeSurveys
        .filter(survey => {
          const key = `${survey.job_id}-${survey.customer_id}`
          return !completedFollowUps.has(key)
        })
        .map((survey: any) => {
          const key = `${survey.job_id}-${survey.customer_id}`
          return {
            id: survey.id,
            score: survey.score,
            respondedAt: survey.responded_at,
            feedback: survey.feedback,
            customerName: survey.jobs.customers.name,
            customerPhone: survey.jobs.customers.phone_e164,
            jobId: survey.job_id,
            customerId: survey.customer_id,
            jobDate: survey.jobs.scheduled_date,
            technicianName: survey.jobs.technicians?.name || null,
            zone: survey.jobs.customers.zone,
            existingReminderId: existingReminders.get(key) || null
          }
        })

      return unresolvedNegatives

    } catch (error) {
      console.error('Error fetching unresolved negatives:', error)
      throw new Error('Failed to fetch unresolved negative surveys')
    }
  }
)

/**
 * Get available filter options (zones and technicians)
 */
export const getFilterOptions = makeTechnicianAction(
  z.object({}),
  async (_, { user, role }): Promise<{
    zones: Array<{ value: string; label: string }>
    technicians: Array<{ value: string; label: string }>
  }> => {
    const supabase = getServerSupabase()

    try {
      // Get zones from customers
      const { data: zones } = await supabase
        .from('customers')
        .select('zone')
        .not('zone', 'is', null)
        .order('zone')

      const uniqueZones = [...new Set(zones?.map(c => c.zone).filter(Boolean) || [])]
      const zoneOptions = uniqueZones.map(zone => ({
        value: zone,
        label: zone
      }))

      // Get technicians based on role
      let technicianQuery = supabase
        .from('users')
        .select(`
          id,
          name,
          user_roles!inner(role)
        `)
        .eq('user_roles.role', 'technician')
        .eq('active', true)
        .order('name')

      // Technicians can only see themselves in the filter
      if (role === 'technician') {
        technicianQuery = technicianQuery.eq('id', user.id)
      }

      const { data: technicians } = await technicianQuery

      const technicianOptions = (technicians || []).map((tech: any) => ({
        value: tech.id,
        label: tech.name
      }))

      return {
        zones: zoneOptions,
        technicians: technicianOptions
      }

    } catch (error) {
      console.error('Error fetching filter options:', error)
      return {
        zones: [],
        technicians: []
      }
    }
  }
)