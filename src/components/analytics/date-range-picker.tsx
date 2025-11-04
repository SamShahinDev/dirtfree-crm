'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DateRangePickerProps {
  className?: string
  onRangeChange?: (range: { from: Date; to: Date }) => void
}

export function DateRangePicker({ className, onRangeChange }: DateRangePickerProps) {
  const [date, setDate] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  })
  const [preset, setPreset] = useState('last30')

  const presets = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7', label: 'Last 7 days' },
    { value: 'last30', label: 'Last 30 days' },
    { value: 'thisMonth', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: 'last90', label: 'Last 90 days' },
    { value: 'thisYear', label: 'This year' },
    { value: 'custom', label: 'Custom range' },
  ]

  const handlePresetChange = (value: string) => {
    setPreset(value)
    const today = new Date()
    let from = new Date()
    let to = new Date()

    switch (value) {
      case 'today':
        from = to = today
        break
      case 'yesterday':
        from = to = new Date(today.setDate(today.getDate() - 1))
        break
      case 'last7':
        from = new Date(today.setDate(today.getDate() - 7))
        to = new Date()
        break
      case 'last30':
        from = new Date(today.setDate(today.getDate() - 30))
        to = new Date()
        break
      case 'thisMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1)
        to = new Date()
        break
      case 'lastMonth':
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        to = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'last90':
        from = new Date(today.setDate(today.getDate() - 90))
        to = new Date()
        break
      case 'thisYear':
        from = new Date(today.getFullYear(), 0, 1)
        to = new Date()
        break
    }

    if (value !== 'custom') {
      const newRange = { from, to }
      setDate(newRange)
      onRangeChange?.(newRange)
    }
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'justify-start text-left font-normal',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, 'LLL dd, y')} -{' '}
                    {format(date.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(date.from, 'LLL dd, y')
                )
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={{ from: date.from, to: date.to }}
              onSelect={(range: any) => {
                if (range?.from && range?.to) {
                  setDate(range)
                  onRangeChange?.(range)
                }
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}