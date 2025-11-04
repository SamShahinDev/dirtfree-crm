'use client'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'
import {
  CalendarDays,
  CalendarRange,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Map,
  RefreshCw,
  Settings,
  Download,
  Upload,
  Maximize2
} from 'lucide-react'
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths } from 'date-fns'
import { cn } from '@/lib/utils'

interface SchedulingToolbarProps {
  selectedDate: Date
  view: 'day' | 'week' | 'month'
  onDateChange: (date: Date) => void
  onViewChange: (view: 'day' | 'week' | 'month') => void
  showRouteOptimization: boolean
  onToggleRouteOptimization: (show: boolean) => void
}

export function SchedulingToolbar({
  selectedDate,
  view,
  onDateChange,
  onViewChange,
  showRouteOptimization,
  onToggleRouteOptimization
}: SchedulingToolbarProps) {

  const handlePrevious = () => {
    if (view === 'day') {
      onDateChange(subDays(selectedDate, 1))
    } else if (view === 'week') {
      onDateChange(subWeeks(selectedDate, 1))
    } else {
      onDateChange(subMonths(selectedDate, 1))
    }
  }

  const handleNext = () => {
    if (view === 'day') {
      onDateChange(addDays(selectedDate, 1))
    } else if (view === 'week') {
      onDateChange(addWeeks(selectedDate, 1))
    } else {
      onDateChange(addMonths(selectedDate, 1))
    }
  }

  const handleToday = () => {
    onDateChange(new Date())
  }

  const getDateDisplay = () => {
    if (view === 'day') {
      return format(selectedDate, 'EEEE, MMMM d, yyyy')
    } else if (view === 'week') {
      const weekStart = new Date(selectedDate)
      weekStart.setDate(selectedDate.getDate() - selectedDate.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
    } else {
      return format(selectedDate, 'MMMM yyyy')
    }
  }

  return (
    <div className="bg-white border-b px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Navigation and Date */}
        <div className="flex items-center gap-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Date Display with Calendar Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'justify-start text-left font-normal',
                  'min-w-[240px]'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {getDateDisplay()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && onDateChange(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* View Toggle */}
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => value && onViewChange(value as 'day' | 'week' | 'month')}
          >
            <ToggleGroupItem value="day" aria-label="Day view">
              <CalendarIcon className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="week" aria-label="Week view">
              <CalendarDays className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="month" aria-label="Month view">
              <CalendarRange className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Center - Status */}
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            12 Jobs Scheduled
          </Badge>
          <Badge variant="secondary">
            3 Unassigned
          </Badge>
          <Badge variant="destructive">
            2 Conflicts
          </Badge>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant={showRouteOptimization ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggleRouteOptimization(!showRouteOptimization)}
          >
            <Map className="h-4 w-4 mr-2" />
            Route Optimization
          </Button>

          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Auto Schedule
          </Button>

          <div className="border-l mx-2 h-6" />

          <Button variant="outline" size="icon">
            <Upload className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="icon">
            <Maximize2 className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}