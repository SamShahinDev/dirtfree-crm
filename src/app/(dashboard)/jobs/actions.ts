'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server'
import { makeDispatcherAction, makeTechnicianAction, makeAction } from '@/lib/actions'
import { normalizeToE164 } from '@/lib/utils/phone'
import { canTransition } from '@/types/job'
import { sendJobNotificationEmail } from '@/lib/email/service'
import {
  JobCreateSchema,
  JobUpdateSchema,
  JobListFilterSchema,
  JobTransitionSchema,
  JobCompleteSchema
} from './schemas/job.zod'

// Additional validation schemas
const AssignTechnicianSchema = z.object({
  jobId: z.string().uuid(),
  technicianId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

const JobIdSchema = z.object({
  id: z.string().uuid()
})

// Response types
interface ActionResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

interface JobListResponse {
  rows: Array<{
    id: string
    customerId: string
    technicianId?: string | null
    zone?: string | null
    status: string
    scheduledDate?: string | null
    scheduledTimeStart?: string | null
    scheduledTimeEnd?: string | null
    description?: string | null
    invoiceUrl?: string | null
    createdAt: string
    updatedAt: string
    customer?: {
      id: string
      name: string
      phone_e164?: string | null
      email?: string | null
      address_line1?: string | null
      city?: string | null
      state?: string | null
    }
    technician?: {
      id: string
      display_name?: string | null
    }
  }>
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Lists jobs with search, filtering, and pagination
 * Accessible by all authenticated users (RLS handles filtering)
 */
export const listJobs = makeTechnicianAction(
  JobListFilterSchema,
  async (params): Promise<JobListResponse> => {
    const supabase = await getServerSupabase()
    // Use service role for queries (permissions verified by makeTechnicianAction)
    const serviceSupabase = getServiceSupabase()
    const { q, status, zone, technicianId, fromDate, toDate, page, pageSize } = params

    // Build the base query
    let query = serviceSupabase
      .from('jobs')
      .select(`
        *,
        customer:customers!jobs_customer_id_fkey(
          id,
          name,
          phone_e164,
          email,
          address_line1,
          city,
          state
        )
      `, { count: 'exact' })

    // Apply search filter
    if (q && q.trim().length > 0) {
      const searchTerm = q.trim()

      // Check if search term looks like a phone number
      const normalizedPhone = normalizeToE164(searchTerm)

      if (normalizedPhone) {
        // Search by customer phone
        query = query.eq('customers.phone_e164', normalizedPhone)
      } else {
        // Search by customer name or address
        query = query.or(`customers.name.ilike.*${searchTerm}*,customers.address_line1.ilike.*${searchTerm}*,customers.city.ilike.*${searchTerm}*`)
      }
    }

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (zone) {
      query = query.eq('zone', zone)
    }

    if (technicianId) {
      query = query.eq('technician_id', technicianId)
    }

    if (fromDate) {
      query = query.gte('scheduled_date', fromDate)
    }

    if (toDate) {
      query = query.lte('scheduled_date', toDate)
    }

    // Get total count
    const { count: total } = await query

    // Apply pagination and ordering
    const offset = (page - 1) * pageSize
    query = query
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time_start', { ascending: true })
      .range(offset, offset + pageSize - 1)

    const { data: jobs, error } = await query

    if (error) {
      throw new Error(`Failed to fetch jobs: ${error.message}`)
    }

    // Get unique technician IDs
    const technicianIds = [...new Set(jobs?.map(j => j.technician_id).filter(Boolean) || [])]

    // Fetch technician data if needed (two-step pattern to avoid non-existent FK)
    let technicianMap: Record<string, { id: string; display_name: string | null }> = {}
    if (technicianIds.length > 0) {
      const { data: techProfiles } = await serviceSupabase
        .from('user_profiles')
        .select('user_id, display_name')
        .in('user_id', technicianIds)

      if (techProfiles) {
        technicianMap = Object.fromEntries(
          techProfiles.map(tp => [tp.user_id, { id: tp.user_id, display_name: tp.display_name }])
        )
      }
    }

    // Merge technician data into jobs
    const jobsWithTechnicians = (jobs || []).map(job => ({
      ...job,
      technician: job.technician_id ? technicianMap[job.technician_id] : undefined
    }))

    const totalPages = Math.ceil((total || 0) / pageSize)

    return {
      rows: jobsWithTechnicians,
      total: total || 0,
      page,
      pageSize,
      totalPages
    }
  }
)

/**
 * Creates a new job
 * Requires dispatcher or admin role
 */
export const createJob = makeDispatcherAction(
  JobCreateSchema,
  async (input, { user }): Promise<ActionResponse<{ id: string }>> => {
    const supabase = await getServerSupabase()
    // Use service role for insert (permissions verified by makeDispatcherAction)
    const serviceSupabase = getServiceSupabase()

    // Prepare job data
    const jobData = {
      customer_id: input.customerId,
      technician_id: input.technicianId || null,
      zone: input.zone || null,
      status: 'scheduled',
      scheduled_date: input.scheduledDate || null,
      scheduled_time_start: input.scheduledTimeStart || null,
      scheduled_time_end: input.scheduledTimeEnd || null,
      description: input.description || null,
      internal_notes: input.internalNotes || null,
      invoice_url: input.invoiceUrl || null
    }

    const { data: job, error} = await serviceSupabase
      .from('jobs')
      .insert(jobData)
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to create job: ${error.message}`)
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'CREATE',
        entity: 'job',
        entity_id: job.id,
        meta: { customer_id: input.customerId, status: 'scheduled' }
      })

    revalidatePath('/jobs')

    return {
      ok: true,
      data: { id: job.id }
    }
  }
)

/**
 * Updates an existing job
 * Requires dispatcher or admin role
 */
export const updateJob = makeDispatcherAction(
  JobUpdateSchema,
  async (input, { user }): Promise<ActionResponse<void>> => {
    const supabase = await getServerSupabase()
    // Use service role for update (permissions verified by makeDispatcherAction)
    const serviceSupabase = getServiceSupabase()
    const { id, currentStatus, ...updates } = input

    // If status is being updated, validate transition
    if (updates.status && currentStatus) {
      if (!canTransition(currentStatus, updates.status)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${updates.status}`)
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (updates.customerId !== undefined) updateData.customer_id = updates.customerId
    if (updates.technicianId !== undefined) updateData.technician_id = updates.technicianId
    if (updates.zone !== undefined) updateData.zone = updates.zone
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.scheduledDate !== undefined) updateData.scheduled_date = updates.scheduledDate
    if (updates.scheduledTimeStart !== undefined) updateData.scheduled_time_start = updates.scheduledTimeStart
    if (updates.scheduledTimeEnd !== undefined) updateData.scheduled_time_end = updates.scheduledTimeEnd
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.internalNotes !== undefined) updateData.internal_notes = updates.internalNotes
    if (updates.invoiceUrl !== undefined) updateData.invoice_url = updates.invoiceUrl

    const { error } = await serviceSupabase
      .from('jobs')
      .update(updateData)
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to update job: ${error.message}`)
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'job',
        entity_id: id,
        meta: { updates: updateData }
      })

    revalidatePath('/jobs')

    return {
      ok: true
    }
  }
)

/**
 * Assigns a technician to a job
 * Requires dispatcher or admin role
 */
export const assignTechnician = makeDispatcherAction(
  AssignTechnicianSchema,
  async (input, { user }): Promise<ActionResponse<void>> => {
    const supabase = await getServerSupabase()
    // Use service role for queries and updates (permissions verified by makeDispatcherAction)
    const serviceSupabase = getServiceSupabase()

    // Verify job exists and is not terminal
    const { data: existingJob, error: fetchError } = await serviceSupabase
      .from('jobs')
      .select('status')
      .eq('id', input.jobId)
      .single()

    if (fetchError || !existingJob) {
      throw new Error('Job not found')
    }

    if (existingJob.status === 'completed' || existingJob.status === 'cancelled') {
      throw new Error('Cannot assign technician to completed or cancelled job')
    }

    // TODO: Add technician schedule conflict validation in Phase 4

    // Prepare update data
    const updateData: Record<string, unknown> = {
      technician_id: input.technicianId
    }

    if (input.scheduledDate) {
      updateData.scheduled_date = input.scheduledDate
    }

    const { error } = await serviceSupabase
      .from('jobs')
      .update(updateData)
      .eq('id', input.jobId)

    if (error) {
      throw new Error(`Failed to assign technician: ${error.message}`)
    }

    // Get job and customer details for email notification
    try {
      const { data: jobDetails, error: jobError } = await serviceSupabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', input.jobId)
        .single()

      // Fetch technician data separately if needed
      let technicianData = null
      if (!jobError && jobDetails?.technician_id) {
        const { data: techProfile } = await serviceSupabase
          .from('user_profiles')
          .select('user_id, display_name, phone_e164')
          .eq('user_id', jobDetails.technician_id)
          .single()

        if (techProfile) {
          technicianData = {
            display_name: techProfile.display_name,
            phone: techProfile.phone_e164
          }
        }
      }

      if (!jobError && jobDetails?.customer?.email &&
          jobDetails.customer.email_notifications &&
          !jobDetails.customer.marketing_opt_out) {
        // Send appointment confirmation email
        const appointmentDate = input.scheduledDate ?
          new Date(input.scheduledDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) :
          'To be scheduled'

        const appointmentTime = jobDetails.scheduled_time_start && jobDetails.scheduled_time_end ?
          `${jobDetails.scheduled_time_start} - ${jobDetails.scheduled_time_end}` :
          'To be determined'

        // Send confirmation email (don't block on this)
        sendJobNotificationEmail(
          jobDetails.customer.email,
          jobDetails.customer.name,
          'appointment_confirmation',
          jobDetails.service_type || 'Carpet Cleaning Service',
          appointmentDate,
          appointmentTime,
          {
            technicianName: technicianData?.display_name,
            technicianPhone: technicianData?.phone,
            address: [
              jobDetails.customer.address_line1,
              jobDetails.customer.city,
              jobDetails.customer.state
            ].filter(Boolean).join(', '),
            notes: 'Please ensure easy access to the service area and secure any pets.'
          }
        ).catch(error => {
          console.error('Failed to send appointment confirmation email:', error)
        })
      }
    } catch (error) {
      console.error('Email notification failed for job assignment:', error)
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'ASSIGN_TECHNICIAN',
        entity: 'job',
        entity_id: input.jobId,
        meta: { technician_id: input.technicianId, scheduled_date: input.scheduledDate }
      })

    revalidatePath('/jobs')

    return {
      ok: true
    }
  }
)

/**
 * Transitions job status
 * Dispatcher+ can change any job; technician can only change their own jobs
 */
export const transitionStatus = makeAction(
  JobTransitionSchema,
  async (input, { user, role }): Promise<ActionResponse<void>> => {
    const supabase = await getServerSupabase()
    // Use service role for queries and updates (permissions verified by makeAction)
    const serviceSupabase = getServiceSupabase()

    // Get current job status and verify permissions
    const { data: job, error: fetchError } = await serviceSupabase
      .from('jobs')
      .select('status, technician_id')
      .eq('id', input.jobId)
      .single()

    if (fetchError || !job) {
      throw new Error('Job not found')
    }

    // Technicians can only change status of their own jobs
    if (role === 'technician' && job.technician_id !== user.id) {
      throw new Error('You can only change the status of your own jobs')
    }

    // Validate transition
    const currentStatus = input.from || job.status
    if (!canTransition(currentStatus, input.to)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${input.to}`)
    }

    const { error } = await serviceSupabase
      .from('jobs')
      .update({ status: input.to })
      .eq('id', input.jobId)

    if (error) {
      throw new Error(`Failed to update job status: ${error.message}`)
    }

    // Send email notifications for specific status changes
    if (input.to === 'in_progress') {
      try {
        const { data: jobDetails, error: jobError } = await serviceSupabase
          .from('jobs')
          .select(`
            *,
            customer:customers(*)
          `)
          .eq('id', input.jobId)
          .single()

        // Fetch technician data separately if needed
        let technicianData = null
        if (!jobError && jobDetails?.technician_id) {
          const { data: techProfile } = await serviceSupabase
            .from('user_profiles')
            .select('user_id, display_name, phone_e164')
            .eq('user_id', jobDetails.technician_id)
            .single()

          if (techProfile) {
            technicianData = {
              display_name: techProfile.display_name,
              phone: techProfile.phone_e164
            }
          }
        }

        if (!jobError && jobDetails?.customer?.email &&
            jobDetails.customer.email_notifications &&
            !jobDetails.customer.marketing_opt_out) {
          const appointmentDate = jobDetails.scheduled_date ?
            new Date(jobDetails.scheduled_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) :
            'Today'

          const appointmentTime = jobDetails.scheduled_time_start && jobDetails.scheduled_time_end ?
            `${jobDetails.scheduled_time_start} - ${jobDetails.scheduled_time_end}` :
            'As scheduled'

          // Send "on the way" notification
          sendJobNotificationEmail(
            jobDetails.customer.email,
            jobDetails.customer.name,
            'on_the_way',
            jobDetails.service_type || 'Carpet Cleaning Service',
            appointmentDate,
            appointmentTime,
            {
              technicianName: technicianData?.display_name,
              technicianPhone: technicianData?.phone,
              estimatedArrival: 'Within 15-30 minutes',
              address: [
                jobDetails.customer.address_line1,
                jobDetails.customer.city,
                jobDetails.customer.state
              ].filter(Boolean).join(', ')
            }
          ).catch(error => {
            console.error('Failed to send on-the-way notification:', error)
          })
        }
      } catch (error) {
        console.error('Email notification failed for status transition:', error)
      }
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'STATUS_TRANSITION',
        entity: 'job',
        entity_id: input.jobId,
        meta: { from: currentStatus, to: input.to, notes: input.notes }
      })

    revalidatePath('/jobs')

    return {
      ok: true
    }
  },
  { minimumRole: 'technician' }
)

