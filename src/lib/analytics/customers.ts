import { getServerSupabase } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export async function calculateCustomerLTV() {
  const supabase = await getServerSupabase()

  const { data: customers } = await supabase
    .from('customers')
    .select(`
      *,
      invoices(total, status, created_at),
      jobs(*)
    `)

  const ltvData = customers?.map(customer => {
    const totalRevenue = customer.invoices
      ?.filter((i: any) => i.status === 'paid')
      ?.reduce((sum: number, i: any) => sum + (i.total || 0), 0) || 0

    const firstInvoiceDate = customer.invoices?.[0]?.created_at
    const lastInvoiceDate = customer.invoices?.[customer.invoices.length - 1]?.created_at
    const customerLifespan = firstInvoiceDate && lastInvoiceDate
      ? Math.max(1, Math.ceil((new Date(lastInvoiceDate).getTime() - new Date(firstInvoiceDate).getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : 1

    return {
      id: customer.id,
      name: customer.name,
      ltv: totalRevenue,
      invoiceCount: customer.invoices?.length || 0,
      jobCount: customer.jobs?.length || 0,
      monthsActive: customerLifespan,
      avgMonthlyValue: totalRevenue / customerLifespan
    }
  }) || []

  // Calculate distribution
  const ranges = [
    { range: '$0-100', min: 0, max: 100 },
    { range: '$100-500', min: 100, max: 500 },
    { range: '$500-1k', min: 500, max: 1000 },
    { range: '$1k-2k', min: 1000, max: 2000 },
    { range: '$2k+', min: 2000, max: Infinity }
  ]

  const distribution = ranges.map(range => ({
    ...range,
    count: ltvData.filter(c => c.ltv >= range.min && c.ltv < range.max).length
  }))

  const average = ltvData.length > 0
    ? ltvData.reduce((sum, c) => sum + c.ltv, 0) / ltvData.length
    : 0

  const topCustomers = ltvData
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, 10)

  return {
    distribution,
    average,
    customers: ltvData,
    topCustomers
  }
}

export async function calculateRetentionRate() {
  const supabase = await getServerSupabase()
  const months = []

  // Calculate retention for last 12 months
  for (let i = 11; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i))
    const monthEnd = endOfMonth(subMonths(new Date(), i))
    const prevMonthStart = startOfMonth(subMonths(new Date(), i + 1))
    const prevMonthEnd = endOfMonth(subMonths(new Date(), i + 1))

    // Get customers who had jobs in previous month
    const { data: prevMonthCustomers } = await supabase
      .from('jobs')
      .select('customer_id')
      .gte('scheduled_date', prevMonthStart.toISOString())
      .lte('scheduled_date', prevMonthEnd.toISOString())
      .eq('status', 'completed')

    const prevCustomerIds = [...new Set(prevMonthCustomers?.map(j => j.customer_id) || [])]

    // Get customers who returned this month
    const { data: thisMonthCustomers } = await supabase
      .from('jobs')
      .select('customer_id')
      .gte('scheduled_date', monthStart.toISOString())
      .lte('scheduled_date', monthEnd.toISOString())
      .eq('status', 'completed')
      .in('customer_id', prevCustomerIds)

    const returnedCustomerIds = [...new Set(thisMonthCustomers?.map(j => j.customer_id) || [])]

    const retentionRate = prevCustomerIds.length > 0
      ? (returnedCustomerIds.length / prevCustomerIds.length) * 100
      : 0

    months.push({
      month: format(monthStart, 'MMM yyyy'),
      retention: Math.round(retentionRate),
      totalCustomers: prevCustomerIds.length,
      retained: returnedCustomerIds.length,
      churned: prevCustomerIds.length - returnedCustomerIds.length
    })
  }

  return months
}

