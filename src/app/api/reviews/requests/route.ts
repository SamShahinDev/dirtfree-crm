import { NextRequest, NextResponse } from 'next/server'
import { createClient, getServiceSupabase } from '@/lib/supabase/server'

/**
 * Review Requests List API
 *
 * GET /api/reviews/requests
 *
 * List all review requests with filtering options.
 *
 * Query Parameters:
 * - status: pending | portal_completed | google_completed | expired | opted_out
 * - customer_id: Filter by customer UUID
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 *
 * Features:
 * - Filter by status
 * - Search by customer
 * - Pagination support
 * - Returns customer and job details
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
        'Only staff members can view review requests',
        403
      )
    }

    const serviceSupabase = getServiceSupabase()
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const status = searchParams.get('status')
    const customerId = searchParams.get('customer_id')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = serviceSupabase
      .from('review_requests')
      .select(`
        id,
        customer_id,
        job_id,
        requested_at,
        request_method,
        portal_review_completed,
        portal_review_rating,
        portal_review_text,
        portal_review_submitted_at,
        google_review_requested,
        google_review_link_clicked,
        google_review_clicked_at,
        google_review_completed,
        google_review_completed_at,
        reminder_sent,
        reminder_sent_at,
        status,
        created_at,
        customers (
          id,
          full_name,
          email,
          phone
        ),
        jobs (
          id,
          service_type,
          completed_at,
          total_amount
        )
      `)
      .order('requested_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      if (status === 'portal_completed') {
        // Special case: filter by portal review completion
        query = query.eq('portal_review_completed', true)
      } else {
        query = query.eq('status', status)
      }
    }

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    const { data: requests, error: requestsError, count } = await query

    if (requestsError) {
      console.error('[Reviews API] Error fetching requests:', requestsError)
      return createErrorResponse(
        'fetch_failed',
        'Failed to fetch review requests',
        500
      )
    }

    // Get total count for pagination
    const { count: totalCount } = await serviceSupabase
      .from('review_requests')
      .select('*', { count: 'exact', head: true })

    return createSuccessResponse({
      requests: requests || [],
      pagination: {
        limit,
        offset,
        total: totalCount || 0,
        hasMore: (offset + limit) < (totalCount || 0),
      },
    })
  } catch (error) {
    console.error('[Reviews API] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
