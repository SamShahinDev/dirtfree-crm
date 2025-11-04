'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Trophy,
  TrendingUp,
  Clock,
  Star,
  DollarSign,
  Activity
} from 'lucide-react'
import { getServicePerformance } from '@/lib/analytics/services'

interface ServiceMetric {
  id: string
  name: string
  totalJobs: number
  completedJobs: number
  revenue: number
  price: number
  duration: number
  avgRating: number
  completionRate: number
  category: string
}

export function ServicePerformance() {
  const [services, setServices] = useState<ServiceMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'top' | 'low'>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const performanceData = await getServicePerformance()
      setServices(performanceData)
    } catch (error) {
      console.error('Failed to load performance data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const filteredServices = services.filter(service => {
    if (filter === 'top') return service.completionRate >= 90
    if (filter === 'low') return service.completionRate < 70
    return true
  })

  const totalRevenue = services.reduce((sum, s) => sum + s.revenue, 0)
  const totalJobs = services.reduce((sum, s) => sum + s.totalJobs, 0)
  const avgCompletionRate = services.length > 0
    ? services.reduce((sum, s) => sum + s.completionRate, 0) / services.length
    : 0

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Service Performance</h2>
          <p className="text-sm text-gray-500 mt-1">
            Track service metrics and completion rates
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'top', 'low'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === f
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All' : f === 'top' ? 'Top Performers' : 'Need Attention'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-gray-600">Total Revenue</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold">{totalJobs}</p>
              <p className="text-xs text-gray-600">Total Jobs</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold">{avgCompletionRate.toFixed(0)}%</p>
              <p className="text-xs text-gray-600">Avg Completion</p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold">4.6</p>
              <p className="text-xs text-gray-600">Avg Rating</p>
            </div>
          </div>

          <div className="space-y-3">
            {filteredServices.map((service, index) => (
              <div
                key={service.id}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{service.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {service.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {service.totalJobs} jobs • {service.duration} min avg
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(service.revenue)}</p>
                    <p className="text-xs text-gray-600">
                      {formatCurrency(service.price)}/service
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Completion Rate</span>
                      <span className="text-xs font-medium">
                        {service.completionRate.toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      value={service.completionRate}
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Customer Rating</span>
                      <span className="text-xs font-medium">
                        {service.avgRating.toFixed(1)}/5.0
                      </span>
                    </div>
                    <Progress
                      value={service.avgRating * 20}
                      className="h-2"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Jobs Completed</span>
                      <span className="text-xs font-medium">
                        {service.completedJobs}/{service.totalJobs}
                      </span>
                    </div>
                    <Progress
                      value={service.totalJobs > 0 ? (service.completedJobs / service.totalJobs) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3">
                  {service.completionRate >= 90 && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>High Performance</span>
                    </div>
                  )}
                  {service.avgRating >= 4.5 && (
                    <div className="flex items-center gap-1 text-xs text-yellow-600">
                      <Star className="h-3 w-3" />
                      <span>Top Rated</span>
                    </div>
                  )}
                  {service.revenue > totalRevenue / services.length * 1.5 && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <DollarSign className="h-3 w-3" />
                      <span>High Revenue</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredServices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No services match the selected filter</p>
            </div>
          )}
        </>
      )}
    </Card>
  )
}