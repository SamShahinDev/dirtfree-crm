import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Report Execution API
 *
 * POST /api/reports/custom/run
 * Executes a custom report and returns results
 *
 * Request body:
 * {
 *   report_id?: string,  // Execute saved report
 *   config?: object,     // Or execute inline config
 *   limit?: number,      // Results limit (default: 1000)
 *   offset?: number,     // Results offset (default: 0)
 *   export?: 'csv' | 'json' | 'excel'
 * }
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

function createSuccessResponse<T>(data: T) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() }
  )
}

/**
 * Verify staff authentication
 */
async function verifyStaffAuth(supabase: any, userId: string): Promise<boolean> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return userRole && ['admin', 'manager', 'dispatcher'].includes((userRole as any).role)
}

/**
 * Convert results to CSV format
 */
function convertToCSV(data: any[], columns: any[]): string {
  if (!data || data.length === 0) return ''

  const lines: string[] = []

  // Header row
  const headers = columns.map((col: any) => col.label || col.field).join(',')
  lines.push(headers)

  // Data rows
  data.forEach((row: any) => {
    const values = columns.map((col: any) => {
      const value = row[col.field]
      if (value === null || value === undefined) return ''
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    lines.push(values.join(','))
  })

  return lines.join('\n')
}

/**
 * POST - Execute custom report
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify staff permissions
    const isStaff = await verifyStaffAuth(supabase, user.id)
    if (!isStaff) {
      return createErrorResponse(
        'forbidden',
        'Only staff can execute reports',
        403
      )
    }

    const body = await request.json()
    const {
      report_id,
      config,
      limit = 1000,
      offset = 0,
      export: exportFormat,
    } = body

    let reportConfig: any
    let reportName = 'Custom Report'

    // Get report configuration
    if (report_id) {
      // Load saved report
      const { data: savedReport, error: reportError } = await supabase
        .from('custom_reports')
        .select('*')
        .eq('id', report_id)
        .single()

      if (reportError || !savedReport) {
        return createErrorResponse(
          'not_found',
          'Report not found',
          404
        )
      }

      // Verify user has access to this report
      if (
        !(savedReport as any).is_public &&
        (savedReport as any).created_by_user_id !== user.id
      ) {
        return createErrorResponse(
          'forbidden',
          'You do not have access to this report',
          403
        )
      }

      reportConfig = {
        data_source: (savedReport as any).data_source,
        columns: (savedReport as any).columns,
        filters: (savedReport as any).filters,
        grouping: (savedReport as any).grouping || [],
        sorting: (savedReport as any).sorting || [],
      }
      reportName = (savedReport as any).report_name
    } else if (config) {
      // Use inline configuration
      reportConfig = config
      reportName = config.report_name || 'Ad-hoc Report'
    } else {
      return createErrorResponse(
        'invalid_request',
        'Either report_id or config must be provided',
        400
      )
    }

    // Validate report configuration
    if (!reportConfig.data_source) {
      return createErrorResponse(
        'invalid_config',
        'data_source is required',
        400
      )
    }

    if (!reportConfig.columns || reportConfig.columns.length === 0) {
      return createErrorResponse(
        'invalid_config',
        'At least one column is required',
        400
      )
    }

    // Execute report using database function
    const { data: results, error: execError } = await (supabase as any).rpc(
      'execute_custom_report',
      {
        report_config: reportConfig,
        limit_rows: Math.min(limit, 10000), // Max 10,000 rows
        offset_rows: offset,
      }
    )

    if (execError) {
      console.error('[Report Execution API] Execution error:', execError)

      // Log failed execution
      if (report_id) {
        await (supabase as any).from('report_execution_logs').insert({
          report_id,
          executed_by_user_id: user.id,
          execution_type: 'manual',
          status: 'failed',
          error_message: execError.message,
          execution_time_ms: Date.now() - startTime,
        })
      }

      return createErrorResponse(
        'execution_error',
        `Failed to execute report: ${execError.message}`,
        500
      )
    }

    const executionTime = Date.now() - startTime
    const rowCount = Array.isArray(results) ? results.length : 0

    // Log successful execution
    if (report_id) {
      await (supabase as any).from('report_execution_logs').insert({
        report_id,
        executed_by_user_id: user.id,
        execution_type: 'manual',
        status: 'completed',
        row_count: rowCount,
        execution_time_ms: executionTime,
      })

      // Update last_run_at
      await (supabase as any)
        .from('custom_reports')
        .update({ last_run_at: new Date().toISOString() })
        .eq('id', report_id)
    }

    // Handle export formats
    if (exportFormat === 'csv') {
      const csv = convertToCSV(results || [], reportConfig.columns)
      const filename = `${reportName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else if (exportFormat === 'json') {
      const filename = `${reportName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.json`

      return new NextResponse(JSON.stringify(results, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    // Return results with metadata
    return createSuccessResponse({
      report_name: reportName,
      data_source: reportConfig.data_source,
      results: results || [],
      metadata: {
        row_count: rowCount,
        execution_time_ms: executionTime,
        limit,
        offset,
        has_more: rowCount === limit, // If we got exactly limit rows, there might be more
      },
    })
  } catch (error) {
    console.error('[Report Execution API] Error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
