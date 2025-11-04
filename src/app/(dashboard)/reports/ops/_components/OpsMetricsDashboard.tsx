'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  MessageSquare,
  RefreshCw,
  Shield,
  TrendingUp,
  Zap
} from 'lucide-react'
import { formatCTWithSeconds } from '@/lib/time/ct'
import { getOperationalMetrics, type OperationalMetrics } from '../actions'

export function OpsMetricsDashboard() {
  const [metrics, setMetrics] = useState<OperationalMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadMetrics = async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getOperationalMetrics()
      setMetrics(data)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMetrics()

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000)
    return () => clearInterval(interval)
  }, [])

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatMinutesAgo = (minutes?: number) => {
    if (minutes === undefined) return 'Unknown'
    if (minutes < 1) return 'Just now'
    if (minutes === 1) return '1 minute ago'
    return `${minutes} minutes ago`
  }

  const getStatusBadge = (healthy: boolean, label?: string) => {
    if (healthy) {
      return (
        <Badge className="gap-1 bg-green-100 text-green-800 border-green-200">
          <CheckCircle2 className="h-3 w-3" />
          {label || 'Healthy'}
        </Badge>
      )
    } else {
      return (
        <Badge className="gap-1 bg-red-100 text-red-800 border-red-200">
          <AlertTriangle className="h-3 w-3" />
          {label || 'Degraded'}
        </Badge>
      )
    }
  }

  if (loading && !metrics) {
    return <div>Loading operational metrics...</div>
  }

  if (error && !metrics) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load operational metrics: {error}
        </AlertDescription>
      </Alert>
    )
  }

  if (!metrics) {
    return <div>No metrics available</div>
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Last updated: {formatCTWithSeconds(lastRefresh.toISOString())}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadMetrics}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card className="rounded-lg p-5 lg:p-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Overall System Health
            </CardTitle>
            {getStatusBadge(metrics.overallHealthy)}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {metrics.overallHealthy
              ? 'All systems are operating normally'
              : 'One or more systems are experiencing issues'}
          </p>
        </CardContent>
      </Card>

      {/* SLO Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.sloStatuses.map((slo) => (
          <Card key={slo.slo} className="rounded-lg p-5 lg:p-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{slo.displayName}</CardTitle>
                {getStatusBadge(slo.healthy)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">{slo.current}</div>
                <div className="text-sm text-muted-foreground">
                  Target: {slo.target}
                </div>
                {slo.breach && (
                  <div className="text-xs text-red-600 font-medium">
                    SLO breach detected
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Heartbeat Checks */}
      <Card className="rounded-lg p-5 lg:p-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            System Heartbeat
          </CardTitle>
          <CardDescription>
            Core system component health checks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Cron Jobs */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Cron Jobs</span>
              </div>
              {getStatusBadge(metrics.heartbeat.checks.cron.ok)}
              {metrics.heartbeat.checks.cron.minutesSinceSuccess !== undefined && (
                <div className="text-xs text-muted-foreground">
                  Last success: {formatMinutesAgo(metrics.heartbeat.checks.cron.minutesSinceSuccess)}
                </div>
              )}
            </div>

            {/* Database */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="text-sm font-medium">Database</span>
              </div>
              {getStatusBadge(metrics.heartbeat.checks.database.ok)}
              {metrics.heartbeat.checks.database.responseTime && (
                <div className="text-xs text-muted-foreground">
                  Response: {formatDuration(metrics.heartbeat.checks.database.responseTime)}
                </div>
              )}
              {metrics.heartbeat.checks.database.error && (
                <div className="text-xs text-red-600">
                  {metrics.heartbeat.checks.database.error}
                </div>
              )}
            </div>

            {/* Ready Check */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm font-medium">Ready Check</span>
              </div>
              {getStatusBadge(metrics.heartbeat.checks.ready.ok)}
              {metrics.heartbeat.checks.ready.error && (
                <div className="text-xs text-red-600">
                  {metrics.heartbeat.checks.ready.error}
                </div>
              )}
            </div>

            {/* API Performance */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span className="text-sm font-medium">API Performance</span>
              </div>
              {metrics.heartbeat.checks.api.p95Ms ? (
                <>
                  {getStatusBadge(metrics.heartbeat.checks.api.p95Ms <= 800)}
                  <div className="text-xs text-muted-foreground">
                    P95: {formatDuration(metrics.heartbeat.checks.api.p95Ms)}
                  </div>
                </>
              ) : (
                <Badge variant="outline">No data</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Statistics */}
      <Card className="rounded-lg p-5 lg:p-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Delivery Statistics
          </CardTitle>
          <CardDescription>
            Last {metrics.samples.windowMinutes} minutes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Reminders Sent</div>
              <div className="text-2xl font-bold text-green-600">
                {metrics.samples.counts.remindersSent}
              </div>
              <div className="text-xs text-muted-foreground">
                Failed: {metrics.samples.counts.remindersFailed}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Inbound Verifications</div>
              <div className="text-2xl font-bold text-blue-600">
                {metrics.samples.counts.inboundVerifyAttempts}
              </div>
              <div className="text-xs text-muted-foreground">
                Errors: {metrics.samples.counts.inboundVerifyErrors}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">API Requests</div>
              <div className="text-2xl font-bold text-purple-600">
                {metrics.samples.counts.apiRequests || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground">
                P95: {formatDuration(metrics.samples.apiP95Ms)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Warning: {error} (showing last cached data)
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}