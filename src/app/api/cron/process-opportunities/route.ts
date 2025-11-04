/**
 * Cron Job: Process Opportunity Offers
 *
 * Optimized with:
 * - Batch processing
 * - Priority-based queueing
 * - Job persistence
 * - Automatic retries
 *
 * Schedule: Every hour via Vercel Cron
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { jobQueue, calculatePriority } from '@/lib/jobs/job-queue'

export async function POST(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Fetch opportunities that need processing
    // Using efficient query with pagination
    const { data: opportunities, error } = await supabase
      .from('opportunities')
      .select('id, status, estimated_value, created_at, customers(tier)')
      .in('status', ['new', 'qualified', 'proposal'])
      .lt('next_action_date', new Date().toISOString())
      .order('estimated_value', { ascending: false })
      .limit(500)

    if (error) throw error

    if (!opportunities || opportunities.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No opportunities to process',
        queued: 0,
      })
    }

    // Calculate priority for each opportunity and add to job queue
    const jobPromises = opportunities.map((opp) => {
      const priority = calculatePriority({
        urgency: determineUrgency(opp),
        customerTier: opp.customers?.tier || 'standard',
        value: opp.estimated_value,
      })

      return jobQueue.addJob({
        type: 'process_opportunity_offer',
        payload: { opportunityId: opp.id },
        priority,
        maxRetries: 3,
        scheduledFor: new Date(),
      })
    })

    // Add all jobs in parallel
    const jobIds = await Promise.all(jobPromises)

    console.log(`Queued ${jobIds.length} opportunity processing jobs`)

    return NextResponse.json({
      success: true,
      message: `Queued ${jobIds.length} jobs for processing`,
      queued: jobIds.length,
      jobIds: jobIds.slice(0, 10), // Return first 10 job IDs
    })
  } catch (error) {
    console.error('Error in process-opportunities cron:', error)
    return NextResponse.json(
      {
        error: 'Failed to queue opportunity processing jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Determine urgency based on opportunity age and status
 */
function determineUrgency(opp: any): 'low' | 'medium' | 'high' | 'critical' {
  const ageInDays = Math.floor(
    (Date.now() - new Date(opp.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (opp.status === 'new' && ageInDays > 7) return 'critical'
  if (opp.status === 'qualified' && ageInDays > 3) return 'high'
  if (opp.status === 'proposal' && ageInDays > 5) return 'high'
  if (ageInDays > 2) return 'medium'

  return 'low'
}

// Configure route as edge function for better performance
export const runtime = 'edge'
export const dynamic = 'force-dynamic'
