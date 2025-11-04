'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Filter, X, RotateCcw } from 'lucide-react'
import type { AuditFilters, FilterOptions } from './AuditLogExplorer'

interface FiltersBarProps {
  filters: AuditFilters
  onFiltersChange: (filters: Partial<AuditFilters>) => void
  filterOptions: FilterOptions
}

export function FiltersBar({ filters, onFiltersChange, filterOptions }: FiltersBarProps) {
  const [searchInput, setSearchInput] = useState(filters.q || '')
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onFiltersChange({ q: searchInput || undefined })
  }

  const handleReset = () => {
    setSearchInput('')
    onFiltersChange({
      from: undefined,
      to: undefined,
      actorId: undefined,
      entity: undefined,
      entityId: undefined,
      action: undefined,
      outcome: undefined,
      q: undefined,
      page: 1
    })
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.from) count++
    if (filters.to) count++
    if (filters.actorId) count++
    if (filters.entity) count++
    if (filters.entityId) count++
    if (filters.action) count++
    if (filters.outcome) count++
    if (filters.q) count++
    return count
  }

  const activeFiltersCount = getActiveFiltersCount()

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Primary filters row */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2 min-w-0 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search in metadata, actions, entities..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </form>

            {/* Quick filters */}
            <Select
              value={filters.outcome || 'all'}
              onValueChange={(value) => onFiltersChange({ outcome: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                <SelectItem value="ok">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.entity || 'all'}
              onValueChange={(value) => onFiltersChange({ entity: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {filterOptions.entities.map((entity) => (
                  <SelectItem key={entity} value={entity}>
                    {entity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Toggle advanced filters */}
            <Button
              variant="outline"
              onClick={() => setIsExpanded(!isExpanded)}
              className="relative"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* Reset button */}
            {activeFiltersCount > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleReset}
                title="Reset all filters"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Advanced filters (collapsible) */}
          {isExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              {/* Date range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Input
                  type="date"
                  value={filters.from || ''}
                  onChange={(e) => onFiltersChange({ from: e.target.value || undefined })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Input
                  type="date"
                  value={filters.to || ''}
                  onChange={(e) => onFiltersChange({ to: e.target.value || undefined })}
                />
              </div>

              {/* Actor */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Actor</label>
                <Select
                  value={filters.actorId || 'all'}
                  onValueChange={(value) => onFiltersChange({ actorId: value === 'all' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actors</SelectItem>
                    {filterOptions.actors.map((actor) => (
                      <SelectItem key={actor.id} value={actor.id}>
                        {actor.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Action</label>
                <Select
                  value={filters.action || 'all'}
                  onValueChange={(value) => onFiltersChange({ action: value === 'all' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {filterOptions.actions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Entity ID */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Entity ID</label>
                <Input
                  placeholder="Filter by specific entity ID"
                  value={filters.entityId || ''}
                  onChange={(e) => onFiltersChange({ entityId: e.target.value || undefined })}
                />
              </div>
            </div>
          )}

          {/* Active filters display */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Active filters:</span>

              {filters.q && (
                <Badge variant="secondary" className="gap-1">
                  Search: {filters.q}
                  <button
                    onClick={() => {
                      setSearchInput('')
                      onFiltersChange({ q: undefined })
                    }}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {filters.from && (
                <Badge variant="secondary" className="gap-1">
                  From: {filters.from}
                  <button
                    onClick={() => onFiltersChange({ from: undefined })}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {filters.to && (
                <Badge variant="secondary" className="gap-1">
                  To: {filters.to}
                  <button
                    onClick={() => onFiltersChange({ to: undefined })}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {filters.actorId && (
                <Badge variant="secondary" className="gap-1">
                  Actor: {filterOptions.actors.find(a => a.id === filters.actorId)?.email || filters.actorId}
                  <button
                    onClick={() => onFiltersChange({ actorId: undefined })}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {filters.entity && (
                <Badge variant="secondary" className="gap-1">
                  Entity: {filters.entity}
                  <button
                    onClick={() => onFiltersChange({ entity: undefined })}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {filters.action && (
                <Badge variant="secondary" className="gap-1">
                  Action: {filters.action}
                  <button
                    onClick={() => onFiltersChange({ action: undefined })}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {filters.outcome && (
                <Badge variant="secondary" className="gap-1">
                  Outcome: {filters.outcome}
                  <button
                    onClick={() => onFiltersChange({ outcome: undefined })}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {filters.entityId && (
                <Badge variant="secondary" className="gap-1">
                  Entity ID: {filters.entityId}
                  <button
                    onClick={() => onFiltersChange({ entityId: undefined })}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}