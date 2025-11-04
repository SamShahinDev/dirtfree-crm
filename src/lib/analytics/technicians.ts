import { getServerSupabase } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from 'date-fns'

export async function getTechnicianOverview() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  // Get all users (technicians)
  const { data: technicians } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'technician')

  if (!technicians || technicians.length === 0) {
    // Mock data for demo
    return {
      totalTechnicians: 5,
      activeTechnicians: 4,
      avgJobsPerTech: 28,
      avgRevenuePerTech: 4500,
      topPerformer: 'John Smith',
      efficiency: 87
    }
  }

  // Get jobs for this month
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, job_services(*)')
    .gte('created_at', monthStart.toISOString())
    .lte('created_at', monthEnd.toISOString())

  const totalJobs = jobs?.length || 0
  const avgJobsPerTech = technicians.length > 0 ? Math.round(totalJobs / technicians.length) : 0

  // Calculate average revenue per technician (mock calculation)
  const totalRevenue = jobs?.reduce((sum, job) => {
    const jobRevenue = job.job_services?.reduce((serviceSum: number, js: any) =>
      serviceSum + (js.price || 0), 0) || 0
    return sum + jobRevenue
  }, 0) || 0

  const avgRevenuePerTech = technicians.length > 0
    ? Math.round(totalRevenue / technicians.length)
    : 0

  return {
    totalTechnicians: technicians.length,
    activeTechnicians: Math.round(technicians.length * 0.8), // Mock: 80% active
    avgJobsPerTech,
    avgRevenuePerTech,
    topPerformer: technicians[0]?.full_name || 'N/A',
    efficiency: 85 + Math.random() * 10 // Mock efficiency 85-95%
  }
}

export async function getTechnicianRankings(metric: 'revenue' | 'jobs' | 'efficiency' = 'revenue') {
  const supabase = await getServerSupabase()
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  const { data: technicians } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'technician')

  // Mock technician data for demo
  const mockTechnicians = technicians?.length ? technicians : [
    { id: '1', full_name: 'John Smith', email: 'john@example.com' },
    { id: '2', full_name: 'Sarah Johnson', email: 'sarah@example.com' },
    { id: '3', full_name: 'Mike Wilson', email: 'mike@example.com' },
    { id: '4', full_name: 'Emily Brown', email: 'emily@example.com' },
    { id: '5', full_name: 'David Lee', email: 'david@example.com' }
  ]

  const rankings = mockTechnicians.map((tech, index) => {
    let value: number
    let trend: number

    if (metric === 'revenue') {
      value = Math.round(5000 - index * 800 + Math.random() * 500)
      trend = Math.round(-10 + Math.random() * 30)
    } else if (metric === 'jobs') {
      value = Math.round(40 - index * 5 + Math.random() * 10)
      trend = Math.round(-5 + Math.random() * 20)
    } else {
      value = Math.round(95 - index * 3 + Math.random() * 5)
      trend = Math.round(-2 + Math.random() * 10)
    }

    return {
      id: tech.id,
      name: tech.full_name || tech.email,
      jobCount: Math.round(30 - index * 3 + Math.random() * 10),
      value: metric === 'revenue' ? `$${value}` : value,
      trend,
      rating: 4.5 + Math.random() * 0.5
    }
  })

  return rankings.sort((a, b) => {
    const aVal = typeof a.value === 'string' ? parseInt(a.value.replace('$', '')) : a.value
    const bVal = typeof b.value === 'string' ? parseInt(b.value.replace('$', '')) : b.value
    return bVal - aVal
  })
}

export async function getProductivityMetrics() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const weekStart = startOfWeek(now)
  const weekEnd = endOfWeek(now)

  // Get weekly productivity data
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .gte('scheduled_date', weekStart.toISOString())
    .lte('scheduled_date', weekEnd.toISOString())

  // Mock productivity data for demo
  const dailyProductivity = []
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  for (let i = 0; i < 7; i++) {
    const dayJobs = Math.round(8 + Math.random() * 6)
    const efficiency = 80 + Math.random() * 20
    const revenue = dayJobs * (150 + Math.random() * 100)

    dailyProductivity.push({
      day: daysOfWeek[i],
      jobs: dayJobs,
      efficiency: Math.round(efficiency),
      revenue: Math.round(revenue),
      hours: Math.round(6 + Math.random() * 3)
    })
  }

  // Calculate metrics
  const totalJobs = dailyProductivity.reduce((sum, d) => sum + d.jobs, 0)
  const avgEfficiency = Math.round(
    dailyProductivity.reduce((sum, d) => sum + d.efficiency, 0) / 7
  )
  const totalRevenue = dailyProductivity.reduce((sum, d) => sum + d.revenue, 0)
  const totalHours = dailyProductivity.reduce((sum, d) => sum + d.hours, 0)

  return {
    dailyProductivity,
    weeklyMetrics: {
      totalJobs,
      avgEfficiency,
      totalRevenue,
      totalHours,
      avgJobsPerDay: Math.round(totalJobs / 7),
      revenuePerHour: Math.round(totalRevenue / totalHours)
    }
  }
}

