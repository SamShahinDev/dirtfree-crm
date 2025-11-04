'use server'

import { z } from 'zod'

import { getServerSupabase } from '@/lib/supabase/server'
import { makeAction } from '@/lib/actions'

export interface ActionResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

// Schema definitions
const ListTechWeeklyJobsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  technicianId: z.string().uuid().optional().nullable()
})

// Types
export interface TechWeeklyJob {
  id: string
  customerId: string
  technicianId?: string | null
  zone?: string | null
  status: string
  serviceType?: string | null
  scheduledDate?: string | null
  scheduledTimeStart?: string | null
  scheduledTimeEnd?: string | null
  description?: string | null
  customer: {
    name: string
    phone_e164?: string | null
    email?: string | null
    address_line1?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
  }
  technician?: {
    id: string
    display_name?: string | null
    phone_e164?: string | null
  } | null
}

export interface DayJobs {
  date: string
  dayName: string
  jobs: TechWeeklyJob[]
  totalJobs: number
}

export interface ZoneGroup {
  zone: string | null
  zoneName: string
  days: DayJobs[]
  totalJobs: number
}

export interface TechWeeklyData {
  zoneGroups: ZoneGroup[]
  totalJobs: number
  weekStart: string
  weekEnd: string
  technicianName?: string | null
  currentUserId?: string
}

/**
 * Lists jobs for the tech weekly view organized by zone and day
 */
export const listTechWeeklyJobs = makeAction(
  ListTechWeeklyJobsSchema,
  async (input, { user, role }): Promise<ActionResponse<TechWeeklyData>> => {
    const supabase = getServerSupabase()

    try {
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
            name,
            phone_e164,
            email,
            address_line1,
            city,
            state,
            zip
          ),
          technicians:auth.users(
            id,
            user_profiles(
              display_name,
              phone_e164
            )
          )
        `)
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', input.from.split('T')[0])
        .lte('scheduled_date', input.to.split('T')[0])
        .not('status', 'in', '(cancelled)')  // Exclude cancelled, but include completed
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time_start', { ascending: true })

      // Filter by technician if specified
      if (input.technicianId) {
        query = query.eq('technician_id', input.technicianId)
      }

      // Technicians can only see their own jobs
      if (role === 'technician') {
        query = query.eq('technician_id', user.id)
      }

      const { data: jobs, error } = await query

      if (error) {
        console.error('Error fetching tech weekly jobs:', error)
        return { ok: false, error: 'Failed to fetch jobs' }
      }

      // Transform jobs
      const transformedJobs: TechWeeklyJob[] = jobs.map(job => ({
        id: job.id,
        customerId: job.customer_id,
        technicianId: job.technician_id,
        zone: job.zone,
        status: job.status,
        serviceType: job.service_type,
        scheduledDate: job.scheduled_date,
        scheduledTimeStart: job.scheduled_time_start,
        scheduledTimeEnd: job.scheduled_time_end,
        description: job.description,
        customer: {
          name: job.customers.name,
          phone_e164: job.customers.phone_e164,
          email: job.customers.email,
          address_line1: job.customers.address_line1,
          city: job.customers.city,
          state: job.customers.state,
          zip: job.customers.zip
        },
        technician: job.technicians ? {
          id: job.technicians.id,
          display_name: job.technicians.user_profiles?.display_name || null,
          phone_e164: job.technicians.user_profiles?.phone_e164 || null
        } : null
      }))

      // Get technician name if filtering by specific technician
      let technicianName: string | null = null
      if (input.technicianId && transformedJobs.length > 0) {
        technicianName = transformedJobs[0].technician?.display_name || 'Unknown Technician'
      }

      // Generate date range for the week
      const startDate = new Date(input.from.split('T')[0])
      const endDate = new Date(input.to.split('T')[0])
      const dates: string[] = []

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0])
      }

      // Group by zone and then by day
      const zoneMap = new Map<string, Map<string, TechWeeklyJob[]>>()

      for (const job of transformedJobs) {
        const zone = job.zone || 'unassigned'
        const date = job.scheduledDate!

        if (!zoneMap.has(zone)) {
          zoneMap.set(zone, new Map())
        }

        const dayMap = zoneMap.get(zone)!
        if (!dayMap.has(date)) {
          dayMap.set(date, [])
        }

        dayMap.get(date)!.push(job)
      }

      // Build zone groups
      const zoneGroups: ZoneGroup[] = []
      const zones = ['N', 'S', 'E', 'W', 'Central', 'unassigned']

      for (const zone of zones) {
        const dayMap = zoneMap.get(zone)
        if (!dayMap || dayMap.size === 0) continue

        const days: DayJobs[] = []
        let totalZoneJobs = 0

        for (const date of dates) {
          const dayJobs = dayMap.get(date) || []
          if (dayJobs.length === 0) continue

          const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' })

          days.push({
            date,
            dayName,
            jobs: dayJobs,
            totalJobs: dayJobs.length
          })

          totalZoneJobs += dayJobs.length
        }

        if (days.length > 0) {
          zoneGroups.push({
            zone: zone === 'unassigned' ? null : zone,
            zoneName: zone === 'unassigned' ? 'Unassigned' :
                     zone === 'Central' ? 'Central' : `Zone ${zone}`,
            days,
            totalJobs: totalZoneJobs
          })
        }
      }

      return {
        ok: true,
        data: {
          zoneGroups,
          totalJobs: transformedJobs.length,
          weekStart: input.from.split('T')[0],
          weekEnd: input.to.split('T')[0],
          technicianName,
          currentUserId: user.id
        }
      }
    } catch (error) {
      console.error('List tech weekly jobs error:', error)
      return { ok: false, error: 'Failed to fetch tech weekly jobs' }
    }
  },
  { minimumRole: 'technician' }
)