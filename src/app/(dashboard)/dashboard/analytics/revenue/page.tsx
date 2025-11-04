'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Download,
  RefreshCw,
  Calendar,
  CreditCard,
  Target,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { toast } from 'sonner'

interface RevenueAnalytics {
  date_range: {
    start_date: string
    end_date: string
    group_by: string
  }
  overview: {
    total_revenue: number
    total_invoices: number
    unique_customers: number
    avg_invoice_value: number
    yoy_comparison: {
      current_period_revenue: number
      previous_period_revenue: number
      revenue_change: number
      revenue_change_pct: number
    } | null
  }
  revenue_sources: {
    portal_bookings: number
    phone_bookings: number
    repeat_customers: number
    new_customers: number
    referrals: number
    breakdown: Array<{
      source: string
      revenue: number
    }>
  }
  payment_analytics: {
    methods: Array<{
      payment_method: string
      transaction_count: number
      total_revenue: number
      avg_transaction_value: number
      percentage_of_transactions: number
      percentage_of_revenue: number
      avg_days_to_payment: number
    }>
    outstanding: {
      count: number
      total: number
    }
    overdue: {
      count: number
      total: number
    }
    avg_days_outstanding: number
  }
  service_performance: {
    by_service: Array<{
      service_type: string
      job_count: number
      unique_customers: number
      total_revenue: number
      avg_revenue_per_job: number
      total_profit: number
      profit_margin_pct: number
    }>
    top_services: Array<any>
    bottom_services: Array<any>
  }
  customer_value: {
    ltv_by_tier: Array<{
      tier_name: string
      tier_level: number
      customer_count: number
      avg_lifetime_value: number
      avg_jobs_per_customer: number
      avg_order_value: number
      repeat_purchase_rate_pct: number
    }>
    top_customers: Array<{
      customer_id: string
      customer_name: string
      customer_email: string
      total_revenue: number
      job_count: number
      avg_order_value: number
      tier_name: string
    }>
    avg_ltv: number
    overall_repeat_rate: number
  }
  charts: {
    revenue_trend: Array<{
      date: string
      revenue: number
      invoices: number
      customers: number
    }>
    revenue_by_zone: Array<{
      zone_name: string
      total_revenue: number
      job_count: number
    }>
    revenue_by_service: Array<{
      service_type: string
      total_revenue: number
    }>
  }
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 Days', value: 'week' },
  { label: 'Last 30 Days', value: 'month' },
  { label: 'Last Quarter', value: 'quarter' },
  { label: 'Last Year', value: 'year' },
]

