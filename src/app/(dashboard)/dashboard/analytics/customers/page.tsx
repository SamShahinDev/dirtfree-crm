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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  MapPin,
  Award,
  Clock,
  Target,
} from 'lucide-react'
import { toast } from 'sonner'

interface CustomerAnalytics {
  overview: {
    total_customers: number
    new_customers_this_month: number
    active_customers: number
    churned_customers: number
    churn_rate: number
    avg_bookings_per_customer: number
    avg_customer_ltv: number
  }
  segments: {
    distribution: Array<{
      segment: string
      customer_count: number
      avg_lifetime_value: number
      avg_bookings: number
      percentage: number
    }>
    customers_by_segment: Array<any> | null
  }
  acquisition: {
    sources: Array<{
      source: string
      customer_count: number
      avg_bookings: number
      avg_ltv: number
      total_revenue: number
      percentage: number
    }>
  }
  behavior: {
    booking_patterns: Array<{
      day_of_week: number
      day_name: string
      booking_count: number
      unique_customers: number
      avg_value: number
    }>
    favorite_services: Array<{
      segment: string
      service_type: string
      booking_count: number
      customer_count: number
      rank: number
    }>
    avg_time_between_bookings: Array<{
      segment: string
      avg_days: number
    }>
  }
  geographic: {
    distribution: Array<{
      zone_id: string
      zone_name: string
      customer_count: number
      total_jobs: number
      total_revenue: number
      avg_job_value: number
      percentage: number
    }>
  }
  trends: {
    growth: Array<{
      month: string
      new_customers: number
      churned_customers: number
      net_growth: number
      total_customers: number
    }>
    retention_cohorts: Array<any>
  }
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6']

const SEGMENT_COLORS: Record<string, string> = {
  VIP: '#8b5cf6',
  Regular: '#3b82f6',
  Active: '#10b981',
  'One-time': '#f59e0b',
  'At-risk': '#ef4444',
  Inactive: '#6b7280',
}

export default function CustomerAnalyticsPage() {
  const [data, setData] = useState<CustomerAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [segmentFilter, setSegmentFilter] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [segmentFilter])

