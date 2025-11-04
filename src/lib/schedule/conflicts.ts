/**
 * Conflict detection utilities for schedule management
 */

import { overlaps } from './time'

export interface ConflictJob {
  id: string
  customerId: string
  customerName?: string
  scheduledDate: string
  scheduledTimeStart: string
  scheduledTimeEnd: string
  status: string
  description?: string
}

export interface ConflictCheck {
  ok: boolean
  conflicts: ConflictJob[]
  message?: string
}

/**
 * Checks if a proposed time slot conflicts with existing jobs
 * @param existingJobs - Array of existing jobs for the technician
 * @param proposedStart - Start time of proposed slot (ISO string)
 * @param proposedEnd - End time of proposed slot (ISO string)
 * @param excludeJobId - Optional job ID to exclude from conflict checking
 * @returns Conflict check result
 */
export function checkTimeSlotConflicts(
  existingJobs: ConflictJob[],
  proposedStart: string,
  proposedEnd: string,
  excludeJobId?: string
): ConflictCheck {
  const conflicts: ConflictJob[] = []

  for (const job of existingJobs) {
    // Skip if this is the job we're updating
    if (excludeJobId && job.id === excludeJobId) {
      continue
    }

    // Skip terminal status jobs
    if (job.status === 'completed' || job.status === 'cancelled') {
      continue
    }

    // Check if job has valid time slot
    if (!job.scheduledTimeStart || !job.scheduledTimeEnd) {
      continue
    }

    // Combine date and time for comparison
    const jobStart = new Date(`${job.scheduledDate}T${job.scheduledTimeStart}:00`).toISOString()
    const jobEnd = new Date(`${job.scheduledDate}T${job.scheduledTimeEnd}:00`).toISOString()

    // Check for overlap
    if (overlaps(proposedStart, proposedEnd, jobStart, jobEnd)) {
      conflicts.push(job)
    }
  }

  const hasConflicts = conflicts.length > 0

  return {
    ok: !hasConflicts,
    conflicts,
    message: hasConflicts
      ? `This time slot conflicts with ${conflicts.length} existing job${conflicts.length === 1 ? '' : 's'}`
      : undefined
  }
}

/**
 * Validates a time slot for basic business rules
 * @param start - Start time (ISO string)
 * @param end - End time (ISO string)
 * @returns Validation result
 */
export function validateTimeSlot(start: string, end: string): ConflictCheck {
  const startTime = new Date(start)
  const endTime = new Date(end)

  // Check if start is before end
  if (startTime >= endTime) {
    return {
      ok: false,
      conflicts: [],
      message: 'Start time must be before end time'
    }
  }

  // Check if the slot is at least 30 minutes
  const durationMs = endTime.getTime() - startTime.getTime()
  const durationMinutes = durationMs / (1000 * 60)

  if (durationMinutes < 30) {
    return {
      ok: false,
      conflicts: [],
      message: 'Job must be at least 30 minutes long'
    }
  }

  // Check if the slot is not longer than 8 hours
  if (durationMinutes > 480) {
    return {
      ok: false,
      conflicts: [],
      message: 'Job cannot be longer than 8 hours'
    }
  }

  // Check business hours (optional - can be configured)
  const hour = startTime.getHours()
  if (hour < 7 || hour > 18) {
    return {
      ok: false,
      conflicts: [],
      message: 'Jobs should be scheduled during business hours (7 AM - 6 PM)'
    }
  }

  return {
    ok: true,
    conflicts: []
  }
}

/**
 * Gets a user-friendly description of conflicts
 * @param conflicts - Array of conflicting jobs
 * @returns Human-readable conflict description
 */
export function getConflictDescription(conflicts: ConflictJob[]): string {
  if (conflicts.length === 0) {
    return 'No conflicts found'
  }

  if (conflicts.length === 1) {
    const job = conflicts[0]
    const customerName = job.customerName || 'Unknown Customer'
    const timeRange = `${job.scheduledTimeStart} - ${job.scheduledTimeEnd}`
    return `Conflicts with existing job for ${customerName} (${timeRange})`
  }

  const customerNames = conflicts
    .map(job => job.customerName || 'Unknown Customer')
    .slice(0, 3)
    .join(', ')

  const additional = conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : ''

  return `Conflicts with ${conflicts.length} jobs: ${customerNames}${additional}`
}

/**
 * Finds the next available time slot for a technician
 * @param existingJobs - Array of existing jobs
 * @param preferredStart - Preferred start time (ISO string)
 * @param duration - Duration in minutes
 * @param date - Date to search on (YYYY-MM-DD)
 * @returns Next available slot or null if no slot found
 */
export function findNextAvailableSlot(
  existingJobs: ConflictJob[],
  preferredStart: string,
  duration: number,
  date: string
): { start: string; end: string } | null {
  const startTime = new Date(preferredStart)
  const durationMs = duration * 60 * 1000

  // Sort jobs by start time
  const sortedJobs = existingJobs
    .filter(job =>
      job.scheduledDate === date &&
      job.scheduledTimeStart &&
      job.scheduledTimeEnd &&
      job.status !== 'completed' &&
      job.status !== 'cancelled'
    )
    .sort((a, b) => {
      const aStart = new Date(`${a.scheduledDate}T${a.scheduledTimeStart}:00`)
      const bStart = new Date(`${b.scheduledDate}T${b.scheduledTimeStart}:00`)
      return aStart.getTime() - bStart.getTime()
    })

  let currentTime = new Date(startTime)

  // Business hours: 7 AM to 6 PM
  const businessStart = new Date(`${date}T07:00:00`)
  const businessEnd = new Date(`${date}T18:00:00`)

  // Start at business hours if preferred time is too early
  if (currentTime < businessStart) {
    currentTime = new Date(businessStart)
  }

  for (const job of sortedJobs) {
    const jobStart = new Date(`${job.scheduledDate}T${job.scheduledTimeStart}:00`)
    const jobEnd = new Date(`${job.scheduledDate}T${job.scheduledTimeEnd}:00`)

    // Check if there's enough space before this job
    const proposedEnd = new Date(currentTime.getTime() + durationMs)

    if (proposedEnd <= jobStart && proposedEnd <= businessEnd) {
      return {
        start: currentTime.toISOString(),
        end: proposedEnd.toISOString()
      }
    }

    // Move current time to after this job
    currentTime = new Date(jobEnd)
  }

  // Check if there's space after all jobs
  const proposedEnd = new Date(currentTime.getTime() + durationMs)
  if (proposedEnd <= businessEnd) {
    return {
      start: currentTime.toISOString(),
      end: proposedEnd.toISOString()
    }
  }

  return null
}