'use server'

import { getServerSupabase } from '@/lib/supabase/server'
import { optimizeRoutes, calculateOptimizationSavings } from '@/lib/scheduling/route-optimizer'
import { revalidatePath } from 'next/cache'

/**
 * Get scheduled jobs for a date range
 */
export async function getScheduledJobsAction(
  startDate: string,
  endDate: string,
  technicianId?: string | null
) {
  const supabase = await getServerSupabase()

  let query = supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(id, name, address, phone, lat, lng, zone_id),
      technician:technicians(id, name, color),
      services:job_services(
        service:services(name, duration_minutes)
      )
    `)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .not('status', 'in', '(cancelled,completed)')

  if (technicianId) {
    query = query.eq('technician_id', technicianId)
  }

  const { data, error } = await query.order('scheduled_time', { ascending: true })

  if (error) {
    console.error('Failed to get scheduled jobs:', error)
    throw new Error('Failed to load scheduled jobs')
  }

  return data || []
}

/**
 * Get unscheduled jobs
 */
export async function getUnscheduledJobsAction() {
  const supabase = await getServerSupabase()

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(id, name, address, phone, lat, lng, zone_id),
      services:job_services(
        service:services(name, duration_minutes)
      ),
      zone:customers!inner(zone:zones(name, color))
    `)
    .is('scheduled_date', null)
    .not('status', 'in', '(cancelled,completed)')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to get unscheduled jobs:', error)
    throw new Error('Failed to load unscheduled jobs')
  }

  // Transform zone data
  const transformedData = (data || []).map(job => ({
    ...job,
    zone: job.zone?.zone?.[0] || null
  }))

  return transformedData
}

/**
 * Update job schedule
 */
