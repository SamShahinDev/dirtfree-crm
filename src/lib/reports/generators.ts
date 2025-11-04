/**
 * Report Data Generators
 *
 * Functions to generate data for different report types.
 */

import { createClient } from '@/lib/supabase/server'

export interface ReportFilters {
  startDate?: string
  endDate?: string
  customerId?: string
  status?: string
  tier?: string
  [key: string]: any
}

export interface ReportData {
  title: string
  generatedAt: string
  filters: ReportFilters
  data: any[]
  summary?: Record<string, any>
}

/**
 * Revenue Summary Report
 *
 * Shows revenue breakdown by service type, payment method, and time period.
 */
export async function generateRevenueSummary(filters: ReportFilters = {}): Promise<ReportData> {
  const supabase = createClient()

  const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = filters.endDate || new Date().toISOString()

  // Get all payments in date range
  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      status,
      payment_method,
      created_at,
      customer:customers (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })

  if (error) throw error

  const data = payments || []

  // Calculate summary statistics
  const totalRevenue = data.reduce((sum, p) => sum + (p.amount / 100), 0)
  const avgTransaction = data.length > 0 ? totalRevenue / data.length : 0

  const byPaymentMethod = data.reduce((acc: Record<string, number>, p) => {
    const method = p.payment_method || 'unknown'
    acc[method] = (acc[method] || 0) + (p.amount / 100)
    return acc
  }, {})

  // Format data for report
  const reportData = data.map((p) => ({
    date: new Date(p.created_at).toLocaleDateString(),
    customer: p.customer
      ? `${p.customer.first_name} ${p.customer.last_name}`
      : 'Unknown',
    email: p.customer?.email || '',
    amount: (p.amount / 100).toFixed(2),
    paymentMethod: p.payment_method || 'Unknown',
    status: p.status,
  }))

  return {
    title: 'Revenue Summary Report',
    generatedAt: new Date().toISOString(),
    filters: { startDate, endDate },
    data: reportData,
    summary: {
      totalRevenue: totalRevenue.toFixed(2),
      transactionCount: data.length,
      avgTransaction: avgTransaction.toFixed(2),
      byPaymentMethod,
    },
  }
}

/**
 * Customer Activity Report
 *
 * Shows customer engagement metrics and activity trends.
 */
export async function generateCustomerActivity(filters: ReportFilters = {}): Promise<ReportData> {
  const supabase = createClient()

  const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = filters.endDate || new Date().toISOString()

  // Get customer portal activity
  const { data: activities, error } = await supabase
    .from('portal_activity_logs')
    .select(`
      id,
      customer_id,
      activity_type,
      created_at,
      customer:customers (
        id,
        first_name,
        last_name,
        email,
        tier
      )
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })

  if (error) throw error

  const data = activities || []

  // Aggregate by customer
  const customerMap = new Map<string, any>()

  data.forEach((activity) => {
    const customerId = activity.customer_id
    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customer: activity.customer,
        activities: [],
        activityCount: 0,
        lastActivity: activity.created_at,
      })
    }

    const customer = customerMap.get(customerId)!
    customer.activities.push(activity.activity_type)
    customer.activityCount++

    if (new Date(activity.created_at) > new Date(customer.lastActivity)) {
      customer.lastActivity = activity.created_at
    }
  })

  // Format for report
  const reportData = Array.from(customerMap.values()).map((c) => ({
    customer: c.customer
      ? `${c.customer.first_name} ${c.customer.last_name}`
      : 'Unknown',
    email: c.customer?.email || '',
    tier: c.customer?.tier || 'bronze',
    activityCount: c.activityCount,
    lastActivity: new Date(c.lastActivity).toLocaleDateString(),
    topActivities: getMostFrequent(c.activities, 3),
  }))

  return {
    title: 'Customer Activity Report',
    generatedAt: new Date().toISOString(),
    filters: { startDate, endDate },
    data: reportData,
    summary: {
      totalCustomers: customerMap.size,
      totalActivities: data.length,
      avgActivitiesPerCustomer: customerMap.size > 0 ? data.length / customerMap.size : 0,
    },
  }
}

/**
 * Opportunity Pipeline Report
 *
 * Shows missed opportunities and conversion metrics.
 */
export async function generateOpportunityPipeline(
  filters: ReportFilters = {}
): Promise<ReportData> {
  const supabase = createClient()

  const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = filters.endDate || new Date().toISOString()

  const { data: opportunities, error } = await supabase
    .from('missed_opportunities')
    .select(`
      id,
      customer_id,
      opportunity_type,
      status,
      estimated_value,
      contacted_at,
      converted_at,
      created_at,
      customer:customers (
        id,
        first_name,
        last_name,
        email,
        tier
      )
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })

  if (error) throw error

  const data = opportunities || []

  // Calculate metrics
  const byStatus = data.reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  const totalValue = data.reduce((sum, o) => sum + (o.estimated_value || 0), 0)
  const convertedValue = data
    .filter((o) => o.status === 'converted')
    .reduce((sum, o) => sum + (o.estimated_value || 0), 0)

  const conversionRate =
    data.length > 0 ? ((byStatus.converted || 0) / data.length) * 100 : 0

  // Format for report
  const reportData = data.map((o) => ({
    date: new Date(o.created_at).toLocaleDateString(),
    customer: o.customer
      ? `${o.customer.first_name} ${o.customer.last_name}`
      : 'Unknown',
    email: o.customer?.email || '',
    tier: o.customer?.tier || 'bronze',
    opportunityType: o.opportunity_type,
    status: o.status,
    estimatedValue: o.estimated_value?.toFixed(2) || '0.00',
    contactedAt: o.contacted_at
      ? new Date(o.contacted_at).toLocaleDateString()
      : 'Not contacted',
    convertedAt: o.converted_at
      ? new Date(o.converted_at).toLocaleDateString()
      : '-',
  }))

  return {
    title: 'Opportunity Pipeline Report',
    generatedAt: new Date().toISOString(),
    filters: { startDate, endDate },
    data: reportData,
    summary: {
      totalOpportunities: data.length,
      byStatus,
      totalValue: totalValue.toFixed(2),
      convertedValue: convertedValue.toFixed(2),
      conversionRate: conversionRate.toFixed(2),
    },
  }
}

