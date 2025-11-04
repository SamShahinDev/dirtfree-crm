'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Clock,
  User,
  Activity,
  Database,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Code,
  GitCompare,
  Copy,
  Loader2,
} from 'lucide-react'
import { formatCTWithSeconds } from '@/lib/time/ct'
import { jsonDiff, groupDiffs, getDiffStats, type DiffEntry } from '@/lib/audit/diff'
import type { AuditDetail } from '../actions'

interface AuditDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: AuditDetail | null
  loading: boolean
}

export function AuditDetailSheet({ open, onOpenChange, entry, loading }: AuditDetailSheetProps) {
  const router = useRouter()

  const diffs = useMemo(() => {
    if (!entry?.before || !entry?.after) return []
    return jsonDiff(entry.before, entry.after)
  }, [entry])

  const diffGroups = useMemo(() => groupDiffs(diffs), [diffs])
  const diffStats = useMemo(() => getDiffStats(diffs), [diffs])

  const handleOpenEntity = () => {
    if (!entry) return

    const { entity, entity_id } = entry

    // Best-guess routing based on entity type
    const routeMap: Record<string, string> = {
      customer: `/customers/${entity_id}`,
      job: `/jobs/${entity_id}`,
      user: `/users/${entity_id}`,
      truck: `/trucks/${entity_id}`,
      reminder: `/reminders/${entity_id}`,
    }

    const route = routeMap[entity.toLowerCase()]
    if (route && entity_id) {
      router.push(route)
    }
  }

  const formatJsonForDisplay = (obj: any) => {
    if (!obj) return 'null'
    return JSON.stringify(obj, null, 2)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getOutcomeBadge = (outcome: 'ok' | 'error') => {
    if (outcome === 'ok') {
      return (
        <Badge className="gap-1 bg-green-100 text-green-800 border-green-200">
          <CheckCircle2 className="h-3 w-3" />
          Success
        </Badge>
      )
    } else {
      return (
        <Badge className="gap-1 bg-red-100 text-red-800 border-red-200">
          <XCircle className="h-3 w-3" />
          Error
        </Badge>
      )
    }
  }

  const getDiffBadge = (kind: string, count: number) => {
    const variants = {
      added: 'bg-green-100 text-green-800 border-green-200',
      changed: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      removed: 'bg-red-100 text-red-800 border-red-200',
    }

    return (
      <Badge className={`gap-1 ${variants[kind as keyof typeof variants] || 'bg-gray-100 text-gray-800'}`}>
        {count} {kind}
      </Badge>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Audit Entry Detail
          </SheetTitle>
          <SheetDescription>
            Detailed view of audit log entry with before/after comparison
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : entry ? (
            <div className="space-y-6">
              {/* Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Timestamp:</span>
                      <div className="font-mono text-xs text-muted-foreground">
                        {formatCTWithSeconds(entry.ts)}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Outcome:</span>
                      <div className="mt-1">
                        {getOutcomeBadge(entry.outcome)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Actor:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="h-3 w-3" />
                        <span className="text-muted-foreground">
                          {entry.actor_email || entry.actor_id || 'System'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Action:</span>
                      <div className="mt-1">
                        <Badge variant="outline" className="font-mono text-xs">
                          {entry.action}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="font-medium">Entity:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Database className="h-3 w-3" />
                      <Badge variant="secondary" className="font-mono text-xs">
                        {entry.entity} {entry.entity_id && `${entry.entity_id}`}
                      </Badge>
                      {entry.entity_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenEntity}
                          className="h-6 px-2 text-xs"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open
                        </Button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-medium">Description:</span>
                    <div className="text-muted-foreground mt-1">
                      {entry.summary}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metadata */}
              {entry.meta && Object.keys(entry.meta).length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Metadata
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(formatJsonForDisplay(entry.meta))}
                        className="h-8 px-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">
                      {formatJsonForDisplay(entry.meta)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Changes */}
              {diffs.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <GitCompare className="h-4 w-4" />
                        Changes
                      </CardTitle>
                      <div className="flex gap-2">
                        {diffStats.added > 0 && getDiffBadge('added', diffStats.added)}
                        {diffStats.changed > 0 && getDiffBadge('changed', diffStats.changed)}
                        {diffStats.removed > 0 && getDiffBadge('removed', diffStats.removed)}
                      </div>
                    </div>
                    <CardDescription>
                      Before/after comparison of changed data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(diffGroups).map(([kind, entries]) => (
                      <div key={kind}>
                        <h4 className="font-medium text-sm mb-2 capitalize flex items-center gap-2">
                          {getDiffBadge(kind, entries.length)}
                        </h4>
                        <div className="space-y-2">
                          {entries.map((diff, index) => (
                            <DiffEntryDisplay key={`${kind}-${index}`} diff={diff} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Before/After Raw Data */}
              {(entry.before || entry.after) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {entry.before && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Before</CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(formatJsonForDisplay(entry.before))}
                            className="h-8 px-2"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-60">
                          {formatJsonForDisplay(entry.before)}
                        </pre>
                      </CardContent>
                    </Card>
                  )}

                  {entry.after && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">After</CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(formatJsonForDisplay(entry.after))}
                            className="h-8 px-2"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-60">
                          {formatJsonForDisplay(entry.after)}
                        </pre>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No entry selected</p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function DiffEntryDisplay({ diff }: { diff: DiffEntry }) {
  const formatValue = (value: any): string => {
    if (value === undefined) return 'undefined'
    if (value === null) return 'null'
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const getKindIcon = (kind: string) => {
    switch (kind) {
      case 'added':
        return <span className="text-green-600 font-bold">+</span>
      case 'removed':
        return <span className="text-red-600 font-bold">-</span>
      case 'changed':
        return <span className="text-yellow-600 font-bold">~</span>
      default:
        return <span className="text-gray-600 font-bold">?</span>
    }
  }

  return (
    <div className="bg-muted/50 p-3 rounded text-xs font-mono space-y-1">
      <div className="flex items-center gap-2 font-medium">
        {getKindIcon(diff.kind)}
        <span className="text-blue-600">{diff.path}</span>
      </div>
      {diff.kind === 'changed' ? (
        <div className="space-y-1 ml-4">
          <div className="text-red-600">- {formatValue(diff.before)}</div>
          <div className="text-green-600">+ {formatValue(diff.after)}</div>
        </div>
      ) : (
        <div className="ml-4">
          <span className={diff.kind === 'added' ? 'text-green-600' : 'text-red-600'}>
            {formatValue(diff.kind === 'added' ? diff.after : diff.before)}
          </span>
        </div>
      )}
    </div>
  )
}