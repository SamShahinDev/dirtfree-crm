'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  Bug,
  Activity,
  RefreshCw,
  ExternalLink,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'

interface ErrorStats {
  overview: {
    totalErrors: number
    uniqueErrors: number
    affectedUsers: number
    errorRate: number
    trend: {
      direction: 'up' | 'down' | 'stable'
      percentage: number
    }
  }
  timeline: Array<{
    timestamp: string
    errorCount: number
    uniqueErrors: number
    affectedUsers: number
  }>
  topErrors: Array<{
    id: string
    message: string
    count: number
    affectedUsers: number
    firstSeen: string
    lastSeen: string
    status: 'resolved' | 'unresolved' | 'ignored'
    level: 'error' | 'warning' | 'info'
    tags: Record<string, string>
  }>
  byComponent: Array<{
    component: string
    count: number
    percentage: number
  }>
  bySeverity: {
    error: number
    warning: number
    info: number
  }
  byStatus: {
    unresolved: number
    resolved: number
    ignored: number
  }
  byPlatform: Array<{
    platform: string
    count: number
    percentage: number
  }>
  performance: {
    avgResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
    slowestEndpoints: Array<{
      endpoint: string
      avgTime: number
      count: number
    }>
  }
  criticalErrors: Array<{
    id: string
    message: string
    timestamp: string
    affectedUsers: number
    resolved: boolean
  }>
}

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899']

const SEVERITY_COLORS = {
  error: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
}

const STATUS_COLORS = {
  unresolved: 'bg-red-100 text-red-800 border-red-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  ignored: 'bg-gray-100 text-gray-800 border-gray-200',
}

export default function ErrorMonitoringPage() {
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('24h')
  const [environment, setEnvironment] = useState('production')

  useEffect(() => {
    loadStats()
  }, [period, environment])

  async function loadStats() {
    try {
      setLoading(true)
      const res = await fetch(
        `/api/admin/errors/stats?period=${period}&environment=${environment}`
      )
      const result = await res.json()

      if (result.success) {
        setStats(result.stats)
      } else {
        toast.error('Failed to load error statistics')
      }
    } catch (error) {
      console.error('Load stats error:', error)
      toast.error('Failed to load error statistics')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString()
  }

  function formatTime(timestamp: string): string {
    const date = new Date(timestamp)
    if (period === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const TrendIcon =
    stats?.overview.trend.direction === 'up'
      ? TrendingUp
      : stats?.overview.trend.direction === 'down'
      ? TrendingDown
      : Minus

  const trendColor =
    stats?.overview.trend.direction === 'up'
      ? 'text-red-600'
      : stats?.overview.trend.direction === 'down'
      ? 'text-green-600'
      : 'text-gray-600'

  if (loading && !stats) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading error statistics...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">
          No error data available
        </div>
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
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900">
                <Bug className="h-6 w-6 text-red-600" />
              </div>
              Error Monitoring
            </h1>
            <p className="text-muted-foreground mt-1">
              Real-time error tracking and performance monitoring
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={environment} onValueChange={setEnvironment}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadStats} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <a
                href={`https://sentry.io/organizations/${process.env.NEXT_PUBLIC_SENTRY_ORG}/issues/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Sentry
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Critical Errors Alert */}
      {stats.criticalErrors.filter((e) => !e.resolved).length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Critical Errors ({stats.criticalErrors.filter((e) => !e.resolved).length})
            </CardTitle>
            <CardDescription>Unresolved critical issues requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.criticalErrors
                .filter((e) => !e.resolved)
                .map((error) => (
                  <div
                    key={error.id}
                    className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-white dark:bg-gray-900"
                  >
                    <div>
                      <p className="font-medium text-red-900 dark:text-red-100">
                        {error.message}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {error.affectedUsers} users affected • {formatDate(error.timestamp)}
                      </p>
                    </div>
                    <Badge variant="destructive">Critical</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <Bug className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Errors</p>
                <div className="text-2xl font-bold">
                  {stats.overview.totalErrors.toLocaleString()}
                </div>
                <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
                  <TrendIcon className="h-3 w-3" />
                  {stats.overview.trend.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unique Errors</p>
                <div className="text-2xl font-bold">
                  {stats.overview.uniqueErrors.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.byStatus.unresolved} unresolved
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Affected Users</p>
                <div className="text-2xl font-bold">
                  {stats.overview.affectedUsers.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <div className="text-2xl font-bold">
                  {stats.overview.errorRate.toFixed(2)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Timeline */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Error Trend</CardTitle>
          <CardDescription>Error occurrences over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => formatDate(label)}
                formatter={(value: number) => value.toLocaleString()}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="errorCount"
                stroke="#ef4444"
                name="Total Errors"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="uniqueErrors"
                stroke="#f59e0b"
                name="Unique Errors"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="affectedUsers"
                stroke="#3b82f6"
                name="Affected Users"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Errors */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Top Errors</CardTitle>
          <CardDescription>Most frequent errors by occurrence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Error Message</th>
                  <th className="text-left py-3 px-4">Component</th>
                  <th className="text-right py-3 px-4">Count</th>
                  <th className="text-right py-3 px-4">Users</th>
                  <th className="text-left py-3 px-4">Severity</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {stats.topErrors.map((error) => (
                  <tr key={error.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <p className="font-medium">{error.message}</p>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {error.tags.component}
                      </code>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold">
                      {error.count.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4">
                      {error.affectedUsers.toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={SEVERITY_COLORS[error.level]}>
                        {error.level}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={STATUS_COLORS[error.status]}>
                        {error.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(error.lastSeen)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Errors by Component */}
        <Card>
          <CardHeader>
            <CardTitle>Errors by Component</CardTitle>
            <CardDescription>Distribution across components</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.byComponent}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="component" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" name="Errors" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Errors by Platform */}
        <Card>
          <CardHeader>
            <CardTitle>Errors by Platform</CardTitle>
            <CardDescription>Browser/platform distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.byPlatform}
                  dataKey="count"
                  nameKey="platform"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry: any) => `${entry.platform} (${entry.percentage.toFixed(1)}%)`}
                >
                  {stats.byPlatform.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>API response times and slowest endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
              <div className="text-2xl font-bold">{stats.performance.avgResponseTime}ms</div>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">95th Percentile</p>
              <div className="text-2xl font-bold">{stats.performance.p95ResponseTime}ms</div>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground">99th Percentile</p>
              <div className="text-2xl font-bold">{stats.performance.p99ResponseTime}ms</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Endpoint</th>
                  <th className="text-right py-3 px-4">Avg Time</th>
                  <th className="text-right py-3 px-4">Requests</th>
                </tr>
              </thead>
              <tbody>
                {stats.performance.slowestEndpoints.map((endpoint, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-3 px-4">
                      <code className="text-sm">{endpoint.endpoint}</code>
                    </td>
                    <td className="text-right py-3 px-4 font-semibold">{endpoint.avgTime}ms</td>
                    <td className="text-right py-3 px-4">{endpoint.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
