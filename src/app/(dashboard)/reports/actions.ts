'use server'

import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { makeTechnicianAction } from '@/lib/actions'

// Zod schemas for input validation
const JobsByStatusSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format'),
  serviceTypes: z.array(z.string()).optional()
})

const JobsByTechnicianSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format'),
  zones: z.array(z.string()).optional()
})

const UpcomingRemindersSchema = z.object({
  horizonDays: z.number().int().min(1).max(365)
})

// Type definitions for report data
export interface JobStatusRow {
  id: string
  status: string
  customerName: string
  customerPhone: string | null
  zone: string | null
  technicianName: string | null
  scheduledDate: string | null
  completedDate: string | null
  serviceType: string | null
  description: string | null
}

export interface JobStatusSummary {
  scheduled: number
  in_progress: number
  completed: number
  cancelled: number
  total: number
}

export interface TechnicianStatsRow {
  technicianId: string
  technicianName: string
  zone: string | null
  jobsScheduled: number
  jobsCompleted: number
  avgRating: number | null
  cancellations: number
}

export interface UpcomingReminderRow {
  id: string
  scheduledDate: string
  title: string | null
  type: string
  customerName: string | null
  customerPhone: string | null
  assigneeName: string | null
  status: string
  origin: string | null
}

export interface JobsByStatusResult {
  rows: JobStatusRow[]
  summary: JobStatusSummary
}

export interface JobsByTechnicianResult {
  rows: TechnicianStatsRow[]
  summary: {
    totalTechnicians: number
    totalJobsScheduled: number
    totalJobsCompleted: number
    totalCancellations: number
  }
}

export interface UpcomingRemindersResult {
  rows: UpcomingReminderRow[]
  summary: {
    totalReminders: number
    byType: Record<string, number>
    byStatus: Record<string, number>
  }
}

/**
 * Get jobs by status report with RBAC enforcement
 */
