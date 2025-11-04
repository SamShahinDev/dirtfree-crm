/**
 * Job types and utilities for the Dirt Free CRM Jobs module.
 *
 * This file contains runtime-free TypeScript types that mirror the database
 * structure from Phase-1 migrations and define the job lifecycle.
 *
 * No Zod imports or side effects - pure type definitions only.
 */

/**
 * Job status enumeration matching the database constraint
 */
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

/**
 * Service zone enumeration matching the database constraint
 */
export type Zone = 'N' | 'S' | 'E' | 'W' | 'Central'

/**
 * Service type enumeration for different types of cleaning services
 */
export type ServiceType =
  | 'carpet_cleaning'
  | 'upholstery_cleaning'
  | 'tile_grout_cleaning'
  | 'area_rug_cleaning'
  | 'water_damage_restoration'
  | 'maintenance'

/**
 * Service item for future invoicing functionality
 * Lightweight shape for P3 implementation
 */
export interface JobServiceItem {
  id?: string
  name: string
  qty: number
  unitPriceCents: number
  notes?: string
}

/**
 * Core job interface matching the jobs table structure from Phase-1 migrations
 * Maps directly to database columns with proper TypeScript typing
 */
export interface JobCore {
  id: string
  customerId: string
  technicianId?: string | null
  zone?: Zone | null
  status: JobStatus
  serviceType?: ServiceType | null
  scheduledDate?: string | null // ISO date YYYY-MM-DD
  scheduledTimeStart?: string | null // 24h HH:mm format
  scheduledTimeEnd?: string | null // 24h HH:mm format
  description?: string | null
  invoiceUrl?: string | null
  serviceItems?: JobServiceItem[]
  createdAt: string
  updatedAt: string
}

/**
 * Extended job interface with related data for UI display
 */
export interface Job extends JobCore {
  customer?: {
    id: string
    name: string
    phone_e164?: string | null
    email?: string | null
    address_line1?: string | null
    city?: string | null
    state?: string | null
    zone?: Zone | null
  }
  technician?: {
    id: string
    display_name?: string | null
    phone_e164?: string | null
    zone?: Zone | null
  }
}

/**
 * Job list item with computed fields for table display
 */
export interface JobListItem extends Job {
  customerName: string
  technicianName?: string | null
  isOverdue?: boolean
  canEdit?: boolean
  canComplete?: boolean
}

/**
 * Service history entry created when job is completed
 */
export interface ServiceHistoryEntry {
  id: string
  jobId: string
  customerId: string
  technicianId?: string | null
  completedAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * All possible job statuses as a runtime array
 */
export const JOB_STATUSES: JobStatus[] = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
] as const

/**
 * Terminal job statuses that cannot transition further
 */
export const JOB_TERMINAL_STATUSES: JobStatus[] = [
  'completed',
  'cancelled'
] as const

/**
 * Non-terminal job statuses that can still transition
 */
export const JOB_ACTIVE_STATUSES: JobStatus[] = [
  'scheduled',
  'in_progress'
] as const

/**
 * All service zones as a runtime array
 */
export const ZONES: Zone[] = [
  'N',
  'S',
  'E',
  'W',
  'Central'
] as const

/**
 * All service types as a runtime array
 */
export const SERVICE_TYPES: ServiceType[] = [
  'carpet_cleaning',
  'upholstery_cleaning',
  'tile_grout_cleaning',
  'area_rug_cleaning',
  'water_damage_restoration',
  'maintenance'
] as const

/**
 * Type guard to check if a value is a valid JobStatus
 */
export function isJobStatus(x: unknown): x is JobStatus {
  return typeof x === 'string' && JOB_STATUSES.includes(x as JobStatus)
}

/**
 * Type guard to check if a value is a valid Zone
 */
export function isZone(x: unknown): x is Zone {
  return typeof x === 'string' && ZONES.includes(x as Zone)
}

/**
 * Type guard to check if a value is a valid ServiceType
 */
