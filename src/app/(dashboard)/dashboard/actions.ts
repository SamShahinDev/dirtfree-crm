'use server'

import { z } from 'zod'
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server'
import { makeTechnicianAction } from '@/lib/actions'

/**
 * Get dashboard statistics
 */
export const getDashboardStats = makeTechnicianAction(
  z.object({}),
  async () => {
    const serviceSupabase = getServiceSupabase()

    // Get total revenue (from completed jobs)
    const { data: revenueData } = await serviceSupabase
      .from('service_history')
      .select('id')
      .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    // Get active jobs count
    const { count: activeJobsCount } = await serviceSupabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['scheduled', 'in_progress'])

    // Get new customers this month
    const firstDayOfMonth = new Date()
    firstDayOfMonth.setDate(1)
    firstDayOfMonth.setHours(0, 0, 0, 0)

    const { count: newCustomersCount } = await serviceSupabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', firstDayOfMonth.toISOString())

    // Get total customers for satisfaction rate calculation
    const { count: totalCustomers } = await serviceSupabase
      .from('customers')
      .select('*', { count: 'exact', head: true })

    // Get service distribution from jobs
    const { data: allJobs } = await serviceSupabase
      .from('jobs')
      .select('description')

    // Count services by type (parse from description)
    const serviceCount: Record<string, number> = {}
    allJobs?.forEach(job => {
      const desc = job.description || ''
      if (desc.toLowerCase().includes('carpet')) {
        serviceCount['Carpet Cleaning'] = (serviceCount['Carpet Cleaning'] || 0) + 1
      } else if (desc.toLowerCase().includes('upholstery')) {
        serviceCount['Upholstery'] = (serviceCount['Upholstery'] || 0) + 1
      } else if (desc.toLowerCase().includes('tile') || desc.toLowerCase().includes('grout')) {
        serviceCount['Tile & Grout'] = (serviceCount['Tile & Grout'] || 0) + 1
      } else {
        serviceCount['Other Services'] = (serviceCount['Other Services'] || 0) + 1
      }
    })

    // Convert to service distribution format
    const totalJobs = Object.values(serviceCount).reduce((a, b) => a + b, 0) || 1
    const serviceDistribution = [
      {
        name: 'Carpet Cleaning',
        value: Math.round((serviceCount['Carpet Cleaning'] || 0) / totalJobs * 100),
        revenue: (serviceCount['Carpet Cleaning'] || 0) * 250,
        color: '#3b82f6'
      },
      {
        name: 'Upholstery',
        value: Math.round((serviceCount['Upholstery'] || 0) / totalJobs * 100),
        revenue: (serviceCount['Upholstery'] || 0) * 250,
        color: '#8b5cf6'
      },
      {
        name: 'Tile & Grout',
        value: Math.round((serviceCount['Tile & Grout'] || 0) / totalJobs * 100),
        revenue: (serviceCount['Tile & Grout'] || 0) * 250,
        color: '#10b981'
      },
      {
        name: 'Other Services',
        value: Math.round((serviceCount['Other Services'] || 0) / totalJobs * 100),
        revenue: (serviceCount['Other Services'] || 0) * 250,
        color: '#f59e0b'
      }
    ]

    return {
      totalRevenue: (revenueData?.length || 0) * 250, // Estimate $250 per job
      activeJobs: activeJobsCount || 0,
      newCustomers: newCustomersCount || 0,
      satisfactionRate: 94.2, // Could calculate from reviews later
      totalCustomers: totalCustomers || 0,
      serviceDistribution
    }
  }
)

/**
 * Get today's scheduled jobs
 */
export const getTodaysJobs = makeTechnicianAction(
  z.object({}),
  async () => {
    const serviceSupabase = getServiceSupabase()
    const today = new Date().toISOString().split('T')[0]

    const { data: jobs } = await serviceSupabase
      .from('jobs')
      .select(`
        id,
        scheduled_time_start,
        description,
        status,
        customers!jobs_customer_id_fkey(
          id,
          name
        )
      `)
      .eq('scheduled_date', today)
      .order('scheduled_time_start', { ascending: true })
      .limit(10)

    return (jobs || []).map(job => ({
      id: job.id,
      time: job.scheduled_time_start || '00:00',
      customer: job.customers?.name || 'Unknown',
      service: job.description || 'Service',
      status: job.status
    }))
  }
)

/**
 * Get recent activity
 */
export const getRecentActivity = makeTechnicianAction(
  z.object({}),
  async () => {
    const serviceSupabase = getServiceSupabase()

    // Get recent audit log entries
    const { data: auditLogs } = await serviceSupabase
      .from('audit_log')
      .select(`
        id,
        action,
        entity,
        entity_id,
        meta,
        created_at,
        user_profiles(display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    return (auditLogs || []).map(log => {
      let title = 'Activity'
      let description = ''
      let type = 'default'

      switch (log.action) {
        case 'CREATE':
          if (log.entity === 'job') {
            title = 'New Job Scheduled'
            description = 'Service appointment scheduled'
            type = 'job_scheduled'
          } else if (log.entity === 'customer') {
            title = 'New Customer Registered'
            description = 'New customer added to system'
            type = 'new_customer'
          }
          break
        case 'COMPLETE_JOB':
          title = 'Job Completed'
          description = 'Service completed successfully'
          type = 'job_completed'
          break
        case 'UPDATE':
          title = 'Record Updated'
          description = `${log.entity} information updated`
          type = 'update'
          break
      }

      return {
        id: log.id,
        type,
        title,
        description,
        customer: log.user_profiles?.display_name || 'System',
        time: getTimeAgo(new Date(log.created_at))
      }
    })
  }
)

/**
 * Get top performing technicians (by job count)
 */
export const getTopTechnicians = makeTechnicianAction(
  z.object({}),
  async () => {
    const serviceSupabase = getServiceSupabase()

    // Get technicians with their completed job counts
    const { data: technicianStats } = await serviceSupabase
      .from('service_history')
      .select(`
        technician_id,
        user_profiles!service_history_technician_id_fkey(
          display_name
        )
      `)
      .not('technician_id', 'is', null)
      .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    // Group by technician and count jobs
    const techMap = new Map()
    technicianStats?.forEach(entry => {
      const techId = entry.technician_id
      const techName = entry.user_profiles?.display_name || 'Unknown'

      if (!techMap.has(techId)) {
        techMap.set(techId, {
          name: techName,
          jobs: 0,
          rating: 4.8, // Default rating
          revenue: 0
        })
      }

      const tech = techMap.get(techId)
      tech.jobs++
      tech.revenue += 250 // Estimate $250 per job
    })

    // Convert to array and sort by job count
    return Array.from(techMap.values())
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 4)
  }
)

// Helper function to format relative time
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  }

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit)
    if (interval >= 1) {
      return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`
    }
  }

  return 'just now'
}
