'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
} from 'recharts'
import {
  TrendingUp,
  Star,
  Clock,
  Target,
  CheckCircle,
  MessageSquare,
  Send,
  Mail,
  Phone,
  Globe,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/**
 * Review Analytics Dashboard
 *
 * Comprehensive analytics and reporting for review system performance.
 *
 * Features:
 * - Review request performance trends
 * - Rating distribution analysis
 * - Review source breakdown
 * - Response time metrics
 * - Follow-up effectiveness tracking
 */

interface AnalyticsData {
  period: string
  date_range: {
    start: string
    end: string
  }
  summary: {
    total_requests: number
    total_responses: number
    response_rate: number
    avg_rating: number
    google_conversion_rate: number
  }
  trends: Array<{
    week?: string
    month?: string
    day?: string
    total_requests: number
    portal_completions: number
    google_completions: number
    email_requests: number
    sms_requests: number
    portal_requests: number
    avg_rating: number
    rating_5_count: number
    rating_4_count: number
    rating_3_count: number
    rating_2_count: number
    rating_1_count: number
    portal_response_rate: number
    google_conversion_rate: number
  }>
  rating_distribution: {
    rating_1: number
    rating_2: number
    rating_3: number
    rating_4: number
    rating_5: number
  }
  source_breakdown: {
    portal_reviews: number
    google_reviews: number
    email_requests: number
    sms_requests: number
    portal_requests: number
  }
  response_times: {
    avg_request_to_portal_hours: number
    avg_portal_to_google_minutes: number
    total_portal_responses: number
    total_google_clicks: number
  }
  follow_up_effectiveness: {
    total_low_ratings: number
    resolved_count: number
    resolution_rate: number
    pending_count: number
  }
}

const COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  rating1: '#ef4444',
  rating2: '#f97316',
  rating3: '#f59e0b',
  rating4: '#84cc16',
  rating5: '#10b981',
}

export default function ReviewAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [period, setPeriod] = useState<string>('weekly')
  const [dateRange, setDateRange] = useState<string>('90') // days

  useEffect(() => {
    fetchAnalytics()
  }, [period, dateRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)

      const endDate = new Date()
      const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000)

      const params = new URLSearchParams({
        period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      })

      const response = await fetch(`/api/reviews/analytics?${params}`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading analytics...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No analytics data available</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Prepare chart data
  const performanceTrendData = data.trends.map((t) => {
    const periodKey = t.week || t.month || t.day || ''
    const date = new Date(periodKey)
    const label = period === 'daily'
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : period === 'monthly'
      ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    return {
      period: label,
      requests: t.total_requests,
      responses: t.portal_completions,
      responseRate: t.portal_response_rate,
      googleConversion: t.google_conversion_rate,
    }
  })

  const ratingDistributionData = [
    { rating: '1 Star', count: data.rating_distribution.rating_1, color: COLORS.rating1 },
    { rating: '2 Stars', count: data.rating_distribution.rating_2, color: COLORS.rating2 },
    { rating: '3 Stars', count: data.rating_distribution.rating_3, color: COLORS.rating3 },
    { rating: '4 Stars', count: data.rating_distribution.rating_4, color: COLORS.rating4 },
    { rating: '5 Stars', count: data.rating_distribution.rating_5, color: COLORS.rating5 },
  ]

  const avgRatingTrendData = data.trends.map((t) => {
    const periodKey = t.week || t.month || t.day || ''
    const date = new Date(periodKey)
    const label = period === 'daily'
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : period === 'monthly'
      ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    return {
      period: label,
      avgRating: t.avg_rating ? parseFloat(t.avg_rating.toFixed(2)) : 0,
    }
  })

  const reviewTypeData = [
    { name: 'Portal Reviews', value: data.source_breakdown.portal_reviews, color: COLORS.primary },
    { name: 'Google Reviews', value: data.source_breakdown.google_reviews, color: COLORS.success },
  ]

  const requestMethodData = [
    { name: 'Email', value: data.source_breakdown.email_requests, color: COLORS.primary },
    { name: 'SMS', value: data.source_breakdown.sms_requests, color: COLORS.secondary },
    { name: 'Portal', value: data.source_breakdown.portal_requests, color: COLORS.success },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Data-driven insights into review collection performance
          </p>
        </div>
        <div className="flex gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics}>Refresh</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.total_requests}</div>
            <p className="text-xs text-muted-foreground">Review requests sent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.response_rate}%</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.total_responses} responses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.avg_rating}</div>
            <p className="text-xs text-muted-foreground">Out of 5.0 stars</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Google Conversion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.google_conversion_rate}%</div>
            <p className="text-xs text-muted-foreground">Link click-through</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.follow_up_effectiveness.resolution_rate}%</div>
            <p className="text-xs text-muted-foreground">
              {data.follow_up_effectiveness.resolved_count}/{data.follow_up_effectiveness.total_low_ratings} resolved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Review Request Performance */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Review Request Performance</CardTitle>
            <CardDescription>Requests sent vs responses received over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke={COLORS.primary}
                  name="Requests Sent"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="responses"
                  stroke={COLORS.success}
                  name="Responses Received"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Response Rate Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Response Rate Trend</CardTitle>
            <CardDescription>Portal review response rate over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={performanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="responseRate"
                  stroke={COLORS.secondary}
                  name="Response Rate %"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Google Conversion Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Google Conversion Trend</CardTitle>
            <CardDescription>Google review link click-through rate</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={performanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="googleConversion"
                  stroke={COLORS.success}
                  name="Conversion Rate %"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Breakdown of 1-5 star ratings</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={ratingDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" name="Count">
                  {ratingDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average Rating Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Average Rating Over Time</CardTitle>
            <CardDescription>Trend of average customer ratings</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={avgRatingTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgRating"
                  stroke={COLORS.warning}
                  name="Average Rating"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Review Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Review Type Breakdown</CardTitle>
            <CardDescription>Portal vs Google reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={reviewTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {reviewTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Request Method Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Request Method Breakdown</CardTitle>
            <CardDescription>Email vs SMS vs Portal requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={requestMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {requestMethodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Response Time Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Response Time Metrics</CardTitle>
            <CardDescription>Average time to complete reviews</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Request to Portal Review</span>
              </div>
              <div className="text-right">
                <div className="font-bold">{data.response_times.avg_request_to_portal_hours} hrs</div>
                <div className="text-xs text-muted-foreground">
                  {data.response_times.total_portal_responses} responses
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Portal to Google Click</span>
              </div>
              <div className="text-right">
                <div className="font-bold">{data.response_times.avg_portal_to_google_minutes} min</div>
                <div className="text-xs text-muted-foreground">
                  {data.response_times.total_google_clicks} clicks
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Follow-up Effectiveness */}
        <Card>
          <CardHeader>
            <CardTitle>Follow-up Effectiveness</CardTitle>
            <CardDescription>Low-rating resolution tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Resolution Progress</span>
                <span className="font-bold">{data.follow_up_effectiveness.resolution_rate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${data.follow_up_effectiveness.resolution_rate}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {data.follow_up_effectiveness.resolved_count}
                </div>
                <div className="text-xs text-muted-foreground">Resolved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {data.follow_up_effectiveness.pending_count}
                </div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
