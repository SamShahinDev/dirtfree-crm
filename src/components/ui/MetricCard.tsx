/**
 * MetricCard Component
 * Displays key performance indicators with modern SaaS styling
 */

import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface MetricCardProps {
  title: string
  value: string
  hint?: string
  delta?: {
    value: string
    direction: 'up' | 'down' | 'flat'
  }
  className?: string
}

export function MetricCard({
  title,
  value,
  hint,
  delta,
  className
}: MetricCardProps) {
  const getDeltaIcon = () => {
    switch (delta?.direction) {
      case 'up':
        return <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
      case 'down':
        return <TrendingDown className="w-3 h-3" strokeWidth={1.5} />
      case 'flat':
      default:
        return <Minus className="w-3 h-3" strokeWidth={1.5} />
    }
  }

  const getDeltaStyle = () => {
    switch (delta?.direction) {
      case 'up':
        return "text-green-700 bg-green-50 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800"
      case 'down':
        return "text-red-700 bg-red-50 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
      case 'flat':
      default:
        return "text-muted-foreground bg-muted border-border"
    }
  }

  return (
    <Card className={cn("relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-200 group", className)} style={{background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.8) 100%)"}}>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      <CardContent className="p-6">
        <div className="space-y-4 relative z-10">
          {/* Title */}
          <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            {title}
          </p>

          {/* Value */}
          <div className="space-y-1">
            <p className="text-3xl md:text-4xl font-bold text-foreground tracking-tight metric-value">
              {value}
            </p>
            {hint && (
              <p className="text-sm text-muted-foreground font-medium">
                {hint}
              </p>
            )}
          </div>

          {/* Delta */}
          {delta && (
            <div className="flex items-center justify-start">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm border",
                getDeltaStyle()
              )}>
                {getDeltaIcon()}
                <span>{delta.value}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}