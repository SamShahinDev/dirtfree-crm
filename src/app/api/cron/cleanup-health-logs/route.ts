import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'

/**
 * POST /api/cron/cleanup-health-logs
 * Clean up old integration health logs to prevent database bloat
 * Keeps logs for the last 90 days
 *
 * Cron schedule: 0 3 * * * (daily at 3 AM)
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

    // Calculate cutoff date (90 days ago)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    // Delete old health logs
    const { error: deleteError, count: deletedCount } = await supabase
      .from('integration_health_log')
      .delete({ count: 'exact' })
      .lt('check_time', ninetyDaysAgo.toISOString())

    if (deleteError) {
      console.error('Failed to delete old health logs:', deleteError)
      return NextResponse.json(
        { error: 'Failed to cleanup health logs' },
        { status: 500 }
      )
    }

    console.log(
      `Cleaned up ${deletedCount} old integration health logs (older than 90 days)`
    )

    // Get current log count and oldest log
    const { data: stats } = await supabase
      .from('integration_health_log')
      .select('check_time')
      .order('check_time', { ascending: true })
      .limit(1)
      .single()

    const { count: remainingCount } = await supabase
      .from('integration_health_log')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      deleted: deletedCount || 0,
      remaining: remainingCount || 0,
      oldestLog: stats?.check_time || null,
      retentionDays: 90,
    })
  } catch (error) {
    console.error('Unexpected error in cleanup-health-logs:', error)
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

// Allow GET for testing in development
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