export async function getScheduleEfficiency() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  // Get schedule data
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .gte('scheduled_date', monthStart.toISOString())
    .lte('scheduled_date', monthEnd.toISOString())

  // Mock schedule efficiency data
  const technicians = [
    { id: '1', name: 'John Smith' },
    { id: '2', name: 'Sarah Johnson' },
    { id: '3', name: 'Mike Wilson' },
    { id: '4', name: 'Emily Brown' },
    { id: '5', name: 'David Lee' }
  ]

  const efficiencyData = technicians.map(tech => {
    const scheduled = Math.round(150 + Math.random() * 50)
    const utilized = Math.round(scheduled * (0.7 + Math.random() * 0.25))
    const idle = scheduled - utilized
    const overtime = Math.round(Math.random() * 20)
    const travelTime = Math.round(utilized * 0.15)
    const workTime = utilized - travelTime

    return {
      id: tech.id,
      name: tech.name,
      scheduledHours: scheduled,
      utilizedHours: utilized,
      idleHours: idle,
      overtimeHours: overtime,
      travelTime,
      workTime,
      efficiency: Math.round((utilized / scheduled) * 100),
      utilizationRate: Math.round((workTime / scheduled) * 100)
    }
  })

  // Calculate averages
  const avgEfficiency = Math.round(
    efficiencyData.reduce((sum, d) => sum + d.efficiency, 0) / efficiencyData.length
  )
  const avgUtilization = Math.round(
    efficiencyData.reduce((sum, d) => sum + d.utilizationRate, 0) / efficiencyData.length
  )
  const totalOvertime = efficiencyData.reduce((sum, d) => sum + d.overtimeHours, 0)
  const totalIdle = efficiencyData.reduce((sum, d) => sum + d.idleHours, 0)

  return {
    technicians: efficiencyData,
    summary: {
      avgEfficiency,
      avgUtilization,
      totalOvertime,
      totalIdle,
      topPerformer: efficiencyData.sort((a, b) => b.efficiency - a.efficiency)[0].name
    }
  }
}

export async function getTechnicianPerformance(technicianId: string) {
  const supabase = await getServerSupabase()
  const now = new Date()

  // Get last 6 months of performance data
  const performanceData = []

  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = endOfMonth(subMonths(now, i))

    // Mock performance data
    const jobs = 25 + Math.round(Math.random() * 15)
    const revenue = jobs * (150 + Math.random() * 100)
    const rating = 4.3 + Math.random() * 0.7
    const efficiency = 80 + Math.random() * 20

    performanceData.push({
      month: monthStart.toLocaleDateString('en', { month: 'short' }),
      jobs,
      revenue: Math.round(revenue),
      rating: Math.round(rating * 10) / 10,
      efficiency: Math.round(efficiency),
      completionRate: 90 + Math.random() * 10
    })
  }

  // Skills assessment (mock data)
  const skills = [
    { skill: 'Carpet Cleaning', score: 85 + Math.random() * 15 },
    { skill: 'Upholstery', score: 75 + Math.random() * 20 },
    { skill: 'Tile & Grout', score: 70 + Math.random() * 25 },
    { skill: 'Customer Service', score: 90 + Math.random() * 10 },
    { skill: 'Time Management', score: 80 + Math.random() * 15 }
  ].map(s => ({ ...s, score: Math.round(s.score) }))

  return {
    performanceData,
    skills,
    currentMonth: {
      jobs: performanceData[performanceData.length - 1].jobs,
      revenue: performanceData[performanceData.length - 1].revenue,
      rating: performanceData[performanceData.length - 1].rating,
      efficiency: performanceData[performanceData.length - 1].efficiency
    }
  }
}