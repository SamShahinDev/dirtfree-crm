import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { format } from 'date-fns'

import { getServerSupabase } from '@/lib/supabase/server'
import { getUser, requireAuth } from '@/lib/auth/server'

// Validation schema
const QuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'From date must be in YYYY-MM-DD format'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'To date must be in YYYY-MM-DD format'),
  serviceTypes: z.string().optional().transform(val => val ? val.split(',').filter(Boolean) : undefined)
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

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const { user, role } = await requireAuth()

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      serviceTypes: searchParams.get('serviceTypes')
    }

    const { from, to, serviceTypes } = QuerySchema.parse(queryParams)

    const supabase = getServerSupabase()

    let query = supabase
      .from('jobs')
      .select(`
        id,
        status,
        scheduled_date,
        completed_at,
        description,
        zone,
        technician_id,
        customers!inner(
          name,
          phone_e164
        ),
        technicians:users!technician_id(
          name
        )
      `)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)

    // Apply RLS-aware filtering based on role
    if (role === 'technician') {
      // Technicians can only see jobs assigned to them
      query = query.eq('technician_id', user.id)
    }

    // Service type filter if provided
    if (serviceTypes && serviceTypes.length > 0) {
      const typeFilters = serviceTypes.map(type => `description.ilike.%${type}%`).join(',')
      query = query.or(typeFilters)
    }

    query = query.order('scheduled_date', { ascending: false })

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch jobs data' },
        { status: 500 }
      )
    }

    // Helper function to extract service type
    function extractServiceType(description: string | null): string {
      if (!description) return 'General Cleaning'

      const serviceTypes = [
        'carpet cleaning',
        'upholstery cleaning',
        'tile cleaning',
        'area rug cleaning',
        'stain removal',
        'deep cleaning',
        'maintenance cleaning'
      ]

      const lowerDesc = description.toLowerCase()
      for (const type of serviceTypes) {
        if (lowerDesc.includes(type)) {
          return type.split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ')
        }
      }

      return 'General Cleaning'
    }

    // Create streaming response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        // CSV headers
        const headers = [
          'Job ID',
          'Status',
          'Customer Name',
          'Customer Phone',
          'Zone',
          'Technician',
          'Scheduled Date',
          'Completed Date',
          'Service Type',
          'Description'
        ]

        const headerRow = headers.map(h => escapeCsvValue(h)).join(',') + '\r\n'
        controller.enqueue(encoder.encode(headerRow))

        // Stream data rows
        for (const job of data || []) {
          const row = [
            job.id,
            job.status?.replace('_', ' ') || '',
            job.customers?.name || '',
            formatPhoneForCsv(job.customers?.phone_e164),
            job.zone || '',
            job.technicians?.name || '',
            formatDateForCsv(job.scheduled_date),
            formatDateForCsv(job.completed_at),
            extractServiceType(job.description),
            job.description || ''
          ]

          const csvRow = row.map(value => escapeCsvValue(value)).join(',') + '\r\n'
          controller.enqueue(encoder.encode(csvRow))
        }

        controller.close()
      }
    })

    // Generate filename with current date
    const filename = `jobs_by_status_${format(new Date(), 'yyyy-MM-dd')}.csv`

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Jobs by status CSV export error:', error)

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