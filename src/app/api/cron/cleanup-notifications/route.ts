import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

/**
 * POST /api/cron/cleanup-notifications
 * Clean up old read notifications and expired notifications
 *
 * Cron schedule: 0 2 * * * (daily at 2 AM)
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

    // Delete read notifications older than 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { error: deleteOldError, count: deletedOldCount } = await supabase
      .from('cross_platform_notifications')
      .delete({ count: 'exact' })
      .eq('read', true)
      .lt('created_at', ninetyDaysAgo.toISOString())

    if (deleteOldError) {
      console.error('Failed to delete old notifications:', deleteOldError)
    }

    // Delete expired notifications
    const { error: deleteExpiredError, count: deletedExpiredCount } =
      await supabase
        .from('cross_platform_notifications')
        .delete({ count: 'exact' })
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString())

    if (deleteExpiredError) {
      console.error('Failed to delete expired notifications:', deleteExpiredError)
    }

    const totalDeleted =
      (deletedOldCount || 0) + (deletedExpiredCount || 0)

    return NextResponse.json({
      success: true,
      deletedOld: deletedOldCount || 0,
      deletedExpired: deletedExpiredCount || 0,
      totalDeleted,
    })
  } catch (error) {
    console.error('Unexpected error in cleanup-notifications:', error)
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
