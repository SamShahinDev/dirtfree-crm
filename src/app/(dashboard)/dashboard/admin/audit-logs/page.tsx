'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  Search,
  Calendar,
  User,
  Activity,
  Clock,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'

interface AuditLog {
  id: string
  action: string
  status: 'success' | 'failure' | 'warning'
  severity: 'low' | 'medium' | 'high' | 'critical'
  user_id?: string
  customer_id?: string
  resource_type?: string
  resource_id?: string
  ip_address?: string
  user_agent?: string
  error_message?: string
  duration_ms?: number
  created_at: string
  users?: {
    email?: string
    display_name?: string
  }
  customers?: {
    name?: string
  }
}

interface SecurityAlert {
  action: string
  user_id: string
  occurrence_count: number
  last_occurrence: string
  ip_addresses: string[]
}

const SEVERITY_COLORS = {
  low: 'bg-blue-100 text-blue-800 border-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
}

const STATUS_COLORS = {
  success: 'bg-green-100 text-green-800 border-green-200',
  failure: 'bg-red-100 text-red-800 border-red-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [userIdFilter, setUserIdFilter] = useState<string>('')
  const [startDateFilter, setStartDateFilter] = useState<string>('')
  const [endDateFilter, setEndDateFilter] = useState<string>('')

  useEffect(() => {
    loadAuditLogs()
    loadSecurityAlerts()
  }, [actionFilter, statusFilter, severityFilter, userIdFilter, startDateFilter, endDateFilter])

  async function loadAuditLogs() {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (severityFilter) params.set('severity', severityFilter)
      if (userIdFilter) params.set('userId', userIdFilter)
      if (startDateFilter) params.set('startDate', startDateFilter)
      if (endDateFilter) params.set('endDate', endDateFilter)
      params.set('limit', '100')

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`)
      const result = await res.json()

      if (result.success) {
        setLogs(result.logs || [])
      } else {
        toast.error('Failed to load audit logs')
      }
    } catch (error) {
      console.error('Load audit logs error:', error)
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }

  async function loadSecurityAlerts() {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'suspicious',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        }),
      })
      const result = await res.json()

      if (result.success) {
        setAlerts(result.report.securityAlerts || [])
      }
    } catch (error) {
      console.error('Load security alerts error:', error)
    }
  }

  async function handleExport(format: 'csv' | 'json') {
    try {
      setExporting(true)
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (severityFilter) params.set('severity', severityFilter)
      if (userIdFilter) params.set('userId', userIdFilter)
      if (startDateFilter) params.set('startDate', startDateFilter)
      if (endDateFilter) params.set('endDate', endDateFilter)
      params.set('format', format)

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`)

      if (res.ok) {
        const blob = await res.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(downloadUrl)
        document.body.removeChild(a)
        toast.success(`Audit logs exported as ${format.toUpperCase()}`)
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

  function clearFilters() {
    setActionFilter('')
    setStatusFilter('')
    setSeverityFilter('')
    setUserIdFilter('')
    setStartDateFilter('')
    setEndDateFilter('')
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString()
  }

  const criticalAlerts = alerts.filter((a) => a.occurrence_count >= 5)
  const failedLogins = logs.filter((l) => l.action === 'login_failed')
  const suspiciousActivity = logs.filter((l) => l.severity === 'critical')

  if (loading && logs.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading audit logs...</div>
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
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              Security Audit Logs
            </h1>
            <p className="text-muted-foreground mt-1">
              Comprehensive security audit trail and threat monitoring
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadAuditLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
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

      {/* Security Alerts */}
      {criticalAlerts.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Security Alerts ({criticalAlerts.length})
            </CardTitle>
            <CardDescription>Suspicious patterns detected in the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criticalAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-white dark:bg-gray-900"
                >
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-100">{alert.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {alert.occurrence_count} occurrences from {alert.ip_addresses.length} IP(s)
                    </p>
                  </div>
                  <Badge variant="destructive">Critical</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <div className="text-2xl font-bold">{logs.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <div className="text-2xl font-bold text-green-600">
                  {logs.filter((l) => l.status === 'success').length}
                </div>
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
                <p className="text-sm text-muted-foreground">Failed</p>
                <div className="text-2xl font-bold text-red-600">
                  {logs.filter((l) => l.status === 'failure').length}
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
                <p className="text-sm text-muted-foreground">Critical</p>
                <div className="text-2xl font-bold text-orange-600">
                  {suspiciousActivity.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="action">Action</Label>
              <Input
                id="action"
                placeholder="e.g., login"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failure">Failure</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger id="severity">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="User UUID"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log Entries ({logs.length})</CardTitle>
          <CardDescription>Recent security events and actions</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found matching your filters
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Timestamp</th>
                    <th className="text-left py-3 px-4">Action</th>
                    <th className="text-left py-3 px-4">User</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Severity</th>
                    <th className="text-left py-3 px-4">Resource</th>
                    <th className="text-left py-3 px-4">IP Address</th>
                    <th className="text-left py-3 px-4">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatDate(log.created_at)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {log.action}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        {log.users?.email || log.users?.display_name ? (
                          <div>
                            <p className="text-sm font-medium">
                              {log.users.display_name || log.users.email}
                            </p>
                            {log.users.display_name && log.users.email && (
                              <p className="text-xs text-muted-foreground">{log.users.email}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">System</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[log.status]}
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={SEVERITY_COLORS[log.severity]}
                        >
                          {log.severity}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {log.resource_type ? (
                          <div>
                            <p className="text-sm">{log.resource_type}</p>
                            {log.resource_id && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {log.resource_id.substring(0, 8)}...
                              </p>
                            )}
                            {log.customers?.name && (
                              <p className="text-xs text-muted-foreground">
                                {log.customers.name}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono">
                          {log.ip_address || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {log.duration_ms ? (
                          <span className="text-sm">{log.duration_ms}ms</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Login Attempts */}
      {failedLogins.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" />
              Failed Login Attempts ({failedLogins.length})
            </CardTitle>
            <CardDescription>Recent authentication failures</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Timestamp</th>
                    <th className="text-left py-3 px-4">User</th>
                    <th className="text-left py-3 px-4">IP Address</th>
                    <th className="text-left py-3 px-4">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {failedLogins.slice(0, 10).map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 text-sm">{formatDate(log.created_at)}</td>
                      <td className="py-3 px-4 text-sm">
                        {log.users?.email || 'Unknown'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono">{log.ip_address || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-red-600">
                        {log.error_message || 'Authentication failed'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
