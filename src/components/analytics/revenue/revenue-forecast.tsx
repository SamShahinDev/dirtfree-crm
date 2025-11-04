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
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { TrendingUp, Info } from 'lucide-react'
import { getRevenueForecast } from '@/lib/analytics/revenue'

export function RevenueForecast() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('medium')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const forecastData = await getRevenueForecast()
      setData(forecastData)

      // Determine confidence based on historical variance
      const historicalData = forecastData.filter((d: any) => d.isHistorical)
      const variance = calculateVariance(historicalData.map((d: any) => d.actual))

      if (variance < 0.1) setConfidence('high')
      else if (variance < 0.25) setConfidence('medium')
      else setConfidence('low')
    } catch (error) {
      console.error('Failed to load forecast data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateVariance = (values: number[]) => {
    if (values.length === 0) return 0
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2))
    const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length
    return Math.sqrt(variance) / mean // Coefficient of variation
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
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {data.isHistorical ? (
            <p className="text-sm text-gray-600">
              Actual: {formatCurrency(data.actual)}
            </p>
          ) : (
            <p className="text-sm text-blue-600">
              Forecast: {formatCurrency(data.forecast)}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const getConfidenceColor = () => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-700'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700'
      case 'low':
        return 'bg-red-100 text-red-700'
    }
  }

  const totalHistorical = data
    .filter(d => d.isHistorical)
    .reduce((sum, d) => sum + (d.actual || 0), 0)

  const totalForecast = data
    .filter(d => !d.isHistorical)
    .reduce((sum, d) => sum + (d.forecast || 0), 0)

  const growthRate = totalHistorical > 0
    ? ((totalForecast - totalHistorical) / totalHistorical) * 100
    : 0

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Revenue Forecast</h2>
          <p className="text-sm text-gray-500 mt-1">
            6-month projection based on historical trends
          </p>
        </div>
        <Badge className={getConfidenceColor()}>
          {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
        </Badge>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
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
              <ReferenceLine
                x={data.find(d => !d.isHistorical)?.month}
                stroke="#9ca3af"
                strokeDasharray="5 5"
                label={{ value: "Forecast", position: "top" }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Actual Revenue"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4 }}
                name="Forecasted Revenue"
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">Projected Growth</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {growthRate > 0 ? '+' : ''}{growthRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Over next 6 months
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">6-Month Historical</span>
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(totalHistorical)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Actual revenue
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">6-Month Forecast</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalForecast)}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Projected revenue
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Forecast Methodology</p>
                <p className="text-sm text-blue-700 mt-1">
                  This forecast uses a weighted average of historical growth rates with seasonal adjustments.
                  Confidence level is based on the consistency of past revenue patterns.
                  {confidence === 'low' && ' Consider this forecast as a rough estimate due to high variability in historical data.'}
                  {confidence === 'medium' && ' The forecast shows moderate reliability based on historical trends.'}
                  {confidence === 'high' && ' The forecast has high reliability due to consistent historical patterns.'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}