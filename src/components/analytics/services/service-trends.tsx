'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Activity,
  BarChart3
} from 'lucide-react'
import { getServiceTrends, getServiceComparisons, getServiceUtilization } from '@/lib/analytics/services'

export function ServiceTrends() {
  const [trendData, setTrendData] = useState<any[]>([])
  const [comparisons, setComparisons] = useState<any[]>([])
  const [utilization, setUtilization] = useState<any[]>([])
  const [viewType, setViewType] = useState<'trends' | 'comparison' | 'utilization'>('trends')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [trendsData, compData, utilizationData] = await Promise.all([
        getServiceTrends(),
        getServiceComparisons(),
        getServiceUtilization()
      ])
      setTrendData(trendsData)
      setComparisons(compData)
      setUtilization(utilizationData)
    } catch (error) {
      console.error('Failed to load trends data:', error)
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="text-sm">
              <span
                className="inline-block w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: entry.stroke || entry.fill }}
              />
              <span className="text-gray-600">{entry.name}: </span>
              <span className="font-semibold">
                {viewType === 'utilization' ? `${entry.value}%` : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  // Get service names from trend data
  const serviceNames = trendData.length > 0
    ? Object.keys(trendData[0]).filter(key => key !== 'month')
    : []

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  // Calculate growth trends
  const growthServices = comparisons.filter(s => s.growthRate > 0).length
  const declineServices = comparisons.filter(s => s.growthRate < 0).length

  // Calculate average utilization
  const avgUtilization = utilization.length > 0
    ? utilization.reduce((sum, u) => sum + u.utilization, 0) / utilization.length
    : 0

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Service Trends & Insights</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewType('trends')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              viewType === 'trends'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Trends
          </button>
          <button
            onClick={() => setViewType('comparison')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              viewType === 'comparison'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Compare
          </button>
          <button
            onClick={() => setViewType('utilization')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
              viewType === 'utilization'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Activity className="h-4 w-4" />
            Utilization
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {viewType === 'trends' && (
            <>
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-4">6-Month Service Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {serviceNames.map((service, index) => (
                      <Line
                        key={service}
                        type="monotone"
                        dataKey={service}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        name={service}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Top Growth</span>
                  </div>
                  {serviceNames.length > 0 && trendData.length >= 2 && (
                    <p className="text-xs text-gray-600">
                      {(() => {
                        const lastMonth = trendData[trendData.length - 1]
                        const prevMonth = trendData[trendData.length - 2]
                        let maxGrowth = 0
                        let topService = ''
                        serviceNames.forEach(service => {
                          const growth = lastMonth[service] - prevMonth[service]
                          if (growth > maxGrowth) {
                            maxGrowth = growth
                            topService = service
                          }
                        })
                        return `${topService} (+${maxGrowth} jobs)`
                      })()}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Most Popular</span>
                  </div>
                  {serviceNames.length > 0 && trendData.length > 0 && (
                    <p className="text-xs text-gray-600">
                      {(() => {
                        const lastMonth = trendData[trendData.length - 1]
                        let maxJobs = 0
                        let topService = ''
                        serviceNames.forEach(service => {
                          if (lastMonth[service] > maxJobs) {
                            maxJobs = lastMonth[service]
                            topService = service
                          }
                        })
                        return `${topService} (${maxJobs} jobs)`
                      })()}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {viewType === 'comparison' && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-lg font-bold text-green-600">{growthServices}</p>
                  <p className="text-xs text-gray-600">Growing Services</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-lg font-bold text-red-600">{declineServices}</p>
                  <p className="text-xs text-gray-600">Declining Services</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold">{comparisons.length - growthServices - declineServices}</p>
                  <p className="text-xs text-gray-600">Stable Services</p>
                </div>
              </div>

              <div className="space-y-3">
                {comparisons.slice(0, 6).map((service) => (
                  <div
                    key={service.id}
                    className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{service.name}</p>
                      <Badge
                        variant={service.growthRate > 0 ? 'default' : 'secondary'}
                        className={
                          service.growthRate > 10
                            ? 'bg-green-100 text-green-700'
                            : service.growthRate < -10
                            ? 'bg-red-100 text-red-700'
                            : ''
                        }
                      >
                        {service.growthRate > 0 ? '+' : ''}{service.growthRate}%
                        {service.growthRate > 0 ? (
                          <TrendingUp className="h-3 w-3 ml-1 inline" />
                        ) : service.growthRate < 0 ? (
                          <TrendingDown className="h-3 w-3 ml-1 inline" />
                        ) : null}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">This Month</p>
                        <p className="font-semibold">
                          {service.thisMonth.jobs} jobs • {formatCurrency(service.thisMonth.revenue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Last Month</p>
                        <p className="font-semibold">
                          {service.lastMonth.jobs} jobs • {formatCurrency(service.lastMonth.revenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {viewType === 'utilization' && (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">Weekly Capacity Utilization</h3>
                  <Badge variant="secondary">{avgUtilization.toFixed(0)}% avg</Badge>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={utilization}>
                    <defs>
                      <linearGradient id="colorUtilization" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="utilization"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#colorUtilization)"
                      name="Utilization"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {utilization.map((day) => (
                  <div
                    key={day.day}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium">{day.day}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-600">
                        {day.jobs} jobs • {Math.round(day.totalMinutes / 60)}h
                      </span>
                      <div className="w-24">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">{day.utilization}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              day.utilization > 80
                                ? 'bg-red-500'
                                : day.utilization > 60
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${day.utilization}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Capacity Insights</p>
                <p className="text-sm text-blue-700 mt-1">
                  {avgUtilization > 75
                    ? 'High utilization detected. Consider adding more technicians or optimizing schedules.'
                    : avgUtilization < 40
                    ? 'Low utilization suggests capacity for more bookings. Focus on marketing and promotions.'
                    : 'Utilization is balanced. Monitor for seasonal changes.'}
                </p>
              </div>
            </>
          )}
        </>
      )}
    </Card>
  )
}