export async function getCustomerSegments() {
  const supabase = await getServerSupabase()

  const { data: customers } = await supabase
    .from('customers')
    .select(`
      *,
      jobs(*),
      invoices(total, status)
    `)

  // Calculate metrics for each customer
  const customerMetrics = customers?.map(customer => {
    const totalRevenue = customer.invoices
      ?.filter((i: any) => i.status === 'paid')
      ?.reduce((sum: number, i: any) => sum + (i.total || 0), 0) || 0

    const jobCount = customer.jobs?.length || 0
    const lastJobDate = customer.jobs?.[customer.jobs.length - 1]?.scheduled_date
    const daysSinceLastJob = lastJobDate
      ? Math.floor((new Date().getTime() - new Date(lastJobDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999

    return {
      ...customer,
      totalRevenue,
      jobCount,
      daysSinceLastJob,
      avgOrderValue: jobCount > 0 ? totalRevenue / jobCount : 0
    }
  }) || []

  // Segment customers based on RFM (Recency, Frequency, Monetary)
  const segments = {
    vip: customerMetrics.filter(c =>
      c.totalRevenue > 2000 && c.jobCount >= 5 && c.daysSinceLastJob < 60
    ),
    loyal: customerMetrics.filter(c =>
      c.totalRevenue > 1000 && c.jobCount >= 3 && c.daysSinceLastJob < 90
    ),
    promising: customerMetrics.filter(c =>
      c.totalRevenue > 500 && c.jobCount >= 2 && c.daysSinceLastJob < 120
    ),
    new: customerMetrics.filter(c =>
      c.jobCount === 1 && c.daysSinceLastJob < 30
    ),
    atrisk: customerMetrics.filter(c =>
      c.jobCount >= 2 && c.daysSinceLastJob > 120 && c.daysSinceLastJob < 180
    ),
    inactive: customerMetrics.filter(c =>
      c.daysSinceLastJob > 180
    )
  }

  return segments
}

export async function getCustomerAcquisition() {
  const supabase = await getServerSupabase()
  const months = []

  // Get acquisition data for last 12 months
  for (let i = 11; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i))
    const monthEnd = endOfMonth(subMonths(new Date(), i))

    const { count: newCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString())

    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', monthEnd.toISOString())

    months.push({
      month: format(monthStart, 'MMM yyyy'),
      newCustomers: newCustomers || 0,
      totalCustomers: totalCustomers || 0,
      growthRate: i > 0 && months[months.length - 1]
        ? ((totalCustomers || 0) - months[months.length - 1].totalCustomers) / months[months.length - 1].totalCustomers * 100
        : 0
    })
  }

  // Calculate acquisition sources (mock data for now)
  const sources = [
    { source: 'Referral', count: 145, percentage: 35 },
    { source: 'Google', count: 125, percentage: 30 },
    { source: 'Facebook', count: 83, percentage: 20 },
    { source: 'Direct', count: 42, percentage: 10 },
    { source: 'Other', count: 21, percentage: 5 }
  ]

  return {
    monthlyData: months,
    sources,
    averageCAC: 125, // Mock customer acquisition cost
    ltv_cac_ratio: 3.4 // Mock LTV/CAC ratio
  }
}

export async function getCustomerOverview() {
  const supabase = await getServerSupabase()
  const now = new Date()
  const monthStart = startOfMonth(now)
  const lastMonthStart = startOfMonth(subMonths(now, 1))
  const lastMonthEnd = endOfMonth(subMonths(now, 1))

  // Total customers
  const { count: totalCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })

  // Active customers (had job in last 90 days)
  const { data: activeJobs } = await supabase
    .from('jobs')
    .select('customer_id')
    .gte('scheduled_date', subMonths(now, 3).toISOString())
    .eq('status', 'completed')

  const activeCustomers = new Set(activeJobs?.map(j => j.customer_id) || []).size

  // New customers this month
  const { count: newCustomers } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', monthStart.toISOString())

  // Churn rate (customers who haven't ordered in 6 months)
  const { data: allCustomers } = await supabase
    .from('customers')
    .select('id, created_at')
    .lte('created_at', subMonths(now, 6).toISOString())

  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('customer_id')
    .gte('scheduled_date', subMonths(now, 6).toISOString())

  const recentCustomerIds = new Set(recentJobs?.map(j => j.customer_id) || [])
  const churnedCount = (allCustomers || []).filter(c => !recentCustomerIds.has(c.id)).length
  const churnRate = allCustomers && allCustomers.length > 0
    ? (churnedCount / allCustomers.length) * 100
    : 0

  return {
    totalCustomers: totalCustomers || 0,
    activeCustomers,
    newCustomers: newCustomers || 0,
    churnRate: Math.round(churnRate),
    activeRate: totalCustomers && totalCustomers > 0
      ? Math.round((activeCustomers / totalCustomers) * 100)
      : 0,
    satisfaction: 4.7, // Mock satisfaction score
    nps: 72 // Mock Net Promoter Score
  }
}