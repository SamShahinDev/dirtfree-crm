import { AnalyticsNav } from '@/components/analytics/analytics-nav'

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full bg-gray-50">
      <AnalyticsNav />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}