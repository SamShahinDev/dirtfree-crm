'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Crown,
  Heart,
  TrendingUp,
  UserPlus,
  AlertTriangle,
  UserMinus
} from 'lucide-react'
import { getCustomerSegments } from '@/lib/analytics/customers'

interface Segment {
  id: string
  name: string
  icon: any
  color: string
  bgColor: string
  description: string
  count: number
  percentage: number
  value: number
}

export function CustomerSegments() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCustomers, setTotalCustomers] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const segmentData = await getCustomerSegments()

      const total = Object.values(segmentData).reduce(
        (sum: number, seg: any) => sum + seg.length,
        0
      )
      setTotalCustomers(total)

      const segmentConfig: Segment[] = [
        {
          id: 'vip',
          name: 'VIP Customers',
          icon: Crown,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          description: 'High value, frequent customers',
          count: segmentData.vip?.length || 0,
          percentage: total > 0 ? Math.round((segmentData.vip?.length || 0) / total * 100) : 0,
          value: 2500
        },
        {
          id: 'loyal',
          name: 'Loyal Customers',
          icon: Heart,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          description: 'Regular customers with good value',
          count: segmentData.loyal?.length || 0,
          percentage: total > 0 ? Math.round((segmentData.loyal?.length || 0) / total * 100) : 0,
          value: 1200
        },
        {
          id: 'promising',
          name: 'Promising',
          icon: TrendingUp,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          description: 'Growing engagement and value',
          count: segmentData.promising?.length || 0,
          percentage: total > 0 ? Math.round((segmentData.promising?.length || 0) / total * 100) : 0,
          value: 600
        },
        {
          id: 'new',
          name: 'New Customers',
          icon: UserPlus,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          description: 'Recently acquired customers',
          count: segmentData.new?.length || 0,
          percentage: total > 0 ? Math.round((segmentData.new?.length || 0) / total * 100) : 0,
          value: 150
        },
        {
          id: 'atrisk',
          name: 'At Risk',
          icon: AlertTriangle,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          description: 'Declining engagement',
          count: segmentData.atrisk?.length || 0,
          percentage: total > 0 ? Math.round((segmentData.atrisk?.length || 0) / total * 100) : 0,
          value: 400
        },
        {
          id: 'inactive',
          name: 'Inactive',
          icon: UserMinus,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          description: 'No recent activity',
          count: segmentData.inactive?.length || 0,
          percentage: total > 0 ? Math.round((segmentData.inactive?.length || 0) / total * 100) : 0,
          value: 0
        }
      ]

      setSegments(segmentConfig)
    } catch (error) {
      console.error('Failed to load segment data:', error)
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

  const totalValue = segments.reduce((sum, seg) => sum + seg.value * seg.count, 0)

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Customer Segments</h2>
          <p className="text-sm text-gray-500 mt-1">
            RFM-based customer segmentation
          </p>
        </div>
        <Badge variant="secondary">{totalCustomers} Total</Badge>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((segment) => {
              const Icon = segment.icon
              return (
                <div
                  key={segment.id}
                  className={`p-4 rounded-lg ${segment.bgColor} border`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${segment.color}`} />
                      <div>
                        <p className="font-medium">{segment.name}</p>
                        <p className="text-xs text-gray-600">
                          {segment.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Customers</span>
                      <span className="font-semibold">{segment.count}</span>
                    </div>

                    <Progress
                      value={segment.percentage}
                      className="h-2"
                    />

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">
                        {segment.percentage}% of total
                      </span>
                      <span className="text-xs font-medium">
                        {formatCurrency(segment.value)} avg
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Segment Value</p>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              <p className="text-xs text-gray-500 mt-1">Combined lifetime value</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Value Concentration</p>
              <p className="text-2xl font-bold">
                {segments.length > 0 && totalValue > 0
                  ? Math.round(
                      (segments.find(s => s.id === 'vip')?.value || 0) *
                      (segments.find(s => s.id === 'vip')?.count || 0) /
                      totalValue * 100
                    )
                  : 0}%
              </p>
              <p className="text-xs text-gray-500 mt-1">From VIP customers</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900">Recommended Actions</p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1">
                {segments.find(s => s.id === 'atrisk')?.count > 10 && (
                  <li>• Launch re-engagement campaign for {segments.find(s => s.id === 'atrisk')?.count} at-risk customers</li>
                )}
                {segments.find(s => s.id === 'new')?.count > 5 && (
                  <li>• Create onboarding program for {segments.find(s => s.id === 'new')?.count} new customers</li>
                )}
                {segments.find(s => s.id === 'vip')?.count > 0 && (
                  <li>• Develop VIP loyalty rewards for top {segments.find(s => s.id === 'vip')?.count} customers</li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}