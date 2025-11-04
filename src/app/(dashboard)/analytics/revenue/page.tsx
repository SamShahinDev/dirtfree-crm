import { DateRangePicker } from '@/components/analytics/date-range-picker'
import { RevenueOverview } from '@/components/analytics/revenue/revenue-overview'
import { RevenueByService } from '@/components/analytics/revenue/revenue-by-service'
import { RevenueByZone } from '@/components/analytics/revenue/revenue-by-zone'
import { PaymentStatus } from '@/components/analytics/revenue/payment-status'
import { RevenueForecast } from '@/components/analytics/revenue/revenue-forecast'

export default function RevenuePage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Revenue Analytics</h1>
        <DateRangePicker />
      </div>

      <RevenueOverview />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueByService />
        <RevenueByZone />
      </div>

      <PaymentStatus />

      <RevenueForecast />
    </div>
  )
}