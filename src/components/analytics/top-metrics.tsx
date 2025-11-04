import { getTopMetricsAction } from '@/app/actions/analytics'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Trophy,
  Star,
  MapPin,
  Wrench,
  Users,
  Clock
} from 'lucide-react'

export async function TopMetrics() {
  const metrics = await getTopMetricsAction()

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold">Top Performers</h3>
          <p className="text-sm text-gray-500 mt-1">
            Leading metrics across categories
          </p>
        </div>
        <Badge variant="secondary">This Month</Badge>
      </div>

      <div className="space-y-6">
        {/* Top Technician */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-700">
              Top Technician
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback style={{ backgroundColor: metrics.topTechnician.color }}>
                  {metrics.topTechnician.name.split(' ').map((n: string) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{metrics.topTechnician.name}</p>
                <p className="text-sm text-gray-500">
                  {metrics.topTechnician.jobsCompleted} jobs
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">${metrics.topTechnician.revenue}</p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="h-3 w-3 text-yellow-500 fill-current" />
                <span className="text-xs text-gray-500">
                  {metrics.topTechnician.rating}/5
                </span>
              </div>
            </div>
          </div>
          <Progress value={metrics.topTechnician.efficiency} className="mt-2" />
          <p className="text-xs text-gray-500 mt-1">
            {metrics.topTechnician.efficiency}% efficiency
          </p>
        </div>

        {/* Top Service */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-700">
              Most Popular Service
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{metrics.topService.name}</p>
              <p className="text-sm text-gray-500">
                {metrics.topService.count} bookings
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">${metrics.topService.revenue}</p>
              <p className="text-xs text-gray-500">
                ${metrics.topService.avgPrice} avg
              </p>
            </div>
          </div>
          <Progress value={(metrics.topService.count / metrics.totalJobs) * 100} className="mt-2" />
          <p className="text-xs text-gray-500 mt-1">
            {((metrics.topService.count / metrics.totalJobs) * 100).toFixed(1)}% of all jobs
          </p>
        </div>

        {/* Top Zone */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-gray-700">
              Busiest Zone
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{metrics.topZone.name}</p>
              <p className="text-sm text-gray-500">
                {metrics.topZone.jobCount} jobs
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">${metrics.topZone.revenue}</p>
              <Badge
                variant="outline"
                style={{ borderColor: metrics.topZone.color, color: metrics.topZone.color }}
                className="mt-1"
              >
                Zone {metrics.topZone.number}
              </Badge>
            </div>
          </div>
          <Progress value={(metrics.topZone.jobCount / metrics.totalJobs) * 100} className="mt-2" />
          <p className="text-xs text-gray-500 mt-1">
            {metrics.topZone.customerCount} customers
          </p>
        </div>

        {/* Customer Retention */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-gray-700">
              Customer Retention
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold">{metrics.retention.rate}%</p>
              <p className="text-xs text-gray-500">Retention Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.retention.repeatCustomers}</p>
              <p className="text-xs text-gray-500">Repeat Customers</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.retention.avgLifetimeValue}</p>
              <p className="text-xs text-gray-500">Avg LTV</p>
            </div>
          </div>
        </div>

        {/* Response Time */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-700">
              Average Response Time
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{metrics.avgResponseTime} hrs</p>
              <p className="text-sm text-gray-500">
                {metrics.responseTimeImprovement > 0 ? 'Improved' : 'Slower'} by {Math.abs(metrics.responseTimeImprovement)}% this month
              </p>
            </div>
            <Progress
              value={100 - (metrics.avgResponseTime / 48) * 100}
              className="w-24"
            />
          </div>
        </div>
      </div>
    </Card>
  )
}