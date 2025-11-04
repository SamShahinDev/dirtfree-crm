'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Clock,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  TrendingUp,
  Calendar,
  Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface CronJob {
  name: string
  description: string
  schedule: string
  category: string
  timeout: number
  retries: number
  enabled: boolean
  isRunning: boolean
  stats: {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    successRate: number
    avgDuration: number
    lastRun?: string
    lastSuccess?: string
    lastFailure?: string
  }
}

interface JobHistory {
  id: string
  status: string
  startedAt: string
  completedAt?: string
  duration?: number
  error?: string
  attempts: number
}

interface CronJobsData {
  summary: {
    totalJobs: number
    enabledJobs: number
    disabledJobs: number
    runningJobs: number
    totalExecutions: number
    totalFailures: number
    overallSuccessRate: number
  }
  jobs: CronJob[]
  categories: Record<string, CronJob[]>
  runningJobs: Array<{ name: string; startedAt: string; duration: number }>
}

const CATEGORY_COLORS: Record<string, string> = {
  opportunities: 'bg-blue-100 text-blue-800 border-blue-200',
  promotions: 'bg-purple-100 text-purple-800 border-purple-200',
  reviews: 'bg-green-100 text-green-800 border-green-200',
  loyalty: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  analytics: 'bg-orange-100 text-orange-800 border-orange-200',
  monitoring: 'bg-red-100 text-red-800 border-red-200',
  cleanup: 'bg-gray-100 text-gray-800 border-gray-200',
}

