'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { getServerSupabase } from '@/lib/supabase/server'
import { makeAction, makeDispatcherAction } from '@/lib/actions'
import { checkTimeSlotConflicts, validateTimeSlot, type ConflictJob } from '@/lib/schedule/conflicts'
import { isValidTimeRange } from '@/lib/schedule/time'
// import { canTransition } from '@/types/job'

export interface ActionResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

// Schema definitions
const ListTechniciansSchema = z.object({
  includeInactive: z.boolean().optional().default(false)
})

const ListJobEventsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  technicianIds: z.array(z.string().uuid()).optional(),
  statuses: z.array(z.string()).optional(),
  zones: z.array(z.string()).optional(),
  serviceTypes: z.array(z.string()).optional()
})

const UpdateEventTimeSchema = z.object({
  jobId: z.string().uuid(),
  start: z.string().datetime(),
  end: z.string().datetime()
})

const AssignEventTechnicianSchema = z.object({
  jobId: z.string().uuid(),
  technicianId: z.string().uuid()
})

const CheckConflictsSchema = z.object({
  technicianId: z.string().uuid(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  excludeJobId: z.string().uuid().optional()
})

const UnassignTechnicianSchema = z.object({
  jobId: z.string().uuid()
})

// Types
export interface TechnicianResource {
  id: string
  displayName: string
  zone?: string | null
}

export interface JobEvent {
  id: string
  resourceId: string | null
  start: string
  end: string
  title: string
  extendedProps: {
    customerId: string
    customerName: string
    zone?: string | null
    status: string
    serviceType?: string | null
    description?: string | null
    technicianName?: string | null
  }
}

/**
 * Lists all technicians as calendar resources
 */
export const listTechnicians = makeAction(
  ListTechniciansSchema,
  async (input, { user, role }): Promise<TechnicianResource[]> => {
    console.log('🔧 [SERVER] listTechnicians: Called with input:', input)
    console.log('🔧 [SERVER] listTechnicians: User:', user?.id, 'Role:', role)

    const supabase = await getServerSupabase()

    // Query user_profiles to get technicians
    let query = supabase
      .from('user_profiles')
      .select(`
        user_id,
        display_name,
        zone
      `)
      .eq('role', 'technician')

    // Admin/Dispatcher can see all technicians, technicians see only themselves
    if (role === 'technician') {
      console.log('🔧 [SERVER] listTechnicians: Filtering for technician user only')
      query = query.eq('user_id', user.id)
    } else {
      console.log('🔧 [SERVER] listTechnicians: Loading all technicians (admin/dispatcher)')
    }

    const { data: userProfiles, error } = await query
    console.log('🔧 [SERVER] listTechnicians: Query result:', {
      profilesCount: userProfiles?.length,
      error: error?.message
    })

    if (error) {
      console.error('🔧 [SERVER] listTechnicians: Database error:', error)
      throw new Error('Failed to fetch technicians')
    }

    const technicians: TechnicianResource[] = (userProfiles || []).map(profile => ({
      id: profile.user_id,
      displayName: profile.display_name || 'Unknown',
      zone: profile.zone || null
    }))

    console.log('🔧 [SERVER] listTechnicians: Returning', technicians.length, 'technicians')
    console.log('🔧 [SERVER] listTechnicians: Returning array directly (wrapper will add success/data)')

    // Return data directly - makeAction wrapper will add { success: true, data: ... }
    return technicians
  },
  { minimumRole: 'technician' }
)

/**
 * Lists job events for the calendar in the specified date range
 */
export const listJobEvents = makeAction(
  ListJobEventsSchema,
  async (input, { user, role }): Promise<JobEvent[]> => {
    console.log('📆 [SERVER] listJobEvents: Called with input:', {
      from: input.from,
      to: input.to,
      technicianIds: input.technicianIds,
      statuses: input.statuses,
      zones: input.zones,
      serviceTypes: input.serviceTypes
    })
    console.log('📆 [SERVER] listJobEvents: User:', user?.id, 'Role:', role)

    const supabase = await getServerSupabase()

    let query = supabase
      .from('jobs')
      .select(`
        id,
        customer_id,
        technician_id,
        zone,
        status,
        service_type,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end,
        description,
        customers!inner(
          name
        )
      `)
      .not('scheduled_date', 'is', null)
      .gte('scheduled_date', input.from.split('T')[0])
      .lte('scheduled_date', input.to.split('T')[0])

    console.log('📆 [SERVER] listJobEvents: Date range:', {
      from: input.from.split('T')[0],
      to: input.to.split('T')[0]
    })

    // Filter by technician if specified
    if (input.technicianIds && input.technicianIds.length > 0) {
      query = query.in('technician_id', input.technicianIds)
    }

    // Filter by status if specified (default excludes terminal statuses)
    if (input.statuses && input.statuses.length > 0) {
      query = query.in('status', input.statuses)
    } else {
      query = query.not('status', 'in', '(completed,cancelled)')
    }

    // Filter by zone if specified
    if (input.zones && input.zones.length > 0) {
      query = query.in('zone', input.zones)
    }

    // Filter by service type if specified
    if (input.serviceTypes && input.serviceTypes.length > 0) {
      query = query.in('service_type', input.serviceTypes)
    }

    // Technicians can only see their own jobs
    if (role === 'technician') {
      query = query.eq('technician_id', user.id)
    }

    console.log('📆 [SERVER] listJobEvents: Executing query...')
    const { data: jobs, error } = await query
    console.log('📆 [SERVER] listJobEvents: Query result:', {
      jobsCount: jobs?.length,
      error: error?.message
    })

    if (error) {
      console.error('📆 [SERVER] listJobEvents: Database error:', error)
      throw new Error('Failed to fetch job events')
    }

    // Get unique technician IDs
    const technicianIds = [...new Set(jobs.map(j => j.technician_id).filter(Boolean))]

    // Fetch technician names if needed
    let technicianMap: Record<string, string> = {}
    if (technicianIds.length > 0) {
      const { data: techProfiles } = await supabase
        .from('user_profiles')
        .select('user_id, display_name')
        .in('user_id', technicianIds)

      if (techProfiles) {
        technicianMap = Object.fromEntries(
          techProfiles.map(tp => [tp.user_id, tp.display_name])
        )
      }
    }

    const events: JobEvent[] = jobs
      .filter(job => job.scheduled_time_start && job.scheduled_time_end)
      .map(job => {
        const startTime = `${job.scheduled_date}T${job.scheduled_time_start}:00`
        const endTime = `${job.scheduled_date}T${job.scheduled_time_end}:00`

        return {
          id: job.id,
          resourceId: job.technician_id,
          start: new Date(startTime).toISOString(),
          end: new Date(endTime).toISOString(),
          title: job.customers.name || 'Unknown Customer',
          extendedProps: {
            customerId: job.customer_id,
            customerName: job.customers.name || 'Unknown Customer',
            zone: job.zone,
            status: job.status,
            serviceType: job.service_type,
            description: job.description,
            technicianName: job.technician_id ? technicianMap[job.technician_id] || null : null
          }
        }
      })

    console.log('📆 [SERVER] listJobEvents: Returning', events.length, 'events')
    console.log('📆 [SERVER] listJobEvents: Returning array directly (wrapper will add success/data)')

    // Return data directly - makeAction wrapper will add { success: true, data: ... }
    return events
  },
  { minimumRole: 'technician' }
)

/**
 * Updates the time of a job event (dispatcher+ only)
 */
export const updateEventTime = makeDispatcherAction(
  UpdateEventTimeSchema,
  async (input): Promise<ActionResponse<{ updated: boolean }>> => {
    const supabase = await getServerSupabase()

    try {
      // Validate time range
      if (!isValidTimeRange(input.start, input.end)) {
        return { ok: false, error: 'Start time must be before end time' }
      }

      const startDate = new Date(input.start)
      const endDate = new Date(input.end)

      // Extract date and time components
      const scheduledDate = startDate.toISOString().split('T')[0]
      const scheduledTimeStart = startDate.toTimeString().slice(0, 5)
      const scheduledTimeEnd = endDate.toTimeString().slice(0, 5)

      // Get current job details for conflict checking
      const { data: currentJob, error: fetchError } = await supabase
        .from('jobs')
        .select('id, technician_id, status')
        .eq('id', input.jobId)
        .single()

      if (fetchError || !currentJob) {
        return { ok: false, error: 'Job not found' }
      }

      // Don't allow editing terminal jobs
      if (currentJob.status === 'completed' || currentJob.status === 'cancelled') {
        return { ok: false, error: 'Cannot modify completed or cancelled jobs' }
      }

      // Check for conflicts if job has a technician
      if (currentJob.technician_id) {
        const conflictResult = await checkConflicts({
          technicianId: currentJob.technician_id,
          start: input.start,
          end: input.end,
          excludeJobId: input.jobId
        })

        if (!conflictResult.ok) {
          return { ok: false, error: conflictResult.error }
        }
      }

      // Update the job
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          scheduled_date: scheduledDate,
          scheduled_time_start: scheduledTimeStart,
          scheduled_time_end: scheduledTimeEnd,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.jobId)

      if (updateError) {
        console.error('Error updating job time:', updateError)
        return { ok: false, error: 'Failed to update job time' }
      }

      // Audit log
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'jobs',
          record_id: input.jobId,
          action: 'UPDATE',
          old_values: { action: 'time_update' },
          new_values: { scheduled_date: scheduledDate, scheduled_time_start: scheduledTimeStart, scheduled_time_end: scheduledTimeEnd }
        })

      revalidatePath('/schedule/calendar')
      revalidatePath('/jobs')

      return { ok: true, data: { updated: true } }
    } catch (error) {
      console.error('Update event time error:', error)
      return { ok: false, error: 'Failed to update event time' }
    }
  }
)

