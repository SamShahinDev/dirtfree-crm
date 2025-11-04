'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'

import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server'
import { makeAction, makeDispatcherAction } from '@/lib/actions'
import { checkTimeSlotConflicts, validateTimeSlot, type ConflictJob } from '@/lib/schedule/conflicts'
import { combineDateTime, isValidTimeRange } from '@/lib/schedule/time'
import {
  bucketForTimes,
  calculateNewTimeWindow,
  nextPosition,
  type BucketKey,
  type ZoneKey
} from '@/lib/schedule/board'

export interface ActionResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

// Schema definitions
const ListZoneBoardSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  zones: z.array(z.string()).optional(),
  includeTerminal: z.boolean().default(false)
})

const MoveCardSchema = z.object({
  jobId: z.string().uuid(),
  toZone: z.string().nullable(),
  toBucket: z.enum(['morning', 'afternoon', 'evening', 'any']),
  beforeId: z.string().uuid().optional().nullable(),
  afterId: z.string().uuid().optional().nullable()
})

const ReorderInBucketSchema = z.object({
  jobId: z.string().uuid(),
  prevId: z.string().uuid().optional().nullable(),
  nextId: z.string().uuid().optional().nullable()
})

const AssignTechQuickSchema = z.object({
  jobId: z.string().uuid(),
  technicianId: z.string().uuid()
})

const AssignJobSchema = z.object({
  jobId: z.string().uuid(),
  technicianId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional()
})

const QuickCreateJobSchema = z.object({
  customerId: z.string().uuid(),
  zone: z.string().nullable(),
  bucket: z.enum(['morning', 'afternoon', 'evening', 'any']),
  description: z.string().max(500).optional().nullable()
})

// Types
export interface JobListItem {
  id: string
  customerId: string
  technicianId?: string | null
  zone?: string | null
  status: string
  scheduledDate?: string | null
  scheduledTimeStart?: string | null
  scheduledTimeEnd?: string | null
  description?: string | null
  position: number
  customer: {
    name: string
    phone_e164?: string | null
    city?: string | null
    state?: string | null
  }
  technician?: {
    id: string
    display_name?: string | null
  } | null
}

export interface BucketData {
  key: BucketKey
  label: string
  jobs: JobListItem[]
  count: number
  estimatedMinutes: number
}

export interface ZoneColumnData {
  zone: string | null
  label: string
  buckets: BucketData[]
  totalJobs: number
  totalMinutes: number
  techCapacity: {
    technicianId: string
    technicianName: string
    assignedJobs: number
    estimatedMinutes: number
  }[]
}

export interface ZoneBoardData {
  columns: ZoneColumnData[]
  totalJobs: number
  unassignedJobs: number
  date: string
}

/**
 * Lists all jobs organized by zone and time bucket for the board view
 */
