import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/notifications
 * Retrieve notifications for the current user
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await getServerSupabase()

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const unreadOnly = searchParams.get('unread_only') === 'true'
    const notificationType = searchParams.get('type')

    // Check if user is a customer or staff
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', user.email)
      .single()

    const { data: staffUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single()

    let query = supabase
      .from('cross_platform_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (customer) {
      // Customer notifications
      query = query
        .eq('recipient_type', 'customer')
        .eq('recipient_id', customer.id)
    } else if (staffUser) {
      // Staff notifications
      query = query.or(
        `recipient_id.eq.${staffUser.id},recipient_type.eq.all_staff,recipient_role.eq.${staffUser.role}`
      )
    } else {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    if (notificationType) {
      query = query.eq('notification_type', notificationType)
    }

    // Filter out expired notifications
    query = query.or('expires_at.is.null,expires_at.gt.now()')

    const { data: notifications, error } = await query

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    // Get unread count
    const { count: unreadCount } = await supabase
      .from('cross_platform_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
      .or(
        customer
          ? `recipient_type.eq.customer,recipient_id.eq.${customer.id}`
          : `recipient_id.eq.${staffUser?.id},recipient_type.eq.all_staff,recipient_role.eq.${staffUser?.role}`
      )

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount: unreadCount || 0,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/notifications:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
