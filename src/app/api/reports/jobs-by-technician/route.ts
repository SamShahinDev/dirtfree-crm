import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { format } from 'date-fns'

import { getServerSupabase } from '@/lib/supabase/server'
import { getUser, requireAuth } from '@/lib/auth/server'

// Validation schema
const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format'),
  zones: z.string().optional().transform(val => val ? val.split(',').filter(Boolean) : undefined)
})

// CSV escape function
function escapeCsvValue(value: any): string {
  if (value == null) return ''

  const stringValue = String(value)
  // Escape quotes by doubling them and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

// Format number for CSV
function formatNumberForCsv(value: number | null, decimals = 0): string {
  if (value == null) return '0'
  return value.toFixed(decimals)
}

// Format rating for CSV
function formatRatingForCsv(rating: number | null): string {
  if (rating == null) return 'N/A'
  return `${rating.toFixed(1)}/5`
}

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const { user, role } = await requireAuth()

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      zones: searchParams.get('zones')
    }

    const { from, to, zones } = QuerySchema.parse(queryParams)

    const supabase = getServerSupabase()

    // Get all technicians first
    let technicianQuery = supabase
      .from('user_profiles')
      .select(`
        user_id,
        display_name,
        zone,
        users!inner(id, name)
      `)
      .in('role', ['technician'])

    if (role === 'technician') {
      technicianQuery = technicianQuery.eq('user_id', user.id)
    }

    if (zones && zones.length > 0) {
      technicianQuery = technicianQuery.in('zone', zones)
    }

    const { data: technicians, error: techError } = await technicianQuery

    if (techError) {
      console.error('Database error:', techError)
      return NextResponse.json(
        { error: 'Failed to fetch technicians data' },
        { status: 500 }
      )
    }

    // Collect technician stats
    const technicianStats = []

    for (const tech of technicians || []) {
      // Count scheduled jobs
      const { count: scheduledCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('technician_id', tech.user_id)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)

      // Count completed jobs
      const { count: completedCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('technician_id', tech.user_id)
        .eq('status', 'completed')
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)

      // Count cancellations
      const { count: cancelledCount } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('technician_id', tech.user_id)
        .eq('status', 'cancelled')
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)

      // Get average rating (if satisfaction surveys exist)
      const { data: jobIds } = await supabase
        .from('jobs')
        .select('id')
        .eq('technician_id', tech.user_id)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)

      let avgRating = null
      if (jobIds && jobIds.length > 0) {
        const jobIdList = jobIds.map(job => job.id)

        const { data: avgRatingData } = await supabase
          .from('satisfaction_surveys')
          .select('score')
          .in('job_id', jobIdList)
          .not('score', 'is', null)

        if (avgRatingData && avgRatingData.length > 0) {
          const scores = avgRatingData.map(s => s.score)
          avgRating = scores.reduce((sum, score) => sum + score, 0) / scores.length
        }
      }

      // Calculate completion rate
      const completionRate = scheduledCount && scheduledCount > 0
        ? ((completedCount || 0) / scheduledCount * 100)
        : 0

      // Calculate cancellation rate
      const cancellationRate = scheduledCount && scheduledCount > 0
        ? ((cancelledCount || 0) / scheduledCount * 100)
        : 0

      technicianStats.push({
        technicianName: tech.users?.name || tech.display_name || 'Unknown',
        zone: tech.zone || 'Unassigned',
        jobsScheduled: scheduledCount || 0,
        jobsCompleted: completedCount || 0,
        jobsCancelled: cancelledCount || 0,
        completionRate,
        cancellationRate,
        avgRating
      })
    }

    // Create streaming response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        // CSV headers
        const headers = [
          'Technician',
          'Zone',
          'Jobs Scheduled',
          'Jobs Completed',
          'Jobs Cancelled',
          'Completion Rate (%)',
          'Cancellation Rate (%)',
          'Average Rating'
        ]

        const headerRow = headers.map(h => escapeCsvValue(h)).join(',') + '\r\n'
        controller.enqueue(encoder.encode(headerRow))

        // Stream data rows
        for (const stats of technicianStats) {
          const row = [
            stats.technicianName,
            stats.zone,
            formatNumberForCsv(stats.jobsScheduled),
            formatNumberForCsv(stats.jobsCompleted),
            formatNumberForCsv(stats.jobsCancelled),
            formatNumberForCsv(stats.completionRate, 1),
            formatNumberForCsv(stats.cancellationRate, 1),
            formatRatingForCsv(stats.avgRating)
          ]

          const csvRow = row.map(value => escapeCsvValue(value)).join(',') + '\r\n'
          controller.enqueue(encoder.encode(csvRow))
        }

        // Add summary row
        const totalScheduled = technicianStats.reduce((sum, stats) => sum + stats.jobsScheduled, 0)
        const totalCompleted = technicianStats.reduce((sum, stats) => sum + stats.jobsCompleted, 0)
        const totalCancelled = technicianStats.reduce((sum, stats) => sum + stats.jobsCancelled, 0)
        const overallCompletionRate = totalScheduled > 0 ? (totalCompleted / totalScheduled * 100) : 0
        const overallCancellationRate = totalScheduled > 0 ? (totalCancelled / totalScheduled * 100) : 0

        // Calculate weighted average rating
        const ratingsWithWeights = technicianStats
          .filter(stats => stats.avgRating !== null && stats.jobsCompleted > 0)
          .map(stats => ({ rating: stats.avgRating!, weight: stats.jobsCompleted }))

        const weightedAvgRating = ratingsWithWeights.length > 0
          ? ratingsWithWeights.reduce((sum, item) => sum + (item.rating * item.weight), 0) /
            ratingsWithWeights.reduce((sum, item) => sum + item.weight, 0)
          : null

        // Add separator line
        controller.enqueue(encoder.encode('\r\n'))

        // Add summary row
        const summaryRow = [
          'TOTALS',
          `${technicianStats.length} Technicians`,
          formatNumberForCsv(totalScheduled),
          formatNumberForCsv(totalCompleted),
          formatNumberForCsv(totalCancelled),
          formatNumberForCsv(overallCompletionRate, 1),
          formatNumberForCsv(overallCancellationRate, 1),
          formatRatingForCsv(weightedAvgRating)
        ]

        const csvSummaryRow = summaryRow.map(value => escapeCsvValue(value)).join(',') + '\r\n'
        controller.enqueue(encoder.encode(csvSummaryRow))

        controller.close()
      }
    })

    // Generate filename with current date
    const filename = `jobs_by_technician_${format(new Date(), 'yyyy-MM-dd')}.csv`

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Jobs by technician CSV export error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}