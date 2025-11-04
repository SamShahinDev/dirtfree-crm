import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Opportunity Statistics API
 *
 * GET /api/opportunities/stats
 *
 * Returns aggregated statistics for opportunities
 *
 * Query Parameters:
 * - days: Number of days to look back (default: 30)
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

  return userRole && ['admin', 'manager', 'dispatcher', 'technician'].includes(userRole.role)
}

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
        'Only staff members can view opportunity statistics',
        403
      )
    }

    const { searchParams } = new URL(request.url)
    const daysBack = parseInt(searchParams.get('days') || '30')

    // Use database function if available, otherwise calculate manually
    try {
      const { data: stats, error } = await (supabase as any).rpc('get_opportunity_stats', {
        days_back: daysBack,
      })

      if (error) throw error

      if (stats && (stats as any[]).length > 0) {
        return createSuccessResponse((stats as any[])[0])
      }
    } catch (error) {
      console.log('[Opportunity Stats] Database function not available, using manual calculation')
    }

    // Fallback: Manual calculation
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    const { data: opportunities, error: queryError } = await supabase
      .from('missed_opportunities')
      .select('*')
      .gte('created_at', cutoffDate.toISOString())

    if (queryError) {
      console.error('[Opportunity Stats] Query error:', queryError)
      return createErrorResponse('query_failed', 'Failed to fetch statistics', 500)
    }

    // Calculate statistics manually
    const opps = opportunities || []
    const totalOpps = opps.length
    const totalValue = opps.reduce((sum: number, opp: any) => sum + (opp.estimated_value || 0), 0)
    const convertedOpps = opps.filter((opp: any) => opp.converted)
    const convertedCount = convertedOpps.length
    const convertedValue = convertedOpps.reduce(
      (sum: number, opp: any) => sum + (opp.conversion_value || 0),
      0
    )
    const conversionRate =
      totalOpps > 0 ? ((convertedCount / totalOpps) * 100).toFixed(2) : 0
    const pendingOpps = opps.filter((opp: any) =>
      ['pending', 'offer_scheduled', 'follow_up_scheduled'].includes(opp.status)
    )
    const pendingCount = pendingOpps.length
    const pendingValue = pendingOpps.reduce(
      (sum: number, opp: any) => sum + (opp.estimated_value || 0),
      0
    )

    // Group by type
    const byType = opps.reduce((acc: any, opp: any) => {
      const type = opp.opportunity_type
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          value: 0,
          converted: 0,
        }
      }
      acc[type].count++
      acc[type].value += opp.estimated_value || 0
      if (opp.converted) acc[type].converted++
      return acc
    }, {})

    return createSuccessResponse({
      total_opportunities: totalOpps,
      total_value: totalValue,
      converted_count: convertedCount,
      converted_value: convertedValue,
      conversion_rate: parseFloat(conversionRate as string),
      pending_count: pendingCount,
      pending_value: pendingValue,
      by_type: byType,
    })
  } catch (error) {
    console.error('[Opportunity Stats] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
