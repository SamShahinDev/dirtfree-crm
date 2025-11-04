'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
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
} from 'recharts'
import {
  MessageSquare,
  Users,
  TrendingUp,
  Clock,
  Bot,
  UserCheck,
  AlertCircle,
  Star,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from 'lucide-react'

/**
 * Messaging Analytics Dashboard
 *
 * Comprehensive analytics for customer messaging including:
 * - Message volume trends
 * - Response time metrics
 * - Chatbot performance
 * - Staff performance comparison
 * - Topic distribution
 * - Escalation trends
 * - Customer satisfaction
 */

interface AnalyticsData {
  period: string
  dateRange: {
    start: string
    end: string
  }
  overview: {
    totalMessages: number
    customerMessages: number
    staffMessages: number
    chatbotMessages: number
    uniqueCustomers: number
    uniqueStaff: number
    avgMessagesPerCustomer: number
    chatbotPercentage: number
    avgResponseTimeSeconds: number
    avgSatisfactionRating: number
  }
  timeSeries: Array<{
    date: string
    total: number
    customer: number
    staff: number
    chatbot: number
  }>
  responseTime: Array<{
    staffId: string
    staffName: string
    avgResponseSeconds: number
    medianResponseSeconds: number
    responseCount: number
  }>
  chatbotPerformance: {
    totalSessions: number
    totalInteractions: number
    successfulSessions: number
    escalatedSessions: number
    escalationRate: number
    avgConfidence: number
    avgInteractionsPerSession: number
    topIntent: string
    topIntentCount: number
  }
  topicDistribution: Array<{
    intent: string
    count: number
    percentage: number
  }>
  escalationTrends: Array<{
    date: string
    totalSessions: number
    escalatedSessions: number
    escalationRate: number
    avgConfidence: number
  }>
  satisfactionRatings: Array<{
    rating: number
    count: number
    percentage: number
  }>
  resolutionTime: {
    avgHours: number
    medianHours: number
    minHours: number
    maxHours: number
    totalResolved: number
  }
  hourlyVolume: Array<{
    hour: number
    total: number
    customer: number
    staff: number
    chatbot: number
  }>
  staffPerformance: Array<{
    staffId: string
    staffName: string
    customersHandled: number
    totalMessagesSent: number
    daysActive: number
  }>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658']

export default function MessagingAnalyticsPage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({ period })
      const response = await fetch(`/api/messaging/analytics?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch analytics')
      }

      setAnalyticsData(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  // Load on mount and when period changes
  useEffect(() => {
    fetchAnalytics()
  }, [period])

  // Format seconds to human readable
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  // Format date for charts
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    if (period === 'day') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Messaging Analytics</h1>
            <p className="text-muted-foreground">
              Communication insights and performance metrics
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !analyticsData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to Load Analytics</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchAnalytics}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  const { overview, timeSeries, responseTime, chatbotPerformance, topicDistribution, escalationTrends, satisfactionRatings, resolutionTime, hourlyVolume, staffPerformance } = analyticsData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messaging Analytics</h1>
          <p className="text-muted-foreground">
            Communication insights and performance metrics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Last 24h</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.avgMessagesPerCustomer.toFixed(1)} per customer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(overview.avgResponseTimeSeconds)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Staff response time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chatbot Usage</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.chatbotPercentage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.chatbotMessages.toLocaleString()} automated messages
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.avgSatisfactionRating.toFixed(1)}/5
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average rating
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chatbot">Chatbot</TabsTrigger>
          <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Message Volume Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Message Volume</CardTitle>
              <CardDescription>Message traffic over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDate} />
                  <YAxis />
                  <Tooltip labelFormatter={formatDate} />
                  <Legend />
                  <Line type="monotone" dataKey="customer" stroke="#0088FE" name="Customer" />
                  <Line type="monotone" dataKey="staff" stroke="#00C49F" name="Staff" />
                  <Line type="monotone" dataKey="chatbot" stroke="#FFBB28" name="Chatbot" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Topic Distribution and Hourly Volume */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Topic Distribution</CardTitle>
                <CardDescription>Most common message topics</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={topicDistribution}
                      dataKey="count"
                      nameKey="intent"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${entry.intent}: ${entry.percentage}%`}
                    >
                      {topicDistribution.map((entry, index) => (
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
                <CardTitle>Busiest Times</CardTitle>
                <CardDescription>Message volume by hour of day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyVolume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                    <YAxis />
                    <Tooltip labelFormatter={(h) => `${h}:00`} />
                    <Bar dataKey="total" fill="#8884D8" name="Total Messages" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Resolution Time */}
          <Card>
            <CardHeader>
              <CardTitle>Resolution Time</CardTitle>
              <CardDescription>Time to resolve customer issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Average</p>
                  <p className="text-2xl font-bold">{resolutionTime.avgHours.toFixed(1)}h</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Median</p>
                  <p className="text-2xl font-bold">{resolutionTime.medianHours.toFixed(1)}h</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Fastest</p>
                  <p className="text-2xl font-bold">{resolutionTime.minHours.toFixed(1)}h</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Resolved</p>
                  <p className="text-2xl font-bold">{resolutionTime.totalResolved}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chatbot Tab */}
        <TabsContent value="chatbot" className="space-y-4">
          {/* Chatbot Performance Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((chatbotPerformance.successfulSessions / chatbotPerformance.totalSessions) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {chatbotPerformance.successfulSessions} / {chatbotPerformance.totalSessions} sessions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Escalation Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{chatbotPerformance.escalationRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {chatbotPerformance.escalatedSessions} escalated sessions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{chatbotPerformance.avgConfidence.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {chatbotPerformance.avgInteractionsPerSession.toFixed(1)} interactions/session
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Escalation Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Escalation Trends</CardTitle>
              <CardDescription>Escalation rate and confidence over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={escalationTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDate} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip labelFormatter={formatDate} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="escalationRate"
                    stroke="#FF8042"
                    name="Escalation Rate (%)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgConfidence"
                    stroke="#0088FE"
                    name="Avg Confidence (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Satisfaction Ratings */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Satisfaction</CardTitle>
              <CardDescription>Rating distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={satisfactionRatings}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rating" tickFormatter={(r) => `${r} ⭐`} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82CA9D" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Performance Tab */}
        <TabsContent value="staff" className="space-y-4">
          {/* Response Time by Staff */}
          <Card>
            <CardHeader>
              <CardTitle>Response Time by Staff</CardTitle>
              <CardDescription>Average response time comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={responseTime} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(s) => formatDuration(s)} />
                  <YAxis type="category" dataKey="staffName" width={120} />
                  <Tooltip formatter={(s: any) => formatDuration(s)} />
                  <Legend />
                  <Bar dataKey="avgResponseSeconds" fill="#0088FE" name="Avg Response Time" />
                  <Bar dataKey="medianResponseSeconds" fill="#00C49F" name="Median Response Time" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Staff Performance Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
              <CardDescription>Messages sent and customers handled</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={staffPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="staffName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalMessagesSent" fill="#8884D8" name="Messages Sent" />
                  <Bar dataKey="customersHandled" fill="#82CA9D" name="Customers Handled" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Staff Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Staff Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Staff Member</th>
                      <th className="text-right py-2 px-4">Messages Sent</th>
                      <th className="text-right py-2 px-4">Customers</th>
                      <th className="text-right py-2 px-4">Days Active</th>
                      <th className="text-right py-2 px-4">Avg Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPerformance.map((staff) => {
                      const staffResponseTime = responseTime.find(rt => rt.staffId === staff.staffId)
                      return (
                        <tr key={staff.staffId} className="border-b">
                          <td className="py-2 px-4">{staff.staffName}</td>
                          <td className="text-right py-2 px-4">{staff.totalMessagesSent.toLocaleString()}</td>
                          <td className="text-right py-2 px-4">{staff.customersHandled}</td>
                          <td className="text-right py-2 px-4">{staff.daysActive}</td>
                          <td className="text-right py-2 px-4">
                            {staffResponseTime ? formatDuration(staffResponseTime.avgResponseSeconds) : 'N/A'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          {/* Message Volume Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Message Volume Trend</CardTitle>
              <CardDescription>Total messages over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDate} />
                  <YAxis />
                  <Tooltip labelFormatter={formatDate} />
                  <Line type="monotone" dataKey="total" stroke="#8884D8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Daily Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Breakdown</CardTitle>
              <CardDescription>Message types per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Date</th>
                      <th className="text-right py-2 px-4">Total</th>
                      <th className="text-right py-2 px-4">Customer</th>
                      <th className="text-right py-2 px-4">Staff</th>
                      <th className="text-right py-2 px-4">Chatbot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeSeries.slice(0, 10).map((day) => (
                      <tr key={day.date} className="border-b">
                        <td className="py-2 px-4">{formatDate(day.date)}</td>
                        <td className="text-right py-2 px-4 font-medium">{day.total}</td>
                        <td className="text-right py-2 px-4">{day.customer}</td>
                        <td className="text-right py-2 px-4">{day.staff}</td>
                        <td className="text-right py-2 px-4">{day.chatbot}</td>
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