export const listZoneBoard = makeAction(
  ListZoneBoardSchema,
  async (input, { user, role }): Promise<ZoneBoardData> => {
    const supabase = await getServerSupabase()

    console.log('🔍 [ZONE BOARD] Starting listZoneBoard action', {
      input,
      userRole: role,
      userId: user.id
    })

    try {
      // Use service role to bypass RLS
      const serviceSupabase = getServiceSupabase()

      // 🚨 EMERGENCY DEBUG - Verify database connectivity
      console.log('🚨 [DEBUG] Starting emergency verification')

      // Count ALL jobs in database
      const { count: totalCount, error: countError } = await serviceSupabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })

      console.log('🚨 [DEBUG] Total jobs in entire database:', totalCount)
      console.log('🚨 [DEBUG] Count error:', countError)

      // Count jobs for the specific date
      const { count: dateCount, error: dateCountError } = await serviceSupabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('scheduled_date', input.date)

      console.log('🚨 [DEBUG] Jobs for date', input.date, ':', dateCount)
      console.log('🚨 [DEBUG] Date count error:', dateCountError)

      // Get a sample of ALL jobs to see date formats
      const { data: sampleJobs, error: sampleError } = await serviceSupabase
        .from('jobs')
        .select('id, scheduled_date, zone, status')
        .limit(10)

      console.log('🚨 [DEBUG] Sample jobs from database:', sampleJobs)
      console.log('🚨 [DEBUG] Sample error:', sampleError)

      console.log('🔍 [ACTION] Querying jobs for date:', input.date)

      const { data: jobs, error } = await serviceSupabase
        .from('jobs')
        .select(`
          id,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          status,
          zone,
          description,
          customer_id,
          technician_id,
          customer:customers (
            id,
            name,
            address_line1,
            city,
            state,
            phone_e164
          )
        `)
        .eq('scheduled_date', input.date)
        .order('scheduled_time_start', { ascending: true })

      console.log('🔍 [ACTION] Query returned:', jobs?.length, 'jobs')
      console.log('🔍 [ACTION] First job:', jobs?.[0])
      console.log('🔍 [ACTION] First job customer:', jobs?.[0]?.customer)
      console.log('🔍 [ACTION] Query error:', error)

      if (error) {
        console.error('❌ [ACTION] Database error:', error)
        throw new Error(`Failed to query jobs: ${error.message}`)
      }

      // Filter by zones if specified
      let filteredJobs = jobs || []
      if (input.zones && input.zones.length > 0) {
        filteredJobs = filteredJobs.filter(job => input.zones!.includes(job.zone))
        console.log('🗺️ [ZONE BOARD] Filtering by zones:', input.zones)
      }

      // Include/exclude terminal jobs
      if (!input.includeTerminal) {
        filteredJobs = filteredJobs.filter(job => job.status !== 'completed' && job.status !== 'cancelled')
        console.log('❌ [ZONE BOARD] Excluding terminal jobs (completed/cancelled)')
      } else {
        console.log('✅ [ZONE BOARD] Including terminal jobs (completed/cancelled)')
      }

      // Technicians can only see their own jobs
      if (role === 'technician') {
        filteredJobs = filteredJobs.filter(job => job.technician_id === user.id)
        console.log('👤 [ZONE BOARD] Technician view - filtering by user:', user.id)
      }

      // Customer data is already included in the main query via join
      // Add fallback for jobs without customer data
      const jobsWithCustomers = filteredJobs.map(job => ({
        ...job,
        customer: job.customer || { name: 'Unknown', address_line1: '', city: '', phone_e164: '', state: '' }
      }))

      console.log('🔍 [ACTION] Jobs with customers:', jobsWithCustomers.length)
      console.log('🔍 [ACTION] First job with customer:', jobsWithCustomers[0])

      console.log('📊 [ZONE BOARD] Query result:', {
        jobsCount: jobsWithCustomers?.length || 0,
        hasError: false,
        error: undefined
      })

      // Organize jobs by zone and bucket
      const zoneMap = new Map<string, Map<BucketKey, JobListItem[]>>()
      const unassignedJobs: JobListItem[] = []
      let totalJobs = 0

      console.log('🏗️ [ZONE BOARD] Processing jobs:', {
        totalJobs: jobsWithCustomers.length,
        sampleJob: jobsWithCustomers[0] ? {
          id: jobsWithCustomers[0].id,
          zone: jobsWithCustomers[0].zone,
          status: jobsWithCustomers[0].status,
          hasTechnician: !!jobsWithCustomers[0].technician_id
        } : null
      })

      for (const job of jobsWithCustomers) {
        const jobItem: JobListItem = {
          id: job.id,
          customerId: job.customer_id,
          technicianId: job.technician_id,
          zone: job.zone,
          status: job.status,
          scheduledDate: job.scheduled_date,
          scheduledTimeStart: job.scheduled_time_start,
          scheduledTimeEnd: job.scheduled_time_end,
          description: job.description,
          position: 0, // Position field doesn't exist in DB, using default
          customer: {
            name: job.customer.name,
            phone_e164: job.customer.phone_e164,
            city: job.customer.city,
            state: job.customer.state
          },
          technician: job.technician_id ? {
            id: job.technician_id,
            display_name: null // Will be fetched separately if needed
          } : null
        }

        totalJobs++

        if (!job.zone) {
          unassignedJobs.push(jobItem)
          continue
        }

        const bucket = bucketForTimes(job.scheduled_time_start, job.scheduled_time_end)

        if (!zoneMap.has(job.zone)) {
          zoneMap.set(job.zone, new Map())
        }

        const zoneBuckets = zoneMap.get(job.zone)!
        if (!zoneBuckets.has(bucket)) {
          zoneBuckets.set(bucket, [])
        }

        zoneBuckets.get(bucket)!.push(jobItem)
      }

      console.log('📦 [ZONE BOARD] Jobs organized by zone:', {
        zones: Array.from(zoneMap.keys()),
        unassignedCount: unassignedJobs.length,
        totalJobs
      })

      // Build column data
      const columns: ZoneColumnData[] = []
      const zones = ['N', 'S', 'E', 'W', 'Central']

      for (const zone of zones) {
        const zoneBuckets = zoneMap.get(zone) || new Map()
        const buckets: BucketData[] = []
        let totalZoneJobs = 0
        let totalZoneMinutes = 0

        // Create buckets for this zone
        const bucketKeys: BucketKey[] = ['morning', 'afternoon', 'evening', 'any']
        for (const bucketKey of bucketKeys) {
          const bucketJobs = zoneBuckets.get(bucketKey) || []
          let estimatedMinutes = 0

          // Calculate estimated duration for bucket
          for (const job of bucketJobs) {
            if (job.scheduledTimeStart && job.scheduledTimeEnd) {
              const start = new Date(`2000-01-01T${job.scheduledTimeStart}:00`)
              const end = new Date(`2000-01-01T${job.scheduledTimeEnd}:00`)
              estimatedMinutes += (end.getTime() - start.getTime()) / (1000 * 60)
            } else {
              estimatedMinutes += 120 // Default 2 hours for unscheduled jobs
            }
          }

          buckets.push({
            key: bucketKey,
            label: bucketKey.charAt(0).toUpperCase() + bucketKey.slice(1),
            jobs: bucketJobs,
            count: bucketJobs.length,
            estimatedMinutes
          })

          totalZoneJobs += bucketJobs.length
          totalZoneMinutes += estimatedMinutes
        }

        // Calculate tech capacity for this zone
        const techMap = new Map<string, { name: string; jobs: number; minutes: number }>()
        for (const bucket of buckets) {
          for (const job of bucket.jobs) {
            if (job.technician) {
              const techId = job.technician.id
              if (!techMap.has(techId)) {
                techMap.set(techId, {
                  name: job.technician.display_name || 'Unknown',
                  jobs: 0,
                  minutes: 0
                })
              }

              const tech = techMap.get(techId)!
              tech.jobs++

              if (job.scheduledTimeStart && job.scheduledTimeEnd) {
                const start = new Date(`2000-01-01T${job.scheduledTimeStart}:00`)
                const end = new Date(`2000-01-01T${job.scheduledTimeEnd}:00`)
                tech.minutes += (end.getTime() - start.getTime()) / (1000 * 60)
              } else {
                tech.minutes += 120
              }
            }
          }
        }

        const techCapacity = Array.from(techMap.entries()).map(([techId, data]) => ({
          technicianId: techId,
          technicianName: data.name,
          assignedJobs: data.jobs,
          estimatedMinutes: data.minutes
        }))

        columns.push({
          zone,
          label: zone === 'Central' ? 'Central' : `Zone ${zone}`,
          buckets,
          totalJobs: totalZoneJobs,
          totalMinutes: totalZoneMinutes,
          techCapacity
        })
      }

      // Add unassigned column if there are unassigned jobs
      if (unassignedJobs.length > 0) {
        columns.push({
          zone: null,
          label: 'Unassigned',
          buckets: [{
            key: 'any',
            label: 'Unassigned Jobs',
            jobs: unassignedJobs,
            count: unassignedJobs.length,
            estimatedMinutes: unassignedJobs.length * 120 // Default 2 hours each
          }],
          totalJobs: unassignedJobs.length,
          totalMinutes: unassignedJobs.length * 120,
          techCapacity: []
        })
      }

      const result = {
        columns,
        totalJobs,
        unassignedJobs: unassignedJobs.length,
        date: input.date
      }

      // Get sample job data for logging
      const sampleColumn = columns.find(c => c.totalJobs > 0)
      const sampleBucket = sampleColumn?.buckets.find(b => b.jobs.length > 0)
      const sampleJob = sampleBucket?.jobs[0]

      console.log('✅ [ZONE BOARD] Success! Returning data with structure:', {
        '🔑 Top-level keys': Object.keys(result),
        '📊 Stats': {
          totalColumns: columns.length,
          totalJobs,
          unassignedJobs: unassignedJobs.length,
          columnsWithJobs: columns.filter(c => c.totalJobs > 0).length
        },
        '📦 Sample Column': sampleColumn ? {
          zone: sampleColumn.zone,
          totalJobs: sampleColumn.totalJobs,
          bucketsCount: sampleColumn.buckets.length
        } : null,
        '📝 Sample Job': sampleJob ? {
          id: sampleJob.id,
          customerName: sampleJob.customer.name,
          zone: sampleJob.zone,
          status: sampleJob.status
        } : null,
        '🗂️ Actual result object': result
      })

      console.log('📤 [ZONE BOARD] Returning result directly (wrapper will add success):', {
        hasColumns: !!result.columns,
        columnsIsArray: Array.isArray(result.columns),
        columnsLength: result.columns?.length,
        keys: Object.keys(result)
      })

      // Return data directly - makeAction wrapper will wrap it in { success: true, data: result }
      return result
    } catch (error) {
      console.error('❌ [ZONE BOARD] List zone board error:', error)
      // Throw error - makeAction wrapper will catch and wrap it in { success: false, error: '...' }
      throw new Error('Failed to fetch zone board data')
    }
  },
  { minimumRole: 'technician' }
)

