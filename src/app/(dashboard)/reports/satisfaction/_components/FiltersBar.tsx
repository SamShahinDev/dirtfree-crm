'use client'

import { useEffect, useState } from 'react'
import { Filter } from 'lucide-react'
import { useFilterContext } from '@/components/filters/FilterProvider'
import { getFilterOptions } from '../actions'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface FilterOptions {
  zones: Array<{ value: string; label: string }>
  technicians: Array<{ value: string; label: string }>
}

export function FiltersBar() {
  const { filters, updateFilter, clearFilters } = useFilterContext()
  const [options, setOptions] = useState<FilterOptions>({ zones: [], technicians: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const result = await getFilterOptions({})
        setOptions(result)
      } catch (error) {
        console.error('Error loading filter options:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFilterOptions()
  }, [])

  const hasActiveFilters = filters.zone || filters.technicianId

  if (loading) {
    return (
      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex space-x-3">
          <div className="w-32 h-9 bg-gray-200 rounded animate-pulse" />
          <div className="w-40 h-9 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-4">
        <Filter className="w-4 h-4 text-gray-600" />

        <div className="flex space-x-3">
          {/* Zone Filter */}
          <Select
            value={filters.zone || 'all'}
            onValueChange={(value) => updateFilter('zone', value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-32 bg-white">
              <SelectValue placeholder="Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {options.zones.map((zone) => (
                <SelectItem key={zone.value} value={zone.value}>
                  {zone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Technician Filter */}
          <Select
            value={filters.technicianId || 'all'}
            onValueChange={(value) => updateFilter('technicianId', value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-40 bg-white">
              <SelectValue placeholder="Technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Technicians</SelectItem>
              {options.technicians.map((tech) => (
                <SelectItem key={tech.value} value={tech.value}>
                  {tech.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-gray-600 hover:text-gray-900"
        >
          Clear filters
        </Button>
      )}
    </div>
  )
}