/**
 * Cron Job: Cleanup Old Completed Jobs
 *
 * Removes completed background jobs older than specified days
 * to keep the database clean and performant.
 *
 * Schedule: Daily at midnight
 */

import { NextResponse } from 'next/server'
import { jobQueue } from '@/lib/jobs/job-queue'

export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Queue cleanup job
    const jobId = await jobQueue.addJob({
      type: 'cleanup_old_data',
      payload: { days: 30 }, // Keep last 30 days
      priority: 3, // Lower priority
      maxRetries: 2,
      scheduledFor: new Date(),
    })

    return NextResponse.json({
      success: true,
      message: 'Cleanup job queued',
      jobId,
    })
  } catch (error) {
    console.error('Error in cleanup-old-jobs cron:', error)
    return NextResponse.json(
      {
        error: 'Failed to queue cleanup job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
