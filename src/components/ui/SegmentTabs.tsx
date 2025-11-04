/**
 * SegmentTabs Component
 * Tiny segmented tabs for time range selection with keyboard accessibility
 */

import { cn } from "@/lib/utils"

interface SegmentTabsProps {
  value: '3m' | '30d' | '7d'
  onValueChange: (value: '3m' | '30d' | '7d') => void
  className?: string
}

const SEGMENT_OPTIONS = [
  { value: '7d' as const, label: '7d' },
  { value: '30d' as const, label: '30d' },
  { value: '3m' as const, label: '3m' },
]

export function SegmentTabs({
  value,
  onValueChange,
  className
}: SegmentTabsProps) {
  return (
    <div
      className={cn(
        "flex items-center rounded-lg border border-border bg-muted p-1",
        className
      )}
      role="tablist"
      aria-label="Time range selection"
    >
      {SEGMENT_OPTIONS.map((option) => {
        const isActive = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${option.value}`}
            className={cn(
              "relative flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onValueChange(option.value)
              }

              // Arrow key navigation
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault()
                const currentIndex = SEGMENT_OPTIONS.findIndex(opt => opt.value === value)
                const nextIndex = e.key === 'ArrowLeft'
                  ? (currentIndex - 1 + SEGMENT_OPTIONS.length) % SEGMENT_OPTIONS.length
                  : (currentIndex + 1) % SEGMENT_OPTIONS.length
                onValueChange(SEGMENT_OPTIONS[nextIndex].value)
              }
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}