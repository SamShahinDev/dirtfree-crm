'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface ColumnDef<T> {
  key: keyof T | 'actions'
  header: string
  sortable?: boolean
  width?: string
  render?: (value: any, row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  loading?: boolean
  emptyMessage?: string
  className?: string
  stickyHeader?: boolean
  showRowNumbers?: boolean
}

type SortDirection = 'asc' | 'desc' | null

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
  stickyHeader = true,
  showRowNumbers = false
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

  // Handle sorting
  const handleSort = (key: keyof T) => {
    const column = columns.find(col => col.key === key)
    if (!column?.sortable) return

    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortKey(null)
        setSortDirection(null)
      } else {
        setSortDirection('asc')
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data

    return [...data].sort((a, b) => {
      const aValue = a[sortKey]
      const bValue = b[sortKey]

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1

      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue)
        return sortDirection === 'asc' ? comparison : -comparison
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime()
      }

      // Convert to string for comparison
      const aStr = String(aValue)
      const bStr = String(bValue)
      const comparison = aStr.localeCompare(bStr)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data, sortKey, sortDirection])

  // Get sort icon
  const getSortIcon = (key: keyof T) => {
    const column = columns.find(col => col.key === key)
    if (!column?.sortable) return null

    if (sortKey === key) {
      return sortDirection === 'asc'
        ? <ChevronUp className="w-4 h-4" />
        : <ChevronDown className="w-4 h-4" />
    }
    return <ChevronsUpDown className="w-4 h-4 opacity-50" />
  }

  // Render loading state
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-0">
          <Table>
            <TableHeader className={stickyHeader ? 'sticky top-0 bg-white z-10' : ''}>
              <TableRow>
                {showRowNumbers && <TableHead className="w-12">#</TableHead>}
                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    style={{ width: column.width }}
                    className={column.className}
                  >
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {showRowNumbers && (
                    <TableCell>
                      <Skeleton className="h-4 w-6" />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={String(column.key)}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className={stickyHeader ? 'sticky top-0 bg-white z-10' : ''}>
              <TableRow>
                {showRowNumbers && (
                  <TableHead className="w-12 text-center">#</TableHead>
                )}
                {columns.map((column) => (
                  <TableHead
                    key={String(column.key)}
                    style={{ width: column.width }}
                    className={cn(
                      column.className,
                      column.sortable && 'cursor-pointer hover:bg-gray-50'
                    )}
                    onClick={() => column.sortable && handleSort(column.key as keyof T)}
                  >
                    <div className="flex items-center gap-2">
                      {column.header}
                      {column.sortable && getSortIcon(column.key as keyof T)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (showRowNumbers ? 1 : 0)}
                    className="text-center py-8 text-gray-500"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row, index) => (
                  <TableRow key={index} className="hover:bg-gray-50">
                    {showRowNumbers && (
                      <TableCell className="text-center text-sm text-gray-500">
                        {index + 1}
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={String(column.key)}
                        className={column.className}
                      >
                        {column.render
                          ? column.render(row[column.key], row)
                          : row[column.key] ?? '-'
                        }
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// Common renderers for different data types
export const tableRenderers = {
  // Status badge renderer
  status: (value: string) => {
    const statusColors: Record<string, string> = {
      'scheduled': 'bg-blue-100 text-blue-800',
      'in_progress': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'snoozed': 'bg-blue-100 text-blue-800',
      'complete': 'bg-green-100 text-green-800',
      'canceled': 'bg-red-100 text-red-800'
    }

    return (
      <Badge className={cn('text-xs', statusColors[value] || 'bg-gray-100 text-gray-800')}>
        {value?.replace('_', ' ') || '-'}
      </Badge>
    )
  },

  // Phone number renderer
  phone: (value: string | null) => {
    if (!value) return '-'
    // Format phone number for display
    return value.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
  },

  // Date renderer
  date: (value: string | null) => {
    if (!value) return '-'
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(new Date(value))
    } catch {
      return value
    }
  },

  // Currency renderer
  currency: (value: number | null) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  },

  // Percentage renderer
  percentage: (value: number | null, decimals = 1) => {
    if (value == null) return '-'
    return `${value.toFixed(decimals)}%`
  },

  // Number renderer with thousand separators
  number: (value: number | null, decimals = 0) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value)
  },

  // Truncated text renderer
  truncatedText: (value: string | null, maxLength = 50) => {
    if (!value) return '-'
    if (value.length <= maxLength) return value
    return (
      <span title={value}>
        {value.substring(0, maxLength)}...
      </span>
    )
  },

  // Boolean renderer
  boolean: (value: boolean | null) => {
    if (value == null) return '-'
    return value ? '✓' : '✗'
  }
}