export async function updateJobScheduleAction(
  jobId: string,
  updates: {
    scheduled_date?: string | null
    scheduled_time?: string | null
    technician_id?: string | null
  }
) {
  const supabase = await getServerSupabase()

  const { error } = await supabase
    .from('jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId)

  if (error) {
    console.error('Failed to update job schedule:', error)
    throw new Error('Failed to update job schedule')
  }

  revalidatePath('/scheduling')
  return { success: true }
}

/**
 * Get technicians with stats for a date
 */
export async function getTechniciansWithStatsAction(date: string) {
  const supabase = await getServerSupabase()

  // Get all technicians
  const { data: technicians, error: techError } = await supabase
    .from('technicians')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (techError) {
    console.error('Failed to get technicians:', techError)
    throw new Error('Failed to load technicians')
  }

  // Get jobs for the date to calculate stats
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select(`
      *,
      services:job_services(
        service:services(duration_minutes)
      )
    `)
    .eq('scheduled_date', date)
    .not('status', 'in', '(cancelled)')

  if (jobsError) {
    console.error('Failed to get jobs for stats:', jobsError)
    throw new Error('Failed to load job stats')
  }

  // Calculate stats for each technician
  const techniciansWithStats = (technicians || []).map(tech => {
    const techJobs = (jobs || []).filter(job => job.technician_id === tech.id)
    const completedJobs = techJobs.filter(job => job.status === 'completed')

    // Calculate total hours scheduled
    const totalMinutes = techJobs.reduce((sum, job) => {
      const duration = job.services?.reduce((d: number, s: any) =>
        d + (s.service?.duration_minutes || 0), 0) || job.duration || 0
      return sum + duration
    }, 0)

    // Find next available time slot
    const scheduledTimes = techJobs
      .filter(job => job.scheduled_time)
      .map(job => ({
        start: job.scheduled_time,
        duration: job.duration || 60
      }))
      .sort((a, b) => a.start.localeCompare(b.start))

    let nextAvailable = '08:00'
    for (const slot of scheduledTimes) {
      if (slot.start > nextAvailable) {
        break
      }
      const endTime = addMinutesToTime(slot.start, slot.duration)
      if (endTime > nextAvailable) {
        nextAvailable = endTime
      }
    }

    // Calculate efficiency (completed / total)
    const efficiency = techJobs.length > 0
      ? Math.round((completedJobs.length / techJobs.length) * 100)
      : 100

    return {
      ...tech,
      stats: {
        jobsToday: techJobs.length,
        completedToday: completedJobs.length,
        totalHours: totalMinutes / 60,
        efficiency,
        nextAvailable: techJobs.length > 0 ? nextAvailable : null
      }
    }
  })

  return techniciansWithStats
}

/**
 * Get optimized routes for a date
 */
export async function getOptimizedRouteAction(
  date: string,
  technicianId?: string | null
) {
  const supabase = await getServerSupabase()

  // Get scheduled jobs
  const jobs = await getScheduledJobsAction(date, date, technicianId)

  // Group jobs by technician
  const jobsByTechnician = jobs.reduce((acc: any, job: any) => {
    if (!job.technician_id) return acc

    if (!acc[job.technician_id]) {
      acc[job.technician_id] = {
        technician: job.technician,
        jobs: []
      }
    }

    acc[job.technician_id].jobs.push(job)
    return acc
  }, {})

  // Create route data for each technician
  const routes = Object.entries(jobsByTechnician).map(([techId, data]: any) => {
    const sortedJobs = data.jobs.sort((a: any, b: any) => {
      if (!a.scheduled_time || !b.scheduled_time) return 0
      return a.scheduled_time.localeCompare(b.scheduled_time)
    })

    // Calculate distances and travel times between consecutive jobs
    let totalDistance = 0
    let totalTravelTime = 0
    const jobsWithRouteInfo = sortedJobs.map((job: any, index: number) => {
      let distance = 0
      let travelTime = 0

      if (index > 0 && sortedJobs[index - 1].customer?.lat && job.customer?.lat) {
        // Simplified distance calculation - in production use proper routing API
        distance = Math.random() * 10 + 2 // Mock 2-12 miles
        travelTime = Math.round(distance * 2.5) // Mock ~2.5 min per mile
        totalDistance += distance
        totalTravelTime += travelTime
      }

      return {
        id: job.id,
        customer: job.customer,
        scheduled_time: job.scheduled_time,
        duration: job.duration || 60,
        distance_from_previous: distance,
        travel_time: travelTime,
        arrival_time: job.scheduled_time
      }
    })

    const totalDuration = sortedJobs.reduce((sum: number, job: any) =>
      sum + (job.duration || 60), 0) + totalTravelTime

    const workingTime = totalDuration - totalTravelTime
    const efficiency = totalDuration > 0
      ? Math.round((workingTime / totalDuration) * 100)
      : 100

    return {
      technician: data.technician,
      jobs: jobsWithRouteInfo,
      total_distance: totalDistance,
      total_travel_time: totalTravelTime,
      total_duration: totalDuration,
      efficiency_score: efficiency
    }
  })

  return routes
}

/**
 * Optimize routes for a date
 */
export async function optimizeRoutesAction(
  date: string,
  technicianId?: string | null
) {
  const supabase = await getServerSupabase()

  // Get jobs and technicians
  const jobs = await getScheduledJobsAction(date, date, technicianId)

  const { data: technicians } = await supabase
    .from('technicians')
    .select('*')
    .eq('is_active', true)

  if (!technicians) {
    throw new Error('No active technicians found')
  }

  // Prepare data for optimization
  const jobsForOptimization = jobs.map(job => ({
    id: job.id,
    customer: {
      id: job.customer.id,
      name: job.customer.name,
      address: job.customer.address,
      lat: job.customer.lat || generateMockCoordinates().lat,
      lng: job.customer.lng || generateMockCoordinates().lng
    },
    duration: job.duration || 60,
    scheduled_time: job.scheduled_time,
    priority: job.priority
  }))

  const techniciansForOptimization = technicians.map(tech => ({
    id: tech.id,
    name: tech.name,
    working_hours: {
      start: '08:00',
      end: '18:00'
    },
    max_jobs: 10
  }))

  // Run optimization
  const optimizedRoutes = optimizeRoutes(
    jobsForOptimization,
    techniciansForOptimization,
    date
  )

  // Transform back to expected format
  const routes = await Promise.all(optimizedRoutes.map(async route => {
    const tech = technicians.find(t => t.id === route.technician_id)
    const routeJobs = route.jobs.map(optimizedJob => {
      const originalJob = jobs.find(j => j.id === optimizedJob.job_id)
      return {
        id: optimizedJob.job_id,
        customer: originalJob?.customer,
        scheduled_time: optimizedJob.arrival_time,
        duration: originalJob?.duration || 60,
        distance_from_previous: optimizedJob.distance,
        travel_time: optimizedJob.travel_time,
        arrival_time: optimizedJob.arrival_time
      }
    })

    // Calculate potential savings
    const originalDistance = route.total_distance * 1.3 // Assume 30% improvement
    const originalTime = route.total_travel_time * 1.25 // Assume 25% improvement

    return {
      technician: tech,
      jobs: routeJobs,
      total_distance: route.total_distance,
      total_travel_time: route.total_travel_time,
      total_duration: route.total_duration,
      efficiency_score: route.efficiency_score,
      savings: {
        distance: originalDistance - route.total_distance,
        time: originalTime - route.total_travel_time
      }
    }
  }))

  revalidatePath('/scheduling')
  return routes
}

// Helper function to add minutes to time string
function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + mins + minutes
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMins = totalMinutes % 60
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`
}

// Mock coordinate generator for demo
function generateMockCoordinates() {
  return {
    lat: 37.7749 + (Math.random() - 0.5) * 0.2, // San Francisco area
    lng: -122.4194 + (Math.random() - 0.5) * 0.2
  }
}