/**
 * Time utilities for schedule management
 */

/**
 * Combines a date string and optional time string into an ISO datetime string
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:mm format (optional)
 * @returns ISO datetime string (local timezone)
 */
export function combineDateTime(date: string, time?: string | null): string {
  if (!time) {
    // If no time specified, use start of day
    return new Date(`${date}T00:00:00`).toISOString()
  }

  return new Date(`${date}T${time}:00`).toISOString()
}

/**
 * Splits an ISO datetime string into date and time components
 * @param iso - ISO datetime string
 * @returns Object with date (YYYY-MM-DD) and time (HH:mm) components
 */
export function splitToDateTime(iso: string): { date: string; time: string } {
  const date = new Date(iso)

  const dateString = date.toISOString().split('T')[0] // YYYY-MM-DD
  const timeString = date.toTimeString().slice(0, 5) // HH:mm

  return {
    date: dateString,
    time: timeString
  }
}

/**
 * Checks if two time ranges overlap
 * @param aStart - Start time of first range
 * @param aEnd - End time of first range
 * @param bStart - Start time of second range
 * @param bEnd - End time of second range
 * @returns True if the ranges overlap
 */
export function overlaps(
  aStart: string | Date,
  aEnd: string | Date,
  bStart: string | Date,
  bEnd: string | Date
): boolean {
  const a1 = new Date(aStart).getTime()
  const a2 = new Date(aEnd).getTime()
  const b1 = new Date(bStart).getTime()
  const b2 = new Date(bEnd).getTime()

  // Check if ranges overlap: a1 < b2 && b1 < a2
  return a1 < b2 && b1 < a2
}

/**
 * Formats a date for display in the calendar
 * @param date - Date object or ISO string
 * @returns Formatted date string
 */
export function formatDateForCalendar(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Formats time for display
 * @param time - Time string in HH:mm format or ISO datetime
 * @returns Formatted time string
 */
export function formatTimeForDisplay(time: string): string {
  if (time.includes('T')) {
    // ISO datetime string
    return new Date(time).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // HH:mm format
  const [hours, minutes] = time.split(':')
  const date = new Date()
  date.setHours(parseInt(hours), parseInt(minutes))

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Gets the start and end of a week containing the given date
 * @param date - Date to find week for
 * @returns Object with start and end dates of the week
 */
export function getWeekBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  const day = start.getDay()
  const diff = start.getDate() - day // Sunday = 0

  start.setDate(diff)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

/**
 * Gets the start and end of a day
 * @param date - Date to find bounds for
 * @returns Object with start and end of the day
 */
export function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

/**
 * Adds business hours to a date (8 AM to 6 PM)
 * @param date - Date string in YYYY-MM-DD format
 * @returns Object with business start and end times
 */
export function getBusinessHours(date: string): { start: string; end: string } {
  return {
    start: combineDateTime(date, '08:00'),
    end: combineDateTime(date, '18:00')
  }
}

/**
 * Validates that start time is before end time
 * @param start - Start time (ISO string or Date)
 * @param end - End time (ISO string or Date)
 * @returns True if start is before end
 */
export function isValidTimeRange(start: string | Date, end: string | Date): boolean {
  return new Date(start).getTime() < new Date(end).getTime()
}

/**
 * Calculates duration between two times in minutes
 * @param start - Start time
 * @param end - End time
 * @returns Duration in minutes
 */
export function getDurationMinutes(start: string | Date, end: string | Date): number {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  return Math.round((endTime - startTime) / (1000 * 60))
}