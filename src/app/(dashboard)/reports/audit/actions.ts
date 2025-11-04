'use server'

import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/guards'
import { redactForAudit } from '@/lib/audit/redact'
import { log, createUserContext } from '@/lib/obs/log'
import { timing } from '@/lib/obs/timing'

const ListAuditSchema = z.object({
  page: z.number().min(1).default(1),
  size: z.number().min(1).max(100).default(50),
  from: z.string().optional(),
  to: z.string().optional(),
  actorId: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  outcome: z.enum(['ok', 'error']).optional(),
  q: z.string().optional()
})

const GetAuditDetailSchema = z.object({
  id: z.string().uuid()
})

export type AuditLogEntry = {
  id: string
  ts: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity: string
  entity_id: string | null
  outcome: 'ok' | 'error'
  meta: Record<string, any> | null
  before: Record<string, any> | null
  after: Record<string, any> | null
}

export type AuditLogSummary = {
  id: string
  ts: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity: string
  entity_id: string | null
  outcome: 'ok' | 'error'
  summary: string
}

export type ListAuditResult = {
  rows: AuditLogSummary[]
  total: number
  page: number
  size: number
  totalPages: number
}

export type AuditDetail = AuditLogEntry & {
  summary: string
}

function generateSummary(entry: AuditLogEntry): string {
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

export async function listAudit(params: z.infer<typeof ListAuditSchema>): Promise<ListAuditResult> {
  // Require admin access
  await requireAdmin()

  const validated = ListAuditSchema.parse(params)
  const { page, size, from, to, actorId, entity, entityId, action, outcome, q } = validated

  const logger = log.child(createUserContext('audit-system'))
  logger.info('Audit log list requested', {
    page,
    size,
    filters: { from, to, actorId, entity, entityId, action, outcome, q }
  })

  const supabase = getServerSupabase()
  const offset = (page - 1) * size

  return timing.db('list-audit-logs', async () => {
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('ts', { ascending: false })
      .range(offset, offset + size - 1)

    // Apply filters
    if (from) {
      // Convert from CT to UTC for database query
      const fromUTC = new Date(from + 'T00:00:00-06:00').toISOString()
      query = query.gte('ts', fromUTC)
    }

    if (to) {
      // Convert from CT to UTC for database query
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

    // Full-text search across JSON fields
    if (q) {
      // Use ILIKE for broader compatibility
      const searchTerm = `%${q}%`
      query = query.or(`meta::text.ilike.${searchTerm},before::text.ilike.${searchTerm},after::text.ilike.${searchTerm},action.ilike.${searchTerm},entity.ilike.${searchTerm}`)
    }

    const { data, error, count } = await query

    if (error) {
      logger.dbError('list-audit-logs', error, { filters: validated })
      throw new Error('Failed to fetch audit logs')
    }

    // Apply redaction and generate summaries
    const rows: AuditLogSummary[] = (data || []).map(entry => {
      const redacted = redactForAudit(entry)
      return {
        id: redacted.id,
        ts: redacted.ts,
        actor_id: redacted.actor_id,
        actor_email: redacted.actor_email,
        action: redacted.action,
        entity: redacted.entity,
        entity_id: redacted.entity_id,
        outcome: redacted.outcome,
        summary: generateSummary(redacted)
      }
    })

    const total = count || 0
    const totalPages = Math.ceil(total / size)

    logger.info('Audit log list completed', {
      rowCount: rows.length,
      total,
      totalPages
    })

    return {
      rows,
      total,
      page,
      size,
      totalPages
    }
  }, { page, size, filterCount: Object.keys(validated).length })
}

export async function getAuditDetail(params: z.infer<typeof GetAuditDetailSchema>): Promise<AuditDetail> {
  // Require admin access
  await requireAdmin()

  const { id } = GetAuditDetailSchema.parse(params)

  const logger = log.child(createUserContext('audit-system'))
  logger.info('Audit detail requested', { id })

  const supabase = getServerSupabase()

  return timing.db('get-audit-detail', async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      logger.dbError('get-audit-detail', error, { id })
      throw new Error('Failed to fetch audit log detail')
    }

    if (!data) {
      throw new Error('Audit log entry not found')
    }

    // Apply redaction
    const redacted = redactForAudit(data)

    const detail: AuditDetail = {
      ...redacted,
      summary: generateSummary(redacted)
    }

    logger.info('Audit detail completed', { id, action: detail.action, entity: detail.entity })

    return detail
  }, { id })
}

export async function getAuditFilters() {
  // Require admin access
  await requireAdmin()

  const logger = log.child(createUserContext('audit-system'))
  logger.debug('Audit filters requested')

  const supabase = getServerSupabase()

  return timing.db('get-audit-filters', async () => {
    const [actionsResult, entitiesResult, actorsResult] = await Promise.all([
      supabase
        .from('audit_log')
        .select('action')
        .order('action'),
      supabase
        .from('audit_log')
        .select('entity')
        .order('entity'),
      supabase
        .from('audit_log')
        .select('actor_id, actor_email')
        .not('actor_id', 'is', null)
        .order('actor_email')
    ])

    if (actionsResult.error || entitiesResult.error || actorsResult.error) {
      logger.warn('Failed to fetch some audit filters', {
        actionsError: actionsResult.error?.message,
        entitiesError: entitiesResult.error?.message,
        actorsError: actorsResult.error?.message
      })
    }

    // Get unique values
    const actions = [...new Set((actionsResult.data || []).map(row => row.action))].filter(Boolean)
    const entities = [...new Set((entitiesResult.data || []).map(row => row.entity))].filter(Boolean)
    const actors = (actorsResult.data || [])
      .filter(row => row.actor_id && row.actor_email)
      .reduce((acc, row) => {
        if (!acc.find(a => a.id === row.actor_id)) {
          acc.push({ id: row.actor_id, email: row.actor_email })
        }
        return acc
      }, [] as Array<{ id: string; email: string }>)

    logger.debug('Audit filters completed', {
      actionCount: actions.length,
      entityCount: entities.length,
      actorCount: actors.length
    })

    return {
      actions,
      entities,
      actors
    }
  })
}