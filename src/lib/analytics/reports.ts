import { getServerSupabase } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subDays, subMonths, format } from 'date-fns'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

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

interface ReportMetric {
  id: string
  label: string
  value: string | number
  trend?: number
  category: string
}

interface ReportData {
  title: string
  generatedAt: Date
  dateRange: {
    start: Date
    end: Date
  }
  metrics: ReportMetric[]
  rows: any[]
  charts?: any[]
}

export async function generateReport(config: ReportConfig): Promise<ReportData> {
  const data = await fetchReportData(config)
  const processedData = processReportData(data, config)
  return processedData
}

async function fetchReportData(config: ReportConfig) {
  const supabase = await getServerSupabase()
  const { start, end } = getDateRange(config.dateRange, config.customStartDate, config.customEndDate)

  const results: any = {}

  // Fetch data for selected metrics
  for (const metricId of config.metrics) {
    switch (metricId) {
      case 'revenue':
        const { data: revenueData } = await supabase
          .from('jobs')
          .select('*, job_services(*, services(*))')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .eq('status', 'completed')

        const totalRevenue = revenueData?.reduce((sum, job) => {
          const jobRevenue = job.job_services?.reduce((serviceSum: number, js: any) =>
            serviceSum + (js.price || 0), 0) || 0
          return sum + jobRevenue
        }, 0) || 0

        results.revenue = totalRevenue
        break

      case 'jobs':
        const { count: jobCount } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())

        results.jobs = jobCount || 0
        break

      case 'customers':
        const { count: customerCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())

        results.customers = customerCount || 0
        break

      case 'avgTicket':
        const { data: ticketData } = await supabase
          .from('jobs')
          .select('*, job_services(*, services(*))')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .eq('status', 'completed')

        const ticketRevenue = ticketData?.reduce((sum, job) => {
          const jobRevenue = job.job_services?.reduce((serviceSum: number, js: any) =>
            serviceSum + (js.price || 0), 0) || 0
          return sum + jobRevenue
        }, 0) || 0

        results.avgTicket = ticketData?.length ? ticketRevenue / ticketData.length : 0
        break

      case 'techUtil':
        // Mock technician utilization
        results.techUtil = 75 + Math.random() * 20
        break

      case 'custSat':
        // Mock customer satisfaction
        results.custSat = 4.3 + Math.random() * 0.5
        break
    }
  }

  // Fetch detailed data if needed
  if (config.type === 'detailed' || config.type === 'custom') {
    const { data: detailedJobs } = await supabase
      .from('jobs')
      .select('*, customers(*), job_services(*, services(*))')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    results.detailed = detailedJobs || []
  }

  return results
}

function processReportData(data: any, config: ReportConfig): ReportData {
  const { start, end } = getDateRange(config.dateRange, config.customStartDate, config.customEndDate)

  const metrics: ReportMetric[] = []
  const rows: any[] = []

  // Process metrics
  if (data.revenue !== undefined) {
    metrics.push({
      id: 'revenue',
      label: 'Total Revenue',
      value: `$${Math.round(data.revenue).toLocaleString()}`,
      category: 'Financial',
      trend: 12 // Mock trend
    })
  }

  if (data.jobs !== undefined) {
    metrics.push({
      id: 'jobs',
      label: 'Jobs Completed',
      value: data.jobs,
      category: 'Operations',
      trend: 8
    })
  }

  if (data.customers !== undefined) {
    metrics.push({
      id: 'customers',
      label: 'New Customers',
      value: data.customers,
      category: 'Growth',
      trend: 15
    })
  }

  if (data.avgTicket !== undefined) {
    metrics.push({
      id: 'avgTicket',
      label: 'Average Ticket',
      value: `$${Math.round(data.avgTicket).toLocaleString()}`,
      category: 'Financial',
      trend: 5
    })
  }

  if (data.techUtil !== undefined) {
    metrics.push({
      id: 'techUtil',
      label: 'Technician Utilization',
      value: `${Math.round(data.techUtil)}%`,
      category: 'Operations',
      trend: 3
    })
  }

  if (data.custSat !== undefined) {
    metrics.push({
      id: 'custSat',
      label: 'Customer Satisfaction',
      value: data.custSat.toFixed(1),
      category: 'Quality',
      trend: 2
    })
  }

  // Process detailed rows if available
  if (data.detailed) {
    rows.push(...data.detailed.map((job: any) => ({
      date: format(new Date(job.created_at), 'MM/dd/yyyy'),
      customer: job.customers?.full_name || 'N/A',
      services: job.job_services?.map((js: any) => js.services?.name).join(', ') || 'N/A',
      revenue: job.job_services?.reduce((sum: number, js: any) => sum + (js.price || 0), 0) || 0,
      status: job.status
    })))
  }

  return {
    title: config.name || 'Analytics Report',
    generatedAt: new Date(),
    dateRange: { start, end },
    metrics,
    rows
  }
}

function getDateRange(range: string, customStart?: Date, customEnd?: Date) {
  const now = new Date()
  let start: Date
  let end: Date

  switch (range) {
    case 'last7days':
      start = subDays(now, 7)
      end = now
      break
    case 'last30days':
      start = subDays(now, 30)
      end = now
      break
    case 'last90days':
      start = subDays(now, 90)
      end = now
      break
    case 'lastYear':
      start = subDays(now, 365)
      end = now
      break
    case 'thisMonth':
      start = startOfMonth(now)
      end = endOfMonth(now)
      break
    case 'lastMonth':
      start = startOfMonth(subMonths(now, 1))
      end = endOfMonth(subMonths(now, 1))
      break
    case 'custom':
      start = customStart || subDays(now, 30)
      end = customEnd || now
      break
    default:
      start = subDays(now, 30)
      end = now
  }

  return { start, end }
}

