import { Card, CardContent } from '@/components/ui/card'

export function TrucksSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="rounded-lg border-2">
          <CardContent className="p-5 lg:p-6 space-y-4">
            {/* Header skeleton */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Maintenance date skeleton */}
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>

            {/* Badges skeleton */}
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-6 w-12 bg-gray-100 rounded-full animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}