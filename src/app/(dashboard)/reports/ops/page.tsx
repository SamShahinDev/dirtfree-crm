import { Suspense } from 'react'
import { requireAdmin } from '@/lib/auth/guards'
import { OpsMetricsDashboard } from './_components/OpsMetricsDashboard'

export default async function OperationsPage() {
  // Require admin access
  await requireAdmin()

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Operations Dashboard</h2>
        <div className="text-sm text-muted-foreground">
          SLO monitoring and system health
        </div>
      </div>

      <Suspense fallback={<OpsDashboardSkeleton />}>
        <OpsMetricsDashboard />
      </Suspense>
    </div>
  )
}

function OpsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Overall status card skeleton */}
      <div className="rounded-lg p-5 lg:p-6 border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-muted animate-pulse rounded w-32" />
          <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-4 bg-muted animate-pulse rounded w-48" />
      </div>

      {/* SLO cards grid skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg p-5 lg:p-6 border bg-card">
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 bg-muted animate-pulse rounded w-24" />
              <div className="h-6 w-16 bg-muted animate-pulse rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-8 bg-muted animate-pulse rounded w-20" />
              <div className="h-4 bg-muted animate-pulse rounded w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Heartbeat checks skeleton */}
      <div className="rounded-lg p-5 lg:p-6 border bg-card">
        <div className="h-6 bg-muted animate-pulse rounded w-40 mb-4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded w-20" />
              <div className="h-6 w-12 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}