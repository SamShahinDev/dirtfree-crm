/**
 * Truck-related types and utilities
 */

export interface TruckCard {
  id: string
  vehicleNumber: string
  nickname?: string | null
  nextMaintenanceAt?: string | null
  openIssuesCount: number
  lowStockCount: number
  photoKey?: string | null
}

export interface TruckTool {
  id: string
  name: string
  minQty: number
  qtyOnTruck: number
  calibrationDueAt?: string | null
  lastCalibratedAt?: string | null
}

export interface Truck {
  id: string
  vehicleNumber: string
  nickname?: string | null
  nextMaintenanceAt?: string | null
  photoKey?: string | null
  createdAt: string
  updatedAt: string
}

export interface MaintenanceRecord {
  id: string
  truckId: string
  date: string
  type: 'scheduled' | 'emergency' | 'inspection'
  description: string
  cost?: number | null
  documentKey?: string | null
  createdAt: string
}

/**
 * Check if a tool is below minimum quantity
 */
export function isLowStock(tool: TruckTool): boolean {
  return tool.qtyOnTruck < tool.minQty
}

/**
 * Check if a tool's calibration is due
 */
export function isCalibrationDue(tool: TruckTool, today: Date = new Date()): boolean {
  if (!tool.calibrationDueAt) {
    return false
  }

  const dueDate = new Date(tool.calibrationDueAt)
  return dueDate <= today
}

/**
 * Get the status of a tool for display
 */
export function getToolStatus(tool: TruckTool): {
  isLow: boolean
  needsCalibration: boolean
  status: 'ok' | 'low' | 'calibration' | 'critical'
} {
  const isLow = isLowStock(tool)
  const needsCalibration = isCalibrationDue(tool)

  let status: 'ok' | 'low' | 'calibration' | 'critical' = 'ok'
  if (isLow && needsCalibration) {
    status = 'critical'
  } else if (isLow) {
    status = 'low'
  } else if (needsCalibration) {
    status = 'calibration'
  }

  return {
    isLow,
    needsCalibration,
    status
  }
}

/**
 * Calculate days until maintenance
 */
export function daysUntilMaintenance(nextMaintenanceAt?: string | null): number | null {
  if (!nextMaintenanceAt) {
    return null
  }

  const today = new Date()
  const maintenanceDate = new Date(nextMaintenanceAt)
  const diffTime = maintenanceDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Determine if maintenance is urgent
 */
export function isMaintenanceUrgent(nextMaintenanceAt?: string | null): boolean {
  const days = daysUntilMaintenance(nextMaintenanceAt)
  return days !== null && days <= 7
}