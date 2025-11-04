/**
 * Utilities for formatting job arrival windows
 */

/**
 * Format arrival window from start and end times
 * @param start - Start time in HH:mm format (e.g., "13:00")
 * @param end - End time in HH:mm format (e.g., "15:00")
 * @returns Formatted arrival window (e.g., "1–3 PM") or "soon" if times unavailable
 */
export function formatArrivalWindow(start?: string | null, end?: string | null): string {
  if (!start || !end) return 'soon'

  try {
    // Parse times (expect HH:mm format)
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)

    if (isNaN(startHour) || isNaN(endHour)) return 'soon'

    // Create Date objects for formatting (use arbitrary date)
    const startDate = new Date(2000, 0, 1, startHour, startMin)
    const endDate = new Date(2000, 0, 1, endHour, endMin)

    // Format times
    const startFormatted = formatTime(startDate)
    const endFormatted = formatTime(endDate)

    // Check if both times have same meridiem for compact format
    const startMeridiem = startDate.getHours() >= 12 ? 'PM' : 'AM'
    const endMeridiem = endDate.getHours() >= 12 ? 'PM' : 'AM'

    if (startMeridiem === endMeridiem) {
      // Same meridiem: "1–3 PM"
      const startTime = startFormatted.replace(/ (AM|PM)/, '')
      return `${startTime}–${endFormatted}`
    } else {
      // Different meridiem: "11 AM–1 PM"
      return `${startFormatted}–${endFormatted}`
    }
  } catch (error) {
    return 'soon'
  }
}

/**
 * Format a time to user-friendly string (e.g., "1 PM", "1:30 PM")
 */
function formatTime(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const meridiem = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

  if (minutes === 0) {
    return `${displayHours} ${meridiem}`
  } else {
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${meridiem}`
  }
}