/**
 * Moves a job card to a different zone/bucket
 */
export const moveCard = makeDispatcherAction(
  MoveCardSchema,
  async (input): Promise<ActionResponse<{ moved: boolean }>> => {
    const supabase = await getServerSupabase()

    try {
      // Get current job details
      const { data: currentJob, error: fetchError } = await supabase
        .from('jobs')
        .select(`
          id,
          zone,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          technician_id,
          status,
          position
        `)
        .eq('id', input.jobId)
        .single()

      if (fetchError || !currentJob) {
        return { ok: false, error: 'Job not found' }
      }

      // Don't allow moving terminal jobs
      if (currentJob.status === 'completed' || currentJob.status === 'cancelled') {
        return { ok: false, error: 'Cannot move completed or cancelled jobs' }
      }

      // Calculate new time window if bucket changed
      const newTimeWindow = calculateNewTimeWindow(
        currentJob.scheduled_time_start,
        currentJob.scheduled_time_end,
        input.toBucket
      )

      // Calculate new position
      let newPosition = currentJob.position || 0

      if (input.beforeId || input.afterId) {
        // Get positions of neighboring jobs
        const neighbors = []
        if (input.beforeId) {
          const { data: beforeJob } = await supabase
            .from('jobs')
            .select('position')
            .eq('id', input.beforeId)
            .single()
          if (beforeJob) neighbors.push({ id: input.beforeId, position: beforeJob.position })
        }
        if (input.afterId) {
          const { data: afterJob } = await supabase
            .from('jobs')
            .select('position')
            .eq('id', input.afterId)
            .single()
          if (afterJob) neighbors.push({ id: input.afterId, position: afterJob.position })
        }

        // Calculate position between neighbors
        const beforePos = neighbors.find(n => n.id === input.beforeId)?.position
        const afterPos = neighbors.find(n => n.id === input.afterId)?.position
        newPosition = nextPosition(beforePos, afterPos)
      }

      // Check for conflicts if job has a technician and valid time window
      if (currentJob.technician_id && newTimeWindow.start && newTimeWindow.end && currentJob.scheduled_date) {
        const startDateTime = combineDateTime(currentJob.scheduled_date, newTimeWindow.start)
        const endDateTime = combineDateTime(currentJob.scheduled_date, newTimeWindow.end)

        // Get existing jobs for the technician on this date
        const { data: existingJobs, error: conflictError } = await supabase
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
          .eq('technician_id', currentJob.technician_id)
          .eq('scheduled_date', currentJob.scheduled_date)
          .not('scheduled_time_start', 'is', null)
          .not('scheduled_time_end', 'is', null)
          .not('status', 'in', '(completed,cancelled)')
          .neq('id', input.jobId)

        if (conflictError) {
          console.error('Error checking conflicts:', conflictError)
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

        const conflictResult = checkTimeSlotConflicts(
          conflictJobs,
          startDateTime,
          endDateTime,
          input.jobId
        )

        if (!conflictResult.ok) {
          return { ok: false, error: 'conflict' }
        }
      }

      // Update the job
      const updateData: any = {
        zone: input.toZone,
        position: newPosition,
        updated_at: new Date().toISOString()
      }

      // Update time window if it changed
      if (newTimeWindow.start !== currentJob.scheduled_time_start ||
          newTimeWindow.end !== currentJob.scheduled_time_end) {
        updateData.scheduled_time_start = newTimeWindow.start
        updateData.scheduled_time_end = newTimeWindow.end
      }

      const { error: updateError } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', input.jobId)

      if (updateError) {
        console.error('Error moving job card:', updateError)
        return { ok: false, error: 'Failed to move job card' }
      }

      // Audit log
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'jobs',
          record_id: input.jobId,
          action: 'UPDATE',
          old_values: {
            action: 'move_card',
            from_zone: currentJob.zone,
            from_bucket: bucketForTimes(currentJob.scheduled_time_start, currentJob.scheduled_time_end)
          },
          new_values: {
            to_zone: input.toZone,
            to_bucket: input.toBucket,
            new_position: newPosition
          }
        })

      revalidatePath('/schedule/zone-board')
      revalidatePath('/jobs')

      return { ok: true, data: { moved: true } }
    } catch (error) {
      console.error('Move card error:', error)
      return { ok: false, error: 'Failed to move job card' }
    }
  }
)

