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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Server,
  Zap,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'

interface SystemMetrics {
  timestamp: string
  period: string
  currentStatus: {
    status: string
    uptime?: number
    memory?: any
    services: Record<string, any>
  }
  uptimeStats: {
    current: {
      uptime: number
      total: number
      up: number
      down: number
      degraded: number
      avgResponseTime: number
    }
    periods: {
      '24h': number
      '7d': number
      '30d': number
    }
    history: Array<{
      timestamp: Date
      status: string
      responseTime: number
    }>
  }
  performance: {
    avgResponseTime: number
    latestResponseTime: number
  }
  alerts: {
    recent: Array<{
      name: string
      severity: string
      message: string
      triggeredAt: string
    }>
    criticalCount: number
    warningCount: number
  }
}

const STATUS_COLORS = {
  healthy: 'bg-green-100 text-green-800 border-green-200',
  up: 'bg-green-100 text-green-800 border-green-200',
  degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  down: 'bg-red-100 text-red-800 border-red-200',
  unhealthy: 'bg-red-100 text-red-800 border-red-200',
}

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
}

export default function MonitoringPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('24h')
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    loadMetrics()
  }, [period])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadMetrics()
    }, 30000)

    return () => clearInterval(interval)
  }, [autoRefresh, period])

  async function loadMetrics() {
    try {
      setLoading(true)
      const res = await fetch(`/api/monitoring/metrics?period=${period}`)
      const result = await res.json()

      if (result.success) {
        setMetrics(result.metrics)
      } else {
        toast.error('Failed to load metrics')
      }
    } catch (error) {
      console.error('Load metrics error:', error)
      toast.error('Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }

  function formatUptime(seconds?: number): string {
    if (!seconds) return 'N/A'

    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  function formatTimestamp(timestamp: string | Date): string {
    return new Date(timestamp).toLocaleString()
  }

  const StatusIcon =
    metrics?.currentStatus.status === 'healthy' || metrics?.currentStatus.status === 'up'
      ? CheckCircle
      : metrics?.currentStatus.status === 'degraded'
      ? AlertTriangle
      : XCircle

  const statusColor =
    metrics?.currentStatus.status === 'healthy' || metrics?.currentStatus.status === 'up'
      ? 'text-green-600'
      : metrics?.currentStatus.status === 'degraded'
      ? 'text-yellow-600'
      : 'text-red-600'

  if (loading && !metrics) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading monitoring data...</div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">No metrics available</div>
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
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              System Monitoring
            </h1>
            <p className="text-muted-foreground mt-1">Real-time health and performance monitoring</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
            </Button>
            <Button variant="outline" onClick={loadMetrics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* System Status */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <StatusIcon className={`h-12 w-12 ${statusColor}`} />
            <div>
              <h2 className="text-2xl font-bold">
                System Status:{' '}
                <span className={statusColor}>{metrics.currentStatus.status.toUpperCase()}</span>
              </h2>
              <p className="text-muted-foreground">
                Uptime: {formatUptime(metrics.currentStatus.uptime)} • Last checked:{' '}
                {formatTimestamp(metrics.timestamp)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Banner */}
      {metrics.alerts.criticalCount > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Active Critical Alerts ({metrics.alerts.criticalCount})
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Uptime Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uptime (24h)</p>
                <div className="text-2xl font-bold text-green-600">
                  {metrics.uptimeStats.periods['24h'].toFixed(2)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uptime (7d)</p>
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.uptimeStats.periods['7d'].toFixed(2)}%
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
                <p className="text-sm text-muted-foreground">Uptime (30d)</p>
                <div className="text-2xl font-bold text-purple-600">
                  {metrics.uptimeStats.periods['30d'].toFixed(2)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-full">
                <Zap className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <div className="text-2xl font-bold">
                  {Math.round(metrics.uptimeStats.current.avgResponseTime)}ms
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Response Time Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Response Time Trend</CardTitle>
          <CardDescription>System response time over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.uptimeStats.history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(value) =>
                  new Date(value).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }
              />
              <YAxis />
              <Tooltip
                labelFormatter={(label) => formatTimestamp(label)}
                formatter={(value: number) => [`${value}ms`, 'Response Time']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke="#3b82f6"
                name="Response Time (ms)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Service Health */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Health
          </CardTitle>
          <CardDescription>Status of all monitored services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(metrics.currentStatus.services).map(([service, status]: [string, any]) => (
              <div key={service} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{service}</span>
                  <Badge
                    variant="outline"
                    className={STATUS_COLORS[status.status as keyof typeof STATUS_COLORS] || ''}
                  >
                    {status.status}
                  </Badge>
                </div>
                {status.responseTime && (
                  <p className="text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {status.responseTime}ms
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Memory Usage */}
          {metrics.currentStatus.memory && (
            <div className="mt-6 p-4 border rounded-lg">
              <h3 className="font-semibold mb-3">Memory Usage</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Heap Used</p>
                  <p className="text-lg font-semibold">{metrics.currentStatus.memory.heapUsedMB}MB</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Heap Total</p>
                  <p className="text-lg font-semibold">{metrics.currentStatus.memory.heapTotalMB}MB</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Usage</p>
                  <p className="text-lg font-semibold">
                    {metrics.currentStatus.memory.usagePercentage}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RSS</p>
                  <p className="text-lg font-semibold">{metrics.currentStatus.memory.rss}MB</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Recent Alerts ({metrics.alerts.recent.length})
          </CardTitle>
          <CardDescription>Latest system alerts and warnings</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.alerts.recent.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No recent alerts</p>
          ) : (
            <div className="space-y-3">
              {metrics.alerts.recent.map((alert, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{alert.name}</span>
                      <Badge
                        variant="outline"
                        className={SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS] || ''}
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {formatTimestamp(alert.triggeredAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
