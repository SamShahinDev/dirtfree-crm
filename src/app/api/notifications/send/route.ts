import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import {
  sendNotification,
  sendNotificationFromTemplate,
  type NotificationPayload,
} from '@/lib/notifications/unified-service'

/**
 * POST /api/notifications/send
 * Send a notification via the unified notification system
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

    // Check user role - only admins and managers can send notifications
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData || !['admin', 'manager'].includes(userData.role)) {
      return NextResponse.json(
        {
          error:
            'Insufficient permissions. Only admins and managers can send notifications.',
        },
        { status: 403 }
      )
    }

    const body = await req.json()

    // Check if using template or direct notification
    if (body.templateKey) {
      // Send using template
      const result = await sendNotificationFromTemplate(
        body.templateKey,
        body.recipientType,
        body.recipientId,
        body.variables || {},
        {
          recipientRole: body.recipientRole,
          channels: body.channels,
          priority: body.priority,
          actionUrl: body.actionUrl,
          actionLabel: body.actionLabel,
          scheduledFor: body.scheduledFor
            ? new Date(body.scheduledFor)
            : undefined,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        }
      )

      return NextResponse.json({ success: true, ...result })
    } else {
      // Send direct notification
      const payload: NotificationPayload = {
        recipientType: body.recipientType,
        recipientId: body.recipientId,
        recipientRole: body.recipientRole,
        title: body.title,
        message: body.message,
        notificationType: body.notificationType,
        priority: body.priority || 'normal',
        channels: body.channels || ['portal'],
        emailSubject: body.emailSubject,
        emailBody: body.emailBody,
        smsBody: body.smsBody,
        actionUrl: body.actionUrl,
        actionLabel: body.actionLabel,
        metadata: body.metadata,
        relatedEntityType: body.relatedEntityType,
        relatedEntityId: body.relatedEntityId,
        scheduledFor: body.scheduledFor
          ? new Date(body.scheduledFor)
          : undefined,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      }

      const result = await sendNotification(payload)

      return NextResponse.json({ success: true, ...result })
    }
  } catch (error) {
    console.error('Notification send failed:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send notification',
      },
      { status: 500 }
    )
  }
}
