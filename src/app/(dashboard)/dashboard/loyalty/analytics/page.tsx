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
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Award,
  Gift,
  DollarSign,
  Target,
  Download,
  RefreshCw,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import { toast } from 'sonner'

interface AnalyticsData {
  program_overview: {
    total_enrolled: number
    active_participants: number
    avg_points_balance: number
    total_points_issued: number
    total_points_redeemed: number
    total_redemptions: number
    redemption_rate: number
    participation_rate: number
  }
  tier_distribution: Array<{
    tier_name: string
    tier_level: number
    customer_count: number
    percentage: number
  }>
  engagement_metrics: {
    earning_activities: Array<{
      transaction_type: string
      transaction_count: number
      total_points: number
      avg_points_per_transaction: number
    }>
    popular_rewards: Array<{
      reward_id: string
      reward_name: string
      reward_type: string
      points_required: number
      redemption_count: number
      used_count: number
      pending_count: number
    }>
    achievement_stats: Array<{
      achievement_id: string
      achievement_name: string
      achievement_category: string
      unlock_count: number
      unlock_rate_pct: number
    }>
  }
  revenue_impact: {
    loyalty_revenue: number
    non_loyalty_revenue: number
    loyalty_avg_order_value: number
    non_loyalty_avg_order_value: number
    loyalty_customer_ltv: number
    non_loyalty_customer_ltv: number
    uplift: {
      avg_order_value_uplift: number
      customer_ltv_uplift: number
      repeat_rate_uplift: number
    }
    by_tier: Array<{
      tier_name: string
      tier_level: number
      customer_count: number
      total_revenue: number
      avg_revenue_per_customer: number
      total_jobs: number
      avg_jobs_per_customer: number
      repeat_customer_rate: number
    }>
  }
  referral_performance: {
    total_sent: number
    registered: number
    booked: number
    completed: number
    conversion_sent_to_registered: number
    conversion_registered_to_booked: number
    conversion_booked_to_completed: number
    overall_conversion_rate: number
  }
  top_referrers: Array<{
    customer_id: string
    customer_name: string
    email: string
    total_referrals: number
    completed_referrals: number
    points_earned: number
    current_balance: number
    current_tier: string
  }>
  charts: {
    points_timeline: Array<{
      date: string
      points_earned: number
      points_spent: number
      net_points: number
    }>
    tier_distribution: Array<{
      tier_name: string
      customer_count: number
    }>
    earning_activities: Array<{
      transaction_type: string
      total_points: number
    }>
  }
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

export default function LoyaltyAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [daysBack, setDaysBack] = useState('90')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [daysBack])

  async function loadAnalytics() {
    try {
      setLoading(true)
      const res = await fetch(`/api/loyalty/analytics?days_back=${daysBack}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast.error('Failed to load analytics')
      }
    } catch (error) {
      console.error('Load analytics error:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport(format: 'csv' | 'json') {
    try {
      setExporting(true)
      const res = await fetch(`/api/loyalty/analytics?days_back=${daysBack}&export=${format}`)

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `loyalty-analytics-${new Date().toISOString().split('T')[0]}.${format}`
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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading analytics...</div>
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
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              Loyalty Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive insights into your loyalty program performance
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={daysBack} onValueChange={setDaysBack}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="60">Last 60 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
                <SelectItem value="180">Last 6 Months</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadAnalytics}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('json')} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Program Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Enrolled</p>
                <div className="text-2xl font-bold">
                  {data.program_overview.total_enrolled.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active (90d)</p>
                <div className="text-2xl font-bold">
                  {data.program_overview.active_participants.toLocaleString()}
                </div>
                <Badge variant="secondary" className="mt-1">
                  {data.program_overview.participation_rate}% participation
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Points Balance</p>
                <div className="text-2xl font-bold">
                  {data.program_overview.avg_points_balance.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <Gift className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Redemption Rate</p>
                <div className="text-2xl font-bold">
                  {data.program_overview.redemption_rate}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.program_overview.total_redemptions.toLocaleString()} redemptions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Impact</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Points Timeline Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Points Activity Over Time</CardTitle>
              <CardDescription>Points earned vs spent over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={data.charts.points_timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value: number) => value.toLocaleString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="points_earned"
                    stroke="#10b981"
                    name="Points Earned"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="points_spent"
                    stroke="#ef4444"
                    name="Points Spent"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="net_points"
                    stroke="#3b82f6"
                    name="Net Points"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Points Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Points Issued</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {data.program_overview.total_points_issued.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Points Redeemed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {data.program_overview.total_points_redeemed.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Points in Circulation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {(
                    data.program_overview.total_points_issued -
                    data.program_overview.total_points_redeemed
                  ).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Earning Activities Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Point Earning Activities</CardTitle>
                <CardDescription>How customers are earning points</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.engagement_metrics.earning_activities.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="transaction_type"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Bar dataKey="total_points" fill="#3b82f6" name="Total Points" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Popular Rewards */}
            <Card>
              <CardHeader>
                <CardTitle>Most Popular Rewards</CardTitle>
                <CardDescription>Top 5 redeemed rewards</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.engagement_metrics.popular_rewards.slice(0, 5).map((reward, index) => (
                    <div key={reward.reward_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-bold">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{reward.reward_name}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary">{reward.points_required} pts</Badge>
                            <Badge variant="outline">{reward.reward_type}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{reward.redemption_count}</div>
                        <p className="text-xs text-muted-foreground">redemptions</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Achievement Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Achievement Unlock Rates</CardTitle>
              <CardDescription>Top achievements and unlock percentages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.engagement_metrics.achievement_stats.slice(0, 8).map((achievement) => (
                  <div key={achievement.achievement_id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{achievement.achievement_name}</span>
                        <span className="text-sm text-muted-foreground">
                          {achievement.unlock_count} unlocks ({achievement.unlock_rate_pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(achievement.unlock_rate_pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Impact Tab */}
        <TabsContent value="revenue" className="space-y-6">
          {/* Revenue Uplift Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Avg Order Value Uplift</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className={`text-3xl font-bold ${data.revenue_impact.uplift.avg_order_value_uplift >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.revenue_impact.uplift.avg_order_value_uplift >= 0 ? '+' : ''}
                    {data.revenue_impact.uplift.avg_order_value_uplift}%
                  </div>
                  {data.revenue_impact.uplift.avg_order_value_uplift >= 0 ? (
                    <ArrowUpRight className="h-6 w-6 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Loyalty: {formatCurrency(data.revenue_impact.loyalty_avg_order_value)} vs Non-Loyalty: {formatCurrency(data.revenue_impact.non_loyalty_avg_order_value)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Customer LTV Uplift</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className={`text-3xl font-bold ${data.revenue_impact.uplift.customer_ltv_uplift >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.revenue_impact.uplift.customer_ltv_uplift >= 0 ? '+' : ''}
                    {data.revenue_impact.uplift.customer_ltv_uplift}%
                  </div>
                  {data.revenue_impact.uplift.customer_ltv_uplift >= 0 ? (
                    <ArrowUpRight className="h-6 w-6 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-6 w-6 text-red-600" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Loyalty: {formatCurrency(data.revenue_impact.loyalty_customer_ltv)} vs Non-Loyalty: {formatCurrency(data.revenue_impact.non_loyalty_customer_ltv)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Repeat Rate Uplift</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className={`text-3xl font-bold ${data.revenue_impact.uplift.repeat_rate_uplift >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.revenue_impact.uplift.repeat_rate_uplift >= 0 ? '+' : ''}
                    {data.revenue_impact.uplift.repeat_rate_uplift}%
                  </div>
                  {data.revenue_impact.uplift.repeat_rate_uplift >= 0 ? (
                    <ArrowUpRight className="h-6 w-6 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-6 w-6 text-red-600" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue by Tier */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Performance by Tier</CardTitle>
              <CardDescription>Customer value and engagement metrics by loyalty tier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Tier</th>
                      <th className="text-right py-3 px-4">Customers</th>
                      <th className="text-right py-3 px-4">Total Revenue</th>
                      <th className="text-right py-3 px-4">Avg LTV</th>
                      <th className="text-right py-3 px-4">Total Jobs</th>
                      <th className="text-right py-3 px-4">Avg Jobs</th>
                      <th className="text-right py-3 px-4">Repeat Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenue_impact.by_tier.map((tier) => (
                      <tr key={tier.tier_level} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{tier.tier_name}</td>
                        <td className="text-right py-3 px-4">{tier.customer_count.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(parseFloat(tier.total_revenue.toString()))}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(parseFloat(tier.avg_revenue_per_customer.toString()))}</td>
                        <td className="text-right py-3 px-4">{tier.total_jobs.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{parseFloat(tier.avg_jobs_per_customer.toString()).toFixed(1)}</td>
                        <td className="text-right py-3 px-4">{parseFloat(tier.repeat_customer_rate.toString()).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Referrals Tab */}
        <TabsContent value="referrals" className="space-y-6">
          {/* Referral Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Referral Conversion Funnel</CardTitle>
              <CardDescription>Journey from referral sent to completed job</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Referrals Sent</span>
                    <span className="text-2xl font-bold">{data.referral_performance.total_sent}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-8">
                    <div className="bg-blue-600 h-8 rounded-full flex items-center justify-end pr-4 text-white font-medium" style={{ width: '100%' }}>
                      100%
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Registered</span>
                    <span className="text-2xl font-bold">{data.referral_performance.registered}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-8">
                    <div className="bg-green-600 h-8 rounded-full flex items-center justify-end pr-4 text-white font-medium" style={{ width: `${data.referral_performance.conversion_sent_to_registered}%` }}>
                      {data.referral_performance.conversion_sent_to_registered}%
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Job Booked</span>
                    <span className="text-2xl font-bold">{data.referral_performance.booked}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-8">
                    <div className="bg-orange-600 h-8 rounded-full flex items-center justify-end pr-4 text-white font-medium" style={{ width: `${data.referral_performance.conversion_registered_to_booked}%` }}>
                      {data.referral_performance.conversion_registered_to_booked}%
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Job Completed</span>
                    <span className="text-2xl font-bold">{data.referral_performance.completed}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-8">
                    <div className="bg-purple-600 h-8 rounded-full flex items-center justify-end pr-4 text-white font-medium" style={{ width: `${data.referral_performance.conversion_booked_to_completed}%` }}>
                      {data.referral_performance.conversion_booked_to_completed}%
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium">Overall Conversion Rate</span>
                    <span className="text-3xl font-bold text-purple-600">
                      {data.referral_performance.overall_conversion_rate}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Referrers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Referrers</CardTitle>
              <CardDescription>Customers driving the most referrals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.top_referrers.map((referrer, index) => (
                  <div key={referrer.customer_id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{referrer.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{referrer.email}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary">{referrer.current_tier}</Badge>
                          <Badge variant="outline">{referrer.current_balance.toLocaleString()} pts</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-600">
                        {referrer.completed_referrals}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        of {referrer.total_referrals} completed
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        +{referrer.points_earned.toLocaleString()} pts earned
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tiers Tab */}
        <TabsContent value="tiers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tier Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Tier Distribution</CardTitle>
                <CardDescription>Customer breakdown by loyalty tier</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.tier_distribution}
                      dataKey="customer_count"
                      nameKey="tier_name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.tier_name} (${entry.percentage}%)`}
                    >
                      {data.tier_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tier Summary Table */}
            <Card>
              <CardHeader>
                <CardTitle>Tier Summary</CardTitle>
                <CardDescription>Detailed tier statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.tier_distribution.map((tier, index) => (
                    <div key={tier.tier_level} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium">{tier.tier_name}</p>
                          <p className="text-sm text-muted-foreground">Level {tier.tier_level}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold">
                          {tier.customer_count.toLocaleString()}
                        </div>
                        <Badge variant="secondary">{tier.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
