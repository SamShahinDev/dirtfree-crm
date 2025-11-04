'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  CheckCircle,
  DollarSign,
  Clock,
  RefreshCcw,
  Target,
  Percent,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from 'recharts'

/**
 * Promotion Analytics Dashboard
 *
 * Displays comprehensive analytics and performance metrics:
 * - Volume metrics (sent, viewed, claimed, redeemed)
 * - Conversion rates and funnel visualization
 * - Financial metrics (revenue, discount, ROI)
 * - Time-to-conversion metrics
 * - Channel performance breakdown
 * - Timeline charts
 */

interface AnalyticsData {
  promotion: {
    id: string
    title: string
    status: string
  }
  metrics: {
    volume: {
      totalSent: number
      totalDelivered: number
      totalViewed: number
      totalClaimed: number
      totalRedeemed: number
    }
    rates: {
      deliveryRate: number
      viewRate: number
      claimRate: number
      redemptionRate: number
      conversionRate: number
    }
    financial: {
      totalRevenue: number
      totalDiscountGiven: number
      totalCost: number
      netProfit: number
      roiPercentage: number
      costPerRedemption: number
      revenuePerRedemption: number
    }
    timing: {
      avgTimeToView: number
      avgTimeToClaim: number
      avgTimeToRedeem: number
    }
    channels: Record<string, any>
  }
  funnel: Array<{ stage: string; count: number; percentage: number }>
  timeDistribution: Array<{ time_bucket: string; redemptions: number }>
  timeline: Array<{ date: string; sent: number; viewed: number; claimed: number; redeemed: number }>
  calculatedAt: string
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function PromotionAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const promotionId = params.id as string

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/promotions/${promotionId}/analytics`)
      const data = await response.json()

      if (data.success) {
        setAnalytics(data.data)
      } else {
        console.error('Failed to fetch analytics:', data.message)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [promotionId])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchAnalytics()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Analytics not available</h2>
            <p className="text-muted-foreground mt-2">
              Unable to load analytics for this promotion.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { metrics, funnel, timeDistribution, timeline } = analytics

  // Prepare channel data for pie chart
  const channelData = Object.entries(metrics.channels).map(([channel, data]: [string, any]) => ({
    name: channel.charAt(0).toUpperCase() + channel.slice(1),
    value: data.redeemed || 0,
    discount: data.discount || 0,
  }))

  // Format timeline data
  const timelineData = timeline.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground mt-1">{analytics.promotion.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => router.push(`/dashboard/marketing/promotions/${promotionId}`)}>
            View Promotion
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Sent
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.volume.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.rates.deliveryRate.toFixed(1)}% delivery rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                View Rate
              </CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.rates.viewRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.volume.totalViewed.toLocaleString()} viewed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Redemption Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.rates.redemptionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.volume.totalRedeemed.toLocaleString()} redeemed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ROI
              </CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{metrics.financial.roiPercentage.toFixed(1)}%</div>
              {metrics.financial.roiPercentage > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ${metrics.financial.netProfit.toFixed(2)} net profit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Funnel and Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>
              Customer journey from delivery to redemption
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="stage" width={80} />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === 'count') return [value.toLocaleString(), 'Count']
                    if (name === 'percentage') return [value.toFixed(1) + '%', 'Percentage']
                    return [value, name]
                  }}
                />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="percentage"
                    position="right"
                    formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(1)}%` : ''}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Delivery Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Timeline</CardTitle>
            <CardDescription>
              Daily delivery and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sent" stroke="#3b82f6" name="Sent" />
                <Line type="monotone" dataKey="viewed" stroke="#10b981" name="Viewed" />
                <Line type="monotone" dataKey="claimed" stroke="#f59e0b" name="Claimed" />
                <Line type="monotone" dataKey="redeemed" stroke="#ef4444" name="Redeemed" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Time Distribution and Channel Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time-to-Conversion Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Time to Redemption</CardTitle>
            <CardDescription>
              How quickly customers redeem offers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time_bucket" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="redemptions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Channel Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Performance</CardTitle>
            <CardDescription>
              Redemptions by delivery channel
            </CardDescription>
          </CardHeader>
          <CardContent>
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name} ${((percent as number) * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No redemptions yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Performance</CardTitle>
          <CardDescription>
            Revenue, costs, and ROI breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Total Revenue</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                ${metrics.financial.totalRevenue.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Discount Given</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">
                ${metrics.financial.totalDiscountGiven.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Campaign Cost</span>
              </div>
              <p className="text-2xl font-bold">
                ${metrics.financial.totalCost.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Net Profit</span>
              </div>
              <p className={`text-2xl font-bold ${metrics.financial.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${metrics.financial.netProfit.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Percent className="h-4 w-4" />
                <span>ROI</span>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${metrics.financial.roiPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.financial.roiPercentage.toFixed(1)}%
                </p>
                {metrics.financial.roiPercentage > 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Cost per Redemption</p>
              <p className="text-xl font-semibold">
                ${metrics.financial.costPerRedemption.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Revenue per Redemption</p>
              <p className="text-xl font-semibold">
                ${metrics.financial.revenuePerRedemption.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timing Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Timing Metrics</CardTitle>
          <CardDescription>
            Average time from delivery to action
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Time to View</span>
              </div>
              <p className="text-2xl font-bold">
                {metrics.timing.avgTimeToView.toFixed(1)} hrs
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Time to Claim</span>
              </div>
              <p className="text-2xl font-bold">
                {metrics.timing.avgTimeToClaim.toFixed(1)} hrs
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Time to Redeem</span>
              </div>
              <p className="text-2xl font-bold">
                {metrics.timing.avgTimeToRedeem.toFixed(1)} hrs
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {new Date(analytics.calculatedAt).toLocaleString()}
      </div>
    </div>
  )
}
