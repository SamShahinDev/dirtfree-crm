import { format, formatDistance, isAfter, isBefore, isToday, isTomorrow, parseISO } from 'date-fns'

/**
 * Format vehicle label with optional nickname
 */
export function formatVehicleLabel(vehicleNumber: string, nickname?: string | null): string {
  if (nickname) {
    return `#${vehicleNumber} - ${nickname}`
  }
  return `Truck #${vehicleNumber}`
}

/**
 * Format maintenance date to human-readable string
 */
export function formatMaintenanceDate(date?: string | null): string {
  if (!date) {
    return '—'
  }

  try {
    const maintenanceDate = parseISO(date)
    const now = new Date()

    // Check if date is in the past
    if (isBefore(maintenanceDate, now)) {
      return 'Overdue'
    }

    // Check if it's today
    if (isToday(maintenanceDate)) {
      return 'Today'
    }

    // Check if it's tomorrow
    if (isTomorrow(maintenanceDate)) {
      return 'Tomorrow'
    }

    // Check if within a week
    const oneWeekFromNow = new Date()
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)
    if (isBefore(maintenanceDate, oneWeekFromNow)) {
      return formatDistance(maintenanceDate, now, { addSuffix: true })
    }

    // Check if within current month
    if (maintenanceDate.getMonth() === now.getMonth() && maintenanceDate.getFullYear() === now.getFullYear()) {
      return format(maintenanceDate, 'MMM d')
    }

    // Check if within current year
    if (maintenanceDate.getFullYear() === now.getFullYear()) {
      return format(maintenanceDate, 'MMM d')
    }

    // Default format for dates further out
    return format(maintenanceDate, 'MMM d, yyyy')
  } catch (error) {
    console.error('Error formatting maintenance date:', error)
    return '—'
  }
}

/**
 * Format a simple date for display
 */
export function formatDate(date?: string | null): string {
  if (!date) {
    return '—'
  }

  try {
    return format(parseISO(date), 'MMM d, yyyy')
  } catch (error) {
    return '—'
  }
}

/**
 * Format calibration status
 */
export function formatCalibrationStatus(calibrationDueAt?: string | null): {
  text: string
  variant: 'default' | 'warning' | 'destructive'
} {
  if (!calibrationDueAt) {
    return {
      text: '—',
      variant: 'default'
    }
  }

  try {
    const dueDate = parseISO(calibrationDueAt)
    const now = new Date()

    if (isBefore(dueDate, now)) {
      return {
        text: 'Overdue',
        variant: 'destructive'
      }
    }

    if (isToday(dueDate)) {
      return {
        text: 'Due today',
        variant: 'warning'
      }
    }

    // Check if due within 7 days
    const oneWeekFromNow = new Date()
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7)
    if (isBefore(dueDate, oneWeekFromNow)) {
      return {
        text: `Due ${format(dueDate, 'MMM d')}`,
        variant: 'warning'
      }
    }

    return {
      text: format(dueDate, 'MMM d, yyyy'),
      variant: 'default'
    }
  } catch (error) {
    return {
      text: '—',
      variant: 'default'
    }
  }
}

/**
 * Get maintenance urgency level
 */
export function getMaintenanceUrgency(nextMaintenanceAt?: string | null): 'overdue' | 'urgent' | 'soon' | 'ok' {
  if (!nextMaintenanceAt) {
    return 'ok'
  }

  try {
    const maintenanceDate = parseISO(nextMaintenanceAt)
    const now = new Date()

    if (isBefore(maintenanceDate, now)) {
      return 'overdue'
    }

    const daysUntil = Math.ceil((maintenanceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntil <= 7) {
      return 'urgent'
    }

    if (daysUntil <= 30) {
      return 'soon'
    }

    return 'ok'
  } catch (error) {
    return 'ok'
  }
}

/**
 * Format tool quantity display
 */
export function formatToolQty(qty: number, min: number): string {
  if (qty < min) {
    return `${qty} (Low)`
  }
  return qty.toString()
}

/**
 * Get display badge for truck issues
 */
export function getIssueBadgeText(count: number): string {
  if (count === 0) {
    return ''
  }
  if (count === 1) {
    return '1 issue'
  }
  return `${count} issues`
}

/**
 * Get display badge for low stock
 */
export function getLowStockBadgeText(count: number): string {
  if (count === 0) {
    return ''
  }
  if (count === 1) {
    return '1 low'
  }
  return `${count} low`
}