/**
 * Completes a job and creates service history
 * Allowed if dispatcher+ or the assigned technician
 */
export const completeJob = makeAction(
  JobCompleteSchema,
  async (input, { user, role }): Promise<ActionResponse<{ completed: boolean }>> => {
    const supabase = await getServerSupabase()
    // Use service role for queries and updates (permissions verified by makeAction)
    const serviceSupabase = getServiceSupabase()

    // Get job details and verify permissions
    const { data: job, error: fetchError } = await serviceSupabase
      .from('jobs')
      .select('*')
      .eq('id', input.jobId)
      .single()

    if (fetchError || !job) {
      throw new Error('Job not found')
    }

    // Check permissions
    if (role === 'technician' && job.technician_id !== user.id) {
      throw new Error('You can only complete your own jobs')
    }

    // Verify job can be completed
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new Error('Job is already completed or cancelled')
    }

    const completedAt = input.completedAt || new Date().toISOString()

    // Update job status to completed
    const { error: updateError } = await serviceSupabase
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', input.jobId)

    if (updateError) {
      throw new Error(`Failed to complete job: ${updateError.message}`)
    }

    // Create service history entry
    const serviceHistoryData = {
      job_id: input.jobId,
      customer_id: job.customer_id,
      technician_id: job.technician_id || user.id,
      completed_at: completedAt,
      notes: input.notes || null
    }

    const { error: historyError } = await serviceSupabase
      .from('service_history')
      .insert(serviceHistoryData)

    if (historyError) {
      // Try to rollback job status change
      await serviceSupabase
        .from('jobs')
        .update({ status: job.status })
        .eq('id', input.jobId)

      throw new Error(`Failed to create service history: ${historyError.message}`)
    }

    // Send completion email notification
    try {
      const { data: jobDetails, error: jobError } = await serviceSupabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', input.jobId)
        .single()

      // Fetch technician data separately if needed
      let technicianData = null
      if (!jobError && jobDetails?.technician_id) {
        const { data: techProfile } = await serviceSupabase
          .from('user_profiles')
          .select('user_id, display_name, phone_e164')
          .eq('user_id', jobDetails.technician_id)
          .single()

        if (techProfile) {
          technicianData = {
            display_name: techProfile.display_name,
            phone: techProfile.phone_e164
          }
        }
      }

      if (!jobError && jobDetails?.customer?.email &&
          jobDetails.customer.email_notifications &&
          !jobDetails.customer.marketing_opt_out) {
        const appointmentDate = jobDetails.scheduled_date ?
          new Date(jobDetails.scheduled_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) :
          new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })

        // Send completion notification with survey link
        sendJobNotificationEmail(
          jobDetails.customer.email,
          jobDetails.customer.name,
          'completion',
          jobDetails.service_type || 'Carpet Cleaning Service',
          appointmentDate,
          'Completed',
          {
            technicianName: technicianData?.display_name,
            technicianPhone: technicianData?.phone,
            feedbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/feedback/${input.jobId}`,
            notes: input.notes || 'Your carpets will be slightly damp. Please avoid heavy foot traffic for 4-6 hours for best results.'
          }
        ).catch(error => {
          console.error('Failed to send completion notification:', error)
        })
      }
    } catch (error) {
      console.error('Email notification failed for job completion:', error)
    }

    // Log the action
    await supabase
      .from('audit_log')
      .insert({
        actor_id: user.id,
        action: 'COMPLETE_JOB',
        entity: 'job',
        entity_id: input.jobId,
        meta: { completed_at: completedAt, notes: input.notes }
      })

    revalidatePath('/jobs')
    revalidatePath(`/customers/${job.customer_id}`)

    return {
      ok: true,
      data: { completed: true }
    }
  },
  { minimumRole: 'technician' }
)

/**
 * Gets a single job by ID
 * Accessible by all authenticated users (RLS handles filtering)
 */
export const getJob = makeTechnicianAction(
  JobIdSchema,
  async ({ id }) => {
    const supabase = await getServerSupabase()
    // Use service role for queries (permissions verified by makeTechnicianAction)
    const serviceSupabase = getServiceSupabase()

    const { data: job, error } = await serviceSupabase
      .from('jobs')
      .select(`
        *,
        customer:customers!jobs_customer_id_fkey(
          id,
          name,
          phone_e164,
          email,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          zone
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      throw new Error(`Failed to fetch job: ${error.message}`)
    }

    // Fetch technician data separately if needed
    if (job?.technician_id) {
      const { data: techProfile } = await serviceSupabase
        .from('user_profiles')
        .select('user_id, display_name, phone_e164, zone')
        .eq('user_id', job.technician_id)
        .single()

      if (techProfile) {
        job.technician = {
          id: techProfile.user_id,
          display_name: techProfile.display_name,
          phone_e164: techProfile.phone_e164,
          zone: techProfile.zone
        }
      }
    }

    return job
  }
)

/**
 * Gets technicians for assignment dropdown
 * Accessible by dispatcher+ users
 */
export const getTechnicians = makeDispatcherAction(
  z.object({}),
  async () => {
    const supabase = await getServerSupabase()
    // Use service role for queries (permissions verified by makeDispatcherAction)
    const serviceSupabase = getServiceSupabase()

    const { data: technicians, error } = await serviceSupabase
      .from('user_profiles')
      .select('user_id, display_name, zone')
      .eq('role', 'technician')
      .order('display_name')

    if (error) {
      throw new Error(`Failed to fetch technicians: ${error.message}`)
    }

    return technicians || []
  }
)

/**
 * Quick customer search for job creation
 * Accessible by dispatcher+ users
 */
export const searchCustomers = makeDispatcherAction(
  z.object({
    q: z.string().min(1).max(100),
    limit: z.number().min(1).max(20).default(10)
  }),
  async ({ q, limit }) => {
    const supabase = await getServerSupabase()
    // Use service role for queries (permissions verified by makeDispatcherAction)
    const serviceSupabase = getServiceSupabase()

    // Check if search term looks like a phone number
    const normalizedPhone = normalizeToE164(q)

    let query = serviceSupabase
      .from('customers')
      .select(`
        id,
        name,
        phone_e164,
        email,
        city,
        state,
        created_at,
        last_service_date,
        total_jobs:jobs(count),
        unpaid_invoices:invoices!invoices_customer_id_fkey(
          id,
          status,
          total_amount_cents
        )
      `)
      .limit(limit)

    if (normalizedPhone) {
      query = query.eq('phone_e164', normalizedPhone)
    } else {
      // Use single-line format for PostgREST or() filter
      query = query.or(`name.ilike.*${q}*,email.ilike.*${q}*,city.ilike.*${q}*`)
    }

    const { data: customers, error } = await query

    if (error) {
      throw new Error(`Failed to search customers: ${error.message}`)
    }

    // Process the data to calculate useful metrics
    const processedCustomers = (customers || []).map((customer: any) => {
      // Invoice status enum: 'draft', 'sent', 'paid', 'void'
      // Unpaid invoices are those with status 'draft' or 'sent'
      const unpaidAmount = customer.unpaid_invoices
        ?.filter((inv: any) => inv.status === 'draft' || inv.status === 'sent')
        ?.reduce((sum: number, inv: any) => sum + (inv.total_amount_cents || 0), 0) || 0

      return {
        id: customer.id,
        name: customer.name,
        phone_e164: customer.phone_e164,
        email: customer.email,
        city: customer.city,
        state: customer.state,
        created_at: customer.created_at,
        last_service_date: customer.last_service_date,
        total_jobs_count: customer.total_jobs?.[0]?.count || 0,
        unpaid_amount_cents: unpaidAmount,
        has_unpaid_invoices: unpaidAmount > 0
      }
    })

    return processedCustomers
  }
)

// Check for scheduling conflicts
export const checkSchedulingConflict = makeTechnicianAction(
  z.object({
    technician_id: z.string().uuid().optional(),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    scheduled_time_start: z.string().optional(),
    scheduled_time_end: z.string().optional(),
    exclude_job_id: z.string().uuid().optional()
  }),
  async (input) => {
    if (!input.technician_id || !input.scheduled_date || !input.scheduled_time_start) {
      return { hasConflict: false }
    }

    const serviceSupabase = getServiceSupabase()

    const { data: jobs, error } = await serviceSupabase
      .from('jobs')
      .select('id, technician_id, scheduled_date, scheduled_time_start, scheduled_time_end')
      .eq('technician_id', input.technician_id)
      .eq('scheduled_date', input.scheduled_date)
      .neq('status', 'cancelled')
      .neq('status', 'completed')

    if (error) {
      throw new Error(`Failed to check conflicts: ${error.message}`)
    }

    const { checkTimeConflict } = await import('@/lib/utils/scheduling')

    const { hasConflict, conflictingJob } = checkTimeConflict(
      jobs || [],
      input,
      input.exclude_job_id
    )

    return {
      hasConflict,
      conflictingJob: conflictingJob ? {
        id: conflictingJob.id,
        time: `${conflictingJob.scheduled_time_start} - ${conflictingJob.scheduled_time_end}`
      } : undefined
    }
  }
)