'use client'

import { useState, useEffect, useRef } from 'react'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isSameDay, startOfMonth, endOfMonth, eachWeekOfInterval, addHours, startOfDay, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { Job } from '@/types/supabase'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Clock, MapPin, User, AlertCircle } from 'lucide-react'
import { getScheduledJobsAction, updateJobScheduleAction } from '@/app/actions/scheduling'

interface CalendarProps {
  date: Date
  view: 'day' | 'week' | 'month'
  technician: string | null
  draggedJob?: string | null
  onDragEnd?: () => void
}

interface ScheduledJob extends Job {
  customer?: { name: string; address: string }
  technician?: { name: string; color: string }
  services?: Array<{ service: { name: string } }>
}

export function Calendar({ date, view, technician, draggedJob, onDragEnd }: CalendarProps) {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadJobs()
  }, [date, view, technician])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const startDate = view === 'day' ? date :
                       view === 'week' ? startOfWeek(date) :
                       startOfMonth(date)
      const endDate = view === 'day' ? date :
                     view === 'week' ? endOfWeek(date) :
                     endOfMonth(date)

      const jobs = await getScheduledJobsAction(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        technician
      )
      setJobs(jobs)
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = async (e: React.DragEvent, targetDate: Date, targetTime?: number, targetTechnicianId?: string) => {
    e.preventDefault()
    setDragOverSlot(null)

    const jobId = e.dataTransfer.getData('jobId')
    if (!jobId) return

    try {
      await updateJobScheduleAction(jobId, {
        scheduled_date: format(targetDate, 'yyyy-MM-dd'),
        scheduled_time: targetTime ? `${targetTime.toString().padStart(2, '0')}:00` : null,
        technician_id: targetTechnicianId || null
      })

      await loadJobs()
      onDragEnd?.()
    } catch (error) {
      console.error('Failed to update job schedule:', error)
    }
  }

  const handleDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault()
    setDragOverSlot(slotId)
  }

  const handleDragLeave = () => {
    setDragOverSlot(null)
  }

  if (view === 'day') {
    return <DayView date={date} jobs={jobs} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} dragOverSlot={dragOverSlot} />
  }

  if (view === 'week') {
    return <WeekView date={date} jobs={jobs} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} dragOverSlot={dragOverSlot} />
  }

  return <MonthView date={date} jobs={jobs} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} dragOverSlot={dragOverSlot} />
}

