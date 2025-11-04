/**
 * Opportunity Statistics Component
 * Server Component that displays opportunity metrics
 */

import { TrendingUp, TrendingDown } from 'lucide-react'

interface OpportunityStatsProps {
  stats: {
    total: number
    new: number
    qualified: number
    won: number
    pipelineValue: number
  }
}

export function OpportunityStats({ stats }: OpportunityStatsProps) {
  const metrics = [
    {
      label: 'Total Opportunities',
      value: stats.total,
      change: '+12%',
      trending: 'up',
      color: 'text-blue-600',
    },
    {
      label: 'New Leads',
      value: stats.new,
      change: '+8%',
      trending: 'up',
      color: 'text-purple-600',
    },
    {
      label: 'Qualified',
      value: stats.qualified,
      change: '+15%',
      trending: 'up',
      color: 'text-green-600',
    },
    {
      label: 'Won',
      value: stats.won,
      change: '+22%',
      trending: 'up',
      color: 'text-emerald-600',
    },
    {
      label: 'Pipeline Value',
      value: \`$\${stats.pipelineValue.toLocaleString()}\`,
      change: '+18%',
      trending: 'up',
      color: 'text-orange-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">{metric.label}</p>
              <p className={\`text-2xl font-bold mt-2 \${metric.color}\`}>
                {metric.value}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            {metric.trending === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span
              className={\`text-sm font-medium \${
                metric.trending === 'up' ? 'text-green-600' : 'text-red-600'
              }\`}
            >
              {metric.change}
            </span>
            <span className="text-sm text-gray-500">vs last month</span>
          </div>
        </div>
      ))}
    </div>
  )
}
