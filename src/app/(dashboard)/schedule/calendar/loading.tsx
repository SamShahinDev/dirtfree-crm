import { Skeleton } from "@/components/ui/skeleton"

export default function CalendarLoading() {
  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Controls and filters */}
      <div className="border rounded-lg p-6 bg-card">
        <div className="flex flex-col gap-4">
          {/* View controls and date navigation */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-10 w-10" />
            </div>
            <Skeleton className="h-10 w-64" />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="border-t pt-4 mt-2">
            <div className="flex gap-4 flex-wrap">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar container */}
      <div className="flex gap-6">
        {/* Main calendar */}
        <div className="flex-1">
          <div className="border rounded-lg p-6 bg-card">
            <Skeleton className="h-[600px] w-full rounded-lg" />
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 space-y-4">
          {/* Summary card */}
          <div className="border rounded-lg p-6 bg-card">
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            </div>
          </div>

          {/* Status breakdown */}
          <div className="border rounded-lg p-6 bg-card">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-6 w-8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
