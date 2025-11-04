'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  Activity,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import { getProductivityMetrics } from '@/lib/analytics/technicians'

interface ProductivityData {
  dailyProductivity: Array<{
    day: string
    jobs: number
    efficiency: number
    revenue: number
    hours: number
  }>
  weeklyMetrics: {
    totalJobs: number
    avgEfficiency: number
    totalRevenue: number
    totalHours: number
    avgJobsPerDay: number
    revenuePerHour: number
  }
}

export function ProductivityMetrics() {
  const [data, setData] = useState<ProductivityData>({
    dailyProductivity: [],
    weeklyMetrics: {
      totalJobs: 0,
      avgEfficiency: 0,
      totalRevenue: 0,
      totalHours: 0,
      avgJobsPerDay: 0,
      revenuePerHour: 0
    }
  })
  const [viewType, setViewType] = useState<'jobs' | 'revenue'>('jobs')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const metricsData = await getProductivityMetrics()
      setData(metricsData)
    } catch (error) {
      console.error('Failed to load productivity metrics:', error)
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
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="text-sm">
              <span className="text-gray-600">{entry.name}: </span>
              <span className="font-semibold">
                {entry.name === 'Revenue'
                  ? formatCurrency(entry.value)
                  : entry.name === 'Efficiency'
                  ? `${entry.value}%`
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Productivity Metrics</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewType('jobs')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewType === 'jobs'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Jobs
          </button>
          <button
            onClick={() => setViewType('revenue')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewType === 'revenue'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Revenue
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[350px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-4 w-4 text-gray-600" />
                <span className="text-xs text-gray-600">Weekly Total</span>
              </div>
              <p className="text-lg font-bold">{data.weeklyMetrics.totalJobs} Jobs</p>
              <p className="text-xs text-gray-500">
                Avg {data.weeklyMetrics.avgJobsPerDay}/day
              </p>
            </div>

            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-xs text-gray-600">Revenue/Hour</span>
              </div>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(data.weeklyMetrics.revenuePerHour)}
              </p>
              <p className="text-xs text-gray-500">
                {data.weeklyMetrics.totalHours}h total
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            {viewType === 'jobs' ? (
              <BarChart data={data.dailyProductivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  yAxisId="left"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  orientation="right"
                  yAxisId="right"
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="jobs"
                  fill="#3b82f6"
                  name="Jobs"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="efficiency"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                  name="Efficiency"
                />
              </BarChart>
            ) : (
              <LineChart data={data.dailyProductivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', r: 4 }}
                  name="Hours"
                  yAxisId="right"
                />
              </LineChart>
            )}
          </ResponsiveContainer>

          <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium">Avg Efficiency</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">
                {data.weeklyMetrics.avgEfficiency}%
              </span>
              {data.weeklyMetrics.avgEfficiency >= 85 ? (
                <Badge className="bg-green-100 text-green-700">Excellent</Badge>
              ) : data.weeklyMetrics.avgEfficiency >= 70 ? (
                <Badge className="bg-yellow-100 text-yellow-700">Good</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700">Needs Improvement</Badge>
              )}
            </div>
          </div>

          {data.weeklyMetrics.avgEfficiency < 70 && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900">
                    Productivity Alert
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Team efficiency is below target. Consider reviewing schedules
                    and workload distribution to optimize productivity.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}