/**
 * Reorders a job within the same bucket
 */
export const reorderInBucket = makeDispatcherAction(
  ReorderInBucketSchema,
  async (input): Promise<ActionResponse<{ reordered: boolean }>> => {
    const supabase = await getServerSupabase()

    try {
      // Get current job
      const { data: currentJob, error: fetchError } = await supabase
        .from('jobs')
        .select('position, status')
        .eq('id', input.jobId)
        .single()

      if (fetchError || !currentJob) {
        return { ok: false, error: 'Job not found' }
      }

      // Don't allow reordering terminal jobs
      if (currentJob.status === 'completed' || currentJob.status === 'cancelled') {
        return { ok: false, error: 'Cannot reorder completed or cancelled jobs' }
      }

      // Get positions of neighboring jobs
      const neighbors = []
      if (input.prevId) {
        const { data: prevJob } = await supabase
          .from('jobs')
          .select('position')
          .eq('id', input.prevId)
          .single()
        if (prevJob) neighbors.push({ id: input.prevId, position: prevJob.position })
      }
      if (input.nextId) {
        const { data: nextJob } = await supabase
          .from('jobs')
          .select('position')
          .eq('id', input.nextId)
          .single()
        if (nextJob) neighbors.push({ id: input.nextId, position: nextJob.position })
      }

      // Calculate new position
      const prevPos = neighbors.find(n => n.id === input.prevId)?.position
      const nextPos = neighbors.find(n => n.id === input.nextId)?.position
      const newPosition = nextPosition(prevPos, nextPos)

      // Update position
      const { error: updateError } = await supabase
        .from('jobs')
        .update({
          position: newPosition,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.jobId)

      if (updateError) {
        console.error('Error reordering job:', updateError)
        return { ok: false, error: 'Failed to reorder job' }
      }

      revalidatePath('/schedule/zone-board')

      return { ok: true, data: { reordered: true } }
    } catch (error) {
      console.error('Reorder in bucket error:', error)
      return { ok: false, error: 'Failed to reorder job' }
    }
  }
)

/**
 * Quickly assigns a technician to a job
 */
export const assignTechQuick = makeDispatcherAction(
  AssignTechQuickSchema,
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

      // Don't allow assigning to terminal jobs
      if (job.status === 'completed' || job.status === 'cancelled') {
        return { ok: false, error: 'Cannot assign technician to completed or cancelled jobs' }
      }

      // Quick conflict check if job has scheduled time
      if (job.scheduled_date && job.scheduled_time_start && job.scheduled_time_end) {
        const startTime = combineDateTime(job.scheduled_date, job.scheduled_time_start)
        const endTime = combineDateTime(job.scheduled_date, job.scheduled_time_end)

        const { data: conflictingJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('technician_id', input.technicianId)
          .eq('scheduled_date', job.scheduled_date)
          .not('scheduled_time_start', 'is', null)
          .not('scheduled_time_end', 'is', null)
          .not('status', 'in', '(completed,cancelled)')
          .neq('id', input.jobId)

        if (conflictingJobs && conflictingJobs.length > 0) {
          // More detailed conflict check would be done here
          // For now, just check if there are any other jobs
          return { ok: false, error: 'Potential scheduling conflict detected' }
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
          old_values: { action: 'quick_assign_technician' },
          new_values: { technician_id: input.technicianId }
        })

      revalidatePath('/schedule/zone-board')
      revalidatePath('/jobs')

      return { ok: true, data: { assigned: true } }
    } catch (error) {
      console.error('Assign tech quick error:', error)
      return { ok: false, error: 'Failed to assign technician' }
    }
  }
)

