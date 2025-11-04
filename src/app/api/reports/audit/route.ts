import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { format } from 'date-fns'

import { getServerSupabase } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { redactForAudit } from '@/lib/audit/redact'
import { formatCTForCSV } from '@/lib/time/ct'
import { log, createRequestContext } from '@/lib/obs/log'
import { timing } from '@/lib/obs/timing'

// Validation schema (similar to server actions but without pagination)
const QuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  actorId: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  outcome: z.enum(['ok', 'error']).optional(),
  q: z.string().optional()
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

// Format JSON for CSV (compact, single line)
function formatJsonForCsv(obj: any): string {
  if (obj === null || obj === undefined) return ''
  if (typeof obj === 'object') {
    try {
      return JSON.stringify(obj)
    } catch {
      return String(obj)
    }
  }
  return String(obj)
}

// Generate summary for CSV
function generateSummary(entry: any): string {
  const actor = entry.actor_email || entry.actor_id || 'System'
  const entity = entry.entity_id ? `${entry.entity} ${entry.entity_id}` : entry.entity

  switch (entry.action) {
    case 'create':
      return `${actor} created ${entity}`
    case 'update':
      return `${actor} updated ${entity}`
    case 'delete':
      return `${actor} deleted ${entity}`
    case 'login':
      return `${actor} logged in`
    case 'logout':
      return `${actor} logged out`
    case 'export':
      return `${actor} exported ${entity}`
    case 'import':
      return `${actor} imported ${entity}`
    default:
      return `${actor} performed ${entry.action} on ${entity}`
  }
}

export async function GET(request: NextRequest) {
  const requestContext = createRequestContext(request)
  const requestLogger = log.child(requestContext)

  try {
    // Require admin access
    await requireAdmin()

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = Object.fromEntries(searchParams.entries())

    const validated = QuerySchema.parse(queryParams)
    const { from, to, actorId, entity, entityId, action, outcome, q } = validated

    requestLogger.info('Audit CSV export requested', {
      filters: validated
    })

    const supabase = getServerSupabase()

    return timing.db('export-audit-csv', async () => {
      // Build query
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('ts', { ascending: false })

      // Apply filters (same logic as server actions)
      if (from) {
        const fromUTC = new Date(from + 'T00:00:00-06:00').toISOString()
        query = query.gte('ts', fromUTC)
      }

      if (to) {
        const toUTC = new Date(to + 'T23:59:59-06:00').toISOString()
        query = query.lte('ts', toUTC)
      }

      if (actorId) {
        query = query.eq('actor_id', actorId)
      }

      if (entity) {
        query = query.eq('entity', entity)
      }

      if (entityId) {
        query = query.eq('entity_id', entityId)
      }

      if (action) {
        query = query.eq('action', action)
      }

      if (outcome) {
        query = query.eq('outcome', outcome)
      }

      // Full-text search
      if (q) {
        const searchTerm = `%${q}%`
        query = query.or(`meta::text.ilike.${searchTerm},before::text.ilike.${searchTerm},after::text.ilike.${searchTerm},action.ilike.${searchTerm},entity.ilike.${searchTerm}`)
      }

      const { data, error } = await query

      if (error) {
        requestLogger.dbError('export-audit-csv', error, { filters: validated })
        return NextResponse.json(
          { error: 'Failed to fetch audit data' },
          { status: 500 }
        )
      }

      requestLogger.info('Audit data fetched for CSV export', {
        rowCount: data?.length || 0
      })

      // Create streaming response
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        start(controller) {
          try {
            // CSV headers with CRLF line endings for Excel compatibility
            const headers = [
              'Timestamp (CT)',
              'Actor ID',
              'Actor Email',
              'Action',
              'Entity Type',
              'Entity ID',
              'Outcome',
              'Summary',
              'Metadata',
              'Before',
              'After',
              'Entry ID'
            ]

            const headerRow = headers.map(h => escapeCsvValue(h)).join(',') + '\r\n'
            controller.enqueue(encoder.encode(headerRow))

            // Process and stream data rows
            for (const entry of data || []) {
              // Apply redaction
              const redacted = redactForAudit(entry)

              const row = [
                formatCTForCSV(redacted.ts),
                redacted.actor_id || '',
                redacted.actor_email || '',
                redacted.action || '',
                redacted.entity || '',
                redacted.entity_id || '',
                redacted.outcome || '',
                generateSummary(redacted),
                formatJsonForCsv(redacted.meta),
                formatJsonForCsv(redacted.before),
                formatJsonForCsv(redacted.after),
                redacted.id || ''
              ]

              const csvRow = row.map(value => escapeCsvValue(value)).join(',') + '\r\n'
              controller.enqueue(encoder.encode(csvRow))
            }

            // Add footer with export metadata
            controller.enqueue(encoder.encode('\r\n'))
            controller.enqueue(encoder.encode(escapeCsvValue('EXPORT METADATA') + '\r\n'))

            const metadataRows = [
              ['Export Date', formatCTForCSV(new Date())],
              ['Total Records', (data?.length || 0).toString()],
              ['Filters Applied', Object.keys(validated).filter(k => validated[k as keyof typeof validated]).join(', ') || 'None'],
              ['Data Redacted', 'Yes - PII and sensitive data masked']
            ]

            for (const row of metadataRows) {
              const csvRow = row.map(value => escapeCsvValue(value)).join(',') + '\r\n'
              controller.enqueue(encoder.encode(csvRow))
            }

            controller.close()
          } catch (streamError) {
            requestLogger.error('Error during CSV streaming', {
              error: streamError instanceof Error ? streamError.message : 'Unknown error'
            })
            controller.error(streamError)
          }
        }
      })

      // Generate filename with current date
      const filename = `audit_${format(new Date(), 'yyyy-MM-dd')}.csv`

      requestLogger.info('Audit CSV export completed', {
        filename,
        rowCount: data?.length || 0
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }, {
      filterCount: Object.keys(validated).length
    })

  } catch (error) {
    requestLogger.apiError('audit-csv-export', error as Error, {
      url: request.url,
      method: request.method
    })

    if (error instanceof z.ZodError) {
      requestLogger.warn('Invalid query parameters for audit CSV export', {
        validationErrors: error.errors,
        url: request.url
      })
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      requestLogger.warn('Unauthorized audit CSV export attempt', {
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