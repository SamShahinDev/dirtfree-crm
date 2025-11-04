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
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts'
import {
  ClipboardCheck,
  Users,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

interface OperationalAnalytics {
  date_range: {
    start_date: string
    end_date: string
    group_by: string
  }
  job_performance: {
    overview: {
      total_jobs: number
      completed_jobs: number
      scheduled_jobs: number
      cancelled_jobs: number
      in_progress_jobs: number
      completion_rate: number
      cancellation_rate: number
      avg_job_duration: number
      total_technicians: number
    }
    period_metrics: any
    status_trend: Array<{
      period: string
      total: number
      completed: number
      cancelled: number
      scheduled: number
      in_progress: number
    }>
  }
  scheduling_efficiency: {
    by_zone: Array<{
      zone_id: string
      zone_name: string
      total_jobs: number
      avg_job_duration: number
      avg_travel_time: number
      travel_vs_service_ratio: number
      jobs_per_day: number
    }>
    utilization: Array<{
      date: string
      total_jobs: number
      technicians_working: number
      utilization_rate: number
      jobs_per_technician: number
    }>
  }
  technician_performance: Array<{
    technician_id: string
    technician_name: string
    total_jobs: number
    completed_jobs: number
    cancelled_jobs: number
    completion_rate: number
    avg_job_duration: number
    total_revenue: number
    avg_rating: number
    rating_count: number
    efficiency_score: number
  }>
  service_time_analysis: Array<{
    service_type: string
    job_count: number
    avg_estimated_duration: number
    avg_actual_duration: number
    avg_variance: number
    actual_vs_estimated_pct: number
    runs_over_count: number
    on_time_count: number
    on_time_rate: number
  }>
  cancellation_analysis: {
    by_reason: Array<{
      reason: string
      count: number
      percentage: number
      avg_days_before: number
      lost_revenue: number
    }>
    total_cancelled: number
    cancellation_rate: number
    total_lost_revenue: number
  }
  optimization_opportunities: Array<{
    type: string
    description: string
    impact_level: string
    affected_count: number
    recommendation: string
  }>
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const DATE_PRESETS = [
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 30 Days', value: '30' },
  { label: 'Last Quarter', value: '90' },
]

export default function OperationalAnalyticsPage() {
  const [data, setData] = useState<OperationalAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [daysBack, setDaysBack] = useState('30')
  const [groupBy, setGroupBy] = useState('day')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [daysBack, groupBy])

  function getDateRange(days: string) {
    const end = new Date()
    const start = new Date(end.getTime() - parseInt(days, 10) * 24 * 60 * 60 * 1000)
    return { start, end }
  }

  async function loadAnalytics() {
    try {
      setLoading(true)
      const { start, end } = getDateRange(daysBack)
      const res = await fetch(
        `/api/analytics/operations?start_date=${start.toISOString()}&end_date=${end.toISOString()}&group_by=${groupBy}`
      )
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast.error('Failed to load operational analytics')
      }
    } catch (error) {
      console.error('Load analytics error:', error)
      toast.error('Failed to load operational analytics')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport(format: 'csv' | 'json') {
    try {
      setExporting(true)
      const { start, end } = getDateRange(daysBack)
      const res = await fetch(
        `/api/analytics/operations?start_date=${start.toISOString()}&end_date=${end.toISOString()}&group_by=${groupBy}&export=${format}`
      )

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `operational-analytics-${new Date().toISOString().split('T')[0]}.${format}`
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
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading operational analytics...</div>
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
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
              Operational Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Operational efficiency metrics and optimization insights
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={daysBack} onValueChange={setDaysBack}>
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
              <div className="p-2 bg-blue-100 rounded-full">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <div className="text-2xl font-bold">
                  {data.job_performance.overview.completion_rate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.job_performance.overview.completed_jobs} / {data.job_performance.overview.total_jobs} jobs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Job Duration</p>
                <div className="text-2xl font-bold">
                  {data.job_performance.overview.avg_job_duration.toFixed(0)}m
                </div>
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
                <p className="text-sm text-muted-foreground">Active Technicians</p>
                <div className="text-2xl font-bold">
                  {data.job_performance.overview.total_technicians}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(data.job_performance.overview.total_jobs / Math.max(data.job_performance.overview.total_technicians, 1)).toFixed(1)} jobs/tech
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cancellation Rate</p>
                <div className="text-2xl font-bold text-red-600">
                  {data.job_performance.overview.cancellation_rate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(data.cancellation_analysis.total_lost_revenue)} lost
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Optimization Opportunities Alert */}
      {data.optimization_opportunities.length > 0 && (
        <Card className="mb-6 border-orange-200 bg-orange-50 dark:bg-orange-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
              <AlertTriangle className="h-5 w-5" />
              Optimization Opportunities ({data.optimization_opportunities.length})
            </CardTitle>
            <CardDescription className="text-orange-700 dark:text-orange-300">
              AI-identified areas for operational improvement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.optimization_opportunities.slice(0, 5).map((opp, index) => (
                <div key={index} className="p-3 bg-white dark:bg-gray-900 border border-orange-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          opp.impact_level === 'High'
                            ? 'destructive'
                            : opp.impact_level === 'Medium'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {opp.impact_level} Impact
                      </Badge>
                      <span className="font-medium text-sm">{opp.type}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{opp.affected_count} affected</span>
                  </div>
                  <p className="text-sm mb-2">{opp.description}</p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Recommendation:</strong> {opp.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="jobs" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="cancellations">Cancellations</TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          {/* Job Status Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Job Status Trend</CardTitle>
              <CardDescription>Job completion and status over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={data.job_performance.status_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={(value) => formatDate(value)}
                  />
                  <YAxis />
                  <Tooltip labelFormatter={(value) => formatDate(value)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#10b981"
                    name="Completed"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="scheduled"
                    stroke="#3b82f6"
                    name="Scheduled"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="cancelled"
                    stroke="#ef4444"
                    name="Cancelled"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="in_progress"
                    stroke="#f59e0b"
                    name="In Progress"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Job Status Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Status Distribution</CardTitle>
                <CardDescription>Current breakdown of all jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Completed', value: data.job_performance.overview.completed_jobs, color: '#10b981' },
                        { name: 'Scheduled', value: data.job_performance.overview.scheduled_jobs, color: '#3b82f6' },
                        { name: 'Cancelled', value: data.job_performance.overview.cancelled_jobs, color: '#ef4444' },
                        { name: 'In Progress', value: data.job_performance.overview.in_progress_jobs, color: '#f59e0b' },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {[
                        { name: 'Completed', value: data.job_performance.overview.completed_jobs, color: '#10b981' },
                        { name: 'Scheduled', value: data.job_performance.overview.scheduled_jobs, color: '#3b82f6' },
                        { name: 'Cancelled', value: data.job_performance.overview.cancelled_jobs, color: '#ef4444' },
                        { name: 'In Progress', value: data.job_performance.overview.in_progress_jobs, color: '#f59e0b' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Completion Rate</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">
                        {data.job_performance.overview.completion_rate.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium">Cancellation Rate</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-red-600">
                        {data.job_performance.overview.cancellation_rate.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Avg Duration</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">
                        {data.job_performance.overview.avg_job_duration.toFixed(0)} min
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-600" />
                      <span className="font-medium">Jobs per Technician</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">
                        {(data.job_performance.overview.total_jobs / Math.max(data.job_performance.overview.total_technicians, 1)).toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scheduling Tab */}
        <TabsContent value="scheduling" className="space-y-6">
          {/* Utilization Rate Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Utilization Rate</CardTitle>
              <CardDescription>Technician utilization percentage by day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.scheduling_efficiency.utilization}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => formatDate(value)}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => formatDate(value)}
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                  />
                  <Bar dataKey="utilization_rate" fill="#8b5cf6" name="Utilization %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Zone Efficiency Table */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduling Efficiency by Zone</CardTitle>
              <CardDescription>Zone-level performance and travel metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Zone</th>
                      <th className="text-right py-3 px-4">Jobs</th>
                      <th className="text-right py-3 px-4">Jobs/Day</th>
                      <th className="text-right py-3 px-4">Avg Duration</th>
                      <th className="text-right py-3 px-4">Avg Travel</th>
                      <th className="text-right py-3 px-4">Travel vs Service</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.scheduling_efficiency.by_zone.map((zone, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{zone.zone_name}</td>
                        <td className="text-right py-3 px-4">{zone.total_jobs}</td>
                        <td className="text-right py-3 px-4">{zone.jobs_per_day.toFixed(1)}</td>
                        <td className="text-right py-3 px-4">{zone.avg_job_duration.toFixed(0)}m</td>
                        <td className="text-right py-3 px-4">{zone.avg_travel_time.toFixed(0)}m</td>
                        <td className="text-right py-3 px-4">
                          <Badge
                            variant={
                              zone.travel_vs_service_ratio > 30
                                ? 'destructive'
                                : zone.travel_vs_service_ratio > 20
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {zone.travel_vs_service_ratio.toFixed(1)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technicians Tab */}
        <TabsContent value="technicians" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Technician Performance Leaderboard</CardTitle>
              <CardDescription>Ranked by efficiency score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.technician_performance.slice(0, 10).map((tech, index) => (
                  <div key={tech.technician_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 text-white font-bold">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{tech.technician_name}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary">{tech.total_jobs} jobs</Badge>
                          <Badge variant="outline">{tech.completion_rate.toFixed(1)}% completion</Badge>
                          {tech.avg_rating > 0 && (
                            <Badge variant="secondary">★ {tech.avg_rating.toFixed(1)}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-orange-600" />
                        <div className="text-2xl font-bold text-orange-600">
                          {tech.efficiency_score.toFixed(0)}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(tech.total_revenue)} revenue
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Technician Metrics Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Technician Comparison</CardTitle>
              <CardDescription>Jobs completed vs average duration</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="completed_jobs" name="Jobs Completed" />
                  <YAxis dataKey="avg_job_duration" name="Avg Duration (min)" />
                  <ZAxis dataKey="efficiency_score" range={[50, 400]} name="Efficiency Score" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-medium">{data.technician_name}</p>
                            <p className="text-sm">Jobs: {data.completed_jobs}</p>
                            <p className="text-sm">Avg Duration: {data.avg_job_duration.toFixed(0)}m</p>
                            <p className="text-sm">Efficiency: {data.efficiency_score.toFixed(0)}</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Scatter data={data.technician_performance} fill="#8b5cf6" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Time Analysis</CardTitle>
              <CardDescription>Actual vs estimated duration by service type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Service</th>
                      <th className="text-right py-3 px-4">Jobs</th>
                      <th className="text-right py-3 px-4">Est Duration</th>
                      <th className="text-right py-3 px-4">Actual Duration</th>
                      <th className="text-right py-3 px-4">Variance</th>
                      <th className="text-right py-3 px-4">Actual vs Est</th>
                      <th className="text-right py-3 px-4">On-Time Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.service_time_analysis.map((service, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{service.service_type}</td>
                        <td className="text-right py-3 px-4">{service.job_count}</td>
                        <td className="text-right py-3 px-4">{service.avg_estimated_duration.toFixed(0)}m</td>
                        <td className="text-right py-3 px-4">{service.avg_actual_duration.toFixed(0)}m</td>
                        <td className="text-right py-3 px-4">
                          <span className={service.avg_variance > 0 ? 'text-red-600' : 'text-green-600'}>
                            {service.avg_variance > 0 ? '+' : ''}{service.avg_variance.toFixed(0)}m
                          </span>
                        </td>
                        <td className="text-right py-3 px-4">
                          <Badge
                            variant={
                              service.actual_vs_estimated_pct > 120
                                ? 'destructive'
                                : service.actual_vs_estimated_pct > 110
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {service.actual_vs_estimated_pct.toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-4">{service.on_time_rate.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Services Running Over/Under */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Services Running Over Time</CardTitle>
                <CardDescription>Need adjusted time estimates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.service_time_analysis
                    .filter((s) => s.actual_vs_estimated_pct > 110)
                    .slice(0, 5)
                    .map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-red-200 rounded-lg">
                        <span className="font-medium">{service.service_type}</span>
                        <div className="text-right">
                          <Badge variant="destructive">{service.actual_vs_estimated_pct.toFixed(0)}%</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {service.runs_over_count} / {service.job_count} over
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Services Running Under Time</CardTitle>
                <CardDescription>Consistently efficient</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.service_time_analysis
                    .filter((s) => s.actual_vs_estimated_pct < 90)
                    .slice(0, 5)
                    .map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-green-200 rounded-lg">
                        <span className="font-medium">{service.service_type}</span>
                        <div className="text-right">
                          <Badge variant="secondary">{service.actual_vs_estimated_pct.toFixed(0)}%</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {service.on_time_count} / {service.job_count} on time
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cancellations Tab */}
        <TabsContent value="cancellations" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cancellation Reasons</CardTitle>
                <CardDescription>Breakdown of why jobs were cancelled</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.cancellation_analysis.by_reason}
                      dataKey="count"
                      nameKey="reason"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry: any) => `${entry.reason} (${entry.percentage.toFixed(0)}%)`}
                    >
                      {data.cancellation_analysis.by_reason.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cancellation Impact</CardTitle>
                <CardDescription>Financial and operational impact</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total Cancellations</p>
                    <div className="text-3xl font-bold text-red-600">
                      {data.cancellation_analysis.total_cancelled}
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Cancellation Rate</p>
                    <div className="text-3xl font-bold text-red-600">
                      {data.cancellation_analysis.cancellation_rate.toFixed(1)}%
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total Lost Revenue</p>
                    <div className="text-3xl font-bold text-red-600">
                      {formatCurrency(data.cancellation_analysis.total_lost_revenue)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cancellation Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Cancellation Details</CardTitle>
              <CardDescription>Detailed breakdown by reason</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Reason</th>
                      <th className="text-right py-3 px-4">Count</th>
                      <th className="text-right py-3 px-4">% of Total</th>
                      <th className="text-right py-3 px-4">Avg Days Before</th>
                      <th className="text-right py-3 px-4">Lost Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.cancellation_analysis.by_reason.map((cancel, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{cancel.reason}</td>
                        <td className="text-right py-3 px-4">{cancel.count}</td>
                        <td className="text-right py-3 px-4">{cancel.percentage.toFixed(1)}%</td>
                        <td className="text-right py-3 px-4">{cancel.avg_days_before.toFixed(1)} days</td>
                        <td className="text-right py-3 px-4">{formatCurrency(cancel.lost_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