/**
 * Quickly creates a new job in a specific zone and bucket
 */
export const quickCreateJob = makeDispatcherAction(
  QuickCreateJobSchema,
  async (input): Promise<ActionResponse<{ created: boolean; jobId: string }>> => {
    const supabase = await getServerSupabase()

    try {
      // Calculate time window based on bucket
      const timeWindow = calculateNewTimeWindow(null, null, input.bucket)

      // Create the job
      const { data: newJob, error: createError } = await supabase
        .from('jobs')
        .insert({
          customer_id: input.customerId,
          zone: input.zone,
          status: 'scheduled',
          scheduled_date: new Date().toISOString().split('T')[0], // Today
          scheduled_time_start: timeWindow.start,
          scheduled_time_end: timeWindow.end,
          description: input.description,
          position: nextPosition(), // Default position
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (createError || !newJob) {
        console.error('Error creating job:', createError)
        return { ok: false, error: 'Failed to create job' }
      }

      // Audit log
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'jobs',
          record_id: newJob.id,
          action: 'INSERT',
          old_values: null,
          new_values: {
            action: 'quick_create',
            zone: input.zone,
            bucket: input.bucket
          }
        })

      revalidatePath('/schedule/zone-board')
      revalidatePath('/jobs')

      return { ok: true, data: { created: true, jobId: newJob.id } }
    } catch (error) {
      console.error('Quick create job error:', error)
      return { ok: false, error: 'Failed to create job' }
    }
  }
)

