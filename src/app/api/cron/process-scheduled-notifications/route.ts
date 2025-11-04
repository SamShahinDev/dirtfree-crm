import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { deliverNotification } from '@/lib/notifications/unified-service'

/**
 * POST /api/cron/process-scheduled-notifications
 * Process and send scheduled notifications that are due
 *
 * Cron schedule: */5 * * * * (every 5 minutes)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await getServerSupabase()

    // Get notifications that are scheduled and due for delivery
    const { data: notifications, error } = await supabase
      .from('cross_platform_notifications')
      .select('*')
      .lte('scheduled_for', new Date().toISOString())
      .is('sent_at', null)
      .order('scheduled_for', { ascending: true })

    if (error) {
      console.error('Failed to fetch scheduled notifications:', error)
      return NextResponse.json(
        { error: 'Failed to fetch scheduled notifications' },
        { status: 500 }
      )
    }

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No scheduled notifications to process',
      })
    }

    let processed = 0
    let failed = 0
    const errors: any[] = []

    // Process each notification
    for (const notification of notifications) {
      try {
        // Deliver the notification
        const deliveryResults = await deliverNotification(notification)

        // Update notification with delivery status
        await supabase
          .from('cross_platform_notifications')
          .update({
            sent_at: new Date().toISOString(),
            delivered_channels: deliveryResults.success,
            failed_channels: deliveryResults.failed,
          })
          .eq('id', notification.id)

        processed++
      } catch (error) {
        console.error(`Failed to process notification ${notification.id}:`, error)
        failed++
        errors.push({
          notification_id: notification.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        // Mark as sent with failed status to avoid reprocessing
        await supabase
          .from('cross_platform_notifications')
          .update({
            sent_at: new Date().toISOString(),
            delivered_channels: [],
            failed_channels: notification.channels.map((ch: string) => ({
              channel: ch,
              reason: error instanceof Error ? error.message : 'Unknown error',
            })),
          })
          .eq('id', notification.id)
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: notifications.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Unexpected error in process-scheduled-notifications:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// Allow GET for testing (can be disabled in production)
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'GET method not allowed in production' },
      { status: 405 }
    )
  }

  // For development, allow GET with the same logic
  return POST(req)
}