export default function RevenueAnalyticsPage() {
  const [data, setData] = useState<RevenueAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [datePreset, setDatePreset] = useState('month')
  const [groupBy, setGroupBy] = useState('day')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [datePreset, groupBy])

  function getDateRange(preset: string) {
    const end = new Date()
    let start = new Date()

    switch (preset) {
      case 'today':
        start = new Date()
        start.setHours(0, 0, 0, 0)
        break
      case 'week':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'quarter':
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    return { start, end }
  }

  async function loadAnalytics() {
    try {
      setLoading(true)
      const { start, end } = getDateRange(datePreset)
      const res = await fetch(
        `/api/analytics/revenue?start_date=${start.toISOString()}&end_date=${end.toISOString()}&group_by=${groupBy}`
      )
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast.error('Failed to load revenue analytics')
      }
    } catch (error) {
      console.error('Load analytics error:', error)
      toast.error('Failed to load revenue analytics')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport(format: 'csv' | 'json') {
    try {
      setExporting(true)
      const { start, end } = getDateRange(datePreset)
      const res = await fetch(
        `/api/analytics/revenue?start_date=${start.toISOString()}&end_date=${end.toISOString()}&group_by=${groupBy}&export=${format}`
      )

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `revenue-analytics-${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success(`Analytics exported as ${format.toUpperCase()}`)
      } else {
        toast.error('Export failed')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading revenue analytics...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">No analytics data available</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-[1600px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              Revenue Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive revenue insights and performance metrics
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">By Day</SelectItem>
                <SelectItem value="week">By Week</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadAnalytics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('json')} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.overview.total_revenue)}
                </div>
                {data.overview.yoy_comparison && (
                  <div className={`flex items-center gap-1 text-sm ${
                    data.overview.yoy_comparison.revenue_change_pct >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {data.overview.yoy_comparison.revenue_change_pct >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(data.overview.yoy_comparison.revenue_change_pct).toFixed(1)}% YoY
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <div className="text-2xl font-bold">
                  {data.overview.total_invoices.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">
                  Avg: {formatCurrency(data.overview.avg_invoice_value)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique Customers</p>
                <div className="text-2xl font-bold">
                  {data.overview.unique_customers.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">
                  {data.customer_value.overall_repeat_rate.toFixed(1)}% repeat rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <Target className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Customer LTV</p>
                <div className="text-2xl font-bold">
                  {formatCurrency(data.customer_value.avg_ltv)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Revenue Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Revenue, invoices, and customers over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={data.charts.revenue_trend}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => formatDate(value)}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    labelFormatter={(value) => formatDate(value)}
                    formatter={(value: number, name: string) => {
                      if (name === 'revenue') return formatCurrency(value)
                      return value.toLocaleString()
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="Revenue"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="invoices"
                    stroke="#3b82f6"
                    name="Invoices"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="customers"
                    stroke="#8b5cf6"
                    name="Customers"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue by Zone and Service */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Zone</CardTitle>
                <CardDescription>Top performing service zones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.charts.revenue_by_zone.slice(0, 5).map((zone, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{zone.zone_name || 'Unassigned'}</span>
                          <span className="text-sm font-bold">
                            {formatCurrency(parseFloat(zone.total_revenue.toString()))}
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all"
                            style={{
                              width: `${(parseFloat(zone.total_revenue.toString()) / parseFloat(data.charts.revenue_by_zone[0]?.total_revenue.toString() || '1')) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {zone.job_count} jobs
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Service Type</CardTitle>
                <CardDescription>Service distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.charts.revenue_by_service.slice(0, 6)}
                      dataKey="total_revenue"
                      nameKey="service_type"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry: any) => `${entry.service_type} (${formatCurrency(parseFloat(entry.total_revenue))})`}
                    >
                      {data.charts.revenue_by_service.slice(0, 6).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* YoY Comparison */}
          {data.overview.yoy_comparison && (
            <Card>
              <CardHeader>
                <CardTitle>Year-over-Year Comparison</CardTitle>
                <CardDescription>Performance vs same period last year</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Current Period</p>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(parseFloat(data.overview.yoy_comparison.current_period_revenue.toString()))}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Previous Year</p>
                    <div className="text-2xl font-bold">
                      {formatCurrency(parseFloat(data.overview.yoy_comparison.previous_period_revenue.toString()))}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Change</p>
                    <div className={`text-2xl font-bold ${
                      parseFloat(data.overview.yoy_comparison.revenue_change.toString()) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(Math.abs(parseFloat(data.overview.yoy_comparison.revenue_change.toString())))}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Growth Rate</p>
                    <div className={`text-2xl font-bold flex items-center gap-2 ${
                      parseFloat(data.overview.yoy_comparison.revenue_change_pct.toString()) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {parseFloat(data.overview.yoy_comparison.revenue_change_pct.toString()) >= 0 ? (
                        <TrendingUp className="h-6 w-6" />
                      ) : (
                        <TrendingDown className="h-6 w-6" />
                      )}
                      {Math.abs(parseFloat(data.overview.yoy_comparison.revenue_change_pct.toString())).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Sources Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Sources</CardTitle>
                <CardDescription>Breakdown by booking channel and customer type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.revenue_sources.breakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Source Cards */}
            <Card>
              <CardHeader>
                <CardTitle>Source Details</CardTitle>
                <CardDescription>Revenue by channel and customer segment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">Portal Bookings</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(data.revenue_sources.portal_bookings)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">Phone Bookings</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(data.revenue_sources.phone_bookings)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">Repeat Customers</span>
                    <span className="text-lg font-bold text-purple-600">
                      {formatCurrency(data.revenue_sources.repeat_customers)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">New Customers</span>
                    <span className="text-lg font-bold text-orange-600">
                      {formatCurrency(data.revenue_sources.new_customers)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">Referrals</span>
                    <span className="text-lg font-bold text-pink-600">
                      {formatCurrency(data.revenue_sources.referrals)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-6">
          {/* Outstanding Invoices Alert */}
          {(data.payment_analytics.outstanding.count > 0 || data.payment_analytics.overdue.count > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-sm text-orange-800 dark:text-orange-200">Outstanding Invoices</p>
                      <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                        {formatCurrency(data.payment_analytics.outstanding.total)}
                      </div>
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        {data.payment_analytics.outstanding.count} invoices
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50 dark:bg-red-950">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                    <div>
                      <p className="text-sm text-red-800 dark:text-red-200">Overdue Invoices</p>
                      <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                        {formatCurrency(data.payment_analytics.overdue.total)}
                      </div>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {data.payment_analytics.overdue.count} invoices
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Transaction distribution and performance by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Payment Method</th>
                      <th className="text-right py-3 px-4">Transactions</th>
                      <th className="text-right py-3 px-4">Total Revenue</th>
                      <th className="text-right py-3 px-4">Avg Value</th>
                      <th className="text-right py-3 px-4">% Transactions</th>
                      <th className="text-right py-3 px-4">% Revenue</th>
                      <th className="text-right py-3 px-4">Avg Days to Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payment_analytics.methods.map((method, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{method.payment_method || 'Not Specified'}</td>
                        <td className="text-right py-3 px-4">{method.transaction_count.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(parseFloat(method.total_revenue.toString()))}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(parseFloat(method.avg_transaction_value.toString()))}</td>
                        <td className="text-right py-3 px-4">{parseFloat(method.percentage_of_transactions.toString()).toFixed(1)}%</td>
                        <td className="text-right py-3 px-4">{parseFloat(method.percentage_of_revenue.toString()).toFixed(1)}%</td>
                        <td className="text-right py-3 px-4">{parseFloat(method.avg_days_to_payment.toString()).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method Distribution</CardTitle>
              <CardDescription>Revenue breakdown by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.payment_analytics.methods}
                    dataKey="total_revenue"
                    nameKey="payment_method"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry: any) => `${entry.payment_method || 'N/A'} (${parseFloat(entry.percentage_of_revenue).toFixed(1)}%)`}
                  >
                    {data.payment_analytics.methods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          {/* Service Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Service Performance</CardTitle>
              <CardDescription>Revenue and profitability by service type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Service Type</th>
                      <th className="text-right py-3 px-4">Jobs</th>
                      <th className="text-right py-3 px-4">Customers</th>
                      <th className="text-right py-3 px-4">Revenue</th>
                      <th className="text-right py-3 px-4">Avg/Job</th>
                      <th className="text-right py-3 px-4">Profit</th>
                      <th className="text-right py-3 px-4">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.service_performance.by_service.map((service, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{service.service_type}</td>
                        <td className="text-right py-3 px-4">{service.job_count.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{service.unique_customers.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(parseFloat(service.total_revenue.toString()))}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(parseFloat(service.avg_revenue_per_job.toString()))}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(parseFloat(service.total_profit.toString()))}</td>
                        <td className="text-right py-3 px-4">
                          <Badge variant={parseFloat(service.profit_margin_pct.toString()) > 30 ? 'default' : 'secondary'}>
                            {parseFloat(service.profit_margin_pct.toString()).toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Top and Bottom Services */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Services</CardTitle>
                <CardDescription>Highest revenue generating services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.service_performance.top_services.map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{service.service_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {service.job_count} jobs • {parseFloat(service.profit_margin_pct).toFixed(1)}% margin
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">
                          {formatCurrency(parseFloat(service.total_revenue))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Needs Attention</CardTitle>
                <CardDescription>Lower performing services</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.service_performance.bottom_services.map((service, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold">
                          !
                        </div>
                        <div>
                          <p className="font-medium">{service.service_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {service.job_count} jobs • {parseFloat(service.profit_margin_pct).toFixed(1)}% margin
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-orange-600">
                          {formatCurrency(parseFloat(service.total_revenue))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          {/* Customer LTV by Tier */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Lifetime Value by Tier</CardTitle>
              <CardDescription>Customer value metrics segmented by loyalty tier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Tier</th>
                      <th className="text-right py-3 px-4">Customers</th>
                      <th className="text-right py-3 px-4">Avg LTV</th>
                      <th className="text-right py-3 px-4">Avg Jobs</th>
                      <th className="text-right py-3 px-4">Avg Order Value</th>
                      <th className="text-right py-3 px-4">Repeat Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customer_value.ltv_by_tier.map((tier, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{tier.tier_name}</td>
                        <td className="text-right py-3 px-4">{tier.customer_count.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(parseFloat(tier.avg_lifetime_value.toString()))}</td>
                        <td className="text-right py-3 px-4">{parseFloat(tier.avg_jobs_per_customer.toString()).toFixed(1)}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(parseFloat(tier.avg_order_value.toString()))}</td>
                        <td className="text-right py-3 px-4">
                          <Badge variant="secondary">
                            {parseFloat(tier.repeat_purchase_rate_pct.toString()).toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Top Revenue Customers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Revenue Customers</CardTitle>
              <CardDescription>Highest value customers in selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.customer_value.top_customers.slice(0, 10).map((customer, index) => (
                  <div key={customer.customer_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-blue-500 text-white font-bold">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{customer.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{customer.customer_email}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary">{customer.tier_name}</Badge>
                          <Badge variant="outline">{customer.job_count} jobs</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(parseFloat(customer.total_revenue.toString()))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Avg: {formatCurrency(parseFloat(customer.avg_order_value.toString()))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
