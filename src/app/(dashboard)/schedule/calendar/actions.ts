'use server'

import { z } from 'zod'
import { getServiceSupabase } from '@/lib/supabase/server'
import { makeTechnicianAction } from '@/lib/actions'

/**
 * Get calendar events for date range
 */
export const getCalendarEvents = makeTechnicianAction(
  z.object({
    startDate: z.string(),
    endDate: z.string(),
    technicianId: z.string().optional(),
    zone: z.string().optional(),
    status: z.array(z.string()).optional()
  }),
  async ({ startDate, endDate, technicianId, zone, status }) => {
    const serviceSupabase = getServiceSupabase()

    console.log('📅 getCalendarEvents: Starting with params:', {
      startDate,
      endDate,
      technicianId,
      zone,
      status
    })

    let query = serviceSupabase
      .from('jobs')
      .select(`
        id,
        scheduled_date,
        scheduled_time_start,
        scheduled_time_end,
        status,
        description,
        zone,
        technician_id,
        customers!jobs_customer_id_fkey(
          id,
          name,
          address_line1,
          city,
          state
        )
      `)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date')
      .order('scheduled_time_start')

    // Apply filters
    if (technicianId && technicianId !== 'all') {
      console.log('📅 Filtering by technician:', technicianId)
      query = query.eq('technician_id', technicianId)
    }

    if (zone && zone !== 'all-zones') {
      console.log('📅 Filtering by zone:', zone)
      query = query.eq('zone', zone)
    }

    if (status && status.length > 0 && !status.includes('all')) {
      console.log('📅 Filtering by status:', status)
      query = query.in('status', status)
    }

    const { data: jobs, error } = await query

    if (error) {
      console.error('📅 getCalendarEvents error:', error)
      throw new Error(`Failed to fetch job events: ${error.message}`)
    }

    console.log(`📅 Loaded ${jobs?.length || 0} jobs from database`)

    // Transform to FullCalendar event format
    const events = (jobs || []).map(job => {
      const startTime = job.scheduled_time_start || '09:00'
      const endTime = job.scheduled_time_end || '17:00'

      const event = {
        id: job.id,
        title: job.customers?.name || 'Unknown Customer',
        start: `${job.scheduled_date}T${startTime}:00`,
        end: `${job.scheduled_date}T${endTime}:00`,
        resourceId: job.technician_id || 'unassigned',
        extendedProps: {
          jobId: job.id,
          status: job.status,
          description: job.description,
          customerName: job.customers?.name,
          customerId: job.customers?.id,
          address: job.customers?.address_line1,
          city: job.customers?.city,
          state: job.customers?.state,
          zone: job.zone,
          technicianId: job.technician_id
        },
        backgroundColor: getStatusColor(job.status),
        borderColor: getStatusColor(job.status),
        textColor: '#ffffff'
      }

      console.log('📅 Transformed job to event:', {
        jobId: job.id,
        customer: job.customers?.name,
        date: job.scheduled_date,
        start: startTime,
        end: endTime,
        status: job.status
      })

      return event
    })

    console.log(`📅 Returning ${events.length} events to calendar`)

    return events
  }
)

function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled':
      return '#3b82f6' // blue
    case 'in_progress':
      return '#eab308' // yellow
    case 'completed':
      return '#22c55e' // green
    case 'cancelled':
      return '#ef4444' // red
    default:
      return '#6b7280' // gray
  }
}
