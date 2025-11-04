/**
 * Zone Board utility functions for Kanban-style job management
 */

import { combineDateTime, overlaps } from './time'

export type BucketKey = 'morning' | 'afternoon' | 'evening' | 'any'
export type ZoneKey = 'N' | 'S' | 'E' | 'W' | 'Central' | 'unassigned'

export interface BucketConfig {
  key: BucketKey
  label: string
  defaultStart: string
  defaultEnd: string
  color: string
}

export const TIME_BUCKETS: Record<BucketKey, BucketConfig> = {
  morning: {
    key: 'morning',
    label: 'Morning',
    defaultStart: '09:00',
    defaultEnd: '11:00',
    color: 'hsl(213 91% 95%)'
  },
  afternoon: {
    key: 'afternoon',
    label: 'Afternoon',
    defaultStart: '13:00',
    defaultEnd: '15:00',
    color: 'hsl(48 96% 95%)'
  },
  evening: {
    key: 'evening',
    label: 'Evening',
    defaultStart: '17:00',
    defaultEnd: '19:00',
    color: 'hsl(262 83% 95%)'
  },
  any: {
    key: 'any',
    label: 'Anytime',
    defaultStart: '',
    defaultEnd: '',
    color: 'hsl(var(--muted))'
  }
}

export const ZONE_CONFIG: Record<ZoneKey, {
  label: string
  color: string
  gradient: string
  borderColor: string
  icon: string
}> = {
  N: {
    label: 'North Zone',
    color: 'hsl(217 91% 95%)',
    gradient: 'from-blue-50 to-white',
    borderColor: 'border-blue-500',
    icon: 'compass'
  },
  S: {
    label: 'South Zone',
    color: 'hsl(142 71% 95%)',
    gradient: 'from-green-50 to-white',
    borderColor: 'border-green-500',
    icon: 'compass'
  },
  E: {
    label: 'East Zone',
    color: 'hsl(48 96% 95%)',
    gradient: 'from-orange-50 to-white',
    borderColor: 'border-orange-500',
    icon: 'compass'
  },
  W: {
    label: 'West Zone',
    color: 'hsl(262 83% 95%)',
    gradient: 'from-purple-50 to-white',
    borderColor: 'border-purple-500',
    icon: 'compass'
  },
  Central: {
    label: 'Central Zone',
    color: 'hsl(var(--muted))',
    gradient: 'from-cyan-50 to-white',
    borderColor: 'border-cyan-500',
    icon: 'target'
  },
  unassigned: {
    label: 'Unassigned',
    color: 'hsl(var(--muted))',
    gradient: 'from-gray-50 to-white',
    borderColor: 'border-gray-400',
    icon: 'inbox'
  }
}

/**
 * Determines which time bucket a job belongs to based on its scheduled times
 * @param start - Scheduled start time (HH:mm format)
 * @param end - Scheduled end time (HH:mm format)
 * @returns The bucket key
 */
export function bucketForTimes(start?: string | null, end?: string | null): BucketKey {
  if (!start || !end) {
    return 'any'
  }

  const startHour = parseInt(start.split(':')[0])

  // Morning: 08:00-12:00
  if (startHour >= 8 && startHour < 12) {
    return 'morning'
  }

  // Afternoon: 12:00-16:00
  if (startHour >= 12 && startHour < 16) {
    return 'afternoon'
  }

  // Evening: 16:00-20:00
  if (startHour >= 16 && startHour < 20) {
    return 'evening'
  }

  // Everything else is "Anytime"
  return 'any'
}

/**
 * Gets the default time window for a bucket
 * @param bucket - The bucket key
 * @returns Default start and end times for the bucket
 */
export function defaultWindowForBucket(bucket: BucketKey): { start: string; end: string } {
  const config = TIME_BUCKETS[bucket]
  return {
    start: config.defaultStart,
    end: config.defaultEnd
  }
}

/**
 * Calculates a position between two existing positions for ordering
 * @param prev - Position of previous item (optional)
 * @param next - Position of next item (optional)
 * @returns New position value
 */
export function nextPosition(prev?: number, next?: number): number {
  if (prev === undefined && next === undefined) {
    return 1000 // Default starting position
  }

  if (prev === undefined) {
    return (next as number) / 2
  }

  if (next === undefined) {
    return (prev as number) + 1000
  }

  return (prev + next) / 2
}