export const getJobsByStatus = makeTechnicianAction(
  JobsByStatusSchema,
  async ({ from, to, serviceTypes }, { user, role }): Promise<JobsByStatusResult> => {
    const supabase = getServerSupabase()

    let query = supabase
      .from('jobs')
      .select(`
        id,
        status,
        scheduled_date,
        completed_at,
        description,
        zone,
        technician_id,
        customers!inner(
          name,
          phone_e164
        ),
        technicians:users!technician_id(
          name
        )
      `)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)

    // Apply RLS-aware filtering based on role
    if (role === 'technician') {
      // Technicians can only see jobs assigned to them
      query = query.eq('technician_id', user.id)
    }

    // Service type filter if provided
    if (serviceTypes && serviceTypes.length > 0) {
      // Assuming description contains service type info - adjust based on actual schema
      const typeFilters = serviceTypes.map(type => `description.ilike.%${type}%`).join(',')
      query = query.or(typeFilters)
    }

    query = query.order('scheduled_date', { ascending: false })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch jobs by status: ${error.message}`)
    }

    // Transform the data
    const rows: JobStatusRow[] = (data || []).map((job: any) => ({
      id: job.id,
      status: job.status,
      customerName: job.customers?.name || 'Unknown',
      customerPhone: job.customers?.phone_e164 || null,
      zone: job.zone,
      technicianName: job.technicians?.name || null,
      scheduledDate: job.scheduled_date,
      completedDate: job.completed_at,
      serviceType: extractServiceType(job.description),
      description: job.description
    }))

    // Calculate summary
    const summary: JobStatusSummary = {
      scheduled: rows.filter(r => r.status === 'scheduled').length,
      in_progress: rows.filter(r => r.status === 'in_progress').length,
      completed: rows.filter(r => r.status === 'completed').length,
      cancelled: rows.filter(r => r.status === 'cancelled').length,
      total: rows.length
    }

    return { rows, summary }
  }
)

/**
 * Get jobs by technician report with RBAC enforcement
 */
export const getJobsByTechnician = makeTechnicianAction(
  JobsByTechnicianSchema,
  async ({ from, to, zones }, { user, role }): Promise<JobsByTechnicianResult> => {
    const supabase = getServerSupabase()

    // Build base query for technician stats
    let baseFilter = `scheduled_date.gte.${from},scheduled_date.lte.${to}`

    if (role === 'technician') {
      // Technicians can only see their own stats
      baseFilter += `,technician_id.eq.${user.id}`
    }

    if (zones && zones.length > 0) {
      baseFilter += `,zone.in.(${zones.join(',')})`
    }

    // Get all technicians first
    let technicianQuery = supabase
      .from('user_profiles')
      .select(`
        user_id,
        display_name,
        zone,
        users!inner(id, name)
      `)
      .in('role', ['technician'])

    if (role === 'technician') {
      technicianQuery = technicianQuery.eq('user_id', user.id)
    }

    if (zones && zones.length > 0) {
      technicianQuery = technicianQuery.in('zone', zones)
    }

    const { data: technicians, error: techError } = await technicianQuery

    if (techError) {
      throw new Error(`Failed to fetch technicians: ${techError.message}`)
    }

    // Get job stats for each technician
    const rows: TechnicianStatsRow[] = []

    for (const tech of technicians || []) {
      // Count scheduled jobs
      const { count: scheduledCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('technician_id', tech.user_id)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)

      // Count completed jobs
      const { count: completedCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('technician_id', tech.user_id)
        .eq('status', 'completed')
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)

      // Count cancellations
      const { count: cancelledCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('technician_id', tech.user_id)
        .eq('status', 'cancelled')
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)

      // Get average rating (if satisfaction surveys exist)
      const { data: avgRatingData } = await supabase
        .from('satisfaction_surveys')
        .select('score')
        .in('job_id',
          supabase
            .from('jobs')
            .select('id')
            .eq('technician_id', tech.user_id)
            .gte('scheduled_date', from)
            .lte('scheduled_date', to)
        )

      const scores = avgRatingData?.map(s => s.score).filter(Boolean) || []
      const avgRating = scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null

      rows.push({
        technicianId: tech.user_id,
        technicianName: tech.users?.name || tech.display_name || 'Unknown',
        zone: tech.zone,
        jobsScheduled: scheduledCount || 0,
        jobsCompleted: completedCount || 0,
        avgRating,
        cancellations: cancelledCount || 0
      })
    }

    // Calculate summary
    const summary = {
      totalTechnicians: rows.length,
      totalJobsScheduled: rows.reduce((sum, row) => sum + row.jobsScheduled, 0),
      totalJobsCompleted: rows.reduce((sum, row) => sum + row.jobsCompleted, 0),
      totalCancellations: rows.reduce((sum, row) => sum + row.cancellations, 0)
    }

    return { rows, summary }
  }
)

/**
 * Get upcoming reminders report with RBAC enforcement
 */
export const getUpcomingReminders = makeTechnicianAction(
  UpcomingRemindersSchema,
  async ({ horizonDays }, { user, role }): Promise<UpcomingRemindersResult> => {
    const supabase = getServerSupabase()

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + horizonDays)

    let query = supabase
      .from('reminders')
      .select(`
        id,
        scheduled_date,
        title,
        type,
        status,
        origin,
        assigned_to,
        customers(
          name,
          phone_e164
        ),
        assignedTo:users!assigned_to(
          name
        )
      `)
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .lte('scheduled_date', endDate.toISOString().split('T')[0])
      .in('status', ['pending', 'snoozed']) // Only show active reminders
      .order('scheduled_date', { ascending: true })

    // Apply RLS-aware filtering based on role
    if (role === 'technician') {
      // Technicians can only see reminders assigned to them or related to their jobs
      query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch upcoming reminders: ${error.message}`)
    }

    // Transform the data
    const rows: UpcomingReminderRow[] = (data || []).map((reminder: any) => ({
      id: reminder.id,
      scheduledDate: reminder.scheduled_date,
      title: reminder.title,
      type: reminder.type,
      customerName: reminder.customers?.name || null,
      customerPhone: reminder.customers?.phone_e164 || null,
      assigneeName: reminder.assignedTo?.name || null,
      status: reminder.status,
      origin: reminder.origin
    }))

    // Calculate summary
    const byType: Record<string, number> = {}
    const byStatus: Record<string, number> = {}

    rows.forEach(row => {
      byType[row.type] = (byType[row.type] || 0) + 1
      byStatus[row.status] = (byStatus[row.status] || 0) + 1
    })

    const summary = {
      totalReminders: rows.length,
      byType,
      byStatus
    }

    return { rows, summary }
  }
)

/**
 * Helper function to extract service type from job description
 * Adjust this based on your actual service type classification
 */
function extractServiceType(description: string | null): string | null {
  if (!description) return null

  const serviceTypes = [
    'carpet cleaning',
    'upholstery cleaning',
    'tile cleaning',
    'area rug cleaning',
    'stain removal',
    'deep cleaning',
    'maintenance cleaning'
  ]

  const lowerDesc = description.toLowerCase()
  for (const type of serviceTypes) {
    if (lowerDesc.includes(type)) {
      return type
    }
  }

  return 'general cleaning'
}

/**
 * Get list of zones for filtering (helper for UI)
 */
export const getZones = makeTechnicianAction(
  z.object({}),
  async (_, { user, role }) => {
    const supabase = getServerSupabase()

    let query = supabase
      .from('user_profiles')
      .select('zone')
      .not('zone', 'is', null)

    // Technicians only see their own zone
    if (role === 'technician') {
      query = query.eq('user_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch zones: ${error.message}`)
    }

    const zones = [...new Set((data || []).map(p => p.zone).filter(Boolean))]
    return zones.sort()
  }
)

/**
 * Get list of technicians for filtering (helper for UI)
 */
export const getTechnicians = makeTechnicianAction(
  z.object({}),
  async (_, { user, role }) => {
    const supabase = getServerSupabase()

    let query = supabase
      .from('user_profiles')
      .select(`
        user_id,
        display_name,
        zone,
        users!inner(name)
      `)
      .eq('role', 'technician')

    // Technicians only see themselves
    if (role === 'technician') {
      query = query.eq('user_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch technicians: ${error.message}`)
    }

    return (data || []).map(tech => ({
      id: tech.user_id,
      name: tech.users?.name || tech.display_name || 'Unknown',
      zone: tech.zone
    }))
  }
)