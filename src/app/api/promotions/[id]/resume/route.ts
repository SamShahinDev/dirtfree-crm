import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'

/**
 * Resume Promotion API
 *
 * POST /api/promotions/[id]/resume - Resume a paused promotion
 *
 * Authentication: Required (staff only - admin, manager)
 */

const API_VERSION = 'v1'

function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
  )
}

async function checkUserRole(userId: string, requiredRoles: string[]): Promise<boolean> {
  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', requiredRoles)
    .single()
  return !error && !!data
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const hasAccess = await checkUserRole(user.id, ['admin', 'manager'])
    if (!hasAccess) {
      return createErrorResponse('forbidden', 'Insufficient permissions', 403)
    }

    const promotionId = params.id
    const serviceSupabase = getServiceSupabase()

    // Check current status
    const { data: promotion } = await serviceSupabase
      .from('promotions')
      .select('status, end_date')
      .eq('id', promotionId)
      .single()

    if (!promotion) {
      return createErrorResponse('not_found', 'Promotion not found', 404)
    }

    if ((promotion as any).status !== 'paused') {
      return createErrorResponse(
        'invalid_status',
        'Only paused promotions can be resumed',
        400
      )
    }

    // Check if promotion has expired
    const endDate = new Date((promotion as any).end_date)
    if (endDate < new Date()) {
      return createErrorResponse(
        'expired',
        'Cannot resume an expired promotion',
        400
      )
    }

    // Update status to active
    const { error: updateError } = await (serviceSupabase as any)
      .from('promotions')
      .update({ status: 'active' })
      .eq('id', promotionId)

    if (updateError) {
      console.error('[Promotions] Error resuming promotion:', updateError)
      return createErrorResponse('update_failed', 'Failed to resume promotion', 500)
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'promotion_resumed',
      resource_type: 'promotion',
      resource_id: promotionId,
    } as any)

    return createSuccessResponse({ message: 'Promotion resumed successfully' })
  } catch (error) {
    console.error('[Promotions] POST /api/promotions/[id]/resume error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500)
  }
}
