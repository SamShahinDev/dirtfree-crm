'use client'

import { Clock, MapPin, Sun, Sunset, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ZoneBoardJob, TIME_SLOTS } from '@/types/zone-board'

interface TimelineSidebarProps {
  jobs: ZoneBoardJob[]
  selectedJob: ZoneBoardJob | null
  onJobSelect: (job: ZoneBoardJob) => void
  selectedDate: string
}

const ZONE_COLORS = {
  N: '#3b82f6',
  S: '#10b981',
  E: '#f97316',
  W: '#a855f7',
}

function getTimeIcon(slotId: string) {
  switch (slotId) {
    case 'morning':
      return <Sun className="h-4 w-4 text-orange-500" />
    case 'afternoon':
      return <Sunset className="h-4 w-4 text-amber-500" />
    case 'evening':
      return <Moon className="h-4 w-4 text-indigo-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-500" />
  }
}

function groupJobsByTimeSlot(jobs: ZoneBoardJob[]) {
  return TIME_SLOTS.map(slot => {
    const slotJobs = jobs.filter(job => {
      const jobTime = job.scheduledTime
      return jobTime >= slot.startTime && jobTime < slot.endTime
    })

    return {
      ...slot,
      jobs: slotJobs.sort((a, b) =>
        a.scheduledTime.localeCompare(b.scheduledTime)
      )
    }
  })
}

function calculateTotalHours(jobs: ZoneBoardJob[]): number {
  return jobs.reduce((total, job) => {
    const hours = parseFloat(job.duration) || 0
    return total + hours
  }, 0)
}

export function TimelineSidebar({
  jobs,
  selectedJob,
  onJobSelect,
  selectedDate
}: TimelineSidebarProps) {
  const timeSlots = groupJobsByTimeSlot(jobs)
  const totalJobs = jobs.length
  const totalHours = calculateTotalHours(jobs)

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b bg-white sticky top-0 z-10 shadow-sm">
        <h3 className="font-semibold text-lg">Schedule Timeline</h3>
        <p className="text-sm text-gray-600 mt-1">
          {new Date(selectedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })}
        </p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-gray-600">
            <span className="font-semibold text-gray-900">{totalJobs}</span> jobs
          </span>
          <span className="text-gray-600">
            <span className="font-semibold text-gray-900">{totalHours.toFixed(1)}</span> hours
          </span>
        </div>
      </div>

      {/* Timeline Sections */}
      <div className="flex-1 overflow-y-auto">
        {timeSlots.map((slot) => (
          <div key={slot.id} className="border-b last:border-b-0">
            <div className="sticky top-0 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTimeIcon(slot.id)}
                  <span className="font-medium">{slot.label}</span>
                  <span className="text-xs text-gray-500">
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="font-medium">{slot.jobs.length}</span>
                  <span>jobs</span>
                  <span>·</span>
                  <span>{calculateTotalHours(slot.jobs).toFixed(1)}h</span>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              {slot.jobs.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No jobs scheduled
                </div>
              ) : (
                slot.jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => onJobSelect(job)}
                    className={cn(
                      "bg-white border-2 rounded-lg p-3 cursor-pointer transition-all duration-200",
                      "hover:shadow-md hover:scale-[1.02]",
                      selectedJob?.id === job.id
                        ? "border-blue-500 shadow-lg scale-[1.02]"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {job.customerName}
                        </div>
                        <div className="text-xs text-gray-600 mt-1 flex items-start gap-1">
                          <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{job.address}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 font-medium whitespace-nowrap">
                        {job.scheduledTime}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{
                          backgroundColor:
                            (ZONE_COLORS[job.zone as keyof typeof ZONE_COLORS] || '#6b7280') + '20',
                          color: ZONE_COLORS[job.zone as keyof typeof ZONE_COLORS] || '#6b7280'
                        }}
                      >
                        Zone {job.zone}
                      </span>
                      <span className="text-xs text-gray-600">
                        {job.duration}
                      </span>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          job.status === 'scheduled' && "bg-blue-100 text-blue-700",
                          job.status === 'in_progress' && "bg-yellow-100 text-yellow-700",
                          job.status === 'completed' && "bg-green-100 text-green-700",
                          job.status === 'cancelled' && "bg-red-100 text-red-700"
                        )}
                      >
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
