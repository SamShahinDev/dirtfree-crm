'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Users,
  Briefcase,
  Target,
  Activity,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import Link from 'next/link'

interface TrendData {
  direction: 'up' | 'down' | 'neutral'
  change: number
  color: string
}

interface KPICardData {
  value: number
  previous?: number
  trend?: TrendData
  growth_pct?: number
  target?: number | null
  status?: string
}

interface DashboardData {
  period: {
    type: string
    start_date: string
    end_date: string
  }
  financial: any
  customer: any
  operational: any
  marketing: any
  growth: any
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US').format(value)
}

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`
}

export default function ExecutiveDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('mtd')

  useEffect(() => {
    loadDashboard()
  }, [period])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics/executive?period=${period}`)
      const result = await response.json()
      if (result.success) {
        setData(result.data.dashboard)
      }
    } catch (error) {
      console.error('Failed to load executive dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTrendIcon = (trend?: TrendData) => {
    if (!trend) return null
    if (trend.direction === 'up') {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    } else if (trend.direction === 'down') {
      return <TrendingDown className="h-4 w-4 text-red-600" />
    }
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'good':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'fair':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'poor':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPerformanceColor = (value: number, threshold: number) => {
    if (value >= threshold) return 'text-green-600'
    if (value >= threshold * 0.8) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time business health overview • Last updated: {new Date().toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mtd">Month to Date</SelectItem>
              <SelectItem value="qtd">Quarter to Date</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadDashboard}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-green-600" />
            Financial Performance
          </h2>
          <Link href="/dashboard/analytics/revenue">
            <Button variant="ghost" size="sm">
              View Details
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className="text-3xl">
                {formatCurrency(data.financial.revenue.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTrendIcon(data.financial.revenue.trend)}
                  <span className={`text-sm font-medium ${
                    data.financial.revenue.trend.direction === 'up' ? 'text-green-600' :
                    data.financial.revenue.trend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {formatPercent(data.financial.revenue.growth_pct)}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  vs {formatCurrency(data.financial.revenue.previous)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Average Invoice Value */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Invoice Value</CardDescription>
              <CardTitle className="text-3xl">
                {formatCurrency(data.financial.avg_invoice_value.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTrendIcon(data.financial.avg_invoice_value.trend)}
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(data.financial.avg_invoice_value.previous)} prev
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Outstanding Receivables */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Outstanding Receivables</CardDescription>
              <CardTitle className="text-3xl">
                {formatCurrency(data.financial.outstanding_receivables.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Overdue: {formatCurrency(data.financial.outstanding_receivables.overdue)}
                </span>
                {data.financial.outstanding_receivables.overdue > 0 && (
                  <Badge variant="destructive">Action Needed</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Profit Margin */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Profit Margin (Est.)</CardDescription>
              <CardTitle className="text-3xl">
                {formatPercent(data.financial.profit_margin.margin_pct)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Revenue:</span>
                  <span>{formatCurrency(data.financial.profit_margin.revenue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Costs:</span>
                  <span>{formatCurrency(data.financial.profit_margin.costs)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Customer KPIs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Users className="h-5 w-5 mr-2 text-blue-600" />
            Customer Metrics
          </h2>
          <Link href="/dashboard/analytics/customers">
            <Button variant="ghost" size="sm">
              View Details
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Customers */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Customers</CardDescription>
              <CardTitle className="text-3xl">
                {formatNumber(data.customer.total_customers.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">
                {formatNumber(data.customer.active_customers.value)} active
              </span>
            </CardContent>
          </Card>

          {/* New Customers */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>New Customers</CardDescription>
              <CardTitle className="text-3xl">
                {formatNumber(data.customer.new_customers.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getTrendIcon(data.customer.new_customers.trend)}
                <span className={`text-sm font-medium ${
                  data.customer.new_customers.trend.direction === 'up' ? 'text-green-600' :
                  data.customer.new_customers.trend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {formatPercent(data.customer.new_customers.growth_pct)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Retention Rate */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Retention Rate</CardDescription>
              <CardTitle className="text-3xl">
                {formatPercent(data.customer.retention_rate.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={getStatusColor(
                data.customer.retention_rate.value >= 80 ? 'excellent' :
                data.customer.retention_rate.value >= 60 ? 'good' :
                data.customer.retention_rate.value >= 40 ? 'fair' : 'poor'
              )}>
                {data.customer.retention_rate.value >= 80 ? 'Excellent' :
                 data.customer.retention_rate.value >= 60 ? 'Good' :
                 data.customer.retention_rate.value >= 40 ? 'Fair' : 'Needs Attention'}
              </Badge>
            </CardContent>
          </Card>

          {/* Customer LTV */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Customer LTV</CardDescription>
              <CardTitle className="text-3xl">
                {formatCurrency(data.customer.customer_ltv.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">Lifetime Value</span>
            </CardContent>
          </Card>

          {/* NPS Score */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>NPS Score</CardDescription>
              <CardTitle className="text-3xl">
                {data.customer.nps_score.value.toFixed(0)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={getStatusColor(data.customer.nps_score.status)}>
                {data.customer.nps_score.status.charAt(0).toUpperCase() + data.customer.nps_score.status.slice(1)}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Operational KPIs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Briefcase className="h-5 w-5 mr-2 text-purple-600" />
            Operational Efficiency
          </h2>
          <Link href="/dashboard/analytics/operations">
            <Button variant="ghost" size="sm">
              View Details
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Jobs Completed */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Jobs Completed</CardDescription>
              <CardTitle className="text-3xl">
                {formatNumber(data.operational.jobs_completed.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getTrendIcon(data.operational.jobs_completed.trend)}
                <span className={`text-sm font-medium ${
                  data.operational.jobs_completed.trend.direction === 'up' ? 'text-green-600' :
                  data.operational.jobs_completed.trend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {formatPercent(data.operational.jobs_completed.growth_pct)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Avg Jobs Per Day */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Jobs/Day</CardDescription>
              <CardTitle className="text-3xl">
                {data.operational.avg_jobs_per_day.value.toFixed(1)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">Daily Average</span>
            </CardContent>
          </Card>

          {/* Technician Utilization */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tech Utilization</CardDescription>
              <CardTitle className="text-3xl">
                {formatPercent(data.operational.technician_utilization.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={getStatusColor(data.operational.technician_utilization.status)}>
                {data.operational.technician_utilization.status.charAt(0).toUpperCase() +
                 data.operational.technician_utilization.status.slice(1)}
              </Badge>
            </CardContent>
          </Card>

          {/* Completion Rate */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completion Rate</CardDescription>
              <CardTitle className="text-3xl">
                {formatPercent(data.operational.completion_rate.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={getStatusColor(
                data.operational.completion_rate.value >= 95 ? 'excellent' :
                data.operational.completion_rate.value >= 85 ? 'good' :
                data.operational.completion_rate.value >= 70 ? 'fair' : 'poor'
              )}>
                {data.operational.completion_rate.value >= 95 ? 'Excellent' :
                 data.operational.completion_rate.value >= 85 ? 'Good' :
                 data.operational.completion_rate.value >= 70 ? 'Fair' : 'Needs Attention'}
              </Badge>
            </CardContent>
          </Card>

          {/* Customer Rating */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Rating</CardDescription>
              <CardTitle className="text-3xl">
                {data.operational.avg_rating.value.toFixed(1)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getTrendIcon(data.operational.avg_rating.trend)}
                <span className="text-xs text-muted-foreground">out of 5.0</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Marketing KPIs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center">
            <Target className="h-5 w-5 mr-2 text-orange-600" />
            Marketing Performance
          </h2>
          <Link href="/dashboard/analytics/marketing">
            <Button variant="ghost" size="sm">
              View Details
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Portal Adoption */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Portal Adoption</CardDescription>
              <CardTitle className="text-3xl">
                {formatPercent(data.marketing.portal_adoption.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">
                {formatNumber(data.marketing.portal_adoption.bookings)} of {formatNumber(data.marketing.portal_adoption.total_bookings)} bookings
              </span>
            </CardContent>
          </Card>

          {/* Campaign ROI */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Campaign ROI</CardDescription>
              <CardTitle className="text-3xl">
                {formatPercent(data.marketing.campaign_roi.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={getStatusColor(
                data.marketing.campaign_roi.value >= 200 ? 'excellent' :
                data.marketing.campaign_roi.value >= 100 ? 'good' :
                data.marketing.campaign_roi.value >= 0 ? 'fair' : 'poor'
              )}>
                {data.marketing.campaign_roi.value >= 200 ? 'Excellent' :
                 data.marketing.campaign_roi.value >= 100 ? 'Good' :
                 data.marketing.campaign_roi.value >= 0 ? 'Fair' : 'Loss'}
              </Badge>
            </CardContent>
          </Card>

          {/* Referral Conversion */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Referral Conversion</CardDescription>
              <CardTitle className="text-3xl">
                {formatPercent(data.marketing.referral_conversion.value)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">
                {formatNumber(data.marketing.referral_conversion.converted)} of {formatNumber(data.marketing.referral_conversion.total)} referrals
              </span>
            </CardContent>
          </Card>

          {/* Review Score */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Review Score</CardDescription>
              <CardTitle className="text-3xl">
                {data.marketing.avg_review_score.value.toFixed(1)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xs text-muted-foreground">
                {formatNumber(data.marketing.avg_review_score.count)} reviews
              </span>
            </CardContent>
          </Card>

          {/* Email Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Email Performance</CardDescription>
              <CardTitle className="text-2xl">
                {formatPercent(data.marketing.email_performance.open_rate)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Open Rate:</span>
                  <span>{formatPercent(data.marketing.email_performance.open_rate)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Click Rate:</span>
                  <span>{formatPercent(data.marketing.email_performance.click_rate)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Growth Indicators */}
      <div>
        <h2 className="text-xl font-semibold flex items-center mb-4">
          <Activity className="h-5 w-5 mr-2 text-indigo-600" />
          Growth Trends (12 Months)
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Monthly revenue over the past year</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.growth.revenue_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })}
                  />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Customer Growth Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Acquisition</CardTitle>
              <CardDescription>New customers each month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.growth.customer_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  />
                  <Legend />
                  <Bar dataKey="new_customers" fill="#3b82f6" name="New Customers" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
