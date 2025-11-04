import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { format } from 'date-fns'

import { getServerSupabase } from '@/lib/supabase/server'
import { getUser, requireAuth } from '@/lib/auth/server'
import { log, createRequestContext, createUserContext } from '@/lib/obs/log'
import { timing } from '@/lib/obs/timing'

// Validation schema
const QuerySchema = z.object({
  horizonDays: z.string().transform(val => parseInt(val, 10)).refine(val => val >= 1 && val <= 365, {
    message: 'Horizon days must be between 1 and 365'
  })
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

// Format phone number for CSV
function formatPhoneForCsv(phone: string | null): string {
  if (!phone) return ''
  // Remove +1 and format as (xxx) xxx-xxxx
  return phone.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
}

// Format date for CSV
function formatDateForCsv(date: string | null): string {
  if (!date) return ''
  try {
    return format(new Date(date), 'MM/dd/yyyy')
  } catch {
    return date
  }
}

// Format reminder type for display
function formatReminderType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Format status for display
function formatStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request)
  const requestLogger = log.child(requestContext)

  try {
    // Auth check
    const { user, role } = await timing.operation('auth', () => requireAuth())
    const userContext = createUserContext(user.id)
    const logger = requestLogger.child(userContext)

    logger.info('Upcoming reminders CSV export requested', { role })

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      horizonDays: searchParams.get('horizonDays') || '7'
    }

    const { horizonDays } = QuerySchema.parse(queryParams)
    logger.debug('Query parameters validated', { horizonDays })

    const supabase = getServerSupabase()

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + horizonDays)

    let query = supabase
      .from('reminders')
      .select(`
        id,
        scheduled_date,
        title,
        type,
        status,
        origin,
        assigned_to,
        created_at,
        customers(
          name,
          phone_e164
        ),
        assignedTo:users!assigned_to(
          name
        )
      `)
      .gte('scheduled_date', new Date().toISOString().split('T')[0])
      .lte('scheduled_date', endDate.toISOString().split('T')[0])
      .in('status', ['pending', 'snoozed']) // Only show active reminders
      .order('scheduled_date', { ascending: true })

    // Apply RLS-aware filtering based on role
    if (role === 'technician') {
      // Technicians can only see reminders assigned to them or related to their jobs
      query = query.or(`assigned_to.eq.${user.id},assigned_to.is.null`)
    }

    const { data, error } = await timing.db('fetch-upcoming-reminders', () => query, {
      horizonDays,
      role,
      userId: user.id
    })

    if (error) {
      logger.dbError('fetch-upcoming-reminders', error, { horizonDays, role })
      return NextResponse.json(
        { error: 'Failed to fetch reminders data' },
        { status: 500 }
      )
    }

    logger.info('Reminders data fetched successfully', {
      count: data?.length || 0,
      horizonDays
    })

    // Create streaming response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        // CSV headers
        const headers = [
          'Reminder ID',
          'Scheduled Date',
          'Title',
          'Type',
          'Customer Name',
          'Customer Phone',
          'Assigned To',
          'Status',
          'Origin',
          'Created Date'
        ]

        const headerRow = headers.map(h => escapeCsvValue(h)).join(',') + '\r\n'
        controller.enqueue(encoder.encode(headerRow))

        // Group reminders by type and status for summary
        const typeGroups: Record<string, number> = {}
        const statusGroups: Record<string, number> = {}

        // Stream data rows
        for (const reminder of data || []) {
          // Count for summary
          const type = reminder.type || 'unknown'
          const status = reminder.status || 'unknown'
          typeGroups[type] = (typeGroups[type] || 0) + 1
          statusGroups[status] = (statusGroups[status] || 0) + 1

          const row = [
            reminder.id,
            formatDateForCsv(reminder.scheduled_date),
            reminder.title || '',
            formatReminderType(reminder.type || ''),
            reminder.customers?.name || '',
            formatPhoneForCsv(reminder.customers?.phone_e164),
            reminder.assignedTo?.name || 'Unassigned',
            formatStatus(reminder.status || ''),
            reminder.origin || '',
            formatDateForCsv(reminder.created_at)
          ]

          const csvRow = row.map(value => escapeCsvValue(value)).join(',') + '\r\n'
          controller.enqueue(encoder.encode(csvRow))
        }

        // Add summary section
        controller.enqueue(encoder.encode('\r\n'))
        controller.enqueue(encoder.encode(escapeCsvValue('SUMMARY') + '\r\n'))
        controller.enqueue(encoder.encode('\r\n'))

        // Summary by type
        controller.enqueue(encoder.encode(escapeCsvValue('By Type') + '\r\n'))
        for (const [type, count] of Object.entries(typeGroups)) {
          const summaryRow = [formatReminderType(type), count.toString()]
          const csvSummaryRow = summaryRow.map(value => escapeCsvValue(value)).join(',') + '\r\n'
          controller.enqueue(encoder.encode(csvSummaryRow))
        }

        controller.enqueue(encoder.encode('\r\n'))

        // Summary by status
        controller.enqueue(encoder.encode(escapeCsvValue('By Status') + '\r\n'))
        for (const [status, count] of Object.entries(statusGroups)) {
          const summaryRow = [formatStatus(status), count.toString()]
          const csvSummaryRow = summaryRow.map(value => escapeCsvValue(value)).join(',') + '\r\n'
          controller.enqueue(encoder.encode(csvSummaryRow))
        }

        controller.enqueue(encoder.encode('\r\n'))

        // Total count
        const totalRow = ['Total Reminders', (data?.length || 0).toString()]
        const csvTotalRow = totalRow.map(value => escapeCsvValue(value)).join(',') + '\r\n'
        controller.enqueue(encoder.encode(csvTotalRow))

        // Report metadata
        controller.enqueue(encoder.encode('\r\n'))
        controller.enqueue(encoder.encode(escapeCsvValue('REPORT DETAILS') + '\r\n'))
        const metadataRows = [
          ['Report Generated', format(new Date(), 'MM/dd/yyyy HH:mm:ss')],
          ['Time Horizon', `Next ${horizonDays} days`],
          ['Generated By', user.email || 'Unknown'],
          ['User Role', role || 'Unknown']
        ]

        for (const row of metadataRows) {
          const csvRow = row.map(value => escapeCsvValue(value)).join(',') + '\r\n'
          controller.enqueue(encoder.encode(csvRow))
        }

        controller.close()
      }
    })

    // Generate filename with current date and horizon
    const filename = `upcoming_reminders_${horizonDays}d_${format(new Date(), 'yyyy-MM-dd')}.csv`

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    requestLogger.apiError('upcoming-reminders-csv', error as Error, {
      url: request.url,
      method: request.method
    })

    if (error instanceof z.ZodError) {
      requestLogger.warn('Invalid query parameters', {
        validationErrors: error.errors,
        url: request.url
      })
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      requestLogger.warn('Unauthorized access attempt', {
        error: error.message,
        url: request.url
      })
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