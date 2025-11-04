/**
 * Audit Logs API
 *
 * Endpoints for retrieving, filtering, and exporting audit logs.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { getAuditLogs, type AuditLogFilters } from '@/lib/audit/audit-logger'
import { createClient } from '@/lib/supabase/server'

/**
 * GET - Retrieve audit logs with filters
 *
 * Query parameters:
 * - userId: Filter by user ID
 * - customerId: Filter by customer ID
 * - action: Filter by action type
 * - status: Filter by status (success/failure/warning)
 * - severity: Filter by severity (low/medium/high/critical)
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - limit: Maximum number of logs (default: 100)
 * - format: Response format (json/csv)
 */
export const GET = withAuth(
  async (req) => {
    const { searchParams } = new URL(req.url)

    // Parse filters from query parameters
    const filters: AuditLogFilters = {
      userId: searchParams.get('userId') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      action: searchParams.get('action') as any,
      status: searchParams.get('status') as any,
      severity: searchParams.get('severity') as any,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : 100,
    }

    // Get audit logs
    const logs = await getAuditLogs(filters)

    // Check if CSV export is requested
    const format = searchParams.get('format')
    if (format === 'csv') {
      const csv = convertToCSV(logs)

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`,
        },
      })
    }

    // Return JSON
    return NextResponse.json({
      success: true,
      count: logs.length,
      filters,
      logs,
    })
  },
  {
    requirePermission: 'analytics:view_all',
    enableAuditLog: true,
  }
)

/**
 * POST - Generate security report
 *
 * Body:
 * - reportType: 'summary' | 'suspicious' | 'compliance'
 * - startDate: Start date for report
 * - endDate: End date for report
 * - userId: Optional user filter
 */
export const POST = withAuth(
  async (req) => {
    const body = await req.json()
    const { reportType, startDate, endDate, userId } = body

    if (!reportType || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'reportType, startDate, and endDate are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    let report: any = {}

    switch (reportType) {
      case 'summary':
        report = await generateSummaryReport(
          supabase,
          new Date(startDate),
          new Date(endDate),
          userId
        )
        break

      case 'suspicious':
        report = await generateSuspiciousActivityReport(supabase)
        break

      case 'compliance':
        report = await generateComplianceReport(
          supabase,
          new Date(startDate),
          new Date(endDate)
        )
        break

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      reportType,
      period: { startDate, endDate },
      report,
    })
  },
  {
    requirePermission: 'analytics:view_all',
    enableAuditLog: true,
  }
)

/**
 * Convert audit logs to CSV format
 */
function convertToCSV(logs: any[]): string {
  if (logs.length === 0) {
    return 'No data'
  }

  // CSV headers
  const headers = [
    'ID',
    'Action',
    'Status',
    'Severity',
    'User ID',
    'User Email',
    'Customer ID',
    'Customer Name',
    'Resource Type',
    'Resource ID',
    'IP Address',
    'Error Message',
    'Duration (ms)',
    'Created At',
  ]

  // CSV rows
  const rows = logs.map((log) => [
    log.id,
    log.action,
    log.status,
    log.severity,
    log.user_id || '',
    log.users?.email || '',
    log.customer_id || '',
    log.customers?.name || '',
    log.resource_type || '',
    log.resource_id || '',
    log.ip_address || '',
    log.error_message || '',
    log.duration_ms || '',
    log.created_at,
  ])

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  return csvContent
}

/**
 * Generate summary report
 */
async function generateSummaryReport(
  supabase: any,
  startDate: Date,
  endDate: Date,
  userId?: string
): Promise<any> {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data: logs, error } = await query

  if (error || !logs) {
    throw error || new Error('Failed to fetch logs')
  }

  // Aggregate statistics
  const report = {
    totalEvents: logs.length,
    byStatus: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    byAction: {} as Record<string, number>,
    topUsers: {} as Record<string, number>,
    hourlyDistribution: Array(24).fill(0),
    dailyDistribution: {} as Record<string, number>,
  }

  for (const log of logs) {
    // By status
    report.byStatus[log.status] = (report.byStatus[log.status] || 0) + 1

    // By severity
    report.bySeverity[log.severity] = (report.bySeverity[log.severity] || 0) + 1

    // By action
    report.byAction[log.action] = (report.byAction[log.action] || 0) + 1

    // Top users
    if (log.user_id) {
      report.topUsers[log.user_id] = (report.topUsers[log.user_id] || 0) + 1
    }

    // Hourly distribution
    const hour = new Date(log.created_at).getHours()
    report.hourlyDistribution[hour]++

    // Daily distribution
    const day = new Date(log.created_at).toISOString().split('T')[0]
    report.dailyDistribution[day] = (report.dailyDistribution[day] || 0) + 1
  }

  return report
}

/**
 * Generate suspicious activity report
 */
async function generateSuspiciousActivityReport(supabase: any): Promise<any> {
  const { data: alerts, error } = await supabase
    .from('security_alerts')
    .select('*')
    .limit(50)

  if (error) {
    throw error
  }

  const { data: failedLogins, error: failedError } = await supabase
    .from('failed_login_attempts')
    .select('*')
    .limit(50)

  if (failedError) {
    throw failedError
  }

  return {
    securityAlerts: alerts || [],
    failedLoginAttempts: failedLogins || [],
    summary: {
      totalSuspiciousPatterns: (alerts || []).length,
      totalFailedLogins: (failedLogins || []).length,
    },
  }
}

/**
 * Generate compliance report
 */
async function generateComplianceReport(
  supabase: any,
  startDate: Date,
  endDate: Date
): Promise<any> {
  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (error || !logs) {
    throw error || new Error('Failed to fetch logs')
  }

  // Filter for compliance-relevant events
  const piiAccess = logs.filter((log) => log.action === 'pii_accessed')
  const dataExports = logs.filter((log) => log.action === 'data_exported')
  const userChanges = logs.filter(
    (log) =>
      log.action === 'user_created' ||
      log.action === 'user_role_changed' ||
      log.action === 'user_deleted'
  )
  const settingsChanges = logs.filter((log) => log.action === 'settings_changed')

  return {
    period: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
    summary: {
      totalEvents: logs.length,
      piiAccessCount: piiAccess.length,
      dataExportsCount: dataExports.length,
      userChangesCount: userChanges.length,
      settingsChangesCount: settingsChanges.length,
    },
    piiAccess: piiAccess.slice(0, 100), // Limit for response size
    dataExports: dataExports.slice(0, 100),
    userChanges: userChanges.slice(0, 100),
    settingsChanges: settingsChanges.slice(0, 100),
  }
}

export const dynamic = 'force-dynamic'
