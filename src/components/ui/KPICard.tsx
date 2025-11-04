import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  className?: string
  iconColor?: string
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  className,
  iconColor = 'text-gray-600'
}: KPICardProps) {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-600" />
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-600" />
      case 'stable':
        return <Minus className="w-3 h-3 text-gray-400" />
      default:
        return null
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      case 'stable':
        return 'text-gray-500'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <Card className={cn('border-2', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={cn('w-5 h-5', iconColor)} />
          {trend && trendValue && (
            <div className={cn('flex items-center space-x-1 text-xs font-medium', getTrendColor())}>
              {getTrendIcon()}
              <span>{trendValue}</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-sm font-medium text-gray-600 leading-tight">
            {title}
          </h3>
          <p className="text-2xl font-bold text-gray-900">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500">
              {subtitle}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}