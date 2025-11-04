/**
 * Sparkline Component
 * Pure React + inline SVG sparkline chart with no external dependencies
 */

import { useMemo } from "react"
import { cn } from "@/lib/utils"

interface SparklineProps {
  data: number[]
  height?: number
  fill?: 'muted' | 'primary'
  strokeWidth?: number
  label?: string
  className?: string
}

export function Sparkline({
  data,
  height = 120,
  fill = 'muted',
  strokeWidth = 2,
  label,
  className
}: SparklineProps) {
  const { pathData, areaData, min, max } = useMemo(() => {
    if (data.length === 0) {
      return { pathData: '', areaData: '', min: 0, max: 0 }
    }

    const minValue = Math.min(...data)
    const maxValue = Math.max(...data)
    const range = maxValue - minValue || 1

    // Calculate width based on data points with minimum spacing
    const width = Math.max(200, data.length * 8)
    const padding = 4

    const points = data.map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / (data.length - 1)
      const y = padding + ((maxValue - value) * (height - padding * 2)) / range
      return { x, y }
    })

    // Create path for line
    const pathCommands = points.map((point, index) =>
      `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    ).join(' ')

    // Create area path (line + bottom edge)
    const areaCommands = [
      ...points.map((point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
      ),
      `L ${points[points.length - 1].x} ${height - padding}`,
      `L ${points[0].x} ${height - padding}`,
      'Z'
    ].join(' ')

    return {
      pathData: pathCommands,
      areaData: areaCommands,
      min: minValue,
      max: maxValue,
      width
    }
  }, [data, height])

  const strokeColor = fill === 'primary' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
  const fillColor = fill === 'primary'
    ? 'hsl(var(--primary) / 0.1)'
    : 'hsl(var(--muted-foreground) / 0.1)'

  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <p className="text-sm text-muted-foreground">No data available</p>
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${Math.max(200, data.length * 8)} ${height}`}
        className="overflow-visible"
        role="img"
        aria-label={label || `Sparkline chart with ${data.length} data points`}
      >
        {label && <title>{label}</title>}

        {/* Area fill */}
        <path
          d={areaData}
          fill={fillColor}
          className="transition-colors duration-200"
        />

        {/* Stroke line */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-colors duration-200"
        />
      </svg>
    </div>
  )
}