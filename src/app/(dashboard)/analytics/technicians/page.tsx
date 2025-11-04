import { TechnicianOverview } from '@/components/analytics/technicians/technician-overview'
import { TechnicianRanking } from '@/components/analytics/technicians/technician-ranking'
import { ProductivityMetrics } from '@/components/analytics/technicians/productivity-metrics'
import { TechnicianScheduleEfficiency } from '@/components/analytics/technicians/schedule-efficiency'

export default function TechnicianAnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Technician Analytics</h1>

      <TechnicianOverview />
      <TechnicianRanking />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProductivityMetrics />
        <TechnicianScheduleEfficiency />
      </div>
    </div>
  )
}