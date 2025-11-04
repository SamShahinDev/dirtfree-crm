export function SatisfactionSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filters Skeleton */}
      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
        <div className="w-4 h-4 bg-gray-300 rounded animate-pulse" />
        <div className="flex space-x-3">
          <div className="w-32 h-9 bg-gray-300 rounded animate-pulse" />
          <div className="w-40 h-9 bg-gray-300 rounded animate-pulse" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
        ))}
      </div>

      {/* Tables Grid Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Responses Table Skeleton */}
        <div className="bg-white border rounded-lg">
          <div className="p-6 border-b">
            <div className="w-32 h-5 bg-gray-300 rounded animate-pulse" />
          </div>
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>

        {/* Negatives Queue Skeleton */}
        <div className="bg-white border rounded-lg">
          <div className="p-6 border-b">
            <div className="w-40 h-5 bg-gray-300 rounded animate-pulse" />
          </div>
          <div className="p-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}