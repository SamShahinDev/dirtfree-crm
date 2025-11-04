'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
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
  Legend
} from 'recharts'
import { getRevenueData } from '@/lib/analytics/revenue'

export function RevenueOverview() {
  const [data, setData] = useState<any[]>([])
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    setLoading(true)
    try {
      const revenueData = await getRevenueData(period)
      setData(revenueData)
    } catch (error) {
      console.error('Failed to load revenue data:', error)
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
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mt-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-600">{entry.name}:</span>
              <span className="text-sm font-semibold">
                {formatCurrency(entry.value)}
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Revenue Overview</h2>
        <div className="flex gap-2">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                period === p
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              tickFormatter={formatCurrency}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorRevenue)"
              name="Revenue"
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Target"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="text-center">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-xl md:text-2xl font-bold">$124,532</p>
          <p className="text-sm text-green-600">+12.5%</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Avg Transaction</p>
          <p className="text-xl md:text-2xl font-bold">$285</p>
          <p className="text-sm text-green-600">+3.2%</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Transactions</p>
          <p className="text-xl md:text-2xl font-bold">437</p>
          <p className="text-sm text-red-600">-2.1%</p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600">Growth Rate</p>
          <p className="text-xl md:text-2xl font-bold">15.3%</p>
          <p className="text-sm text-green-600">+5.4%</p>
        </div>
      </div>
    </Card>
  )
}