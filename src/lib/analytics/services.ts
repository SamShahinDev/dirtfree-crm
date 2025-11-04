import { getServerSupabase } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subMonths, format, startOfWeek, endOfWeek } from 'date-fns'

export async function getServicePerformance() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  // Get all services with their job counts and revenue
  const { data: services } = await supabase
    .from('services')
    .select(`
      *,
      job_services(*)
    `)

  const serviceMetrics = await Promise.all(
    (services || []).map(async (service) => {
      // Get jobs for this service this month
      const { data: jobServices } = await supabase
        .from('job_services')
        .select(`
          *,
          jobs(*)
        `)
        .eq('service_id', service.id)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())

      const completedJobs = jobServices?.filter(js => js.jobs?.status === 'completed').length || 0
      const totalJobs = jobServices?.length || 0
      const revenue = totalJobs * (service.price || 0)

      // Calculate average rating (mock for now)
      const avgRating = 4.5 + Math.random() * 0.5

      return {
        id: service.id,
        name: service.name,
        totalJobs,
        completedJobs,
        revenue,
        price: service.price,
        duration: service.duration,
        avgRating,
        completionRate: totalJobs > 0 ? (completedJobs / totalJobs * 100) : 0,
        category: service.category || 'General'
      }
    })
  )

  // Sort by revenue
  serviceMetrics.sort((a, b) => b.revenue - a.revenue)

  return serviceMetrics
}

export async function calculateServiceProfitability() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const { data: services } = await supabase
    .from('services')
    .select(`
      *,
      job_services(*)
    `)

  const profitData = (services || []).map(service => {
    const jobCount = service.job_services?.length || 0
    const revenue = jobCount * (service.price || 0)

    // Mock cost calculation (typically 30-40% of revenue)
    const costPercentage = 0.35 + Math.random() * 0.1
    const cost = revenue * costPercentage
    const profit = revenue - cost
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

    return {
      name: service.name,
      revenue: Math.round(revenue),
      cost: Math.round(cost),
      profit: Math.round(profit),
      margin,
      jobCount
    }
  })

  // Sort by profit and take top 5
  return profitData
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5)
}

export async function getServiceDuration() {
  const supabase = await getServerSupabase()

  const { data: services } = await supabase
    .from('services')
    .select('*')

  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      *,
      job_services(*, services(*))
    `)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .limit(100)

  // Calculate actual vs estimated duration
  const durationData = (services || []).map(service => {
    const serviceJobs = jobs?.filter(job =>
      job.job_services?.some((js: any) => js.service_id === service.id)
    ) || []

    const actualDurations = serviceJobs.map(job => {
      if (job.scheduled_date && job.completed_at) {
        const scheduled = new Date(job.scheduled_date)
        const completed = new Date(job.completed_at)
        return Math.abs(completed.getTime() - scheduled.getTime()) / (1000 * 60) // minutes
      }
      return service.duration || 60
    })

    const avgActual = actualDurations.length > 0
      ? actualDurations.reduce((sum, d) => sum + d, 0) / actualDurations.length
      : service.duration || 60

    return {
      name: service.name,
      estimated: service.duration || 60,
      actual: Math.round(avgActual),
      variance: Math.round(avgActual - (service.duration || 60)),
      efficiency: service.duration ? Math.round((service.duration / avgActual) * 100) : 100
    }
  })

  return durationData
}

export async function getServiceTrends() {
  const supabase = await getServerSupabase()
  const months = []

  // Get trend data for last 6 months
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i))
    const monthEnd = endOfMonth(subMonths(new Date(), i))

    const { data: services } = await supabase
      .from('services')
      .select(`
        *,
        job_services!inner(
          *,
          jobs!inner(*)
        )
      `)

    // Count jobs per service for this month
    const serviceData = await Promise.all(
      (services || []).slice(0, 5).map(async service => {
        const { count } = await supabase
          .from('job_services')
          .select('*', { count: 'exact', head: true })
          .eq('service_id', service.id)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString())

        return {
          service: service.name,
          count: count || 0
        }
      })
    )

    const monthData: any = {
      month: format(monthStart, 'MMM'),
    }

    serviceData.forEach(sd => {
      monthData[sd.service] = sd.count
    })

    months.push(monthData)
  }

  return months
}

export async function getServiceComparisons() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  const { data: services } = await supabase
    .from('services')
    .select('*')

  const comparisons = await Promise.all(
    (services || []).map(async service => {
      // This month's data
      const { count: thisMonthCount } = await supabase
        .from('job_services')
        .select('*', { count: 'exact', head: true })
        .eq('service_id', service.id)
        .gte('created_at', thisMonthStart.toISOString())

      // Last month's data
      const { count: lastMonthCount } = await supabase
        .from('job_services')
        .select('*', { count: 'exact', head: true })
        .eq('service_id', service.id)
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', lastMonthEnd.toISOString())

      const thisMonthRevenue = (thisMonthCount || 0) * (service.price || 0)
      const lastMonthRevenue = (lastMonthCount || 0) * (service.price || 0)

      const growthRate = lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0

      return {
        id: service.id,
        name: service.name,
        thisMonth: {
          jobs: thisMonthCount || 0,
          revenue: thisMonthRevenue
        },
        lastMonth: {
          jobs: lastMonthCount || 0,
          revenue: lastMonthRevenue
        },
        growthRate: Math.round(growthRate)
      }
    })
  )

  return comparisons.sort((a, b) => b.thisMonth.revenue - a.thisMonth.revenue)
}

export async function getServiceUtilization() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const weekStart = startOfWeek(now)
  const weekEnd = endOfWeek(now)

  // Get weekly schedule
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      *,
      job_services(*, services(*))
    `)
    .gte('scheduled_date', weekStart.toISOString())
    .lte('scheduled_date', weekEnd.toISOString())

  // Calculate utilization by day
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const utilization = daysOfWeek.map((day, index) => {
    const dayJobs = jobs?.filter(job => {
      const jobDate = new Date(job.scheduled_date)
      return jobDate.getDay() === (index + 1) % 7
    }) || []

    const totalMinutes = dayJobs.reduce((sum, job) => {
      const duration = job.job_services?.reduce((serviceSum: number, js: any) =>
        serviceSum + (js.services?.duration || 60), 0
      ) || 60
      return sum + duration
    }, 0)

    // Assuming 8 hours (480 minutes) capacity per day with 3 technicians
    const capacity = 480 * 3
    const utilizationRate = Math.min(100, Math.round((totalMinutes / capacity) * 100))

    return {
      day,
      utilization: utilizationRate,
      jobs: dayJobs.length,
      totalMinutes
    }
  })

  return utilization
}