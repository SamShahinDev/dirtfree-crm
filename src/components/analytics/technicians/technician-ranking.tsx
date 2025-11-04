'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Star,
  Medal
} from 'lucide-react'
import { getTechnicianRankings } from '@/lib/analytics/technicians'

interface TechnicianRank {
  id: string
  name: string
  jobCount: number
  value: string | number
  trend: number
  rating: number
}

export function TechnicianRanking() {
  const [rankings, setRankings] = useState<TechnicianRank[]>([])
  const [metric, setMetric] = useState<'revenue' | 'jobs' | 'efficiency'>('revenue')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [metric])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getTechnicianRankings(metric)
      setRankings(data)
    } catch (error) {
      console.error('Failed to load technician rankings:', error)
    } finally {
      setLoading(false)
    }
  }

  const getMetricIcon = (key: string) => {
    switch (key) {
      case 'revenue':
        return DollarSign
      case 'jobs':
        return Trophy
      case 'efficiency':
        return Clock
      default:
        return Trophy
    }
  }

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100">
          <Medal className="w-5 h-5 text-yellow-600" />
        </div>
      )
    } else if (index === 1) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
          <Medal className="w-5 h-5 text-gray-600" />
        </div>
      )
    } else if (index === 2) {
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100">
          <Medal className="w-5 h-5 text-orange-600" />
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50">
        <span className="text-sm font-bold text-gray-600">#{index + 1}</span>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Technician Rankings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Top performers by metric
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { key: 'revenue', label: 'Revenue', icon: DollarSign },
            { key: 'jobs', label: 'Jobs', icon: Trophy },
            { key: 'efficiency', label: 'Efficiency', icon: Clock }
          ].map((m) => {
            const Icon = m.icon
            return (
              <button
                key={m.key}
                onClick={() => setMetric(m.key as any)}
                className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  metric === m.key
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {rankings.map((tech, index) => (
            <div
              key={tech.id}
              className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                index < 3
                  ? 'bg-gradient-to-r from-blue-50 to-transparent border-l-4 border-blue-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              {getRankBadge(index)}

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{tech.name}</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs text-gray-600">
                      {tech.rating.toFixed(1)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {tech.jobCount} jobs completed this month
                </p>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold">
                  {metric === 'revenue'
                    ? tech.value
                    : metric === 'jobs'
                    ? `${tech.value} jobs`
                    : `${tech.value}%`}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  {tech.trend > 0 ? (
                    <>
                      <TrendingUp className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-green-600">
                        +{tech.trend}%
                      </span>
                    </>
                  ) : tech.trend < 0 ? (
                    <>
                      <TrendingDown className="w-3 h-3 text-red-600" />
                      <span className="text-xs text-red-600">
                        {tech.trend}%
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">No change</span>
                  )}
                  <span className="text-xs text-gray-500">vs last</span>
                </div>
              </div>

              {index < 3 && (
                <Badge
                  variant={index === 0 ? 'default' : 'secondary'}
                  className={
                    index === 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : index === 1
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-orange-100 text-orange-700'
                  }
                >
                  {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {rankings.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-2">
            <Trophy className="h-4 w-4 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Performance Insights
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {metric === 'revenue' && (
                  <>
                    {rankings[0].name} is leading in revenue generation with{' '}
                    {rankings[0].value} this month.
                    {rankings[0].trend > 10 &&
                      ' Exceptional growth compared to last period!'}
                  </>
                )}
                {metric === 'jobs' && (
                  <>
                    {rankings[0].name} completed the most jobs with{' '}
                    {rankings[0].value} completions.
                    {rankings[0].trend > 15 &&
                      ' Outstanding productivity improvement!'}
                  </>
                )}
                {metric === 'efficiency' && (
                  <>
                    {rankings[0].name} has the highest efficiency at{' '}
                    {rankings[0].value}%.
                    {Number(rankings[0].value) >= 95 &&
                      ' Near-perfect time utilization!'}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}