export async function exportReport(config: ReportConfig) {
  const data = await generateReport(config)

  switch (config.format) {
    case 'pdf':
      exportPDF(data, config)
      break
    case 'excel':
      exportExcel(data, config)
      break
    case 'csv':
      exportCSV(data, config)
      break
    default:
      exportPDF(data, config)
  }
}

function exportPDF(data: ReportData, config: ReportConfig) {
  const doc = new jsPDF()

  // Add header
  doc.setFontSize(20)
  doc.text(data.title, 20, 20)

  // Add date range
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(
    `${format(data.dateRange.start, 'MMM dd, yyyy')} - ${format(data.dateRange.end, 'MMM dd, yyyy')}`,
    20,
    30
  )
  doc.text(`Generated: ${format(data.generatedAt, 'MMM dd, yyyy HH:mm')}`, 20, 36)

  // Reset text color
  doc.setTextColor(0)

  // Add metrics
  doc.setFontSize(14)
  doc.text('Key Metrics', 20, 50)

  let y = 60
  doc.setFontSize(11)
  data.metrics.forEach((metric) => {
    doc.text(`${metric.label}:`, 25, y)
    doc.setFont(undefined, 'bold')
    doc.text(String(metric.value), 80, y)
    doc.setFont(undefined, 'normal')
    if (metric.trend) {
      doc.setTextColor(metric.trend > 0 ? 0 : 255, metric.trend > 0 ? 128 : 0, 0)
      doc.text(`${metric.trend > 0 ? '+' : ''}${metric.trend}%`, 120, y)
      doc.setTextColor(0)
    }
    y += 8
  })

  // Add detailed data if available
  if (data.rows.length > 0) {
    y += 10
    doc.setFontSize(14)
    doc.text('Detailed Data', 20, y)
    y += 10

    // Add table headers
    doc.setFontSize(10)
    doc.text('Date', 25, y)
    doc.text('Customer', 60, y)
    doc.text('Services', 110, y)
    doc.text('Revenue', 160, y)
    y += 5

    // Add rows (limit to fit on page)
    doc.setFontSize(9)
    const maxRows = Math.min(data.rows.length, 20)
    for (let i = 0; i < maxRows; i++) {
      const row = data.rows[i]
      doc.text(row.date, 25, y)
      doc.text(row.customer.substring(0, 20), 60, y)
      doc.text(row.services.substring(0, 30), 110, y)
      doc.text(`$${row.revenue}`, 160, y)
      y += 5

      // Add new page if needed
      if (y > 270) {
        doc.addPage()
        y = 20
      }
    }
  }

  // Save the PDF
  doc.save(`${config.name || 'report'}_${format(new Date(), 'yyyyMMdd')}.pdf`)
}

function exportExcel(data: ReportData, config: ReportConfig) {
  // Create workbook
  const wb = XLSX.utils.book_new()

  // Summary sheet
  const summaryData = [
    ['Report Title', data.title],
    ['Generated', format(data.generatedAt, 'MMM dd, yyyy HH:mm')],
    ['Date Range', `${format(data.dateRange.start, 'MMM dd, yyyy')} - ${format(data.dateRange.end, 'MMM dd, yyyy')}`],
    [],
    ['Metrics', 'Value', 'Trend']
  ]

  data.metrics.forEach(metric => {
    summaryData.push([metric.label, String(metric.value), metric.trend ? `${metric.trend}%` : ''])
  })

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')

  // Detailed data sheet
  if (data.rows.length > 0) {
    const detailSheet = XLSX.utils.json_to_sheet(data.rows)
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Details')
  }

  // Save file
  XLSX.writeFile(wb, `${config.name || 'report'}_${format(new Date(), 'yyyyMMdd')}.xlsx`)
}

function exportCSV(data: ReportData, config: ReportConfig) {
  let csv = 'Report: ' + data.title + '\n'
  csv += 'Generated: ' + format(data.generatedAt, 'MMM dd, yyyy HH:mm') + '\n'
  csv += `Date Range: ${format(data.dateRange.start, 'MMM dd, yyyy')} - ${format(data.dateRange.end, 'MMM dd, yyyy')}\n\n`

  // Add metrics
  csv += 'Metric,Value,Trend\n'
  data.metrics.forEach(metric => {
    csv += `"${metric.label}","${metric.value}","${metric.trend ? metric.trend + '%' : ''}"\n`
  })

  // Add detailed data if available
  if (data.rows.length > 0) {
    csv += '\n\nDetailed Data\n'
    const headers = Object.keys(data.rows[0])
    csv += headers.join(',') + '\n'

    data.rows.forEach(row => {
      csv += headers.map(header => `"${row[header]}"`).join(',') + '\n'
    })
  }

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `${config.name || 'report'}_${format(new Date(), 'yyyyMMdd')}.csv`)
}

export async function saveReportTemplate(template: any) {
  const supabase = await getServerSupabase()

  const { error } = await supabase
    .from('report_templates')
    .insert({
      name: template.name,
      config: template,
      created_at: new Date().toISOString()
    })

  if (error) throw error
  return { success: true }
}

export async function getReportTemplates() {
  const supabase = await getServerSupabase()

  const { data, error } = await supabase
    .from('report_templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function scheduleReport(schedule: any) {
  const supabase = await getServerSupabase()

  const { error } = await supabase
    .from('scheduled_reports')
    .insert({
      ...schedule,
      created_at: new Date().toISOString()
    })

  if (error) throw error
  return { success: true }
}

export async function getScheduledReports() {
  const supabase = await getServerSupabase()

  const { data, error } = await supabase
    .from('scheduled_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}