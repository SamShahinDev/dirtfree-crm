'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clock,
  Calendar,
  Mail,
  Play,
  Pause,
  Edit,
  Trash2,
  Plus,
  CheckCircle,
  AlertCircle,
  Users
} from 'lucide-react'
import { getScheduledReports, scheduleReport } from '@/lib/analytics/reports'
import { format } from 'date-fns'

interface ScheduledReport {
  id: string
  name: string
  config: any
  schedule: {
    frequency: string
    dayOfWeek?: number
    dayOfMonth?: number
    time: string
  }
  recipients: string[]
  active: boolean
  lastRun?: string
  nextRun: string
  status: 'active' | 'paused' | 'error'
}

export function ScheduledReports() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    try {
      // Mock scheduled reports for demo
      const mockReports: ScheduledReport[] = [
        {
          id: '1',
          name: 'Weekly Performance Summary',
          config: {
            type: 'summary',
            dateRange: 'last7days',
            metrics: ['revenue', 'jobs', 'customers'],
            format: 'pdf'
          },
          schedule: {
            frequency: 'weekly',
            dayOfWeek: 1, // Monday
            time: '09:00'
          },
          recipients: ['manager@company.com', 'owner@company.com'],
          active: true,
          lastRun: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          nextRun: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        },
        {
          id: '2',
          name: 'Monthly Revenue Report',
          config: {
            type: 'detailed',
            dateRange: 'lastMonth',
            metrics: ['revenue', 'avgTicket'],
            format: 'excel'
          },
          schedule: {
            frequency: 'monthly',
            dayOfMonth: 1,
            time: '08:00'
          },
          recipients: ['finance@company.com'],
          active: true,
          lastRun: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          nextRun: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        },
        {
          id: '3',
          name: 'Daily Operations Report',
          config: {
            type: 'summary',
            dateRange: 'last24hours',
            metrics: ['jobs', 'techUtil'],
            format: 'pdf'
          },
          schedule: {
            frequency: 'daily',
            time: '18:00'
          },
          recipients: ['operations@company.com', 'supervisor@company.com'],
          active: false,
          lastRun: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          nextRun: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'paused'
        },
        {
          id: '4',
          name: 'Quarterly Performance Review',
          config: {
            type: 'comparison',
            dateRange: 'last90days',
            metrics: ['revenue', 'customers', 'custSat'],
            format: 'pdf'
          },
          schedule: {
            frequency: 'quarterly',
            dayOfMonth: 1,
            time: '10:00'
          },
          recipients: ['board@company.com', 'ceo@company.com'],
          active: true,
          nextRun: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        }
      ]
      setReports(mockReports)
    } catch (error) {
      console.error('Failed to load scheduled reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = (reportId: string) => {
    setReports(prev =>
      prev.map(r =>
        r.id === reportId
          ? {
              ...r,
              active: !r.active,
              status: !r.active ? 'active' : 'paused'
            }
          : r
      )
    )
  }

  const handleDeleteReport = (reportId: string) => {
    if (confirm('Are you sure you want to delete this scheduled report?')) {
      setReports(prev => prev.filter(r => r.id !== reportId))
    }
  }

  const getFrequencyBadge = (frequency: string) => {
    const colors = {
      daily: 'bg-blue-100 text-blue-700',
      weekly: 'bg-green-100 text-green-700',
      monthly: 'bg-purple-100 text-purple-700',
      quarterly: 'bg-orange-100 text-orange-700'
    }

    return (
      <Badge
        variant="secondary"
        className={colors[frequency as keyof typeof colors] || ''}
      >
        <Clock className="w-3 h-3 mr-1" />
        {frequency}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case 'paused':
        return (
          <Badge className="bg-yellow-100 text-yellow-700">
            <Pause className="w-3 h-3 mr-1" />
            Paused
          </Badge>
        )
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-700">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        )
      default:
        return null
    }
  }

  const getDayName = (dayNumber: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return days[dayNumber]
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Scheduled Reports</h2>
          <p className="text-sm text-gray-500 mt-1">
            Automated report delivery to your team
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Schedule
        </button>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No scheduled reports yet</p>
          <p className="text-sm text-gray-500 mt-2">
            Set up automated reports to be sent to your team
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className={`border rounded-lg p-4 transition-colors ${
                report.active ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{report.name}</h3>
                    {getStatusBadge(report.status)}
                    {getFrequencyBadge(report.schedule.frequency)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span>Schedule:</span>
                      </div>
                      <p className="ml-6">
                        {report.schedule.frequency === 'daily' && `Daily at ${report.schedule.time}`}
                        {report.schedule.frequency === 'weekly' &&
                          `Every ${getDayName(report.schedule.dayOfWeek!)} at ${report.schedule.time}`}
                        {report.schedule.frequency === 'monthly' &&
                          `Day ${report.schedule.dayOfMonth} at ${report.schedule.time}`}
                        {report.schedule.frequency === 'quarterly' &&
                          `Quarterly on day ${report.schedule.dayOfMonth} at ${report.schedule.time}`}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4" />
                        <span>Recipients ({report.recipients.length}):</span>
                      </div>
                      <p className="ml-6 truncate">
                        {report.recipients.slice(0, 2).join(', ')}
                        {report.recipients.length > 2 && ` +${report.recipients.length - 2} more`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    {report.lastRun && (
                      <span>
                        Last run: {format(new Date(report.lastRun), 'MMM dd, yyyy HH:mm')}
                      </span>
                    )}
                    <span>
                      Next run: {format(new Date(report.nextRun), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(report.id)}
                    className={`p-2 rounded-lg ${
                      report.active
                        ? 'text-yellow-600 hover:bg-yellow-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    title={report.active ? 'Pause' : 'Resume'}
                  >
                    {report.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setEditingReport(report)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteReport(report.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showAddModal || editingReport) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingReport ? 'Edit Scheduled Report' : 'Schedule New Report'}
            </h3>

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Report Template</label>
                <select className="w-full px-3 py-2 border rounded-lg">
                  <option>Monthly Performance Report</option>
                  <option>Weekly Operations Summary</option>
                  <option>Revenue Analysis Report</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Frequency</label>
                <select className="w-full px-3 py-2 border rounded-lg">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Day</label>
                  <select className="w-full px-3 py-2 border rounded-lg">
                    <option>Monday</option>
                    <option>Tuesday</option>
                    <option>Wednesday</option>
                    <option>Thursday</option>
                    <option>Friday</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Time</label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border rounded-lg"
                    defaultValue="09:00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Recipients</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Enter email addresses separated by commas"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingReport(null)
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingReport ? 'Save Changes' : 'Schedule Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  )
}