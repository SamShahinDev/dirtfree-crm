'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Users, MessageSquare, Star } from 'lucide-react'
import { useFilterContext } from '@/components/filters/FilterProvider'
import { getSatisfactionKPIs, type SatisfactionKPIs } from '../actions'
import { KPICard } from '@/components/ui/KPICard'

export function KPICards() {
  const { filters } = useFilterContext()
  const [kpis, setKpis] = useState<SatisfactionKPIs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadKPIs() {
      try {
        setLoading(true)
        setError(null)

        const result = await getSatisfactionKPIs({
          zone: filters.zone || undefined,
          technicianId: filters.technicianId || undefined
        })

        setKpis(result)
      } catch (err) {
        console.error('Error loading satisfaction KPIs:', err)
        setError('Failed to load KPIs')
      } finally {
        setLoading(false)
      }
    }

    loadKPIs()
  }, [filters])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (error || !kpis) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">
          {error || 'Failed to load satisfaction metrics'}
        </p>
      </div>
    )
  }

  const thirtyDayResponseRate = kpis.thirtyDay.responseRate
  const ninetyDayResponseRate = kpis.ninetyDay.responseRate
  const thirtyDayAvgScore = kpis.thirtyDay.avgScore
  const ninetyDayAvgScore = kpis.ninetyDay.avgScore

  // Calculate trends (positive if current period is better)
  const responseRateTrend = thirtyDayResponseRate - ninetyDayResponseRate
  const avgScoreTrend = thirtyDayAvgScore - ninetyDayAvgScore

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 30-Day Response Rate */}
      <KPICard
        title="30-Day Response Rate"
        value={`${thirtyDayResponseRate.toFixed(1)}%`}
        subtitle={`${kpis.thirtyDay.responses} of ${kpis.thirtyDay.sent} sent`}
        icon={MessageSquare}
        trend={responseRateTrend > 0 ? 'up' : responseRateTrend < 0 ? 'down' : 'stable'}
        trendValue={`${Math.abs(responseRateTrend).toFixed(1)}% vs 90d`}
        className="bg-blue-50 border-blue-200"
        iconColor="text-blue-600"
      />

      {/* 90-Day Response Rate */}
      <KPICard
        title="90-Day Response Rate"
        value={`${ninetyDayResponseRate.toFixed(1)}%`}
        subtitle={`${kpis.ninetyDay.responses} of ${kpis.ninetyDay.sent} sent`}
        icon={TrendingUp}
        className="bg-indigo-50 border-indigo-200"
        iconColor="text-indigo-600"
      />

      {/* 30-Day Average Score */}
      <KPICard
        title="30-Day Avg Score"
        value={thirtyDayAvgScore > 0 ? thirtyDayAvgScore.toFixed(1) : '—'}
        subtitle={kpis.thirtyDay.responses > 0 ? `From ${kpis.thirtyDay.responses} responses` : 'No responses'}
        icon={Star}
        trend={avgScoreTrend > 0 ? 'up' : avgScoreTrend < 0 ? 'down' : 'stable'}
        trendValue={kpis.thirtyDay.responses > 0 && kpis.ninetyDay.responses > 0 ? `${avgScoreTrend >= 0 ? '+' : ''}${avgScoreTrend.toFixed(1)} vs 90d` : undefined}
        className="bg-green-50 border-green-200"
        iconColor="text-green-600"
      />

      {/* 90-Day Average Score */}
      <KPICard
        title="90-Day Avg Score"
        value={ninetyDayAvgScore > 0 ? ninetyDayAvgScore.toFixed(1) : '—'}
        subtitle={kpis.ninetyDay.responses > 0 ? `From ${kpis.ninetyDay.responses} responses` : 'No responses'}
        icon={Users}
        className="bg-emerald-50 border-emerald-200"
        iconColor="text-emerald-600"
      />
    </div>
  )
}