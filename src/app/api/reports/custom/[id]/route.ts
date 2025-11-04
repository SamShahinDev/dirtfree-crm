import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Individual Report API
 *
 * GET /api/reports/custom/[id]
 * Get a specific report template with full configuration
 *
 * PUT /api/reports/custom/[id]
 * Update a report template
 *
 * DELETE /api/reports/custom/[id]
 * Delete a report template
 *
 * Authentication: Required (staff only, owner or public)
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
 * GET - Fetch specific report template
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
        'Only staff can access reports',
        403
      )
    }

    // Fetch report
    const { data: report, error: reportError } = await supabase
      .from('custom_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (reportError || !report) {
      return createErrorResponse('not_found', 'Report not found', 404)
    }

    // Verify access
    if (
      !(report as any).is_public &&
      (report as any).created_by_user_id !== user.id
    ) {
      return createErrorResponse(
        'forbidden',
        'You do not have access to this report',
        403
      )
    }

    // Get creator information
    const { data: creator } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('id', (report as any).created_by_user_id)
      .single()

    // Get execution history
    const { data: execHistory } = await supabase
      .from('report_execution_logs')
      .select('*')
      .eq('report_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    // Format response
    const formattedReport = {
      id: (report as any).id,
      report_name: (report as any).report_name,
      report_description: (report as any).report_description,
      data_source: (report as any).data_source,
      columns: (report as any).columns,
      filters: (report as any).filters,
      grouping: (report as any).grouping,
      sorting: (report as any).sorting,
      visualization_type: (report as any).visualization_type,
      visualization_config: (report as any).visualization_config,
      schedule: (report as any).schedule,
      is_public: (report as any).is_public,
      is_active: (report as any).is_active,
      last_run_at: (report as any).last_run_at,
      created_at: (report as any).created_at,
      updated_at: (report as any).updated_at,
      created_by: creator
        ? {
            id: (creator as any).id,
            name: `${(creator as any).first_name} ${(creator as any).last_name}`,
            email: (creator as any).email,
          }
        : null,
      is_owner: (report as any).created_by_user_id === user.id,
      execution_history: (execHistory || []).map((exec: any) => ({
        id: exec.id,
        execution_type: exec.execution_type,
        status: exec.status,
        row_count: exec.row_count,
        execution_time_ms: exec.execution_time_ms,
        error_message: exec.error_message,
        created_at: exec.created_at,
      })),
    }

    return createSuccessResponse({ report: formattedReport })
  } catch (error) {
    console.error('[Report API] Error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * PUT - Update report template
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
        'Only staff can update reports',
        403
      )
    }

    // Fetch existing report
    const { data: existingReport, error: fetchError } = await supabase
      .from('custom_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingReport) {
      return createErrorResponse('not_found', 'Report not found', 404)
    }

    // Verify ownership
    if ((existingReport as any).created_by_user_id !== user.id) {
      return createErrorResponse(
        'forbidden',
        'You can only update your own reports',
        403
      )
    }

    const body = await request.json()
    const {
      report_name,
      report_description,
      data_source,
      columns,
      filters,
      grouping,
      sorting,
      visualization_type,
      visualization_config,
      schedule,
      is_public,
      is_active,
    } = body

    // Build update object (only update provided fields)
    const updates: any = {}

    if (report_name !== undefined) updates.report_name = report_name
    if (report_description !== undefined) updates.report_description = report_description
    if (data_source !== undefined) updates.data_source = data_source
    if (columns !== undefined) updates.columns = JSON.stringify(columns)
    if (filters !== undefined) updates.filters = JSON.stringify(filters)
    if (grouping !== undefined) updates.grouping = JSON.stringify(grouping)
    if (sorting !== undefined) updates.sorting = JSON.stringify(sorting)
    if (visualization_type !== undefined) updates.visualization_type = visualization_type
    if (visualization_config !== undefined)
      updates.visualization_config = JSON.stringify(visualization_config)
    if (schedule !== undefined) updates.schedule = schedule ? JSON.stringify(schedule) : null
    if (is_public !== undefined) updates.is_public = is_public
    if (is_active !== undefined) updates.is_active = is_active

    // Update report
    const { data: updatedReport, error: updateError } = await (supabase as any)
      .from('custom_reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[Report API] Update error:', updateError)
      return createErrorResponse(
        'database_error',
        'Failed to update report',
        500
      )
    }

    return createSuccessResponse({
      report: updatedReport,
      message: 'Report updated successfully',
    })
  } catch (error) {
    console.error('[Report API] Error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * DELETE - Delete report template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
        'Only staff can delete reports',
        403
      )
    }

    // Fetch existing report
    const { data: existingReport, error: fetchError } = await supabase
      .from('custom_reports')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingReport) {
      return createErrorResponse('not_found', 'Report not found', 404)
    }

    // Verify ownership
    if ((existingReport as any).created_by_user_id !== user.id) {
      return createErrorResponse(
        'forbidden',
        'You can only delete your own reports',
        403
      )
    }

    // Delete report (cascade will delete execution logs)
    const { error: deleteError } = await supabase
      .from('custom_reports')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Report API] Delete error:', deleteError)
      return createErrorResponse(
        'database_error',
        'Failed to delete report',
        500
      )
    }

    return createSuccessResponse({
      message: 'Report deleted successfully',
    })
  } catch (error) {
    console.error('[Report API] Error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