export default function CronJobsPage() {
  const [data, setData] = useState<CronJobsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [jobHistory, setJobHistory] = useState<any>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    loadJobs()
  }, [])

  async function loadJobs() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/cron-jobs')
      const result = await res.json()

      if (result.success) {
        setData(result)
      } else {
        toast.error('Failed to load cron jobs')
      }
    } catch (error) {
      console.error('Load cron jobs error:', error)
      toast.error('Failed to load cron jobs')
    } finally {
      setLoading(false)
    }
  }

  async function toggleJob(jobName: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/admin/cron-jobs/${jobName}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      const result = await res.json()

      if (result.success) {
        toast.success(`Job ${enabled ? 'enabled' : 'disabled'}`)
        await loadJobs()
      } else {
        toast.error('Failed to toggle job')
      }
    } catch (error) {
      console.error('Toggle job error:', error)
      toast.error('Failed to toggle job')
    }
  }

  async function runJob(jobName: string) {
    try {
      const res = await fetch(`/api/admin/cron-jobs/${jobName}/run`, {
        method: 'POST',
      })

      const result = await res.json()

      if (result.success) {
        toast.success('Job queued for execution')
        await loadJobs()
      } else {
        toast.error(result.error || 'Failed to run job')
      }
    } catch (error) {
      console.error('Run job error:', error)
      toast.error('Failed to run job')
    }
  }

  async function viewJobHistory(jobName: string) {
    try {
      setHistoryLoading(true)
      setSelectedJob(jobName)

      const res = await fetch(`/api/admin/cron-jobs/${jobName}/history`)
      const result = await res.json()

      if (result.success) {
        setJobHistory(result)
      } else {
        toast.error('Failed to load job history')
      }
    } catch (error) {
      console.error('Load job history error:', error)
      toast.error('Failed to load job history')
    } finally {
      setHistoryLoading(false)
    }
  }

  function formatDuration(ms?: number): string {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  function formatTimestamp(timestamp?: string): string {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleString()
  }

  const filteredJobs =
    categoryFilter === 'all'
      ? data?.jobs || []
      : data?.categories[categoryFilter] || []

  if (loading && !data) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading cron jobs...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">No data available</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-[1800px]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              Cron Job Management
            </h1>
            <p className="text-muted-foreground mt-1">Manage and monitor scheduled background jobs</p>
          </div>
          <Button variant="outline" onClick={loadJobs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Jobs</p>
              <p className="text-3xl font-bold">{data.summary.totalJobs}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Enabled</p>
              <p className="text-3xl font-bold text-green-600">{data.summary.enabledJobs}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Disabled</p>
              <p className="text-3xl font-bold text-orange-600">{data.summary.disabledJobs}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Running</p>
              <p className="text-3xl font-bold text-blue-600">{data.summary.runningJobs}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Runs</p>
              <p className="text-3xl font-bold">{data.summary.totalExecutions}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Failures</p>
              <p className="text-3xl font-bold text-red-600">{data.summary.totalFailures}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-3xl font-bold text-green-600">
                {data.summary.overallSuccessRate.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Running Jobs Banner */}
      {data.runningJobs.length > 0 && (
        <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-blue-700 flex items-center gap-2">
              <Activity className="h-5 w-5 animate-pulse" />
              Currently Running Jobs ({data.runningJobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.runningJobs.map((job) => (
                <div key={job.name} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded">
                  <span className="font-medium">{job.name}</span>
                  <span className="text-sm text-muted-foreground">
                    Running for {formatDuration(job.duration)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="mb-6">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="opportunities">Opportunities</SelectItem>
            <SelectItem value="promotions">Promotions</SelectItem>
            <SelectItem value="reviews">Reviews</SelectItem>
            <SelectItem value="loyalty">Loyalty</SelectItem>
            <SelectItem value="analytics">Analytics</SelectItem>
            <SelectItem value="monitoring">Monitoring</SelectItem>
            <SelectItem value="cleanup">Cleanup</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cron Jobs</CardTitle>
          <CardDescription>
            {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
            {categoryFilter !== 'all' && ` in ${categoryFilter}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Success Rate</TableHead>
                <TableHead className="text-right">Avg Duration</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job) => (
                <TableRow key={job.name}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{job.name}</div>
                      <div className="text-sm text-muted-foreground">{job.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {job.schedule}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={CATEGORY_COLORS[job.category] || ''}>
                      {job.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={(enabled) => toggleJob(job.name, enabled)}
                        disabled={job.isRunning}
                      />
                      {job.isRunning && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">
                          Running
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {job.stats.successRate >= 95 ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : job.stats.successRate >= 80 ? (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span>{job.stats.successRate.toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatDuration(job.stats.avgDuration)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {job.stats.lastRun ? (
                        <>
                          <div>{formatTimestamp(job.stats.lastRun)}</div>
                          {job.stats.lastFailure && (
                            <div className="text-red-600 text-xs">
                              Last failure: {formatTimestamp(job.stats.lastFailure)}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewJobHistory(job.name)}
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runJob(job.name)}
                        disabled={job.isRunning}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Job History Dialog */}
      <Dialog open={selectedJob !== null} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job History: {selectedJob}</DialogTitle>
            <DialogDescription>
              {jobHistory?.job.description}
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="text-center py-8">Loading history...</div>
          ) : jobHistory ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Total Runs</p>
                    <p className="text-2xl font-bold">{jobHistory.stats.totalRuns}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {jobHistory.stats.successRate}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Avg Duration</p>
                    <p className="text-2xl font-bold">{formatDuration(jobHistory.stats.avgDuration)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Failed Runs</p>
                    <p className="text-2xl font-bold text-red-600">{jobHistory.stats.failedRuns}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Timeline Chart */}
              {jobHistory.timeline && jobHistory.timeline.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Execution Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={jobHistory.timeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="time_bucket"
                          tickFormatter={(value) => new Date(value).toLocaleDateString()}
                        />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="executions" stroke="#8884d8" name="Executions" />
                        <Line type="monotone" dataKey="failures" stroke="#ef4444" name="Failures" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Recent Executions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Executions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobHistory.history.map((log: JobHistory) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                log.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : log.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }
                            >
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatTimestamp(log.startedAt)}
                          </TableCell>
                          <TableCell>{formatDuration(log.duration)}</TableCell>
                          <TableCell>{log.attempts}</TableCell>
                          <TableCell className="text-sm text-red-600 max-w-md truncate">
                            {log.error || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
