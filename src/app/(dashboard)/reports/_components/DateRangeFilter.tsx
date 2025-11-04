'use client'

import { useState, useEffect } from 'react'
import { Calendar, RotateCcw } from 'lucide-react'
import { format, subDays } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DateRange {
  from: string
  to: string
}

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
  label?: string
  className?: string
}

export function DateRangeFilter({
  value,
  onChange,
  label = 'Date Range',
  className = ''
}: DateRangeFilterProps) {
  const [fromDate, setFromDate] = useState(value.from)
  const [toDate, setToDate] = useState(value.to)

  // Update local state when prop changes
  useEffect(() => {
    setFromDate(value.from)
    setToDate(value.to)
  }, [value.from, value.to])

  // Handle date changes
  const handleFromChange = (date: string) => {
    setFromDate(date)
    onChange({ from: date, to: toDate })
  }

  const handleToChange = (date: string) => {
    setToDate(date)
    onChange({ from: fromDate, to: date })
  }

  // Preset date ranges
  const presets = [
    {
      label: 'Last 7 days',
      getValue: () => ({
        from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd')
      })
    },
    {
      label: 'Last 30 days',
      getValue: () => ({
        from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd')
      })
    },
    {
      label: 'Last 90 days',
      getValue: () => ({
        from: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd')
      })
    },
    {
      label: 'This year',
      getValue: () => ({
        from: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
        to: format(new Date(), 'yyyy-MM-dd')
      })
    }
  ]

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getValue()
    setFromDate(range.from)
    setToDate(range.to)
    onChange(range)
  }

  const handleReset = () => {
    const defaultRange = {
      from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
      to: format(new Date(), 'yyyy-MM-dd')
    }
    setFromDate(defaultRange.from)
    setToDate(defaultRange.to)
    onChange(defaultRange)
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="w-4 h-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Custom Date Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="from-date" className="text-xs font-medium text-gray-700">
              From Date
            </Label>
            <Input
              id="from-date"
              type="date"
              value={fromDate}
              onChange={(e) => handleFromChange(e.target.value)}
              max={toDate}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to-date" className="text-xs font-medium text-gray-700">
              To Date
            </Label>
            <Input
              id="to-date"
              type="date"
              value={toDate}
              onChange={(e) => handleToChange(e.target.value)}
              min={fromDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="text-sm"
            />
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Quick Presets</Label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(preset)}
                className="text-xs h-8 justify-start"
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Reset Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="w-full text-xs h-8"
        >
          <RotateCcw className="w-3 h-3 mr-2" />
          Reset to Last 30 Days
        </Button>
      </CardContent>
    </Card>
  )
}

// Default date range (last 30 days)
export const getDefaultDateRange = (): DateRange => ({
  from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  to: format(new Date(), 'yyyy-MM-dd')
})

// Validate date range
export const isValidDateRange = (range: DateRange): boolean => {
  if (!range.from || !range.to) return false
  return new Date(range.from) <= new Date(range.to)
}

// Format date range for display
export const formatDateRange = (range: DateRange): string => {
  try {
    const fromFormatted = format(new Date(range.from), 'MMM dd, yyyy')
    const toFormatted = format(new Date(range.to), 'MMM dd, yyyy')
    return `${fromFormatted} - ${toFormatted}`
  } catch {
    return 'Invalid date range'
  }
}