'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Download,
  Trash2,
  Send,
  Clock,
  Calendar,
  MoreVertical,
  Eye
} from 'lucide-react'
import { getReportTemplates, exportReport } from '@/lib/analytics/reports'
import { format } from 'date-fns'

interface SavedReport {
  id: string
  name: string
  config: any
  created_at: string
  last_run?: string
  schedule?: string
}

export function SavedReports() {
  const [reports, setReports] = useState<SavedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    try {
      // Mock saved reports for demo
      const mockReports: SavedReport[] = [
        {
          id: '1',
          name: 'Monthly Performance Report',
          config: {
            type: 'summary',
            dateRange: 'lastMonth',
            metrics: ['revenue', 'jobs', 'customers', 'avgTicket'],
            format: 'pdf'
          },
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          last_run: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          schedule: 'monthly'
        },
        {
          id: '2',
          name: 'Weekly Operations Summary',
          config: {
            type: 'detailed',
            dateRange: 'last7days',
            metrics: ['jobs', 'techUtil', 'custSat'],
            format: 'excel'
          },
          created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
          last_run: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          schedule: 'weekly'
        },
        {
          id: '3',
          name: 'Revenue Analysis Report',
          config: {
            type: 'comparison',
            dateRange: 'last90days',
            metrics: ['revenue', 'avgTicket'],
            format: 'pdf'
          },
          created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
          last_run: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '4',
          name: 'Customer Growth Report',
          config: {
            type: 'summary',
            dateRange: 'lastYear',
            metrics: ['customers', 'custSat'],
            format: 'csv'
          },
          created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          last_run: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '5',
          name: 'Technician Performance Review',
          config: {
            type: 'detailed',
            dateRange: 'last30days',
            metrics: ['techUtil', 'jobs', 'revenue'],
            format: 'excel'
          },
          created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
          last_run: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          schedule: 'monthly'
        }
      ]
      setReports(mockReports)
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRunReport = async (report: SavedReport) => {
    try {
      await exportReport(report.config)
      // Update last run time
      setReports(prev =>
        prev.map(r =>
          r.id === report.id
            ? { ...r, last_run: new Date().toISOString() }
            : r
        )
      )
    } catch (error) {
      console.error('Failed to run report:', error)
      alert('Failed to run report')
    }
  }

  const handleDeleteReport = (reportId: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      setReports(prev => prev.filter(r => r.id !== reportId))
    }
  }

  const getScheduleBadge = (schedule?: string) => {
    if (!schedule) return null

    const scheduleColors = {
      daily: 'bg-blue-100 text-blue-700',
      weekly: 'bg-green-100 text-green-700',
      monthly: 'bg-purple-100 text-purple-700',
      quarterly: 'bg-orange-100 text-orange-700'
    }

    return (
      <Badge
        variant="secondary"
        className={scheduleColors[schedule as keyof typeof scheduleColors] || ''}
      >
        <Clock className="w-3 h-3 mr-1" />
        {schedule}
      </Badge>
    )
  }

  const getFormatBadge = (format: string) => {
    const formatColors = {
      pdf: 'bg-red-100 text-red-700',
      excel: 'bg-green-100 text-green-700',
      csv: 'bg-blue-100 text-blue-700'
    }

    return (
      <Badge
        variant="secondary"
        className={formatColors[format as keyof typeof formatColors] || ''}
      >
        {format.toUpperCase()}
      </Badge>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Saved Reports</h2>
        <Badge variant="secondary">{reports.length} Reports</Badge>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No saved reports yet</p>
          <p className="text-sm text-gray-500 mt-2">
            Create and save a report from the Report Builder
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold">{report.name}</h3>
                    {getScheduleBadge(report.schedule)}
                    {getFormatBadge(report.config.format)}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Created {format(new Date(report.created_at), 'MMM dd, yyyy')}</span>
                    </div>
                    {report.last_run && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>Last run {format(new Date(report.last_run), 'MMM dd, yyyy')}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      Type: {report.config.type} • Date Range: {report.config.dateRange}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {report.config.metrics.map((metric: string) => (
                        <Badge
                          key={metric}
                          variant="secondary"
                          className="text-xs"
                        >
                          {metric}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setSelectedReport(report)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRunReport(report)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Run & Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Email Report"
                  >
                    <Send className="w-4 h-4" />
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

      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{selectedReport.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Report Configuration Preview
                </p>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Report Type</p>
                <p className="capitalize">{selectedReport.config.type}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Date Range</p>
                <p>{selectedReport.config.dateRange}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Selected Metrics</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedReport.config.metrics.map((metric: string) => (
                    <Badge key={metric} variant="secondary">
                      {metric}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Export Format</p>
                <p className="uppercase">{selectedReport.config.format}</p>
              </div>

              {selectedReport.schedule && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Schedule</p>
                  <p className="capitalize">{selectedReport.schedule}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleRunReport(selectedReport)
                    setSelectedReport(null)
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Run Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}