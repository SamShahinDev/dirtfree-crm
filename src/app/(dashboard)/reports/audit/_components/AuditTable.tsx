'use client'

import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  User,
  Activity,
  Database,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { formatCTWithSeconds } from '@/lib/time/ct'
import type { ListAuditResult } from '../actions'
import type { AuditFilters } from './AuditLogExplorer'

interface AuditTableProps {
  data: ListAuditResult | null
  loading: boolean
  onRowSelect: (id: string) => void
  selectedRowId: string | null
  filters: AuditFilters
  onFiltersChange: (filters: Partial<AuditFilters>) => void
}

export function AuditTable({
  data,
  loading,
  onRowSelect,
  selectedRowId,
  filters,
  onFiltersChange
}: AuditTableProps) {
  const { totalPages, page } = data || { totalPages: 0, page: 1 }

  const handlePageChange = (newPage: number) => {
    onFiltersChange({ page: newPage })
  }

  const getOutcomeBadge = (outcome: 'ok' | 'error') => {
    if (outcome === 'ok') {
      return (
        <Badge variant="outline" className="gap-1 text-green-700 border-green-200 bg-green-50">
          <CheckCircle2 className="h-3 w-3" />
          Success
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="gap-1 text-red-700 border-red-200 bg-red-50">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      )
    }
  }

  const getEntityBadge = (entity: string, entityId: string | null) => {
    const displayText = entityId ? `${entity} ${entityId}` : entity

    const iconMap: Record<string, React.ComponentType<any>> = {
      customer: User,
      job: Activity,
      user: User,
      default: Database,
    }

    const IconComponent = iconMap[entity.toLowerCase()] || iconMap.default

    return (
      <Badge variant="secondary" className="gap-1 font-mono text-xs">
        <IconComponent className="h-3 w-3" />
        {displayText}
      </Badge>
    )
  }

  const formatActorDisplay = (actorEmail: string | null, actorId: string | null) => {
    if (actorEmail) return actorEmail
    if (actorId) return `ID: ${actorId}`
    return 'System'
  }

  if (loading) {
    return <TableSkeleton />
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">
            Audit Entries
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Showing {data.rows.length} of {data.total} entries
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[180px]">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Timestamp (CT)
                  </div>
                </TableHead>
                <TableHead className="w-[200px]">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Actor
                  </div>
                </TableHead>
                <TableHead className="w-[120px]">Action</TableHead>
                <TableHead className="w-[200px]">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Entity
                  </div>
                </TableHead>
                <TableHead className="flex-1 min-w-[300px]">Summary</TableHead>
                <TableHead className="w-[100px]">Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer hover:bg-muted/50 ${
                    selectedRowId === row.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => onRowSelect(row.id)}
                >
                  <TableCell className="font-mono text-xs">
                    {formatCTWithSeconds(row.ts)}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate text-sm">
                      {formatActorDisplay(row.actor_email, row.actor_id)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {row.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getEntityBadge(row.entity, row.entity_id)}
                  </TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="truncate text-sm">
                      {row.summary}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getOutcomeBadge(row.outcome)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {data.rows.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                No audit entries found matching your filters.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(1)}
                disabled={page === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="px-3 py-1 text-sm">
                {page} / {totalPages}
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(totalPages)}
                disabled={page === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-muted animate-pulse rounded w-32" />
          <div className="h-4 bg-muted animate-pulse rounded w-40" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableHead key={i}>
                  <div className="h-4 bg-muted animate-pulse rounded w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-4 bg-muted animate-pulse rounded w-16" />
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