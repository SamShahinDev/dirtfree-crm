import { CustomerOverview } from '@/components/analytics/customers/customer-overview'
import { CustomerLifetimeValue } from '@/components/analytics/customers/customer-lifetime-value'
import { CustomerRetention } from '@/components/analytics/customers/customer-retention'
import { CustomerSegments } from '@/components/analytics/customers/customer-segments'
import { CustomerAcquisition } from '@/components/analytics/customers/customer-acquisition'

export default function CustomerAnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Customer Analytics</h1>

      <CustomerOverview />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomerLifetimeValue />
        <CustomerRetention />
      </div>

      <CustomerSegments />
      <CustomerAcquisition />
    </div>
  )
}