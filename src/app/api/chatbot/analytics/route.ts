import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'

/**
 * Chatbot Analytics API
 *
 * GET /api/chatbot/analytics
 * - Returns comprehensive chatbot performance analytics
 * - Query params:
 *   - startDate: ISO date string (default: 30 days ago)
 *   - endDate: ISO date string (default: now)
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
  )
}

/**
 * Check if user has required role
 */
async function checkUserRole(
  userId: string,
  requiredRoles: string[]
): Promise<boolean> {
  const supabase = getServiceSupabase()

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return false
  }

  return requiredRoles.includes(data.role)
}

/**
 * GET - Get chatbot analytics
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Check if user has staff role
    const hasAccess = await checkUserRole(user.id, [
      'admin',
      'manager',
      'dispatcher',
      'technician',
    ])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Default to last 30 days
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    const serviceSupabase = getServiceSupabase()

    // Get overall analytics
    const { data: analytics, error: analyticsError } = await serviceSupabase.rpc(
      'get_chatbot_analytics',
      {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as any
    )

    if (analyticsError) {
      console.error('[Chatbot Analytics] Error fetching analytics:', analyticsError)
      return createErrorResponse(
        'database_error',
        'Failed to fetch analytics',
        500
      )
    }

    const analyticsData: any = analytics?.[0] || {}

    // Get confidence score distribution
    const { data: confidenceDistribution } = await serviceSupabase
      .from('chatbot_interactions')
      .select('confidence_score')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .not('confidence_score', 'is', null)

    // Calculate confidence distribution buckets
    const buckets = {
      '0-0.3': 0,
      '0.3-0.5': 0,
      '0.5-0.7': 0,
      '0.7-0.9': 0,
      '0.9-1.0': 0,
    }

    confidenceDistribution?.forEach((item: any) => {
      const score = parseFloat(item.confidence_score)
      if (score < 0.3) buckets['0-0.3']++
      else if (score < 0.5) buckets['0.3-0.5']++
      else if (score < 0.7) buckets['0.5-0.7']++
      else if (score < 0.9) buckets['0.7-0.9']++
      else buckets['0.9-1.0']++
    })

    // Get satisfaction ratings
    const { data: ratings } = await serviceSupabase
      .from('chatbot_sessions')
      .select('satisfaction_rating')
      .gte('started_at', start.toISOString())
      .lte('started_at', end.toISOString())
      .not('satisfaction_rating', 'is', null)

    const satisfactionData = {
      average:
        ratings && ratings.length > 0
          ? ratings.reduce(
              (sum: number, r: any) => sum + (r.satisfaction_rating || 0),
              0
            ) / ratings.length
          : 0,
      count: ratings?.length || 0,
      distribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    }

    ratings?.forEach((r: any) => {
      if (r.satisfaction_rating) {
        satisfactionData.distribution[
          r.satisfaction_rating as keyof typeof satisfactionData.distribution
        ]++
      }
    })

    // Get intent distribution over time (daily)
    const { data: dailyIntents } = await serviceSupabase
      .from('chatbot_interactions')
      .select('intent_detected, created_at')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .eq('message_type', 'customer_query')
      .not('intent_detected', 'is', null)
      .order('created_at', { ascending: true })

    // Group by date
    const dailyData: Record<string, Record<string, number>> = {}
    dailyIntents?.forEach((item: any) => {
      const date = new Date(item.created_at).toISOString().split('T')[0]
      if (!dailyData[date]) {
        dailyData[date] = {}
      }
      const intent = item.intent_detected
      dailyData[date][intent] = (dailyData[date][intent] || 0) + 1
    })

    // Get escalation details
    const { data: escalations } = await serviceSupabase
      .from('chatbot_interactions')
      .select('created_at, intent_detected, metadata')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .eq('escalated_to_human', true)
      .order('created_at', { ascending: false })
      .limit(10)

    const escalationDetails = escalations?.map((e: any) => ({
      timestamp: e.created_at,
      intent: e.intent_detected,
      reason: e.metadata?.escalation_reason || 'Unknown',
      isUrgent: e.metadata?.is_urgent || false,
    }))

    // Get response time statistics
    const { data: sessions } = await serviceSupabase
      .from('chatbot_sessions')
      .select('started_at, ended_at')
      .gte('started_at', start.toISOString())
      .lte('started_at', end.toISOString())
      .not('ended_at', 'is', null)

    const responseTimes = sessions
      ?.map((s: any) => {
        const duration =
          new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()
        return duration / 1000 // Convert to seconds
      })
      .filter((t) => t > 0)

    const avgResponseTime =
      responseTimes && responseTimes.length > 0
        ? responseTimes.reduce((sum: number, t: number) => sum + t, 0) /
          responseTimes.length
        : 0

    // Compile response
    const response = {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        totalSessions: parseInt(analyticsData.total_sessions || '0'),
        totalInteractions: parseInt(analyticsData.total_interactions || '0'),
        escalationRate: parseFloat(analyticsData.escalation_rate || '0'),
        avgConfidenceScore: parseFloat(
          analyticsData.avg_confidence_score || '0'
        ),
        avgSessionLength: analyticsData.avg_session_length || '0 seconds',
        avgResponseTime: Math.round(avgResponseTime),
      },
      intents: {
        topIntents: analyticsData.top_intents || [],
        distribution: dailyData,
      },
      confidence: {
        distribution: buckets,
        average: parseFloat(analyticsData.avg_confidence_score || '0'),
      },
      satisfaction: satisfactionData,
      escalations: {
        rate: parseFloat(analyticsData.escalation_rate || '0'),
        recent: escalationDetails || [],
      },
    }

    return createSuccessResponse(response)
  } catch (error) {
    console.error('[Chatbot Analytics] GET /api/chatbot/analytics error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
