import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Data Sources Metadata API
 *
 * GET /api/reports/custom/data-sources
 * Returns available data sources and their queryable fields for report builder
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
 * GET - Fetch available data sources
 */
export async function GET() {
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
        'Only staff can access report builder',
        403
      )
    }

    // Fetch data sources metadata
    const { data: dataSources, error: dataSourcesError } = await supabase
      .from('report_data_sources')
      .select('*')
      .order('source_label', { ascending: true })

    if (dataSourcesError) {
      console.error('[Data Sources API] Error:', dataSourcesError)
      return createErrorResponse(
        'database_error',
        'Failed to fetch data sources',
        500
      )
    }

    // Format response
    const formattedDataSources = (dataSources || []).map((source: any) => ({
      source_name: source.source_name,
      source_label: source.source_label,
      base_table: source.base_table,
      description: source.description,
      fields: source.available_fields,
    }))

    return createSuccessResponse({
      data_sources: formattedDataSources,
      total: formattedDataSources.length,
    })
  } catch (error) {
    console.error('[Data Sources API] Error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
