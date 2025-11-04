/**
 * Loading Skeletons for Opportunities Page
 * Used in Suspense fallbacks for better UX during data fetching
 */

export function OpportunityStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="bg-white p-6 rounded-lg border border-gray-200 animate-pulse"
        >
          <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
          <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-3 bg-gray-100 rounded w-16"></div>
        </div>
      ))}
    </div>
  )
}

export function OpportunityListSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
        </div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-gray-200">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="px-6 py-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-gray-200 rounded w-48"></div>
                <div className="h-4 bg-gray-100 rounded w-32"></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-6 bg-gray-200 rounded w-20"></div>
                <div className="h-6 bg-gray-100 rounded-full w-16"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OpportunityCardSkeleton() {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 animate-pulse">
      <div className="space-y-3">
        <div className="h-6 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-100 rounded w-1/2"></div>
        <div className="h-4 bg-gray-100 rounded w-2/3"></div>
        <div className="flex items-center gap-2 mt-4">
          <div className="h-8 bg-gray-200 rounded w-24"></div>
          <div className="h-8 bg-gray-100 rounded-full w-20"></div>
        </div>
      </div>
    </div>
  )
}