/**
 * Assigns a technician to a job with full conflict checking and audit logging
 * This is the primary assignment action for the Zone Board
 */
export const assignJob = makeDispatcherAction(
  AssignJobSchema,
  async (input): Promise<ActionResponse<{ assigned: boolean }>> => {
    const supabase = await getServerSupabase()

    try {
      // Get job details
      const { data: job, error: fetchError } = await supabase
        .from('jobs')
        .select(`
          id,
          customer_id,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          status,
          zone,
          technician_id,
          customers(name)
        `)
        .eq('id', input.jobId)
        .single()

      if (fetchError || !job) {
        return { ok: false, error: 'Job not found' }
      }

      // Don't allow assigning to terminal jobs
      if (job.status === 'completed' || job.status === 'cancelled') {
        return { ok: false, error: 'Cannot assign technician to completed or cancelled jobs' }
      }

      // Use the provided scheduled date or fall back to the job's current date
      const scheduledDate = input.scheduledDate || job.scheduled_date

      // Comprehensive conflict check if job has scheduled time
      if (scheduledDate && job.scheduled_time_start && job.scheduled_time_end) {
        const startTime = combineDateTime(scheduledDate, job.scheduled_time_start)
        const endTime = combineDateTime(scheduledDate, job.scheduled_time_end)

        // Get existing jobs for the technician on this date
        const { data: existingJobs, error: conflictError } = await supabase
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
          .eq('scheduled_date', scheduledDate)
          .not('scheduled_time_start', 'is', null)
          .not('scheduled_time_end', 'is', null)
          .not('status', 'in', '(completed,cancelled)')
          .neq('id', input.jobId)

        if (conflictError) {
          console.error('Error checking conflicts:', conflictError)
          return { ok: false, error: 'Failed to check for conflicts' }
        }

        if (existingJobs && existingJobs.length > 0) {
          const conflictJobs: ConflictJob[] = existingJobs.map(conflictJob => ({
            id: conflictJob.id,
            customerId: conflictJob.customer_id,
            customerName: conflictJob.customers?.name || 'Unknown Customer',
            scheduledDate: conflictJob.scheduled_date,
            scheduledTimeStart: conflictJob.scheduled_time_start,
            scheduledTimeEnd: conflictJob.scheduled_time_end,
            status: conflictJob.status,
            description: conflictJob.description
          }))

          const conflictResult = checkTimeSlotConflicts(
            conflictJobs,
            startTime,
            endTime,
            input.jobId
          )

          if (!conflictResult.ok) {
            return { ok: false, error: conflictResult.message }
          }
        }
      }

      // Get the current technician for audit purposes
      const previousTechnicianId = job.technician_id

      // Update the job with new assignment
      const updateData: any = {
        technician_id: input.technicianId,
        updated_at: new Date().toISOString()
      }

      // Update scheduled date if provided
      if (input.scheduledDate && input.scheduledDate !== job.scheduled_date) {
        updateData.scheduled_date = input.scheduledDate
      }

      const { error: updateError } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', input.jobId)

      if (updateError) {
        console.error('Error assigning job:', updateError)
        return { ok: false, error: 'Failed to assign technician to job' }
      }

      // Comprehensive audit log
      await supabase
        .from('audit_logs')
        .insert({
          table_name: 'jobs',
          record_id: input.jobId,
          action: 'UPDATE',
          old_values: {
            action: 'assign_job',
            previous_technician_id: previousTechnicianId,
            previous_scheduled_date: job.scheduled_date,
            customer_name: job.customers?.name,
            job_zone: job.zone
          },
          new_values: {
            assigned_technician_id: input.technicianId,
            new_scheduled_date: input.scheduledDate || job.scheduled_date,
            assignment_timestamp: new Date().toISOString()
          }
        })

      // Revalidate cache
      revalidatePath('/schedule/zone-board')
      revalidatePath('/schedule/calendar')
      revalidatePath('/jobs')

      return { ok: true, data: { assigned: true } }
    } catch (error) {
      console.error('Assign job error:', error)
      return { ok: false, error: 'Failed to assign technician to job' }
    }
  }
)