'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getStatusColor, type JobStatus } from '@/types/job'

export interface LegendProps {
  className?: string
  compact?: boolean
}

const STATUS_INFO: Record<JobStatus, { label: string; description: string }> = {
  scheduled: {
    label: 'Scheduled',
    description: 'Job is scheduled and awaiting technician assignment or start'
  },
  in_progress: {
    label: 'In Progress',
    description: 'Job is currently being worked on by technician'
  },
  completed: {
    label: 'Completed',
    description: 'Job has been finished and service history recorded'
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Job was cancelled and will not be performed'
  }
}

export function Legend({ className, compact = false }: LegendProps) {
  const getStatusBadgeProps = (status: JobStatus) => {
    const color = getStatusColor(status)

    switch (color) {
      case 'blue':
        return {
          variant: 'default' as const,
          style: {
            backgroundColor: 'hsl(217 91% 60%)',
            borderColor: 'hsl(217 91% 50%)',
            color: 'white'
          }
        }
      case 'yellow':
        return {
          variant: 'secondary' as const,
          style: {
            backgroundColor: 'hsl(48 96% 53%)',
            borderColor: 'hsl(48 96% 43%)',
            color: 'hsl(222.2 84% 4.9%)'
          }
        }
      case 'green':
        return {
          variant: 'default' as const,
          style: {
            backgroundColor: 'hsl(142 71% 45%)',
            borderColor: 'hsl(142 71% 35%)',
            color: 'white'
          }
        }
      case 'red':
        return {
          variant: 'destructive' as const,
          style: {
            backgroundColor: 'hsl(0 84% 60%)',
            borderColor: 'hsl(0 84% 50%)',
            color: 'white'
          }
        }
      default:
        return { variant: 'outline' as const, style: {} }
    }
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-4 ${className || ''}`}>
        <span className="text-sm font-medium text-muted-foreground">Status:</span>
        <div className="flex items-center gap-3">
          {Object.entries(STATUS_INFO).map(([status, info]) => {
            const badgeProps = getStatusBadgeProps(status as JobStatus)
            return (
              <div key={status} className="flex items-center gap-1">
                <Badge
                  variant={badgeProps.variant}
                  style={badgeProps.style}
                  className="text-xs px-2 py-1"
                >
                  {info.label}
                </Badge>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Job Status Legend</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(STATUS_INFO).map(([status, info]) => {
          const badgeProps = getStatusBadgeProps(status as JobStatus)
          return (
            <div key={status} className="flex items-start gap-3">
              <Badge
                variant={badgeProps.variant}
                style={badgeProps.style}
                className="text-xs px-2 py-1 mt-0.5"
              >
                {info.label}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">
                  {info.description}
                </p>
              </div>
            </div>
          )
        })}

        {/* Additional legend items */}
        <div className="pt-2 border-t space-y-2">
          <h4 className="text-sm font-medium">Calendar Features</h4>

          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary/20 border border-primary rounded"></div>
              <span>Drag events to reschedule or reassign technicians</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-muted border rounded"></div>
              <span>Resize events to adjust duration</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-destructive/20 border border-destructive rounded"></div>
              <span>Completed/cancelled jobs cannot be modified</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-destructive rounded-full"></div>
              <span>Red line indicates current time</span>
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts */}
        <div className="pt-2 border-t">
          <h4 className="text-sm font-medium mb-2">Keyboard Shortcuts</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Click event</span>
              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Click</kbd>
            </div>
            <div className="flex justify-between">
              <span>Open event menu</span>
              <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd>
            </div>
            <div className="flex justify-between">
              <span>Navigate events</span>
              <div className="space-x-1">
                <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Tab</kbd>
                <kbd className="px-1 py-0.5 bg-muted rounded text-xs">↑↓</kbd>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}