/**
 * Assigns a technician to a job event (dispatcher+ only)
 */
export const assignEventTechnician = makeDispatcherAction(
  AssignEventTechnicianSchema,
  async (input): Promise<ActionResponse<{ assigned: boolean }>> => {
    const supabase = await getServerSupabase()

    try {
      // Get job details
      const { data: job, error: fetchError } = await supabase
        .from('jobs')
        .select('id, scheduled_date, scheduled_time_start, scheduled_time_end, status')
        .eq('id', input.jobId)
        .single()

      if (fetchError || !job) {
        return { ok: false, error: 'Job not found' }
      }

      // Don't allow editing terminal jobs
      if (job.status === 'completed' || job.status === 'cancelled') {
        return { ok: false, error: 'Cannot modify completed or cancelled jobs' }
      }

      // Check for conflicts if job has scheduled time
      if (job.scheduled_date && job.scheduled_time_start && job.scheduled_time_end) {
        const startTime = `${job.scheduled_date}T${job.scheduled_time_start}:00`
        const endTime = `${job.scheduled_date}T${job.scheduled_time_end}:00`

        const conflictResult = await checkConflicts({
          technicianId: input.technicianId,
          start: new Date(startTime).toISOString(),
          end: new Date(endTime).toISOString(),
          excludeJobId: input.jobId
        })

        if (!conflictResult.ok) {
          return { ok: false, error: conflictResult.error }
        }
      }

      // Update the job
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          technician_id: input.technicianId,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.jobId)

      if (updateError) {
        console.error('Error assigning technician:', updateError)
        return { ok: false, error: 'Failed to assign technician' }
      }

      // Audit log
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'jobs',
          record_id: input.jobId,
          action: 'UPDATE',
          old_values: { action: 'technician_assignment' },
          new_values: { technician_id: input.technicianId }
        })

      revalidatePath('/schedule/calendar')
      revalidatePath('/jobs')

      return { ok: true, data: { assigned: true } }
    } catch (error) {
      console.error('Assign event technician error:', error)
      return { ok: false, error: 'Failed to assign technician' }
    }
  }
)

