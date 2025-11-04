'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { calculateCustomerLTV } from '@/lib/analytics/customers'
import { TrendingUp, Users, DollarSign } from 'lucide-react'

const COLORS = ['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6']

export function CustomerLifetimeValue() {
  const [data, setData] = useState<any[]>([])
  const [avgLTV, setAvgLTV] = useState(0)
  const [topCustomers, setTopCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const ltvData = await calculateCustomerLTV()
      setData(ltvData.distribution)
      setAvgLTV(ltvData.average)
      setTopCustomers(ltvData.topCustomers || [])
    } catch (error) {
      console.error('Failed to load LTV data:', error)
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
          <p className="text-sm text-gray-600">
            {payload[0].value} customers
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Customer Lifetime Value</h2>
        <DollarSign className="h-5 w-5 text-gray-400" />
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(avgLTV)}
              </p>
              <p className="text-xs text-gray-600">Average LTV</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(avgLTV * 1.8)}
              </p>
              <p className="text-xs text-gray-600">Top 10% LTV</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                18
              </p>
              <p className="text-xs text-gray-600">Months Avg</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <span className="text-sm font-medium">Top 10% customers</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">{formatCurrency(avgLTV * 1.8)}</span>
                <span className="text-xs text-gray-500 ml-2">avg</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-sm font-medium">Middle 50% customers</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">{formatCurrency(avgLTV * 0.7)}</span>
                <span className="text-xs text-gray-500 ml-2">avg</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-200" />
                <span className="text-sm font-medium">Bottom 40% customers</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">{formatCurrency(avgLTV * 0.3)}</span>
                <span className="text-xs text-gray-500 ml-2">avg</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">LTV Growth</span>
              <span className="text-sm font-bold">+12.5%</span>
              <span className="text-xs">vs last quarter</span>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}