/**
 * Calculates new time window when moving a job to a different bucket
 * @param currentStart - Current start time
 * @param currentEnd - Current end time
 * @param targetBucket - Target bucket
 * @returns New start and end times
 */
export function calculateNewTimeWindow(
  currentStart?: string | null,
  currentEnd?: string | null,
  targetBucket: BucketKey
): { start: string | null; end: string | null } {
  const defaultWindow = defaultWindowForBucket(targetBucket)

  // If target bucket is "any", clear the times
  if (targetBucket === 'any') {
    return { start: null, end: null }
  }

  // If no default times for bucket, return current times
  if (!defaultWindow.start || !defaultWindow.end) {
    return { start: currentStart || null, end: currentEnd || null }
  }

  // Calculate current duration if both start and end exist
  let durationMinutes = 120 // Default 2 hours
  if (currentStart && currentEnd) {
    const startTime = new Date(`2000-01-01T${currentStart}:00`)
    const endTime = new Date(`2000-01-01T${currentEnd}:00`)
    durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60)
  }

  // Set new start time to bucket default
  const newStart = defaultWindow.start

  // Calculate new end time based on duration
  const startTime = new Date(`2000-01-01T${newStart}:00`)
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)
  const newEnd = endTime.toTimeString().slice(0, 5)

  return { start: newStart, end: newEnd }
}

/**
 * Gets display name for a zone
 * @param zone - Zone key
 * @returns Human-readable zone name
 */
export function getZoneDisplayName(zone: string | null): string {
  if (!zone) return ZONE_CONFIG.unassigned.label

  const zoneKey = zone as ZoneKey
  return ZONE_CONFIG[zoneKey]?.label || `Zone ${zone}`
}

/**
 * Gets display name for a bucket
 * @param bucket - Bucket key
 * @returns Human-readable bucket name
 */
export function getBucketDisplayName(bucket: BucketKey): string {
  return TIME_BUCKETS[bucket].label
}

/**
 * Gets bucket configuration
 * @param bucket - Bucket key
 * @returns Bucket configuration
 */
export function getBucketConfig(bucket: BucketKey): BucketConfig {
  return TIME_BUCKETS[bucket]
}

/**
 * Gets zone configuration
 * @param zone - Zone key
 * @returns Zone configuration
 */
export function getZoneConfig(zone: ZoneKey): {
  label: string
  color: string
  gradient: string
  borderColor: string
  icon: string
} {
  return ZONE_CONFIG[zone]
}

/**
 * Validates if a time window fits within business hours
 * @param start - Start time (HH:mm)
 * @param end - End time (HH:mm)
 * @returns True if within business hours (7 AM - 8 PM)
 */
export function isWithinBusinessHours(start: string, end: string): boolean {
  const startHour = parseInt(start.split(':')[0])
  const endHour = parseInt(end.split(':')[0])
  const endMinute = parseInt(end.split(':')[1])

  // Business hours: 7 AM to 8 PM
  const businessStart = 7
  const businessEnd = 20

  return startHour >= businessStart && (endHour < businessEnd || (endHour === businessEnd && endMinute === 0))
}

/**
 * Sorts zones in logical order
 * @param zones - Array of zone keys
 * @returns Sorted array of zones
 */
export function sortZones(zones: (string | null)[]): (string | null)[] {
  const zoneOrder: Record<string, number> = {
    'N': 1,
    'S': 2,
    'E': 3,
    'W': 4,
    'Central': 5
  }

  return zones.sort((a, b) => {
    if (!a && !b) return 0
    if (!a) return 1 // null zones (unassigned) go last
    if (!b) return -1

    const aOrder = zoneOrder[a] || 999
    const bOrder = zoneOrder[b] || 999

    return aOrder - bOrder
  })
}

/**
 * Formats time window for display
 * @param start - Start time
 * @param end - End time
 * @returns Formatted time window string
 */
export function formatTimeWindow(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'Anytime'
  if (!start) return `Until ${formatTime(end!)}`
  if (!end) return `From ${formatTime(start)}`
  return `${formatTime(start)} - ${formatTime(end)}`
}

/**
 * Formats a time string for display
 * @param time - Time in HH:mm format
 * @returns Formatted time string
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const date = new Date()
  date.setHours(parseInt(hours), parseInt(minutes))

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Re-export needed functions from time.ts
export { combineDateTime, overlaps } from './time'