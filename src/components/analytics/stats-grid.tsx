import { getAnalyticsStatsAction } from '@/app/actions/analytics'
import { Card } from '@/components/ui/card'
import {
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'
import { cn } from '@/lib/utils'

export async function StatsGrid() {
  const stats = await getAnalyticsStatsAction()

  const statCards = [
    {
      title: 'Total Revenue',
      value: `$${stats.revenue.total.toLocaleString()}`,
      change: stats.revenue.changePercent,
      changeLabel: 'vs last period',
      icon: DollarSign,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100'
    },
    {
      title: 'Active Customers',
      value: stats.customers.active.toLocaleString(),
      change: stats.customers.changePercent,
      changeLabel: 'new this month',
      subtitle: `${stats.customers.total} total`,
      icon: Users,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100'
    },
    {
      title: 'Jobs Completed',
      value: stats.jobs.completed.toLocaleString(),
      change: stats.jobs.completionRate,
      changeLabel: 'completion rate',
      subtitle: `${stats.jobs.scheduled} scheduled`,
      icon: Calendar,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-100'
    },
    {
      title: 'Avg Job Value',
      value: `$${stats.avgJobValue.toFixed(0)}`,
      change: stats.avgJobValueChange,
      changeLabel: 'vs last period',
      icon: TrendingUp,
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-100'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon
        const TrendIcon = stat.change > 0 ? TrendingUp :
                         stat.change < 0 ? TrendingDown : Minus

        return (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold mt-2">
                  {stat.value}
                </p>
                {stat.subtitle && (
                  <p className="text-xs text-gray-500 mt-1">
                    {stat.subtitle}
                  </p>
                )}
                <div className="flex items-center mt-3">
                  <TrendIcon className={cn(
                    'h-4 w-4 mr-1',
                    stat.change > 0 ? 'text-green-600' :
                    stat.change < 0 ? 'text-red-600' :
                    'text-gray-400'
                  )} />
                  <span className={cn(
                    'text-sm font-medium',
                    stat.change > 0 ? 'text-green-600' :
                    stat.change < 0 ? 'text-red-600' :
                    'text-gray-600'
                  )}>
                    {stat.change > 0 ? '+' : ''}{stat.change}%
                  </span>
                  <span className="text-sm text-gray-500 ml-1">
                    {stat.changeLabel}
                  </span>
                </div>
              </div>
              <div className={cn(
                'flex items-center justify-center w-12 h-12 rounded-lg',
                stat.iconBg
              )}>
                <Icon className={cn('h-6 w-6', stat.iconColor)} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}