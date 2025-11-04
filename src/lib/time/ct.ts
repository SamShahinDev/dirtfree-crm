/**
 * Central Time (America/Chicago) utilities for quiet hours and scheduling
 */

// Server-only guard
if (typeof window !== 'undefined') {
  throw new Error('This module must only be used on the server side')
}

/**
 * Get the current time in Central Time (America/Chicago)
 */
export function getNowCT(): Date {
  // Create a date in CT timezone
  const now = new Date()
  const ctString = now.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  // Parse the CT string back to a date
  const [date, time] = ctString.split(', ')
  const [month, day, year] = date.split('/')
  const [hour, minute, second] = time.split(':')

  const ctDate = new Date()
  ctDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day))
  ctDate.setHours(parseInt(hour), parseInt(minute), parseInt(second), 0)

  return ctDate
}

/**
 * Get the current hour in Central Time (0-23)
 */
export function getCurrentHourCT(): number {
  const now = new Date()
  const ctHour = parseInt(
    now.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      hour: '2-digit',
      hour12: false
    }).split(':')[0]
  )
  return ctHour
}

/**
 * Check if current time is within quiet hours (9PM - 8AM CT)
 * @returns true if within quiet hours (21:00-07:59 CT)
 */
export function isQuietHours(): boolean {
  const hourCT = getCurrentHourCT()
  // Quiet hours: 9PM (21:00) through 7:59AM (next day)
  return hourCT >= 21 || hourCT < 8
}

/**
 * Get the next time when quiet hours end (8AM CT)
 * Useful for scheduling retries
 */
export function getNextQuietHoursEnd(): Date {
  const nowCT = getNowCT()
  const hourCT = getCurrentHourCT()

  const nextEnd = new Date(nowCT)

  if (hourCT >= 21) {
    // After 9PM, next end is tomorrow at 8AM
    nextEnd.setDate(nextEnd.getDate() + 1)
    nextEnd.setHours(8, 0, 0, 0)
  } else if (hourCT < 8) {
    // Before 8AM, next end is today at 8AM
    nextEnd.setHours(8, 0, 0, 0)
  } else {
    // During allowed hours, next end is tomorrow at 8AM
    nextEnd.setDate(nextEnd.getDate() + 1)
    nextEnd.setHours(8, 0, 0, 0)
  }

  return nextEnd
}

/**
 * Format a date for display in Central Time
 */
export function formatCT(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return dateObj.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Format a date for display in Central Time with seconds
 */
export function formatCTWithSeconds(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return dateObj.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
}

/**
 * Format a date for CSV export in Central Time
 */
export function formatCTForCSV(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return dateObj.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * Get a debug string showing current CT time and quiet hours status
 */
export function getQuietHoursDebugInfo(): {
  currentTimeCT: string
  hourCT: number
  isQuietHours: boolean
  quietHoursRange: string
  nextQuietHoursEnd?: string
} {
  const nowCT = getNowCT()
  const hourCT = getCurrentHourCT()
  const quiet = isQuietHours()

  return {
    currentTimeCT: formatCT(nowCT),
    hourCT,
    isQuietHours: quiet,
    quietHoursRange: '9:00 PM - 8:00 AM CT',
    nextQuietHoursEnd: quiet ? formatCT(getNextQuietHoursEnd()) : undefined
  }
}