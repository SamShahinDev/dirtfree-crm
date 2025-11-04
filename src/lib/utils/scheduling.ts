import { addHours, parseISO, format } from 'date-fns'

interface Job {
  id: string
  technician_id?: string | null
  scheduled_date?: string | null
  scheduled_time_start?: string | null
  scheduled_time_end?: string | null
}

export function calculateEndTime(startTime: string, durationHours: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const start = new Date()
  start.setHours(hours, minutes, 0, 0)

  const end = addHours(start, durationHours)
  return format(end, 'HH:mm')
}

export function checkTimeConflict(
  existingJobs: Job[],
  newJob: {
    technician_id?: string | null
    scheduled_date?: string | null
    scheduled_time_start?: string | null
    scheduled_time_end?: string | null
  },
  excludeJobId?: string
): { hasConflict: boolean; conflictingJob?: Job } {
  if (!newJob.technician_id || !newJob.scheduled_date || !newJob.scheduled_time_start) {
    return { hasConflict: false }
  }

  const conflictingJob = existingJobs.find(job => {
    // Skip if same job (editing)
    if (excludeJobId && job.id === excludeJobId) return false

    // Skip if different technician or date
    if (job.technician_id !== newJob.technician_id) return false
    if (job.scheduled_date !== newJob.scheduled_date) return false
    if (!job.scheduled_time_start || !job.scheduled_time_end) return false

    // Check if times overlap
    const newStart = newJob.scheduled_time_start
    const newEnd = newJob.scheduled_time_end || '23:59'
    const existingStart = job.scheduled_time_start
    const existingEnd = job.scheduled_time_end

    return (
      (newStart >= existingStart && newStart < existingEnd) ||
      (newEnd > existingStart && newEnd <= existingEnd) ||
      (newStart <= existingStart && newEnd >= existingEnd)
    )
  })

  return {
    hasConflict: !!conflictingJob,
    conflictingJob
  }
}

export const SERVICE_DURATIONS: Record<string, number> = {
  'carpet-cleaning': 2.5,
  'tile-grout': 2,
  'upholstery': 1.5,
  'air-duct': 3,
  'water-damage': 4,
  'pet-stain': 2,
  'area-rug': 1,
  'natural-stone': 2,
  'commercial': 4
}

export function getServiceDuration(description?: string): number {
  if (!description) return 2.5 // Default

  const lowerDesc = description.toLowerCase()

  for (const [key, duration] of Object.entries(SERVICE_DURATIONS)) {
    if (lowerDesc.includes(key.replace('-', ' '))) {
      return duration
    }
  }

  return 2.5 // Default
}
