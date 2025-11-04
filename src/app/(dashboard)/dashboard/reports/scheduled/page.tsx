'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  FileText,
  Plus,
  Play,
  Edit,
  Trash2,
  RefreshCw,
  Calendar,
  Users,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface ScheduledReport {
  id: string
  name: string
  report_type: string
  schedule: string
  recipients: string[]
  filters?: Record<string, any>
  format: 'pdf' | 'csv' | 'excel'
  enabled: boolean
  created_at: string
  stats?: {
    successRate: number
    totalGenerations: number
    lastGenerated: string | null
  }
}

const REPORT_TYPES = [
  { value: 'revenue_summary', label: 'Revenue Summary' },
  { value: 'customer_activity', label: 'Customer Activity' },
  { value: 'opportunity_pipeline', label: 'Opportunity Pipeline' },
  { value: 'promotion_performance', label: 'Promotion Performance' },
  { value: 'loyalty_engagement', label: 'Loyalty Engagement' },
]

const FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'excel', label: 'Excel (XLSX)' },
]

const SCHEDULE_PRESETS = [
  { value: '0 6 * * *', label: 'Daily at 6am' },
  { value: '0 8 * * 1', label: 'Weekly on Monday at 8am' },
  { value: '0 8 1 * *', label: 'Monthly on the 1st at 8am' },
  { value: '0 */6 * * *', label: 'Every 6 hours' },
  { value: '0 0 * * *', label: 'Daily at midnight' },
]

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showHistoryDialog, setShowHistoryDialog] = useState(false)
  const [selectedReport, setSelectedReport] = useState<ScheduledReport | null>(null)
  const [history, setHistory] = useState<any>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    reportType: '',
    schedule: '',
    recipients: '',
    format: 'pdf' as 'pdf' | 'csv' | 'excel',
    enabled: true,
  })

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/reports/scheduled')
      const result = await res.json()

      if (result.success) {
        setReports(result.reports)
      } else {
        toast.error('Failed to load reports')
      }
    } catch (error) {
      console.error('Load reports error:', error)
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  async function createReport() {
    try {
      const recipients = formData.recipients
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.length > 0)

      if (recipients.length === 0) {
        toast.error('Please enter at least one recipient')
        return
      }

      const res = await fetch('/api/admin/reports/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          reportType: formData.reportType,
          schedule: formData.schedule,
          recipients,
          format: formData.format,
          enabled: formData.enabled,
        }),
      })

      const result = await res.json()

      if (result.success) {
        toast.success('Report created successfully')
        setShowCreateDialog(false)
        resetForm()
        await loadReports()
      } else {
        toast.error(result.error || 'Failed to create report')
      }
    } catch (error) {
      console.error('Create report error:', error)
      toast.error('Failed to create report')
    }
  }

  async function toggleReport(reportId: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/admin/reports/scheduled/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      const result = await res.json()

      if (result.success) {
        toast.success(`Report ${enabled ? 'enabled' : 'disabled'}`)
        await loadReports()
      } else {
        toast.error('Failed to update report')
      }
    } catch (error) {
      console.error('Toggle report error:', error)
      toast.error('Failed to update report')
    }
  }

  async function deleteReport(reportId: string) {
    if (!confirm('Are you sure you want to delete this report?')) {
      return
    }

    try {
      const res = await fetch(`/api/admin/reports/scheduled/${reportId}`, {
        method: 'DELETE',
      })

      const result = await res.json()

      if (result.success) {
        toast.success('Report deleted successfully')
        await loadReports()
      } else {
        toast.error('Failed to delete report')
      }
    } catch (error) {
      console.error('Delete report error:', error)
      toast.error('Failed to delete report')
    }
  }

  async function generateReport(reportId: string) {
    try {
      const res = await fetch(`/api/admin/reports/scheduled/${reportId}/generate`, {
        method: 'POST',
      })

      const result = await res.json()

      if (result.success) {
        toast.success('Report generation started')
      } else {
        toast.error('Failed to generate report')
      }
    } catch (error) {
      console.error('Generate report error:', error)
      toast.error('Failed to generate report')
    }
  }

  async function testReport(report: ScheduledReport) {
    try {
      const res = await fetch(`/api/admin/reports/scheduled/${report.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: report.report_type,
          format: report.format,
          filters: report.filters || {},
        }),
      })

      const result = await res.json()

      if (result.success) {
        toast.success(
          `Test report generated: ${result.result.fileName} (${result.result.fileSizeKB} KB)`
        )
      } else {
        toast.error(result.error || 'Failed to generate test report')
      }
    } catch (error) {
      console.error('Test report error:', error)
      toast.error('Failed to generate test report')
    }
  }

  async function viewHistory(report: ScheduledReport) {
    try {
      setSelectedReport(report)
      setShowHistoryDialog(true)

      const res = await fetch(`/api/admin/reports/scheduled/${report.id}/history`)
      const result = await res.json()

      if (result.success) {
        setHistory(result)
      } else {
        toast.error('Failed to load history')
      }
    } catch (error) {
      console.error('Load history error:', error)
      toast.error('Failed to load history')
    }
  }

  function resetForm() {
    setFormData({
      name: '',
      reportType: '',
      schedule: '',
      recipients: '',
      format: 'pdf',
      enabled: true,
    })
  }

  function formatReportType(type: string): string {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  function formatTimestamp(timestamp: string | null): string {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleString()
  }

  if (loading && reports.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading reports...</div>
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
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              Scheduled Reports
            </h1>
            <p className="text-muted-foreground mt-1">
              Automated report generation and delivery
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadReports} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </Button>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Reports ({reports.length})</CardTitle>
          <CardDescription>Manage automated report generation schedules</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No scheduled reports yet</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Report
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Success Rate</TableHead>
                  <TableHead>Last Generated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{report.name}</TableCell>
                    <TableCell>{formatReportType(report.report_type)}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        {report.schedule}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{report.recipients.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={report.enabled}
                        onCheckedChange={(enabled) => toggleReport(report.id, enabled)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {report.stats?.totalGenerations ? (
                        <div className="flex items-center justify-end gap-2">
                          {report.stats.successRate >= 95 ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-red-600" />
                          )}
                          <span>{report.stats.successRate.toFixed(1)}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTimestamp(report.stats?.lastGenerated || null)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewHistory(report)}
                          title="View History"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateReport(report.id)}
                          title="Generate Now"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReport(report.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Report Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Scheduled Report</DialogTitle>
            <DialogDescription>
              Set up automated report generation and delivery
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Report Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Daily Revenue Summary"
              />
            </div>

            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select
                value={formData.reportType}
                onValueChange={(value) => setFormData({ ...formData, reportType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="schedule">Schedule (Cron Expression)</Label>
              <Select
                value={formData.schedule}
                onValueChange={(value) => setFormData({ ...formData, schedule: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Current: <code>{formData.schedule || 'Not set'}</code>
              </p>
            </div>

            <div>
              <Label htmlFor="recipients">Recipients (comma-separated emails)</Label>
              <Input
                id="recipients"
                value={formData.recipients}
                onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                placeholder="admin@example.com, manager@example.com"
              />
            </div>

            <div>
              <Label htmlFor="format">Format</Label>
              <Select
                value={formData.format}
                onValueChange={(value: 'pdf' | 'csv' | 'excel') =>
                  setFormData({ ...formData, format: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createReport}>Create Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generation History: {selectedReport?.name}</DialogTitle>
            <DialogDescription>
              {formatReportType(selectedReport?.report_type || '')}
            </DialogDescription>
          </DialogHeader>

          {history ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold">{history.stats.total}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Successful</p>
                    <p className="text-2xl font-bold text-green-600">
                      {history.stats.successful}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold text-red-600">{history.stats.failed}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold">{history.stats.successRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </div>

              {/* History Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Generated At</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.history.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            log.status === 'success'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTimestamp(log.generated_at)}
                      </TableCell>
                      <TableCell>{log.recipients?.length || 0}</TableCell>
                      <TableCell className="text-sm font-mono">{log.file_name || '-'}</TableCell>
                      <TableCell className="text-sm text-red-600 max-w-md truncate">
                        {log.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">Loading history...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
