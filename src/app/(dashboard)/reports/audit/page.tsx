import { Suspense } from 'react'
import { requireAdmin } from '@/lib/auth/guards'
import { AuditLogExplorer } from './_components/AuditLogExplorer'

export default async function AuditLogPage() {
  // Require admin access
  await requireAdmin()

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Audit Log</h2>
        <div className="text-sm text-muted-foreground">
          Administrative activity tracking and compliance
        </div>
      </div>

      <Suspense fallback={<AuditLogSkeleton />}>
        <AuditLogExplorer />
      </Suspense>
    </div>
  )
}

function AuditLogSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters skeleton */}
      <div className="flex flex-wrap gap-4 p-4 border rounded-lg">
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        <div className="h-10 w-48 bg-muted animate-pulse rounded" />
      </div>

      {/* Table skeleton */}
      <div className="border rounded-lg">
        {/* Header */}
        <div className="flex items-center h-12 px-4 border-b bg-muted/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1">
              <div className="h-4 bg-muted animate-pulse rounded w-20" />
            </div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center h-12 px-4 border-b">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="flex-1">
                <div className="h-4 bg-muted animate-pulse rounded w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}