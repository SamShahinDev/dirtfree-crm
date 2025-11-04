'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import {
  UserPlus,
  TrendingUp,
  DollarSign,
  Target
} from 'lucide-react'
import { getCustomerAcquisition } from '@/lib/analytics/customers'

const SOURCE_COLORS = {
  Referral: '#10b981',
  Google: '#3b82f6',
  Facebook: '#1877f2',
  Direct: '#8b5cf6',
  Other: '#6b7280'
}

export function CustomerAcquisition() {
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  const [metrics, setMetrics] = useState({
    averageCAC: 0,
    ltv_cac_ratio: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const acquisitionData = await getCustomerAcquisition()
      setMonthlyData(acquisitionData.monthlyData)
      setSources(acquisitionData.sources)
      setMetrics({
        averageCAC: acquisitionData.averageCAC,
        ltv_cac_ratio: acquisitionData.ltv_cac_ratio
      })
    } catch (error) {
      console.error('Failed to load acquisition data:', error)
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
              <span className="font-semibold">{entry.value}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const PieCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percentage
  }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return percentage > 5 ? (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${percentage}%`}
      </text>
    ) : null
  }

  const totalNewCustomers = monthlyData.reduce((sum, m) => sum + m.newCustomers, 0)
  const avgMonthlyGrowth = monthlyData.length > 0
    ? monthlyData.reduce((sum, m) => sum + (m.growthRate || 0), 0) / monthlyData.length
    : 0

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Customer Acquisition</h2>
          <p className="text-sm text-gray-500 mt-1">
            New customer trends and sources
          </p>
        </div>
        <Badge variant="secondary">Last 12 months</Badge>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold">{totalNewCustomers}</p>
              <p className="text-xs text-gray-600">Total New Customers</p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold">
                {avgMonthlyGrowth > 0 ? '+' : ''}{avgMonthlyGrowth.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-600">Avg Growth Rate</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(metrics.averageCAC)}</p>
              <p className="text-xs text-gray-600">Avg CAC</p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold">{metrics.ltv_cac_ratio.toFixed(1)}x</p>
              <p className="text-xs text-gray-600">LTV:CAC Ratio</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-4">Monthly Acquisition Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorNewCustomers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                  <Area
                    type="monotone"
                    dataKey="newCustomers"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorNewCustomers)"
                    name="New Customers"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-4">Acquisition Sources</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sources}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={PieCustomLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="source"
                  >
                    {sources.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={SOURCE_COLORS[entry.source as keyof typeof SOURCE_COLORS] || '#6b7280'}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {sources.slice(0, 3).map((source) => (
                  <div
                    key={source.source}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: SOURCE_COLORS[source.source as keyof typeof SOURCE_COLORS] || '#6b7280'
                        }}
                      />
                      <span className="text-sm">{source.source}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">{source.count}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({source.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Acquisition Insights</p>
                <p className="text-sm text-blue-700 mt-1">
                  Your LTV:CAC ratio of {metrics.ltv_cac_ratio.toFixed(1)}x is
                  {metrics.ltv_cac_ratio >= 3 ? ' excellent' : ' good'}.
                  Referrals are your most effective channel at {sources[0]?.percentage}% of acquisitions.
                  Consider investing more in referral programs to reduce CAC.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}