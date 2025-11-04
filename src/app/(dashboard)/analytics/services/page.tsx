import { ServicePerformance } from '@/components/analytics/services/service-performance'
import { ServiceProfitability } from '@/components/analytics/services/service-profitability'
import { ServiceDuration } from '@/components/analytics/services/service-duration'
import { ServiceTrends } from '@/components/analytics/services/service-trends'

export default function ServiceAnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Service Analytics</h1>

      <ServicePerformance />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ServiceProfitability />
        <ServiceDuration />
      </div>

      <ServiceTrends />
    </div>
  )
}