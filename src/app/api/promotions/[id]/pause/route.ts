import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'

/**
 * Pause Promotion API
 *
 * POST /api/promotions/[id]/pause - Pause an active promotion
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
      .select('status')
      .eq('id', promotionId)
      .single()

    if (!promotion) {
      return createErrorResponse('not_found', 'Promotion not found', 404)
    }

    if ((promotion as any).status !== 'active') {
      return createErrorResponse(
        'invalid_status',
        'Only active promotions can be paused',
        400
      )
    }

    // Update status to paused
    const { error: updateError } = await (serviceSupabase as any)
      .from('promotions')
      .update({ status: 'paused' })
      .eq('id', promotionId)

    if (updateError) {
      console.error('[Promotions] Error pausing promotion:', updateError)
      return createErrorResponse('update_failed', 'Failed to pause promotion', 500)
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'promotion_paused',
      resource_type: 'promotion',
      resource_id: promotionId,
    } as any)

    return createSuccessResponse({ message: 'Promotion paused successfully' })
  } catch (error) {
    console.error('[Promotions] POST /api/promotions/[id]/pause error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500)
  }
}
