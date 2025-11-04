import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

/**
 * POST /api/notifications/mark-read
 * Mark one or more notifications as read
 */
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { notificationId, markAll } = body

    if (markAll) {
      // Mark all notifications as read for this user
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
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('read', false)

      if (customer) {
        query = query
          .eq('recipient_type', 'customer')
          .eq('recipient_id', customer.id)
      } else if (staffUser) {
        query = query.or(
          `recipient_id.eq.${staffUser.id},recipient_type.eq.all_staff,recipient_role.eq.${staffUser.role}`
        )
      }

      const { error } = await query

      if (error) {
        console.error('Error marking all as read:', error)
        return NextResponse.json(
          { error: 'Failed to mark notifications as read' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } else if (notificationId) {
      // Mark single notification as read
      const { error } = await supabase
        .from('cross_platform_notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)

      if (error) {
        console.error('Error marking notification as read:', error)
        return NextResponse.json(
          { error: 'Failed to mark notification as read' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Either notificationId or markAll must be provided' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Unexpected error in POST /api/notifications/mark-read:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
