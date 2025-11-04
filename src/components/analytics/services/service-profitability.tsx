'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts'
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { calculateServiceProfitability } from '@/lib/analytics/services'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export function ServiceProfitability() {
  const [data, setData] = useState<any[]>([])
  const [viewType, setViewType] = useState<'pie' | 'bar'>('pie')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const profitData = await calculateServiceProfitability()
      setData(profitData)
    } catch (error) {
      console.error('Failed to load profitability data:', error)
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
      const data = viewType === 'pie' ? payload[0].payload : payload[0]
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{viewType === 'pie' ? data.name : label}</p>
          <p className="text-sm text-gray-600">
            Revenue: {formatCurrency(viewType === 'pie' ? data.revenue : data.value)}
          </p>
          {viewType === 'pie' && (
            <>
              <p className="text-sm text-gray-600">
                Profit: {formatCurrency(data.profit)}
              </p>
              <p className="text-sm text-gray-600">
                Margin: {data.margin}%
              </p>
            </>
          )}
        </div>
      )
    }
    return null
  }

  const RADIAN = Math.PI / 180
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent
  }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const totalRevenue = data.reduce((sum, s) => sum + s.revenue, 0)
  const totalProfit = data.reduce((sum, s) => sum + s.profit, 0)
  const avgMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Service Profitability</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewType('pie')}
            className={`p-2 rounded-lg transition-colors ${
              viewType === 'pie'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
          </button>
          <button
            onClick={() => setViewType('bar')}
            className={`p-2 rounded-lg transition-colors ${
              viewType === 'bar'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="13" width="4" height="8" />
              <rect x="10" y="9" width="4" height="12" />
              <rect x="17" y="5" width="4" height="16" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-gray-600">Total Revenue</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(totalProfit)}
              </p>
              <p className="text-xs text-gray-600">Total Profit</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-lg font-bold text-blue-600">{avgMargin}%</p>
              <p className="text-xs text-gray-600">Avg Margin</p>
            </div>
          </div>

          {viewType === 'pie' ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="mt-4 space-y-2">
            {data.slice(0, 3).map((service, index) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm font-medium">{service.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(service.revenue)}</p>
                    <p className="text-xs text-gray-600">
                      {formatCurrency(service.profit)} profit
                    </p>
                  </div>
                  <Badge
                    variant={service.margin >= 65 ? 'default' : 'secondary'}
                    className={service.margin >= 65 ? 'bg-green-100 text-green-700' : ''}
                  >
                    {service.margin}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}