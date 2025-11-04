'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts'
import { Clock, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { getServiceDuration } from '@/lib/analytics/services'

interface DurationData {
  name: string
  estimated: number
  actual: number
  variance: number
  efficiency: number
}

export function ServiceDuration() {
  const [data, setData] = useState<DurationData[]>([])
  const [viewType, setViewType] = useState<'comparison' | 'efficiency'>('comparison')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const durationData = await getServiceDuration()
      setData(durationData)
    } catch (error) {
      console.error('Failed to load duration data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label || data.name}</p>
          {viewType === 'comparison' ? (
            <>
              <p className="text-sm text-gray-600">
                Estimated: {formatDuration(data.estimated)}
              </p>
              <p className="text-sm text-gray-600">
                Actual: {formatDuration(data.actual)}
              </p>
              <p className="text-sm text-gray-600">
                Variance: {data.variance > 0 ? '+' : ''}{formatDuration(Math.abs(data.variance))}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Efficiency: {data.efficiency}%
              </p>
              <p className="text-sm text-gray-600">
                Time Saved: {data.efficiency > 100 ? formatDuration(data.estimated - data.actual) : 'None'}
              </p>
            </>
          )}
        </div>
      )
    }
    return null
  }

  const avgEfficiency = data.length > 0
    ? data.reduce((sum, d) => sum + d.efficiency, 0) / data.length
    : 100

  const overrunServices = data.filter(d => d.variance > 0)
  const underrunServices = data.filter(d => d.variance < 0)

  const scatterData = data.map(d => ({
    x: d.estimated,
    y: d.actual,
    name: d.name,
    efficiency: d.efficiency
  }))

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Service Duration Analysis</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewType('comparison')}
            className={`p-2 rounded-lg transition-colors ${
              viewType === 'comparison'
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
          <button
            onClick={() => setViewType('efficiency')}
            className={`p-2 rounded-lg transition-colors ${
              viewType === 'efficiency'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path d="M12 2v10l5 5" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[350px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <Clock className="h-4 w-4 text-gray-600" />
              </div>
              <p className="text-lg font-bold">{avgEfficiency.toFixed(0)}%</p>
              <p className="text-xs text-gray-600">Avg Efficiency</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <TrendingUp className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-lg font-bold text-red-600">{overrunServices.length}</p>
              <p className="text-xs text-gray-600">Over Time</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                <TrendingDown className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-lg font-bold text-green-600">{underrunServices.length}</p>
              <p className="text-xs text-gray-600">Under Time</p>
            </div>
          </div>

          {viewType === 'comparison' ? (
            <>
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
                    label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="estimated" fill="#93c5fd" name="Estimated" />
                  <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 space-y-2">
                {data.slice(0, 5).map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {service.variance > 10 && (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="text-sm font-medium">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatDuration(service.actual)}
                        </p>
                        <p className="text-xs text-gray-600">
                          Est: {formatDuration(service.estimated)}
                        </p>
                      </div>
                      <Badge
                        variant={service.efficiency >= 90 ? 'default' : 'secondary'}
                        className={
                          service.efficiency >= 90
                            ? 'bg-green-100 text-green-700'
                            : service.efficiency < 80
                            ? 'bg-red-100 text-red-700'
                            : ''
                        }
                      >
                        {service.efficiency}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={250}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    name="Estimated"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    label={{ value: 'Estimated Duration (min)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    name="Actual"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    label={{ value: 'Actual Duration (min)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    stroke="#999"
                    strokeDasharray="3 3"
                    segment={[
                      { x: 0, y: 0 },
                      { x: Math.max(...scatterData.map(d => Math.max(d.x, d.y))), y: Math.max(...scatterData.map(d => Math.max(d.x, d.y))) }
                    ]}
                  />
                  <Scatter name="Services" data={scatterData} fill="#3b82f6">
                    {scatterData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.efficiency >= 90
                            ? '#10b981'
                            : entry.efficiency < 80
                            ? '#ef4444'
                            : '#3b82f6'
                        }
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Duration Insights</p>
                <p className="text-sm text-blue-700 mt-1">
                  Points above the diagonal line indicate services taking longer than estimated.
                  {avgEfficiency < 85 && ' Consider adjusting time estimates for better planning.'}
                  {avgEfficiency > 95 && ' Your estimates are very accurate!'}
                </p>
              </div>
            </>
          )}
        </>
      )}
    </Card>
  )
}