/**
 * Invoice Filters Component
 * Provides filtering capabilities for invoice list
 */

'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CalendarIcon, FilterIcon, XIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { InvoiceStatus, getInvoiceStatusLabel } from '@/types/invoice'

// =============================================================================
// TYPES
// =============================================================================

interface Technician {
  id: string
  name: string
}

interface InvoicesFiltersProps {
  technicians: Technician[]
  currentFilters: {
    status?: InvoiceStatus
    technician?: string
    customer?: string
    dateFrom?: string
    dateTo?: string
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function updateSearchParams(
  searchParams: URLSearchParams,
  updates: Record<string, string | null>
): URLSearchParams {
  const newParams = new URLSearchParams(searchParams)

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === '' || value === undefined) {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
  })

  // Reset to first page when filters change
  newParams.set('page', '1')

  return newParams
}

// =============================================================================
// COMPONENTS
// =============================================================================

function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: {
  dateFrom?: string
  dateTo?: string
  onDateFromChange: (date?: string) => void
  onDateToChange: (date?: string) => void
}) {
  const [fromDate, setFromDate] = useState<Date | undefined>(
    dateFrom ? new Date(dateFrom) : undefined
  )
  const [toDate, setToDate] = useState<Date | undefined>(
    dateTo ? new Date(dateTo) : undefined
  )

  const handleFromDateSelect = (date?: Date) => {
    setFromDate(date)
    onDateFromChange(date ? date.toISOString().split('T')[0] : undefined)
  }

  const handleToDateSelect = (date?: Date) => {
    setToDate(date)
    onDateToChange(date ? date.toISOString().split('T')[0] : undefined)
  }

  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <Label htmlFor="date-from" className="text-sm font-medium">
          From
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date-from"
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !fromDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {fromDate ? format(fromDate, 'MMM d, yyyy') : 'Pick date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={handleFromDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex-1">
        <Label htmlFor="date-to" className="text-sm font-medium">
          To
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date-to"
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !toDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {toDate ? format(toDate, 'MMM d, yyyy') : 'Pick date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={handleToDateSelect}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function ActiveFilters({
  currentFilters,
  technicians,
  onClearFilter,
  onClearAll,
}: {
  currentFilters: InvoicesFiltersProps['currentFilters']
  technicians: Technician[]
  onClearFilter: (key: string) => void
  onClearAll: () => void
}) {
  const activeFilters = []

  if (currentFilters.status) {
    activeFilters.push({
      key: 'status',
      label: `Status: ${getInvoiceStatusLabel(currentFilters.status)}`,
    })
  }

  if (currentFilters.technician) {
    const tech = technicians.find(t => t.id === currentFilters.technician)
    activeFilters.push({
      key: 'technician',
      label: `Technician: ${tech?.name || 'Unknown'}`,
    })
  }

  if (currentFilters.customer) {
    activeFilters.push({
      key: 'customer',
      label: `Customer: ${currentFilters.customer}`,
    })
  }

  if (currentFilters.dateFrom) {
    activeFilters.push({
      key: 'dateFrom',
      label: `From: ${format(new Date(currentFilters.dateFrom), 'MMM d, yyyy')}`,
    })
  }

  if (currentFilters.dateTo) {
    activeFilters.push({
      key: 'dateTo',
      label: `To: ${format(new Date(currentFilters.dateTo), 'MMM d, yyyy')}`,
    })
  }

  if (activeFilters.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">
        Active filters:
      </span>
      {activeFilters.map((filter) => (
        <Badge
          key={filter.key}
          variant="secondary"
          className="flex items-center gap-1"
        >
          {filter.label}
          <button
            onClick={() => onClearFilter(filter.key)}
            className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="text-muted-foreground hover:text-foreground"
      >
        Clear all
      </Button>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InvoicesFilters({
  technicians,
  currentFilters,
}: InvoicesFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isExpanded, setIsExpanded] = useState(false)

  // Local state for form inputs
  const [localFilters, setLocalFilters] = useState(currentFilters)

  const handleFilterChange = (key: string, value: string | undefined) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  const applyFilters = () => {
    const newParams = updateSearchParams(searchParams, localFilters)
    router.push(`/invoices?${newParams.toString()}`)
  }

  const clearFilter = (key: string) => {
    const newFilters = { ...localFilters }
    delete newFilters[key as keyof typeof newFilters]
    setLocalFilters(newFilters)

    const newParams = updateSearchParams(searchParams, { [key]: null })
    router.push(`/invoices?${newParams.toString()}`)
  }

  const clearAllFilters = () => {
    setLocalFilters({})
    router.push('/invoices')
  }

  const hasActiveFilters = Object.values(currentFilters).some(value =>
    value !== undefined && value !== ''
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-4 w-4" />
              <span className="font-medium">Filters</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Hide' : 'Show'} Filters
            </Button>
          </div>

          {isExpanded && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Status Filter */}
                <div className="space-y-2">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select
                    value={localFilters.status || 'all'}
                    onValueChange={(value) =>
                      handleFilterChange('status', value === 'all' ? undefined : value)
                    }
                  >
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="void">Void</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Technician Filter */}
                {technicians.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="technician-filter">Technician</Label>
                    <Select
                      value={localFilters.technician || 'all'}
                      onValueChange={(value) =>
                        handleFilterChange('technician', value === 'all' ? undefined : value)
                      }
                    >
                      <SelectTrigger id="technician-filter">
                        <SelectValue placeholder="All technicians" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All technicians</SelectItem>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Customer Filter */}
                <div className="space-y-2">
                  <Label htmlFor="customer-filter">Customer</Label>
                  <Input
                    id="customer-filter"
                    placeholder="Search customer..."
                    value={localFilters.customer || ''}
                    onChange={(e) =>
                      handleFilterChange('customer', e.target.value || undefined)
                    }
                  />
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <DateRangePicker
                  dateFrom={localFilters.dateFrom}
                  dateTo={localFilters.dateTo}
                  onDateFromChange={(date) => handleFilterChange('dateFrom', date)}
                  onDateToChange={(date) => handleFilterChange('dateTo', date)}
                />
              </div>

              {/* Filter Actions */}
              <div className="flex items-center gap-2 pt-4 border-t">
                <Button onClick={applyFilters}>
                  Apply Filters
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocalFilters(currentFilters)}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <ActiveFilters
          currentFilters={currentFilters}
          technicians={technicians}
          onClearFilter={clearFilter}
          onClearAll={clearAllFilters}
        />
      )}
    </div>
  )
}