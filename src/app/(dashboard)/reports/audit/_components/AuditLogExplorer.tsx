'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FiltersBar } from './FiltersBar'
import { AuditTable } from './AuditTable'
import { AuditDetailSheet } from './AuditDetailSheet'
import { CsvButton } from './CsvButton'
import { listAudit, getAuditDetail, getAuditFilters, type ListAuditResult, type AuditDetail } from '../actions'
import { log, createComponentContext } from '@/lib/obs/log'

export interface AuditFilters {
  page: number
  size: number
  from?: string
  to?: string
  actorId?: string
  entity?: string
  entityId?: string
  action?: string
  outcome?: 'ok' | 'error'
  q?: string
}

export interface FilterOptions {
  actions: string[]
  entities: string[]
  actors: Array<{ id: string; email: string }>
}

export function AuditLogExplorer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const logger = log.child(createComponentContext('AuditLogExplorer'))

  // State
  const [data, setData] = useState<ListAuditResult | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<AuditDetail | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    actions: [],
    entities: [],
    actors: []
  })
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Parse filters from URL
  const filters: AuditFilters = {
    page: parseInt(searchParams.get('page') || '1'),
    size: parseInt(searchParams.get('size') || '50'),
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
    actorId: searchParams.get('actorId') || undefined,
    entity: searchParams.get('entity') || undefined,
    entityId: searchParams.get('entityId') || undefined,
    action: searchParams.get('action') || undefined,
    outcome: (searchParams.get('outcome') as 'ok' | 'error') || undefined,
    q: searchParams.get('q') || undefined
  }

  // Update URL with new filters
  const updateFilters = useCallback((newFilters: Partial<AuditFilters>) => {
    const params = new URLSearchParams()

    const merged = { ...filters, ...newFilters }

    // Reset to page 1 when filters change (unless page is specifically being updated)
    if (!('page' in newFilters)) {
      merged.page = 1
    }

    Object.entries(merged).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value))
      }
    })

    router.push(`?${params.toString()}`, { scroll: false })
  }, [filters, router])

  // Load audit data
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      logger.info('Loading audit log data', { filters })
      const result = await listAudit(filters)
      setData(result)
      logger.info('Audit log data loaded', {
        rowCount: result.rows.length,
        total: result.total
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load audit log'
      logger.error('Failed to load audit log data', { error: errorMessage, filters })
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [filters, logger])

  // Load filter options
  const loadFilterOptions = useCallback(async () => {
    try {
      logger.debug('Loading filter options')
      const options = await getAuditFilters()
      setFilterOptions(options)
      logger.debug('Filter options loaded', {
        actionCount: options.actions.length,
        entityCount: options.entities.length,
        actorCount: options.actors.length
      })
    } catch (err) {
      logger.warn('Failed to load filter options', {
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }, [logger])

  // Load entry detail
  const loadEntryDetail = useCallback(async (id: string) => {
    setDetailLoading(true)

    try {
      logger.info('Loading audit entry detail', { id })
      const detail = await getAuditDetail({ id })
      setSelectedEntry(detail)
      logger.info('Audit entry detail loaded', { id, action: detail.action })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load entry detail'
      logger.error('Failed to load audit entry detail', { error: errorMessage, id })
      setError(errorMessage)
    } finally {
      setDetailLoading(false)
    }
  }, [logger])

  // Handle row selection
  const handleRowSelect = useCallback((id: string) => {
    setSelectedEntryId(id)
    loadEntryDetail(id)
  }, [loadEntryDetail])

  // Handle sheet close
  const handleSheetClose = useCallback(() => {
    setSelectedEntryId(null)
    setSelectedEntry(null)
  }, [])

  // Load data when filters change
  useEffect(() => {
    loadData()
  }, [loadData])

  // Load filter options once on mount
  useEffect(() => {
    loadFilterOptions()
  }, [loadFilterOptions])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FiltersBar
          filters={filters}
          onFiltersChange={updateFilters}
          filterOptions={filterOptions}
        />
        <CsvButton filters={filters} />
      </div>

      {error && (
        <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <AuditTable
        data={data}
        loading={loading}
        onRowSelect={handleRowSelect}
        selectedRowId={selectedEntryId}
        filters={filters}
        onFiltersChange={updateFilters}
      />

      <AuditDetailSheet
        open={!!selectedEntryId}
        onOpenChange={handleSheetClose}
        entry={selectedEntry}
        loading={detailLoading}
      />
    </div>
  )
}