// Day View Component
function DayView({ date, jobs, onDrop, onDragOver, onDragLeave, dragOverSlot }: any) {
  const hours = Array.from({ length: 13 }, (_, i) => i + 7) // 7 AM to 7 PM

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">
          {format(date, 'EEEE, MMMM d, yyyy')}
        </h2>

        <div className="space-y-1">
          {hours.map(hour => {
            const slotId = `${format(date, 'yyyy-MM-dd')}-${hour}`
            const slotJobs = jobs.filter((job: ScheduledJob) => {
              const jobHour = job.scheduled_time ? parseInt(job.scheduled_time.split(':')[0]) : null
              return isSameDay(new Date(job.scheduled_date), date) && jobHour === hour
            })

            return (
              <div
                key={hour}
                className={cn(
                  'min-h-[80px] border rounded-lg p-2 transition-colors',
                  dragOverSlot === slotId ? 'bg-blue-50 border-blue-300' : 'bg-white'
                )}
                onDrop={(e) => onDrop(e, date, hour)}
                onDragOver={(e) => onDragOver(e, slotId)}
                onDragLeave={onDragLeave}
              >
                <div className="text-sm text-gray-600 mb-1">
                  {hour % 12 || 12}:00 {hour >= 12 ? 'PM' : 'AM'}
                </div>

                <div className="space-y-1">
                  {slotJobs.map((job: ScheduledJob) => (
                    <JobCard key={job.id} job={job} compact />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ScrollArea>
  )
}

// Week View Component
function WeekView({ date, jobs, onDrop, onDragOver, onDragLeave, dragOverSlot }: any) {
  const weekDays = eachDayOfInterval({
    start: startOfWeek(date),
    end: endOfWeek(date)
  })

  return (
    <div className="h-full overflow-auto">
      <div className="grid grid-cols-7 h-full">
        {weekDays.map(day => (
          <div
            key={day.toString()}
            className={cn(
              'border-r last:border-r-0 flex flex-col',
              isToday(day) && 'bg-blue-50/30'
            )}
          >
            <div className="p-2 border-b bg-white sticky top-0 z-10">
              <div className="text-sm font-medium">{format(day, 'EEE')}</div>
              <div className={cn(
                'text-lg',
                isToday(day) && 'font-bold text-blue-600'
              )}>
                {format(day, 'd')}
              </div>
            </div>

            <div
              className={cn(
                'flex-1 p-2 space-y-1',
                dragOverSlot === format(day, 'yyyy-MM-dd') && 'bg-blue-50'
              )}
              onDrop={(e) => onDrop(e, day)}
              onDragOver={(e) => onDragOver(e, format(day, 'yyyy-MM-dd'))}
              onDragLeave={onDragLeave}
            >
              {jobs
                .filter((job: ScheduledJob) => isSameDay(new Date(job.scheduled_date), day))
                .map((job: ScheduledJob) => (
                  <JobCard key={job.id} job={job} mini />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Month View Component
function MonthView({ date, jobs, onDrop, onDragOver, onDragLeave, dragOverSlot }: any) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd })

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="bg-white p-2 text-sm font-medium text-gray-700">
            {day}
          </div>
        ))}

        {weeks.map(week => {
          const days = eachDayOfInterval({
            start: week,
            end: addDays(week, 6)
          })

          return days.map(day => {
            const isCurrentMonth = day >= monthStart && day <= monthEnd
            const slotId = format(day, 'yyyy-MM-dd')
            const dayJobs = jobs.filter((job: ScheduledJob) =>
              isSameDay(new Date(job.scheduled_date), day)
            )

            return (
              <div
                key={day.toString()}
                className={cn(
                  'bg-white p-2 min-h-[100px]',
                  !isCurrentMonth && 'text-gray-400 bg-gray-50',
                  isToday(day) && 'bg-blue-50',
                  dragOverSlot === slotId && 'bg-blue-100'
                )}
                onDrop={(e) => onDrop(e, day)}
                onDragOver={(e) => onDragOver(e, slotId)}
                onDragLeave={onDragLeave}
              >
                <div className={cn(
                  'text-sm mb-1',
                  isToday(day) && 'font-bold text-blue-600'
                )}>
                  {format(day, 'd')}
                </div>

                <div className="space-y-1">
                  {dayJobs.slice(0, 3).map((job: ScheduledJob) => (
                    <div
                      key={job.id}
                      className="text-xs p-1 bg-blue-100 rounded truncate"
                      title={job.customer?.name}
                    >
                      {job.scheduled_time?.slice(0, 5)} - {job.customer?.name}
                    </div>
                  ))}
                  {dayJobs.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayJobs.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })
        })}
      </div>
    </div>
  )
}

// Job Card Component
function JobCard({ job, compact = false, mini = false }: { job: ScheduledJob; compact?: boolean; mini?: boolean }) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('jobId', job.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  if (mini) {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        className="p-1 bg-white border rounded cursor-move hover:shadow-sm transition-shadow"
        style={{ borderLeftColor: job.technician?.color || '#3B82F6', borderLeftWidth: '3px' }}
      >
        <div className="text-xs font-medium truncate">{job.customer?.name}</div>
        {job.scheduled_time && (
          <div className="text-xs text-gray-500">{job.scheduled_time.slice(0, 5)}</div>
        )}
      </div>
    )
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="p-2 bg-white border rounded-lg cursor-move hover:shadow-md transition-shadow"
      style={{ borderLeftColor: job.technician?.color || '#3B82F6', borderLeftWidth: '4px' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{job.customer?.name}</div>
          {compact && (
            <>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                {job.scheduled_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {job.scheduled_time.slice(0, 5)}
                  </span>
                )}
                {job.duration && (
                  <span>{job.duration} min</span>
                )}
              </div>
              {job.customer?.address && (
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{job.customer.address}</span>
                </div>
              )}
            </>
          )}
        </div>
        {job.status === 'confirmed' && (
          <Badge variant="success" className="ml-2">
            Confirmed
          </Badge>
        )}
      </div>
    </div>
  )
}