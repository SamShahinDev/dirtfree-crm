'use server'

import { getServerSupabase } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subDays, subMonths, format } from 'date-fns'

/**
 * Get analytics stats for the dashboard
 */
export async function getAnalyticsStatsAction() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  // Get revenue data
  const { data: thisMonthRevenue } = await supabase
    .from('invoices')
    .select('total')
    .eq('status', 'paid')
    .gte('paid_at', thisMonthStart.toISOString())
    .lte('paid_at', thisMonthEnd.toISOString())

  const { data: lastMonthRevenue } = await supabase
    .from('invoices')
    .select('total')
    .eq('status', 'paid')
    .gte('paid_at', lastMonthStart.toISOString())
    .lte('paid_at', lastMonthEnd.toISOString())

  const currentRevenue = thisMonthRevenue?.reduce((sum, inv) => sum + inv.total, 0) || 0
  const previousRevenue = lastMonthRevenue?.reduce((sum, inv) => sum + inv.total, 0) || 0
  const revenueChange = previousRevenue > 0
    ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
    : 0

  // Get customer data
  const { count: totalCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  const { count: activeCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .gte('last_service_date', subMonths(now, 3).toISOString())

  const { count: newCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())

  const customerChange = newCustomers || 0

  // Get jobs data
  const { count: scheduledJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .gte('scheduled_date', thisMonthStart.toISOString())
    .lte('scheduled_date', thisMonthEnd.toISOString())

  const { count: completedJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', thisMonthStart.toISOString())
    .lte('completed_at', thisMonthEnd.toISOString())

  const completionRate = scheduledJobs && scheduledJobs > 0
    ? Math.round((completedJobs || 0) / scheduledJobs * 100)
    : 0

  // Calculate average job value
  const avgJobValue = completedJobs && completedJobs > 0
    ? currentRevenue / completedJobs
    : 0

  const { data: lastMonthJobs } = await supabase
    .from('invoices')
    .select('total')
    .eq('status', 'paid')
    .gte('paid_at', lastMonthStart.toISOString())
    .lte('paid_at', lastMonthEnd.toISOString())

  const lastMonthAvgValue = lastMonthJobs && lastMonthJobs.length > 0
    ? lastMonthRevenue / lastMonthJobs.length
    : 0

  const avgJobValueChange = lastMonthAvgValue > 0
    ? ((avgJobValue - lastMonthAvgValue) / lastMonthAvgValue) * 100
    : 0

  return {
    revenue: {
      total: currentRevenue,
      changePercent: Math.round(revenueChange)
    },
    customers: {
      total: totalCustomers || 0,
      active: activeCustomers || 0,
      changePercent: customerChange
    },
    jobs: {
      scheduled: scheduledJobs || 0,
      completed: completedJobs || 0,
      completionRate
    },
    avgJobValue,
    avgJobValueChange: Math.round(avgJobValueChange)
  }
}

/**
 * Get revenue data for chart
 */
export async function getRevenueDataAction(range: '7d' | '30d' | '90d' | '1y') {
  const supabase = await getServerSupabase()
  const now = new Date()
  let startDate: Date

  switch (range) {
    case '7d':
      startDate = subDays(now, 7)
      break
    case '30d':
      startDate = subDays(now, 30)
      break
    case '90d':
      startDate = subDays(now, 90)
      break
    case '1y':
      startDate = subDays(now, 365)
      break
  }

  // Get invoices in date range
  const { data: invoices } = await supabase
    .from('invoices')
    .select('total, paid_at')
    .eq('status', 'paid')
    .gte('paid_at', startDate.toISOString())
    .lte('paid_at', now.toISOString())
    .order('paid_at', { ascending: true })

  // Group by day
  const dailyRevenue: { [key: string]: number } = {}
  const dailyTarget: { [key: string]: number } = {}

  // Initialize all days with 0
  let currentDate = new Date(startDate)
  while (currentDate <= now) {
    const key = format(currentDate, 'MMM dd')
    dailyRevenue[key] = 0
    dailyTarget[key] = 2000 // Mock target
    currentDate = addDays(currentDate, 1)
  }

  // Sum revenue by day
  invoices?.forEach(inv => {
    const key = format(new Date(inv.paid_at), 'MMM dd')
    if (dailyRevenue[key] !== undefined) {
      dailyRevenue[key] += inv.total
    }
  })

  // Convert to array format
  return Object.entries(dailyRevenue).map(([date, revenue]) => ({
    date,
    revenue,
    target: dailyTarget[date]
  }))
}

// Helper to add days
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Get top metrics
 */
export async function getTopMetricsAction() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const monthStart = startOfMonth(now)

  // Get top technician
  const { data: technicianStats } = await supabase
    .from('jobs')
    .select(`
      technician:technicians(id, name, color),
      status
    `)
    .gte('scheduled_date', monthStart.toISOString())
    .eq('status', 'completed')

  const technicianPerformance: { [key: string]: any } = {}

  technicianStats?.forEach((job: any) => {
    if (!job.technician) return
    const techId = job.technician.id

    if (!technicianPerformance[techId]) {
      technicianPerformance[techId] = {
        ...job.technician,
        jobsCompleted: 0,
        revenue: 0,
        rating: 0,
        efficiency: 95 // Mock
      }
    }
    technicianPerformance[techId].jobsCompleted++
    technicianPerformance[techId].revenue += Math.random() * 500 + 200 // Mock revenue
  })

  const topTechnician = Object.values(technicianPerformance)
    .sort((a, b) => b.jobsCompleted - a.jobsCompleted)[0] || {
      name: 'John Smith',
      color: '#3B82F6',
      jobsCompleted: 45,
      revenue: 12500,
      rating: 4.8,
      efficiency: 95
    }

  // Get top service
  const { data: services } = await supabase
    .from('job_services')
    .select(`
      service:services(id, name, price)
    `)

  const serviceStats: { [key: string]: any } = {}

  services?.forEach((js: any) => {
    if (!js.service) return
    const serviceId = js.service.id

    if (!serviceStats[serviceId]) {
      serviceStats[serviceId] = {
        ...js.service,
        count: 0,
        revenue: 0
      }
    }
    serviceStats[serviceId].count++
    serviceStats[serviceId].revenue += js.service.price
  })

  const topService = Object.values(serviceStats)
    .sort((a, b) => b.count - a.count)[0] || {
      name: 'Deep Carpet Cleaning',
      count: 87,
      revenue: 15225,
      avgPrice: 175
    }

  // Mock data for other metrics
  return {
    topTechnician,
    topService,
    topZone: {
      name: 'North District',
      number: 'A',
      color: '#10B981',
      jobCount: 125,
      revenue: 28750,
      customerCount: 89
    },
    retention: {
      rate: 78,
      repeatCustomers: 234,
      avgLifetimeValue: '$1,850'
    },
    avgResponseTime: 3.5,
    responseTimeImprovement: 12,
    totalJobs: 324
  }
}

/**
 * Get recent activity
 */
export async function getRecentActivityAction() {
  const supabase = await getServerSupabase()
  const activities: any[] = []

  // Get recent completed jobs
  const { data: completedJobs } = await supabase
    .from('jobs')
    .select(`
      id,
      status,
      completed_at,
      customer:customers(name),
      technician:technicians(name)
    `)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5)

  completedJobs?.forEach(job => {
    activities.push({
      id: `job-${job.id}`,
      type: 'job_completed',
      title: 'Job Completed',
      description: `Service for ${job.customer?.name} completed by ${job.technician?.name}`,
      timestamp: new Date(job.completed_at),
      user: job.technician ? {
        name: job.technician.name,
        initials: job.technician.name.split(' ').map((n: string) => n[0]).join('')
      } : undefined,
      metadata: {
        jobId: job.id,
        amount: Math.round(Math.random() * 300 + 150) // Mock amount
      }
    })
  })

  // Get recent new customers
  const { data: newCustomers } = await supabase
    .from('customers')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(3)

  newCustomers?.forEach(customer => {
    activities.push({
      id: `customer-${customer.id}`,
      type: 'new_customer',
      title: 'New Customer',
      description: `${customer.name} joined`,
      timestamp: new Date(customer.created_at),
      metadata: {
        customerId: customer.id
      }
    })
  })

  // Get recent payments
  const { data: payments } = await supabase
    .from('invoices')
    .select(`
      id,
      total,
      paid_at,
      customer:customers(name)
    `)
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(5)

  payments?.forEach(payment => {
    activities.push({
      id: `payment-${payment.id}`,
      type: 'payment_received',
      title: 'Payment Received',
      description: `Payment from ${payment.customer?.name}`,
      timestamp: new Date(payment.paid_at),
      metadata: {
        amount: payment.total
      }
    })
  })

  // Add some mock review activities
  activities.push({
    id: 'review-1',
    type: 'review_received',
    title: 'New Review',
    description: 'Sarah Johnson left a 5-star review',
    timestamp: subDays(now, 0.5),
    metadata: {
      rating: 5
    }
  })

  // Sort by timestamp
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return activities.slice(0, 10)
}