/**
 * Promotion Performance Report
 *
 * Shows promotion delivery and engagement metrics.
 */
export async function generatePromotionPerformance(
  filters: ReportFilters = {}
): Promise<ReportData> {
  const supabase = createClient()

  const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = filters.endDate || new Date().toISOString()

  const { data: promotions, error } = await supabase
    .from('promotions')
    .select(`
      id,
      name,
      promotion_type,
      discount_type,
      discount_value,
      created_at,
      promotion_deliveries (
        id,
        customer_id,
        status,
        delivered_at,
        viewed_at,
        used_at
      )
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })

  if (error) throw error

  const data = promotions || []

  // Calculate metrics per promotion
  const reportData = data.map((promo) => {
    const deliveries = promo.promotion_deliveries || []
    const delivered = deliveries.filter((d) => d.delivered_at).length
    const viewed = deliveries.filter((d) => d.viewed_at).length
    const used = deliveries.filter((d) => d.used_at).length

    const viewRate = delivered > 0 ? (viewed / delivered) * 100 : 0
    const useRate = delivered > 0 ? (used / delivered) * 100 : 0

    return {
      promotionName: promo.name,
      type: promo.promotion_type,
      discountType: promo.discount_type,
      discountValue: promo.discount_value,
      delivered,
      viewed,
      used,
      viewRate: viewRate.toFixed(2),
      useRate: useRate.toFixed(2),
      createdAt: new Date(promo.created_at).toLocaleDateString(),
    }
  })

  // Overall summary
  const totalDelivered = reportData.reduce((sum, p) => sum + p.delivered, 0)
  const totalViewed = reportData.reduce((sum, p) => sum + p.viewed, 0)
  const totalUsed = reportData.reduce((sum, p) => sum + p.used, 0)

  return {
    title: 'Promotion Performance Report',
    generatedAt: new Date().toISOString(),
    filters: { startDate, endDate },
    data: reportData,
    summary: {
      totalPromotions: data.length,
      totalDelivered,
      totalViewed,
      totalUsed,
      overallViewRate:
        totalDelivered > 0 ? ((totalViewed / totalDelivered) * 100).toFixed(2) : '0.00',
      overallUseRate:
        totalDelivered > 0 ? ((totalUsed / totalDelivered) * 100).toFixed(2) : '0.00',
    },
  }
}

/**
 * Loyalty Engagement Report
 *
 * Shows loyalty program participation and tier distribution.
 */
export async function generateLoyaltyEngagement(
  filters: ReportFilters = {}
): Promise<ReportData> {
  const supabase = createClient()

  const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = filters.endDate || new Date().toISOString()

  // Get customers with their loyalty stats
  const { data: customers, error } = await supabase
    .from('customers')
    .select(`
      id,
      first_name,
      last_name,
      email,
      tier,
      points_balance,
      lifetime_points,
      created_at,
      loyalty_transactions (
        id,
        transaction_type,
        points,
        created_at
      )
    `)
    .order('lifetime_points', { ascending: false })

  if (error) throw error

  const data = customers || []

  // Filter transactions by date range
  const reportData = data.map((customer) => {
    const transactions = (customer.loyalty_transactions || []).filter(
      (t) =>
        new Date(t.created_at) >= new Date(startDate) &&
        new Date(t.created_at) <= new Date(endDate)
    )

    const pointsEarned = transactions
      .filter((t) => t.transaction_type === 'earned')
      .reduce((sum, t) => sum + t.points, 0)

    const pointsRedeemed = transactions
      .filter((t) => t.transaction_type === 'redeemed')
      .reduce((sum, t) => sum + Math.abs(t.points), 0)

    return {
      customer: `${customer.first_name} ${customer.last_name}`,
      email: customer.email,
      tier: customer.tier || 'bronze',
      currentPoints: customer.points_balance || 0,
      lifetimePoints: customer.lifetime_points || 0,
      pointsEarned,
      pointsRedeemed,
      transactionCount: transactions.length,
      memberSince: new Date(customer.created_at).toLocaleDateString(),
    }
  })

  // Tier distribution
  const tierDistribution = reportData.reduce((acc: Record<string, number>, c) => {
    acc[c.tier] = (acc[c.tier] || 0) + 1
    return acc
  }, {})

  const totalPointsEarned = reportData.reduce((sum, c) => sum + c.pointsEarned, 0)
  const totalPointsRedeemed = reportData.reduce((sum, c) => sum + c.pointsRedeemed, 0)

  return {
    title: 'Loyalty Engagement Report',
    generatedAt: new Date().toISOString(),
    filters: { startDate, endDate },
    data: reportData,
    summary: {
      totalCustomers: data.length,
      tierDistribution,
      totalPointsEarned,
      totalPointsRedeemed,
      avgPointsPerCustomer: data.length > 0 ? totalPointsEarned / data.length : 0,
    },
  }
}

/**
 * Helper function to get most frequent items
 */
function getMostFrequent(arr: string[], count: number): string {
  const frequency = arr.reduce((acc: Record<string, number>, item) => {
    acc[item] = (acc[item] || 0) + 1
    return acc
  }, {})

  return Object.entries(frequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, count)
    .map(([item]) => item)
    .join(', ')
}
