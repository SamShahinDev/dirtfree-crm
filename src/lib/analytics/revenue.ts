import { getServerSupabase } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, eachDayOfInterval, format, subMonths, startOfWeek, endOfWeek, eachWeekOfInterval, startOfDay, endOfDay } from 'date-fns'

export async function getRevenueData(period: 'daily' | 'weekly' | 'monthly') {
  const supabase = await getServerSupabase()
  const now = new Date()
  let start: Date
  let end: Date
  let intervals: Date[]
  let formatString: string

  switch (period) {
    case 'daily':
      start = startOfMonth(now)
      end = endOfMonth(now)
      intervals = eachDayOfInterval({ start, end })
      formatString = 'MMM dd'
      break
    case 'weekly':
      start = startOfMonth(subMonths(now, 2))
      end = endOfMonth(now)
      intervals = eachWeekOfInterval({ start, end })
      formatString = 'MMM dd'
      break
    case 'monthly':
      start = startOfMonth(subMonths(now, 11))
      end = endOfMonth(now)
      intervals = []
      for (let i = 0; i < 12; i++) {
        intervals.push(startOfMonth(subMonths(now, 11 - i)))
      }
      formatString = 'MMM yyyy'
      break
    default:
      start = startOfMonth(now)
      end = endOfMonth(now)
      intervals = eachDayOfInterval({ start, end })
      formatString = 'MMM dd'
  }

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .eq('status', 'paid')

  // Group by period
  const grouped = invoices?.reduce((acc, invoice) => {
    const date = new Date(invoice.created_at)
    let key: string

    switch (period) {
      case 'daily':
        key = format(date, 'yyyy-MM-dd')
        break
      case 'weekly':
        key = format(startOfWeek(date), 'yyyy-MM-dd')
        break
      case 'monthly':
        key = format(startOfMonth(date), 'yyyy-MM-dd')
        break
      default:
        key = format(date, 'yyyy-MM-dd')
    }

    acc[key] = (acc[key] || 0) + (invoice.total || 0)
    return acc
  }, {} as Record<string, number>)

  // Fill in missing intervals with zero values
  return intervals.map(interval => {
    const key = format(interval, 'yyyy-MM-dd')
    const formattedDate = format(interval, formatString)

    return {
      date: formattedDate,
      revenue: grouped?.[key] || 0,
      target: period === 'daily' ? 4000 : period === 'weekly' ? 28000 : 120000
    }
  })
}

export async function getRevenueByService() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const start = startOfMonth(now)
  const end = endOfMonth(now)

  const { data: jobServices } = await supabase
    .from('job_services')
    .select(`
      *,
      service:services(*),
      job:jobs(*)
    `)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  const grouped = jobServices?.reduce((acc, item) => {
    const serviceName = item.service?.name || 'Other'
    const amount = item.service?.price || 0
    acc[serviceName] = (acc[serviceName] || 0) + amount
    return acc
  }, {} as Record<string, number>)

  return Object.entries(grouped || {})
    .map(([name, value]) => ({
      name,
      value,
      percentage: 0 // Will be calculated after total is known
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6) // Top 6 services
    .map((item, _, arr) => {
      const total = arr.reduce((sum, i) => sum + i.value, 0)
      return {
        ...item,
        percentage: total > 0 ? Math.round((item.value / total) * 100) : 0
      }
    })
}

export async function getRevenueByZone() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const start = startOfMonth(now)
  const end = endOfMonth(now)

  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(*),
      invoices(*)
    `)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .eq('status', 'completed')

  // Mock zone data since we don't have zones in the schema yet
  const zones = [
    { name: 'North District', color: '#3b82f6', value: 45000 },
    { name: 'South District', color: '#10b981', value: 38000 },
    { name: 'East District', color: '#f59e0b', value: 32000 },
    { name: 'West District', color: '#8b5cf6', value: 28000 },
    { name: 'Central', color: '#ef4444', value: 22000 }
  ]

  const total = zones.reduce((sum, zone) => sum + zone.value, 0)

  return zones.map(zone => ({
    ...zone,
    percentage: Math.round((zone.value / total) * 100)
  }))
}

export async function getPaymentMetrics() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const start = startOfMonth(now)
  const end = endOfMonth(now)

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  const metrics = {
    total: invoices?.length || 0,
    paid: invoices?.filter(i => i.status === 'paid').length || 0,
    pending: invoices?.filter(i => i.status === 'sent').length || 0,
    overdue: invoices?.filter(i => i.status === 'overdue').length || 0,
    draft: invoices?.filter(i => i.status === 'draft').length || 0
  }

  const amounts = {
    totalAmount: invoices?.reduce((sum, i) => sum + (i.total || 0), 0) || 0,
    paidAmount: invoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0) || 0,
    pendingAmount: invoices?.filter(i => i.status === 'sent').reduce((sum, i) => sum + (i.total || 0), 0) || 0,
    overdueAmount: invoices?.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.total || 0), 0) || 0
  }

  return { metrics, amounts }
}

export async function getRevenueForecast() {
  // Simple forecast based on historical data
  const supabase = await getServerSupabase()
  const now = new Date()

  // Get last 6 months of data
  const historicalData = []
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthEnd = endOfMonth(subMonths(now, i))

    const { data: invoices } = await supabase
      .from('invoices')
      .select('total')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString())
      .eq('status', 'paid')

    const revenue = invoices?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0

    historicalData.push({
      month: format(monthStart, 'MMM yyyy'),
      actual: revenue,
      isHistorical: true
    })
  }

  // Calculate growth rate
  const growthRates = []
  for (let i = 1; i < historicalData.length; i++) {
    if (historicalData[i - 1].actual > 0) {
      growthRates.push((historicalData[i].actual - historicalData[i - 1].actual) / historicalData[i - 1].actual)
    }
  }

  const avgGrowthRate = growthRates.length > 0
    ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
    : 0.05 // Default 5% growth

  // Forecast next 6 months
  const forecastData = []
  let lastRevenue = historicalData[historicalData.length - 1].actual

  for (let i = 1; i <= 6; i++) {
    const forecastMonth = format(startOfMonth(subMonths(now, -i)), 'MMM yyyy')
    const forecastRevenue = lastRevenue * (1 + avgGrowthRate)

    forecastData.push({
      month: forecastMonth,
      forecast: Math.round(forecastRevenue),
      isHistorical: false
    })

    lastRevenue = forecastRevenue
  }

  return [...historicalData, ...forecastData]
}