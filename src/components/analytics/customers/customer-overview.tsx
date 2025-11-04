'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Star,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { getCustomerOverview } from '@/lib/analytics/customers'

export function CustomerOverview() {
  const [data, setData] = useState<any>({
    totalCustomers: 0,
    activeCustomers: 0,
    newCustomers: 0,
    churnRate: 0,
    activeRate: 0,
    satisfaction: 0,
    nps: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const overviewData = await getCustomerOverview()
      setData(overviewData)
    } catch (error) {
      console.error('Failed to load customer overview:', error)
    } finally {
      setLoading(false)
    }
  }

  const metrics = [
    {
      label: 'Total Customers',
      value: data.totalCustomers,
      change: '+12',
      changeType: 'positive' as const,
      icon: Users,
      color: 'blue'
    },
    {
      label: 'Active Customers',
      value: data.activeCustomers,
      percentage: `${data.activeRate}%`,
      icon: UserCheck,
      color: 'green'
    },
    {
      label: 'New This Month',
      value: data.newCustomers,
      change: '+8%',
      changeType: 'positive' as const,
      icon: UserPlus,
      color: 'purple'
    },
    {
      label: 'Churn Rate',
      value: `${data.churnRate}%`,
      change: '-2%',
      changeType: 'positive' as const,
      icon: UserX,
      color: 'red'
    }
  ]

  const getIconColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'text-blue-600'
      case 'green':
        return 'text-green-600'
      case 'purple':
        return 'text-purple-600'
      case 'red':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getBgColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50'
      case 'green':
        return 'bg-green-50'
      case 'purple':
        return 'bg-purple-50'
      case 'red':
        return 'bg-red-50'
      default:
        return 'bg-gray-50'
    }
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Customer Overview</h2>
        <Badge variant="secondary">Last 30 days</Badge>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <div
                  key={metric.label}
                  className={`p-4 rounded-lg ${getBgColor(metric.color)}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`h-5 w-5 ${getIconColor(metric.color)}`} />
                    {metric.change && (
                      <div className="flex items-center gap-1">
                        {metric.changeType === 'positive' ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <span className={`text-xs font-medium ${
                          metric.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {metric.change}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-2xl font-bold">{metric.value}</p>
                  <p className="text-xs text-gray-600 mt-1">{metric.label}</p>
                  {metric.percentage && (
                    <p className="text-xs font-medium text-gray-700 mt-1">
                      {metric.percentage} of total
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium">Customer Satisfaction</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{data.satisfaction}</span>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor(data.satisfaction)
                          ? 'text-yellow-500 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-1">Based on 324 reviews</p>
            </div>

            <div className="p-4 bg-indigo-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                <span className="text-sm font-medium">Net Promoter Score</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-indigo-600">{data.nps}</span>
                <Badge className="bg-indigo-100 text-indigo-700">Excellent</Badge>
              </div>
              <p className="text-xs text-gray-600 mt-1">Industry avg: 50</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="p-1 bg-blue-100 rounded">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">Growth Insights</p>
                <p className="text-sm text-blue-700 mt-1">
                  Customer base growing at 15% MoM. Active customer rate of {data.activeRate}%
                  is above industry average. Focus on reducing churn rate to maintain growth momentum.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}