/**
 * Checks for scheduling conflicts for a technician
 */
export const checkConflicts = makeAction(
  CheckConflictsSchema,
  async (input): Promise<ActionResponse<{ conflicts: ConflictJob[] }>> => {
    const supabase = await getServerSupabase()

    try {
      // Basic time validation
      const timeValidation = validateTimeSlot(input.start, input.end)
      if (!timeValidation.ok) {
        return { ok: false, error: timeValidation.message }
      }

      const startDate = new Date(input.start)
      // const endDate = new Date(input.end)
      const searchDate = startDate.toISOString().split('T')[0]

      // Get existing jobs for the technician on this date
      let query = supabase
        .from('jobs')
        .select(`
          id,
          customer_id,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          status,
          description,
          customers(name)
        `)
        .eq('technician_id', input.technicianId)
        .eq('scheduled_date', searchDate)
        .not('scheduled_time_start', 'is', null)
        .not('scheduled_time_end', 'is', null)
        .not('status', 'in', '(completed,cancelled)')

      if (input.excludeJobId) {
        query = query.neq('id', input.excludeJobId)
      }

      const { data: existingJobs, error } = await query

      if (error) {
        console.error('Error checking conflicts:', error)
        return { ok: false, error: 'Failed to check for conflicts' }
      }

      const conflictJobs: ConflictJob[] = existingJobs.map(job => ({
        id: job.id,
        customerId: job.customer_id,
        customerName: job.customers?.name || 'Unknown Customer',
        scheduledDate: job.scheduled_date,
        scheduledTimeStart: job.scheduled_time_start,
        scheduledTimeEnd: job.scheduled_time_end,
        status: job.status,
        description: job.description
      }))

      // Check for time conflicts
      const conflictResult = checkTimeSlotConflicts(
        conflictJobs,
        input.start,
        input.end,
        input.excludeJobId
      )

      if (!conflictResult.ok) {
        return { ok: false, error: conflictResult.message }
      }

      return { ok: true, data: { conflicts: conflictResult.conflicts } }
    } catch (error) {
      console.error('Check conflicts error:', error)
      return { ok: false, error: 'Failed to check for conflicts' }
    }
  },
  { minimumRole: 'technician' }
)

