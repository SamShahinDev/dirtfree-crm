/**
 * Cron Jobs List Endpoint
 *
 * Returns all registered cron jobs and their configurations.
 * Protected by cron secret authentication.
 */

import { NextResponse } from 'next/server'
import { cronJobs } from '@/lib/cron/registry'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Return all jobs with their configurations
    const jobs = cronJobs.map((job) => ({
      name: job.name,
      schedule: job.schedule,
      enabled: job.enabled,
      timeout: job.timeout,
      retries: job.retries,
      description: job.description,
      category: job.category,
    }))

    return NextResponse.json({
      total: jobs.length,
      jobs,
      categories: {
        opportunities: jobs.filter((j) => j.category === 'opportunities').length,
        promotions: jobs.filter((j) => j.category === 'promotions').length,
        reviews: jobs.filter((j) => j.category === 'reviews').length,
        loyalty: jobs.filter((j) => j.category === 'loyalty').length,
        analytics: jobs.filter((j) => j.category === 'analytics').length,
        monitoring: jobs.filter((j) => j.category === 'monitoring').length,
        cleanup: jobs.filter((j) => j.category === 'cleanup').length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
