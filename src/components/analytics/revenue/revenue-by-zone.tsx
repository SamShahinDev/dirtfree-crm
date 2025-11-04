'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getRevenueByZone } from '@/lib/analytics/revenue'

export function RevenueByZone() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const zoneData = await getRevenueByZone()
      setData(zoneData)
    } catch (error) {
      console.error('Failed to load zone revenue:', error)
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

  const maxValue = Math.max(...data.map(d => d.value))

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Revenue by Zone</h2>
        <button className="text-sm text-blue-600 hover:text-blue-700">
          View Map
        </button>
      </div>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((zone, index) => (
            <div key={zone.name} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: zone.color }}
                  />
                  <span className="font-medium">{zone.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(zone.value)}</p>
                  <p className="text-xs text-gray-500">{zone.percentage}%</p>
                </div>
              </div>
              <Progress
                value={(zone.value / maxValue) * 100}
                className="h-2"
                style={
                  {
                    '--progress-background': zone.color
                  } as React.CSSProperties
                }
              />
            </div>
          ))}

          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-xl font-bold">
                  {formatCurrency(data.reduce((sum, z) => sum + z.value, 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Best Zone</p>
                <p className="text-xl font-bold">
                  {data[0]?.name || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-blue-600 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Zone Optimization</p>
                <p className="text-sm text-blue-700 mt-1">
                  Consider increasing service capacity in North District due to high demand.
                  West District shows potential for growth with targeted marketing.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}