/**
 * Unassigns a technician from a job (dispatcher+ only)
 */
export const unassignTechnician = makeDispatcherAction(
  UnassignTechnicianSchema,
  async (input): Promise<ActionResponse<{ unassigned: boolean }>> => {
    const supabase = await getServerSupabase()

    try {
      // Get current job status
      const { data: job, error: fetchError } = await supabase
        .from('jobs')
        .select('status')
        .eq('id', input.jobId)
        .single()

      if (fetchError || !job) {
        return { ok: false, error: 'Job not found' }
      }

      // Don't allow editing terminal jobs
      if (job.status === 'completed' || job.status === 'cancelled') {
        return { ok: false, error: 'Cannot modify completed or cancelled jobs' }
      }

      // Update the job
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          technician_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.jobId)

      if (updateError) {
        console.error('Error unassigning technician:', updateError)
        return { ok: false, error: 'Failed to unassign technician' }
      }

      // Audit log
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'jobs',
          record_id: input.jobId,
          action: 'UPDATE',
          old_values: { action: 'technician_unassignment' },
          new_values: { technician_id: null }
        })

      revalidatePath('/schedule/calendar')
      revalidatePath('/jobs')

      return { ok: true, data: { unassigned: true } }
    } catch (error) {
      console.error('Unassign technician error:', error)
      return { ok: false, error: 'Failed to unassign technician' }
    }
  }
)