export function isServiceType(x: unknown): x is ServiceType {
  return typeof x === 'string' && SERVICE_TYPES.includes(x as ServiceType)
}

/**
 * Check if a job status transition is allowed
 *
 * Allowed transitions:
 * - scheduled → in_progress, completed, cancelled
 * - in_progress → completed, cancelled
 * - completed → (none - terminal)
 * - cancelled → (none - terminal)
 *
 * @param from - Current job status
 * @param to - Desired job status
 * @returns True if transition is allowed
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  // Same status is always allowed (no-op)
  if (from === to) {
    return true
  }

  // Terminal statuses cannot transition
  if (JOB_TERMINAL_STATUSES.includes(from)) {
    return false
  }

  // Scheduled can transition to any other status
  if (from === 'scheduled') {
    return true
  }

  // In progress can only transition to terminal statuses
  if (from === 'in_progress') {
    return JOB_TERMINAL_STATUSES.includes(to)
  }

  // Should not reach here, but be safe
  return false
}

/**
 * Get all possible next statuses for a given current status
 */
export function getNextStatuses(current: JobStatus): JobStatus[] {
  return JOB_STATUSES.filter(status => canTransition(current, status) && status !== current)
}

/**
 * Check if a job is overdue based on scheduled date
 */
export function isJobOverdue(job: Pick<JobCore, 'scheduledDate' | 'status'>): boolean {
  if (!job.scheduledDate || JOB_TERMINAL_STATUSES.includes(job.status)) {
    return false
  }

  const today = new Date()
  const scheduledDate = new Date(job.scheduledDate)

  // Reset time to compare dates only
  today.setHours(0, 0, 0, 0)
  scheduledDate.setHours(0, 0, 0, 0)

  return scheduledDate < today
}

/**
 * Check if a job can be edited based on status and user role
 */
export function canEditJob(job: Pick<JobCore, 'status'>, userRole?: string): boolean {
  // Terminal jobs cannot be edited
  if (JOB_TERMINAL_STATUSES.includes(job.status)) {
    return false
  }

  // Admins and dispatchers can always edit non-terminal jobs
  if (userRole === 'admin' || userRole === 'dispatcher') {
    return true
  }

  // Technicians can edit jobs they are assigned to
  return true // Will be refined in server actions with proper user checks
}

/**
 * Check if a job can be completed by the current user
 */
export function canCompleteJob(
  job: Pick<JobCore, 'status' | 'technicianId'>,
  userId?: string,
  userRole?: string
): boolean {
  // Only active jobs can be completed
  if (!JOB_ACTIVE_STATUSES.includes(job.status)) {
    return false
  }

  // Admins and dispatchers can complete any job
  if (userRole === 'admin' || userRole === 'dispatcher') {
    return true
  }

  // Technicians can only complete jobs assigned to them
  if (userRole === 'technician') {
    return job.technicianId === userId
  }

  return false
}

/**
 * Get display-friendly status text
 */
export function getStatusDisplay(status: JobStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled'
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Unknown'
  }
}

/**
 * Get CSS class name for status styling
 */
export function getStatusColor(status: JobStatus): string {
  switch (status) {
    case 'scheduled':
      return 'blue'
    case 'in_progress':
      return 'yellow'
    case 'completed':
      return 'green'
    case 'cancelled':
      return 'red'
    default:
      return 'gray'
  }
}

/**
 * Get display-friendly service type text
 */
export function getServiceTypeDisplay(serviceType: ServiceType): string {
  switch (serviceType) {
    case 'carpet_cleaning':
      return 'Carpet Cleaning'
    case 'upholstery_cleaning':
      return 'Upholstery Cleaning'
    case 'tile_grout_cleaning':
      return 'Tile & Grout Cleaning'
    case 'area_rug_cleaning':
      return 'Area Rug Cleaning'
    case 'water_damage_restoration':
      return 'Water Damage Restoration'
    case 'maintenance':
      return 'Maintenance'
    default:
      return 'Unknown'
  }
}