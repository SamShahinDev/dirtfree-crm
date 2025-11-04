'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Download,
  Save,
  Send,
  FileText,
  FileSpreadsheet,
  File,
  Calendar,
  Filter,
  BarChart3
} from 'lucide-react'
import { generateReport, exportReport, saveReportTemplate } from '@/lib/analytics/reports'

interface ReportConfig {
  name: string
  type: string
  dateRange: string
  metrics: string[]
  groupBy: string
  format: string
  customStartDate?: Date
  customEndDate?: Date
}

export function ReportBuilder() {
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    name: '',
    type: 'summary',
    dateRange: 'last30days',
    metrics: [],
    groupBy: 'none',
    format: 'pdf'
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<any>(null)

  const metrics = [
    { id: 'revenue', label: 'Revenue', category: 'Financial', icon: '💰' },
    { id: 'jobs', label: 'Jobs Completed', category: 'Operations', icon: '📋' },
    { id: 'customers', label: 'New Customers', category: 'Growth', icon: '👥' },
    { id: 'avgTicket', label: 'Average Ticket', category: 'Financial', icon: '🎫' },
    { id: 'techUtil', label: 'Technician Utilization', category: 'Operations', icon: '👷' },
    { id: 'custSat', label: 'Customer Satisfaction', category: 'Quality', icon: '⭐' }
  ]

  const reportTypes = [
    { value: 'summary', label: 'Executive Summary', description: 'High-level overview with key metrics' },
    { value: 'detailed', label: 'Detailed Analysis', description: 'Comprehensive data with trends' },
    { value: 'comparison', label: 'Period Comparison', description: 'Compare metrics across time periods' },
    { value: 'custom', label: 'Custom Report', description: 'Build your own report structure' }
  ]

  const dateRanges = [
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'last90days', label: 'Last 90 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'lastYear', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ]

  const handleGenerate = async () => {
    if (!reportConfig.name || reportConfig.metrics.length === 0) {
      alert('Please provide a report name and select at least one metric')
      return
    }

    setIsGenerating(true)
    try {
      const report = await generateReport(reportConfig)
      setGeneratedReport(report)
      console.log('Generated report:', report)
    } catch (error) {
      console.error('Failed to generate report:', error)
      alert('Failed to generate report')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExport = async (format?: string) => {
    if (!reportConfig.name || reportConfig.metrics.length === 0) {
      alert('Please configure the report before exporting')
      return
    }

    try {
      await exportReport({
        ...reportConfig,
        format: format || reportConfig.format
      })
    } catch (error) {
      console.error('Failed to export report:', error)
      alert('Failed to export report')
    }
  }

  const handleSaveTemplate = async () => {
    if (!reportConfig.name) {
      alert('Please provide a report name')
      return
    }

    try {
      await saveReportTemplate(reportConfig)
      alert('Report template saved successfully')
    } catch (error) {
      console.error('Failed to save template:', error)
      alert('Failed to save template')
    }
  }

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <FileText className="w-4 h-4" />
      case 'excel':
        return <FileSpreadsheet className="w-4 h-4" />
      case 'csv':
        return <File className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Report Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reportConfig.name}
              onChange={(e) => setReportConfig({ ...reportConfig, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Monthly Performance Report"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Report Type</label>
            <div className="grid grid-cols-2 gap-3">
              {reportTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setReportConfig({ ...reportConfig, type: type.value })}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    reportConfig.type === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium">{type.label}</p>
                  <p className="text-xs text-gray-600 mt-1">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Range
              </label>
              <select
                value={reportConfig.dateRange}
                onChange={(e) => setReportConfig({ ...reportConfig, dateRange: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {dateRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <Filter className="w-4 h-4 inline mr-1" />
                Group By
              </label>
              <select
                value={reportConfig.groupBy}
                onChange={(e) => setReportConfig({ ...reportConfig, groupBy: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">None</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="service">Service Type</option>
                <option value="technician">Technician</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">
              <BarChart3 className="w-4 h-4 inline mr-1" />
              Select Metrics <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.map((metric) => (
                <label
                  key={metric.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    reportConfig.metrics.includes(metric.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={reportConfig.metrics.includes(metric.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setReportConfig({
                          ...reportConfig,
                          metrics: [...reportConfig.metrics, metric.id]
                        })
                      } else {
                        setReportConfig({
                          ...reportConfig,
                          metrics: reportConfig.metrics.filter(m => m !== metric.id)
                        })
                      }
                    }}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      <span className="mr-1">{metric.icon}</span>
                      {metric.label}
                    </p>
                    <p className="text-xs text-gray-500">{metric.category}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !reportConfig.name || reportConfig.metrics.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <BarChart3 className="w-4 h-4" />
                {isGenerating ? 'Generating...' : 'Generate Report'}
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!reportConfig.name}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save Template
              </button>
            </div>

            <div className="flex gap-2">
              <div className="flex border rounded-lg overflow-hidden">
                {['pdf', 'excel', 'csv'].map((format) => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    disabled={!reportConfig.name || reportConfig.metrics.length === 0}
                    className="flex items-center gap-1 px-3 py-2 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border-r last:border-r-0"
                    title={`Export as ${format.toUpperCase()}`}
                  >
                    {getFormatIcon(format)}
                    <span className="text-xs uppercase">{format}</span>
                  </button>
                ))}
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                <Send className="w-4 h-4" />
                Email
              </button>
            </div>
          </div>
        </div>
      </Card>

      {generatedReport && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Report Preview</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Report Title</p>
              <p className="font-semibold">{generatedReport.title}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Key Metrics</p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedReport.metrics.map((metric: any) => (
                  <div key={metric.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">{metric.label}</p>
                    <p className="text-xl font-bold">{metric.value}</p>
                    {metric.trend && (
                      <p className={`text-sm ${metric.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metric.trend > 0 ? '+' : ''}{metric.trend}% vs last period
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}