import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Report Templates API
 *
 * GET /api/reports/custom/templates
 * List saved report templates
 *
 * Query params:
 * - is_public: 'true' | 'false' (filter by public/private)
 * - data_source: filter by data source
 *
 * POST /api/reports/custom/templates
 * Create a new report template
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
 * GET - List saved report templates
 */
export async function GET(request: NextRequest) {
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
        'Only staff can access report templates',
        403
      )
    }

    const { searchParams } = new URL(request.url)
    const isPublicFilter = searchParams.get('is_public')
    const dataSourceFilter = searchParams.get('data_source')

    // Build query
    let query = supabase
      .from('custom_reports')
      .select(`
        id,
        report_name,
        report_description,
        data_source,
        visualization_type,
        schedule,
        created_by_user_id,
        is_public,
        is_active,
        last_run_at,
        created_at,
        updated_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    // Apply filters
    if (isPublicFilter === 'true') {
      query = query.eq('is_public', true)
    } else if (isPublicFilter === 'false') {
      query = query.eq('is_public', false).eq('created_by_user_id', user.id)
    } else {
      // Show both public reports and user's own reports
      query = query.or(`is_public.eq.true,created_by_user_id.eq.${user.id}`)
    }

    if (dataSourceFilter) {
      query = query.eq('data_source', dataSourceFilter)
    }

    const { data: templates, error: templatesError } = await query

    if (templatesError) {
      console.error('[Templates API] Error:', templatesError)
      return createErrorResponse(
        'database_error',
        'Failed to fetch templates',
        500
      )
    }

    // Get creator information for templates
    const creatorIds = [...new Set((templates || []).map((t: any) => t.created_by_user_id))]
    const { data: creators } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', creatorIds)

    const creatorsMap = new Map(
      (creators || []).map((c: any) => [c.id, c])
    )

    // Format response
    const formattedTemplates = (templates || []).map((template: any) => {
      const creator = creatorsMap.get(template.created_by_user_id)
      return {
        id: template.id,
        report_name: template.report_name,
        report_description: template.report_description,
        data_source: template.data_source,
        visualization_type: template.visualization_type,
        schedule: template.schedule,
        is_public: template.is_public,
        is_scheduled: template.schedule && (template.schedule as any).enabled === true,
        last_run_at: template.last_run_at,
        created_at: template.created_at,
        updated_at: template.updated_at,
        created_by: creator
          ? {
              id: creator.id,
              name: `${creator.first_name} ${creator.last_name}`,
              email: creator.email,
            }
          : null,
        is_owner: template.created_by_user_id === user.id,
      }
    })

    return createSuccessResponse({
      templates: formattedTemplates,
      total: formattedTemplates.length,
    })
  } catch (error) {
    console.error('[Templates API] Error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Create new report template
 */
export async function POST(request: NextRequest) {
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
        'Only staff can create report templates',
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
    } = body

    // Validate required fields
    if (!report_name || !data_source || !columns || columns.length === 0) {
      return createErrorResponse(
        'invalid_request',
        'report_name, data_source, and columns are required',
        400
      )
    }

    // Validate data source
    const validDataSources = [
      'customers',
      'jobs',
      'invoices',
      'payments',
      'promotions',
      'messages',
      'reviews',
      'loyalty',
    ]
    if (!validDataSources.includes(data_source)) {
      return createErrorResponse(
        'invalid_data_source',
        `data_source must be one of: ${validDataSources.join(', ')}`,
        400
      )
    }

    // Create report template
    const { data: newReport, error: createError } = await (supabase as any)
      .from('custom_reports')
      .insert({
        report_name,
        report_description: report_description || null,
        data_source,
        columns: JSON.stringify(columns),
        filters: JSON.stringify(filters || []),
        grouping: JSON.stringify(grouping || []),
        sorting: JSON.stringify(sorting || []),
        visualization_type: visualization_type || 'table',
        visualization_config: JSON.stringify(visualization_config || {}),
        schedule: schedule ? JSON.stringify(schedule) : null,
        is_public: is_public || false,
        created_by_user_id: user.id,
      })
      .select()
      .single()

    if (createError) {
      console.error('[Templates API] Create error:', createError)
      return createErrorResponse(
        'database_error',
        'Failed to create report template',
        500
      )
    }

    return createSuccessResponse({
      report: newReport,
      message: 'Report template created successfully',
    })
  } catch (error) {
    console.error('[Templates API] Error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
