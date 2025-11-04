import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Opportunities Analytics API
 *
 * GET /api/opportunities/analytics
 *
 * Returns comprehensive analytics for opportunity conversion tracking
 *
 * Query Parameters:
 * - type: Analytics type (overview, by_type, by_staff, funnel, time, offers, trends)
 * - startDate: Start date for filtering (ISO format)
 * - endDate: End date for filtering (ISO format)
 * - staffId: Filter by specific staff member
 * - opportunityType: Filter by opportunity type
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

  return userRole && ['admin', 'manager', 'dispatcher'].includes(userRole.role)
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
        'Only staff members can view analytics',
        403
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'overview'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const staffId = searchParams.get('staffId')
    const opportunityType = searchParams.get('opportunityType')

    let analyticsData: any = {}

    switch (type) {
      case 'overview':
        analyticsData = await getOverviewAnalytics(supabase, startDate, endDate)
        break

      case 'by_type':
        analyticsData = await getAnalyticsByType(supabase, startDate, endDate)
        break

      case 'by_staff':
        analyticsData = await getAnalyticsByStaff(supabase, startDate, endDate, staffId)
        break

      case 'funnel':
        analyticsData = await getConversionFunnel(supabase, startDate, endDate)
        break

      case 'time':
        analyticsData = await getTimeAnalytics(supabase)
        break

      case 'offers':
        analyticsData = await getOfferEffectiveness(supabase)
        break

      case 'trends':
        analyticsData = await getMonthlyTrends(supabase)
        break

      default:
        return createErrorResponse('invalid_type', 'Invalid analytics type', 400)
    }

    return createSuccessResponse(analyticsData)
  } catch (error) {
    console.error('[Opportunity Analytics] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

async function getOverviewAnalytics(
  supabase: any,
  startDate?: string | null,
  endDate?: string | null
) {
  let query = supabase.from('missed_opportunities').select('*')

  if (startDate) {
    query = query.gte('created_at', startDate)
  }
  if (endDate) {
    query = query.lte('created_at', endDate)
  }

  const { data: opportunities } = await query

  const opps = opportunities || []

  return {
    totalOpportunities: opps.length,
    totalConverted: opps.filter((o: any) => o.converted).length,
    totalRevenue: opps.reduce((sum: number, o: any) => sum + (o.conversion_value || 0), 0),
    averageConversionValue: opps.filter((o: any) => o.converted).length > 0
      ? opps.reduce((sum: number, o: any) => sum + (o.conversion_value || 0), 0) /
        opps.filter((o: any) => o.converted).length
      : 0,
    conversionRate: opps.length > 0
      ? (opps.filter((o: any) => o.converted).length / opps.length) * 100
      : 0,
    averageDaysToConvert: calculateAverageDaysToConvert(opps),
  }
}

async function getAnalyticsByType(
  supabase: any,
  startDate?: string | null,
  endDate?: string | null
) {
  try {
    const { data, error } = await supabase.from('opportunity_analytics').select('*')

    if (error) {
      console.error('Analytics by type error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Analytics by type error:', error)
    return []
  }
}

async function getAnalyticsByStaff(
  supabase: any,
  startDate?: string | null,
  endDate?: string | null,
  staffId?: string | null
) {
  try {
    let query = supabase.from('opportunity_staff_performance').select('*')

    if (staffId) {
      query = query.eq('staff_id', staffId)
    }

    const { data, error } = await query.order('total_revenue', { ascending: false })

    if (error) {
      console.error('Analytics by staff error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Analytics by staff error:', error)
    return []
  }
}

async function getConversionFunnel(
  supabase: any,
  startDate?: string | null,
  endDate?: string | null
) {
  try {
    const { data, error } = await supabase.from('opportunity_conversion_funnel').select('*')

    if (error) {
      console.error('Conversion funnel error:', error)
      return null
    }

    return data && data.length > 0 ? data[0] : null
  } catch (error) {
    console.error('Conversion funnel error:', error)
    return null
  }
}

async function getTimeAnalytics(supabase: any) {
  try {
    const { data, error } = await (supabase as any).rpc('get_opportunity_time_analytics', {
      days_back: 90,
    })

    if (error) {
      console.error('Time analytics error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Time analytics error:', error)
    return []
  }
}

async function getOfferEffectiveness(supabase: any) {
  try {
    const { data, error } = await (supabase as any).rpc('get_offer_effectiveness_analytics')

    if (error) {
      console.error('Offer effectiveness error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Offer effectiveness error:', error)
    return []
  }
}

async function getMonthlyTrends(supabase: any) {
  try {
    const { data, error } = await (supabase as any).rpc('get_opportunity_monthly_trends', {
      months_back: 12,
    })

    if (error) {
      console.error('Monthly trends error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Monthly trends error:', error)
    return []
  }
}

function calculateAverageDaysToConvert(opportunities: any[]): number {
  const convertedOpps = opportunities.filter(
    (o) => o.converted && o.conversion_date && o.created_at
  )

  if (convertedOpps.length === 0) return 0

  const totalDays = convertedOpps.reduce((sum, o) => {
    const created = new Date(o.created_at).getTime()
    const converted = new Date(o.conversion_date).getTime()
    const days = (converted - created) / (1000 * 60 * 60 * 24)
    return sum + days
  }, 0)

  return Math.round(totalDays / convertedOpps.length)
}
