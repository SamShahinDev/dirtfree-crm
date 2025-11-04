'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  UserCheck,
  Briefcase,
  DollarSign,
  Trophy,
  TrendingUp
} from 'lucide-react'
import { getTechnicianOverview } from '@/lib/analytics/technicians'

interface OverviewData {
  totalTechnicians: number
  activeTechnicians: number
  avgJobsPerTech: number
  avgRevenuePerTech: number
  topPerformer: string
  efficiency: number
}

export function TechnicianOverview() {
  const [data, setData] = useState<OverviewData>({
    totalTechnicians: 0,
    activeTechnicians: 0,
    avgJobsPerTech: 0,
    avgRevenuePerTech: 0,
    topPerformer: '',
    efficiency: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const overviewData = await getTechnicianOverview()
      setData(overviewData)
    } catch (error) {
      console.error('Failed to load technician overview:', error)
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

  const metrics = [
    {
      label: 'Total Technicians',
      value: data.totalTechnicians,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      change: null
    },
    {
      label: 'Active Today',
      value: data.activeTechnicians,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      change: `${Math.round((data.activeTechnicians / data.totalTechnicians) * 100)}% active`
    },
    {
      label: 'Avg Jobs/Tech',
      value: data.avgJobsPerTech,
      icon: Briefcase,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      change: '+12% vs last month'
    },
    {
      label: 'Avg Revenue/Tech',
      value: formatCurrency(data.avgRevenuePerTech),
      icon: DollarSign,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      change: '+8% vs last month'
    },
    {
      label: 'Top Performer',
      value: data.topPerformer,
      icon: Trophy,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      change: 'This month'
    },
    {
      label: 'Team Efficiency',
      value: `${data.efficiency.toFixed(0)}%`,
      icon: TrendingUp,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      change: data.efficiency >= 85 ? 'Excellent' : 'Good'
    }
  ]

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Technician Overview</h2>
          <p className="text-sm text-gray-500 mt-1">
            Team performance at a glance
          </p>
        </div>
        <Badge variant="secondary">Current Month</Badge>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div
                key={metric.label}
                className={`p-4 rounded-lg ${metric.bgColor}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                <p className="text-lg font-bold">{metric.value}</p>
                <p className="text-xs text-gray-600">{metric.label}</p>
                {metric.change && (
                  <p className="text-xs text-gray-500 mt-1">
                    {metric.change}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}