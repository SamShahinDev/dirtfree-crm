'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { calculateRetentionRate } from '@/lib/analytics/customers'
import { TrendingDown, AlertCircle } from 'lucide-react'

export function CustomerRetention() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [avgRetention, setAvgRetention] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const retentionData = await calculateRetentionRate()
      setData(retentionData)

      // Calculate average retention
      const avg = retentionData.length > 0
        ? retentionData.reduce((sum, d) => sum + d.retention, 0) / retentionData.length
        : 0
      setAvgRetention(Math.round(avg))
    } catch (error) {
      console.error('Failed to load retention data:', error)
    } finally {
      setLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-gray-600">
            Retention: {data.retention}%
          </p>
          <p className="text-xs text-gray-500">
            {data.retained} of {data.totalCustomers} customers
          </p>
        </div>
      )
    }
    return null
  }

  const getRetentionStatus = (rate: number) => {
    if (rate >= 80) return { label: 'Excellent', color: 'text-green-600 bg-green-50' }
    if (rate >= 60) return { label: 'Good', color: 'text-blue-600 bg-blue-50' }
    if (rate >= 40) return { label: 'Average', color: 'text-yellow-600 bg-yellow-50' }
    return { label: 'Poor', color: 'text-red-600 bg-red-50' }
  }

  const status = getRetentionStatus(avgRetention)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Customer Retention</h2>
        <Badge className={status.color}>{status.label}</Badge>
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">{avgRetention}%</p>
              <p className="text-xs text-gray-600">Avg Retention</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">
                {data.length > 0 ? data[data.length - 1].retention : 0}%
              </p>
              <p className="text-xs text-gray-600">Current Month</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold">
                {data.length > 0
                  ? data.reduce((sum, d) => sum + d.churned, 0)
                  : 0}
              </p>
              <p className="text-xs text-gray-600">Total Churned</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
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
              <Legend />
              <Line
                type="monotone"
                dataKey="retention"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Retention Rate"
              />
            </LineChart>
          </ResponsiveContainer>

          {avgRetention < 60 && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">
                    Retention Alert
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Your retention rate is below industry average. Consider implementing
                    loyalty programs or improving customer engagement.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">Industry Benchmark</span>
              <span className="text-sm font-semibold">65-75%</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">Your 3-Month Avg</span>
              <span className="text-sm font-semibold">
                {data.length >= 3
                  ? Math.round(
                      data.slice(-3).reduce((sum, d) => sum + d.retention, 0) / 3
                    )
                  : avgRetention}%
              </span>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}