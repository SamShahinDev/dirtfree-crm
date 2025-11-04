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
  Megaphone,
  TrendingUp,
  DollarSign,
  Target,
  Mail,
  MessageSquare,
  Download,
  RefreshCw,
  Calendar,
  Sparkles,
  MousePointerClick,
} from 'lucide-react'
import { toast } from 'sonner'

interface MarketingAnalytics {
  date_range: {
    start_date: string
    end_date: string
    attribution_model: string
  }
  overview: {
    total_campaigns: number
    total_revenue: number
    total_cost: number
    net_revenue: number
    avg_roi: number
  }
  campaign_performance: Array<{
    campaign_id: string
    campaign_name: string
    channel: string
    total_sent: number
    total_converted: number
    conversion_rate: number
    revenue: number
    roi: number
  }>
  channel_performance: Array<{
    channel: string
    total_campaigns: number
    total_sent: number
    total_opened: number
    total_clicked: number
    total_converted: number
    avg_open_rate: number
    avg_click_rate: number
    avg_conversion_rate: number
    total_revenue: number
    total_cost: number
    avg_roi: number
  }>
  promotion_effectiveness: Array<{
    promotion_id: string
    promotion_name: string
    discount_type: string
    discount_value: number
    times_claimed: number
    times_redeemed: number
    redemption_rate: number
    revenue_generated: number
    total_discount: number
    net_revenue: number
    active: boolean
  }>
  content_performance: {
    by_template: Array<{
      type: string
      template_name: string
      total_sent: number
      open_rate: number
      click_rate: number
      response_rate: number
    }>
    top_performing: Array<{
      type: string
      template_name: string
      total_sent: number
      open_rate: number
      click_rate: number
      response_rate: number
      performance_score: number
    }>
  }
  attribution: {
    model: string
    by_source: Array<{
      source: string
      customer_count: number
      total_revenue: number
      avg_revenue_per_customer: number
    }>
  }
  channel_preferences: Array<{
    channel: string
    customers_reached: number
    total_interactions: number
    avg_engagement_rate: number
    preferred_by_count: number
  }>
  portal_engagement: Array<{
    week: string
    unique_visitors: number
    total_pageviews: number
    booking_conversion_rate: number
    avg_session_duration: number
  }>
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

const DATE_PRESETS = [
  { label: 'Last 30 Days', value: '30' },
  { label: 'Last Quarter', value: '90' },
  { label: 'Last Year', value: '365' },
]

export default function MarketingAnalyticsPage() {
  const [data, setData] = useState<MarketingAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [daysBack, setDaysBack] = useState('30')
  const [attributionModel, setAttributionModel] = useState('last_touch')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadAnalytics()
  }, [daysBack, attributionModel])

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
        `/api/analytics/marketing?start_date=${start.toISOString()}&end_date=${end.toISOString()}&attribution_model=${attributionModel}`
      )
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast.error('Failed to load marketing analytics')
      }
    } catch (error) {
      console.error('Load analytics error:', error)
      toast.error('Failed to load marketing analytics')
    } finally {
      setLoading(false)
    }
  }

  async function handleExport(format: 'csv' | 'json') {
    try {
      setExporting(true)
      const { start, end } = getDateRange(daysBack)
      const res = await fetch(
        `/api/analytics/marketing?start_date=${start.toISOString()}&end_date=${end.toISOString()}&attribution_model=${attributionModel}&export=${format}`
      )

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `marketing-analytics-${new Date().toISOString().split('T')[0]}.${format}`
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
        <div className="text-center">Loading marketing analytics...</div>
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
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-pink-100 dark:bg-pink-900">
                <Megaphone className="h-6 w-6 text-pink-600" />
              </div>
              Marketing Analytics
            </h1>
            <p className="text-muted-foreground mt-1">
              Campaign performance, channel effectiveness, and ROI tracking
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
            <Select value={attributionModel} onValueChange={setAttributionModel}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_touch">First Touch</SelectItem>
                <SelectItem value="last_touch">Last Touch</SelectItem>
                <SelectItem value="linear">Linear</SelectItem>
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
                <Megaphone className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Campaigns</p>
                <div className="text-2xl font-bold">
                  {data.overview.total_campaigns}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.overview.total_revenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(data.overview.total_cost)} cost
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Revenue</p>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(data.overview.net_revenue)}
                </div>
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
                <p className="text-sm text-muted-foreground">Average ROI</p>
                <div className="text-2xl font-bold text-orange-600">
                  {data.overview.avg_roi.toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>ROI and conversion metrics by campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Campaign</th>
                      <th className="text-left py-3 px-4">Channel</th>
                      <th className="text-right py-3 px-4">Sent</th>
                      <th className="text-right py-3 px-4">Converted</th>
                      <th className="text-right py-3 px-4">Conv Rate</th>
                      <th className="text-right py-3 px-4">Revenue</th>
                      <th className="text-right py-3 px-4">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaign_performance.slice(0, 20).map((campaign, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{campaign.campaign_name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary">{campaign.channel}</Badge>
                        </td>
                        <td className="text-right py-3 px-4">{campaign.total_sent.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{campaign.total_converted}</td>
                        <td className="text-right py-3 px-4">
                          <Badge variant={campaign.conversion_rate > 5 ? 'default' : 'secondary'}>
                            {campaign.conversion_rate.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-4">{formatCurrency(campaign.revenue)}</td>
                        <td className="text-right py-3 px-4">
                          <span className={campaign.roi > 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                            {campaign.roi.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Campaign ROI Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign ROI Comparison</CardTitle>
              <CardDescription>Top 10 campaigns by ROI</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.campaign_performance.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="campaign_name" angle={-45} textAnchor="end" height={120} />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `${value.toFixed(0)}%`} />
                  <Bar dataKey="roi" fill="#8b5cf6" name="ROI %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Channel Performance Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Channel</CardTitle>
                <CardDescription>Total revenue distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.channel_performance}
                      dataKey="total_revenue"
                      nameKey="channel"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry: any) => `${entry.channel} (${formatCurrency(entry.total_revenue)})`}
                    >
                      {data.channel_performance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Channel Engagement Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Channel Engagement</CardTitle>
                <CardDescription>Open, click, and conversion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.channel_performance.map((channel, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="font-medium">{channel.channel}</span>
                        </div>
                        <Badge variant={channel.avg_roi > 100 ? 'default' : 'secondary'}>
                          {channel.avg_roi.toFixed(0)}% ROI
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Open Rate</p>
                          <p className="font-bold">{channel.avg_open_rate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Click Rate</p>
                          <p className="font-bold">{channel.avg_click_rate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Conv Rate</p>
                          <p className="font-bold">{channel.avg_conversion_rate.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Channel Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Channel Preferences</CardTitle>
              <CardDescription>Engagement and preference by channel</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.channel_preferences}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="customers_reached" fill="#3b82f6" name="Customers Reached" />
                  <Bar yAxisId="right" dataKey="avg_engagement_rate" fill="#10b981" name="Engagement %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Promotions Tab */}
        <TabsContent value="promotions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Promotion Effectiveness</CardTitle>
              <CardDescription>Claim rates, redemption, and revenue impact</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Promotion</th>
                      <th className="text-left py-3 px-4">Type</th>
                      <th className="text-right py-3 px-4">Claimed</th>
                      <th className="text-right py-3 px-4">Redeemed</th>
                      <th className="text-right py-3 px-4">Redemption %</th>
                      <th className="text-right py-3 px-4">Revenue</th>
                      <th className="text-right py-3 px-4">Discount</th>
                      <th className="text-right py-3 px-4">Net Revenue</th>
                      <th className="text-center py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.promotion_effectiveness.slice(0, 15).map((promo, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{promo.promotion_name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{promo.discount_type}</Badge>
                        </td>
                        <td className="text-right py-3 px-4">{promo.times_claimed}</td>
                        <td className="text-right py-3 px-4">{promo.times_redeemed}</td>
                        <td className="text-right py-3 px-4">{promo.redemption_rate.toFixed(1)}%</td>
                        <td className="text-right py-3 px-4">{formatCurrency(promo.revenue_generated)}</td>
                        <td className="text-right py-3 px-4 text-red-600">{formatCurrency(promo.total_discount)}</td>
                        <td className="text-right py-3 px-4 font-bold">{formatCurrency(promo.net_revenue)}</td>
                        <td className="text-center py-3 px-4">
                          <Badge variant={promo.active ? 'default' : 'secondary'}>
                            {promo.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Top Performing Promotions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Highest Revenue Promotions</CardTitle>
                <CardDescription>Top 5 by revenue generated</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.promotion_effectiveness
                    .sort((a, b) => b.revenue_generated - a.revenue_generated)
                    .slice(0, 5)
                    .map((promo, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-green-200 rounded-lg">
                        <div>
                          <p className="font-medium">{promo.promotion_name}</p>
                          <p className="text-sm text-muted-foreground">{promo.times_redeemed} redemptions</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(promo.revenue_generated)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(promo.net_revenue)} net
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Best Redemption Rates</CardTitle>
                <CardDescription>Top 5 by redemption percentage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.promotion_effectiveness
                    .filter((p) => p.times_claimed > 5)
                    .sort((a, b) => b.redemption_rate - a.redemption_rate)
                    .slice(0, 5)
                    .map((promo, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-blue-200 rounded-lg">
                        <div>
                          <p className="font-medium">{promo.promotion_name}</p>
                          <p className="text-sm text-muted-foreground">{promo.times_claimed} claimed</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">
                            {promo.redemption_rate.toFixed(1)}%
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {promo.times_redeemed} redeemed
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Content</CardTitle>
              <CardDescription>Best message templates by engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.content_performance.top_performing.map((content, index) => (
                  <div key={index} className="p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{content.template_name}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="secondary">{content.type}</Badge>
                            <Badge variant="outline">{content.total_sent} sent</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-purple-600" />
                          <div className="text-2xl font-bold text-purple-600">
                            {content.performance_score.toFixed(0)}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">performance score</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Open Rate</p>
                        <p className="font-bold">{content.open_rate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Click Rate</p>
                        <p className="font-bold">{content.click_rate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Response Rate</p>
                        <p className="font-bold">{content.response_rate.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Content by Type */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement by Content Type</CardTitle>
              <CardDescription>Average engagement metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.content_performance.by_template.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="template_name" angle={-45} textAnchor="end" height={120} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="open_rate" fill="#3b82f6" name="Open %" />
                  <Bar dataKey="click_rate" fill="#10b981" name="Click %" />
                  <Bar dataKey="response_rate" fill="#f59e0b" name="Response %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attribution Tab */}
        <TabsContent value="attribution" className="space-y-6">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Attribution Model: {data.attribution.model.replace('_', ' ').toUpperCase()}</CardTitle>
              <CardDescription>Revenue attribution by source</CardDescription>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attribution Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Source</CardTitle>
                <CardDescription>Total attributed revenue</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.attribution.by_source}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="source" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="total_revenue" fill="#8b5cf6" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Attribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Distribution</CardTitle>
                <CardDescription>Customers by attribution source</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.attribution.by_source}
                      dataKey="customer_count"
                      nameKey="source"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {data.attribution.by_source.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Attribution Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Attribution Details</CardTitle>
              <CardDescription>Customer and revenue metrics by source</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Source</th>
                      <th className="text-right py-3 px-4">Customers</th>
                      <th className="text-right py-3 px-4">Total Revenue</th>
                      <th className="text-right py-3 px-4">Avg Revenue/Customer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attribution.by_source.map((attr, index) => (
                      <tr key={index} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{attr.source}</td>
                        <td className="text-right py-3 px-4">{attr.customer_count.toLocaleString()}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(attr.total_revenue)}</td>
                        <td className="text-right py-3 px-4">{formatCurrency(attr.avg_revenue_per_customer)}</td>
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