  async function loadAnalytics() {
    try {
      setLoading(true)
      const url = segmentFilter
        ? `/api/analytics/customers?segment=${segmentFilter}`
        : '/api/analytics/customers'
      const res = await fetch(url)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast.error('Failed to load customer analytics')
      }
    } catch (error) {
      console.error('Load analytics error:', error)
      toast.error('Failed to load customer analytics')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport(format: 'csv' | 'json') {
    try {
      setExporting(true)
      const url = segmentFilter
        ? `/api/analytics/customers?segment=${segmentFilter}&export=${format}`
        : `/api/analytics/customers?export=${format}`
      const res = await fetch(url)

      if (res.ok) {
        const blob = await res.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `customer-analytics-${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading customer analytics...</div>
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
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              Customer Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Customer insights, segmentation, and behavior analysis
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select
              value={segmentFilter || 'all'}
              onValueChange={(value) => setSegmentFilter(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
                <SelectItem value="Regular">Regular</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="One-time">One-time</SelectItem>
                <SelectItem value="At-risk">At-risk</SelectItem>
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
              <div className="p-2 bg-blue-100 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <div className="text-2xl font-bold">
                  {data.overview.total_customers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(data.overview.avg_customer_ltv)} avg LTV
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <UserPlus className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">New (This Month)</p>
                <div className="text-2xl font-bold text-green-600">
                  {data.overview.new_customers_this_month.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <UserCheck className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active (90d)</p>
                <div className="text-2xl font-bold text-purple-600">
                  {data.overview.active_customers.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.overview.avg_bookings_per_customer.toFixed(1)} avg bookings
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Churned</p>
                <div className="text-2xl font-bold text-red-600">
                  {data.overview.churned_customers.toLocaleString()}
                </div>
                <Badge variant="destructive" className="mt-1">
                  {data.overview.churn_rate.toFixed(1)}% churn rate
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="acquisition">Acquisition</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
          <TabsTrigger value="geographic">Geographic</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Customer Growth Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Growth Trend</CardTitle>
              <CardDescription>Monthly new customers, churn, and net growth</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={data.trends.growth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                    }
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="new_customers"
                    stroke="#10b981"
                    name="New Customers"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="churned_customers"
                    stroke="#ef4444"
                    name="Churned"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="net_growth"
                    stroke="#3b82f6"
                    name="Net Growth"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="total_customers"
                    stroke="#8b5cf6"
                    name="Total Customers"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Segment Distribution Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Segments</CardTitle>
                <CardDescription>Distribution across customer segments</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.segments.distribution}
                      dataKey="customer_count"
                      nameKey="segment"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry: any) => `${entry.segment} (${entry.percentage.toFixed(0)}%)`}
                    >
                      {data.segments.distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SEGMENT_COLORS[entry.segment] || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Segment Details</CardTitle>
                <CardDescription>Customer count and value by segment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.segments.distribution.map((segment) => (
                    <div key={segment.segment} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: SEGMENT_COLORS[segment.segment] || '#6b7280' }}
                        />
                        <div>
                          <p className="font-medium">{segment.segment}</p>
                          <p className="text-sm text-muted-foreground">
                            {segment.avg_bookings.toFixed(1)} avg bookings
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {segment.customer_count.toLocaleString()}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(segment.avg_lifetime_value)} LTV
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Segments Tab */}
        <TabsContent value="segments" className="space-y-6">
          {/* Segment Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Segment Performance Comparison</CardTitle>
              <CardDescription>Detailed metrics across customer segments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Segment</th>
                      <th className="text-right py-3 px-4">Customers</th>
                      <th className="text-right py-3 px-4">% of Total</th>
                      <th className="text-right py-3 px-4">Avg LTV</th>
                      <th className="text-right py-3 px-4">Avg Bookings</th>
                      <th className="text-right py-3 px-4">Avg Days Between</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.segments.distribution.map((segment) => {
                      const timeData = data.behavior.avg_time_between_bookings.find(
                        (t) => t.segment === segment.segment
                      )
                      return (
                        <tr key={segment.segment} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: SEGMENT_COLORS[segment.segment] }}
                              />
                              <span className="font-medium">{segment.segment}</span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">{segment.customer_count.toLocaleString()}</td>
                          <td className="text-right py-3 px-4">{segment.percentage.toFixed(1)}%</td>
                          <td className="text-right py-3 px-4">{formatCurrency(segment.avg_lifetime_value)}</td>
                          <td className="text-right py-3 px-4">{segment.avg_bookings.toFixed(1)}</td>
                          <td className="text-right py-3 px-4">
                            {timeData ? `${timeData.avg_days.toFixed(0)} days` : 'N/A'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Favorite Services by Segment */}
          <Card>
            <CardHeader>
              <CardTitle>Top Services by Segment</CardTitle>
              <CardDescription>Most popular services for each customer segment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {['VIP', 'Regular', 'Active', 'One-time', 'At-risk'].map((segment) => {
                  const segmentServices = data.behavior.favorite_services
                    .filter((s) => s.segment === segment && s.rank <= 3)
                    .sort((a, b) => a.rank - b.rank)

                  if (segmentServices.length === 0) return null

                  return (
                    <Card key={segment}>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: SEGMENT_COLORS[segment] }}
                          />
                          {segment}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {segmentServices.map((service) => (
                            <div key={service.service_type} className="flex items-center justify-between text-sm">
                              <span className="truncate">{service.service_type}</span>
                              <Badge variant="secondary">{service.booking_count}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Customer List (if segment filter is applied) */}
          {segmentFilter && data.segments.customers_by_segment && (
            <Card>
              <CardHeader>
                <CardTitle>Customers in {segmentFilter} Segment</CardTitle>
                <CardDescription>Top customers by lifetime value</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Customer</th>
                        <th className="text-right py-3 px-4">Bookings</th>
                        <th className="text-right py-3 px-4">Lifetime Value</th>
                        <th className="text-right py-3 px-4">Last Booking</th>
                        <th className="text-right py-3 px-4">Days Since</th>
                        <th className="text-right py-3 px-4">Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.segments.customers_by_segment.slice(0, 20).map((customer: any) => (
                        <tr key={customer.customer_id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{customer.customer_name}</p>
                              <p className="text-sm text-muted-foreground">{customer.customer_email}</p>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">{customer.total_bookings}</td>
                          <td className="text-right py-3 px-4">{formatCurrency(parseFloat(customer.lifetime_value || 0))}</td>
                          <td className="text-right py-3 px-4">
                            {customer.last_booking_date
                              ? new Date(customer.last_booking_date).toLocaleDateString()
                              : 'N/A'}
                          </td>
                          <td className="text-right py-3 px-4">
                            {customer.days_since_last_booking ? `${customer.days_since_last_booking.toFixed(0)} days` : 'N/A'}
                          </td>
                          <td className="text-right py-3 px-4">
                            <Badge variant="secondary">{customer.loyalty_tier}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Acquisition Tab */}
        <TabsContent value="acquisition" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Acquisition Sources Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Acquisition Sources</CardTitle>
                <CardDescription>How customers found your business</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.acquisition.sources}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="customer_count" fill="#3b82f6" name="Customers" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Acquisition Source Pie */}
            <Card>
              <CardHeader>
                <CardTitle>Source Distribution</CardTitle>
                <CardDescription>Percentage breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.acquisition.sources}
                      dataKey="customer_count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry: any) => `${entry.source} (${entry.percentage.toFixed(0)}%)`}
                    >
                      {data.acquisition.sources.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Source Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Source Performance Metrics</CardTitle>
              <CardDescription>Customer value and engagement by acquisition source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Source</th>
                      <th className="text-right py-3 px-4">Customers</th>
                      <th className="text-right py-3 px-4">% of Total</th>
                      <th className="text-right py-3 px-4">Avg Bookings</th>
                      <th className="text-right py-3 px-4">Avg LTV</th>
                      <th className="text-right py-3 px-4">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.acquisition.sources.map((source, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{source.source}</td>
                        <td className="text-right py-3 px-4">{source.customer_count.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{source.percentage.toFixed(1)}%</td>
                        <td className="text-right py-3 px-4">{source.avg_bookings.toFixed(1)}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(source.avg_ltv)}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(source.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Behavior Tab */}
        <TabsContent value="behavior" className="space-y-6">
          {/* Booking Patterns by Day */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Patterns by Day of Week</CardTitle>
              <CardDescription>Customer booking preferences throughout the week</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.behavior.booking_patterns}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day_name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="booking_count" fill="#3b82f6" name="Bookings" />
                  <Bar yAxisId="left" dataKey="unique_customers" fill="#10b981" name="Customers" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Average Time Between Bookings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Rebooking Frequency</CardTitle>
                <CardDescription>Average days between bookings by segment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.behavior.avg_time_between_bookings.map((item) => (
                    <div key={item.segment} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{item.segment}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">{item.avg_days.toFixed(0)}</div>
                        <p className="text-xs text-muted-foreground">days</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Booking Value Patterns</CardTitle>
                <CardDescription>Average booking value by day of week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.behavior.booking_patterns}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day_name" angle={-45} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="avg_value" fill="#8b5cf6" name="Avg Value" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Geographic Tab */}
        <TabsContent value="geographic" className="space-y-6">
          {/* Geographic Distribution Table */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Distribution by Zone</CardTitle>
              <CardDescription>Customer count and revenue by service zone</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Zone</th>
                      <th className="text-right py-3 px-4">Customers</th>
                      <th className="text-right py-3 px-4">% of Total</th>
                      <th className="text-right py-3 px-4">Total Jobs</th>
                      <th className="text-right py-3 px-4">Total Revenue</th>
                      <th className="text-right py-3 px-4">Avg Job Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.geographic.distribution.map((zone, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{zone.zone_name}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4">{zone.customer_count.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{zone.percentage.toFixed(1)}%</td>
                        <td className="text-right py-3 px-4">{zone.total_jobs.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(zone.total_revenue)}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(zone.avg_job_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Zone Comparison Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Customers by Zone</CardTitle>
                <CardDescription>Customer distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.geographic.distribution.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="zone_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="customer_count" fill="#3b82f6" name="Customers" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Zone</CardTitle>
                <CardDescription>Total revenue distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.geographic.distribution.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="zone_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="total_revenue" fill="#10b981" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
