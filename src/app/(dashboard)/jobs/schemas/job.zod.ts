/**
 * Zod schemas for Jobs module validation and data transformation.
 *
 * Provides comprehensive validation for create, update, filter, and transition
 * operations with proper refinements for business logic constraints.
 */

import { z } from 'zod'
import {
  type JobStatus,
  type Zone,
  JOB_STATUSES,
  ZONES,
  canTransition
} from '@/types/job'

// =============================================================================
// COMMON FIELD SCHEMAS
// =============================================================================

/**
 * Job status enum schema
 */
export const JobStatusZ = z.enum(JOB_STATUSES as [JobStatus, ...JobStatus[]], {
  errorMap: () => ({ message: 'Invalid job status' })
})

/**
 * Zone enum schema
 */
export const ZoneZ = z.enum(ZONES as [Zone, ...Zone[]], {
  errorMap: () => ({ message: 'Invalid service zone' })
})

/**
 * ISO date format schema (YYYY-MM-DD)
 */
export const IsoDateZ = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
)

/**
 * 24-hour time format schema (HH:mm)
 */
export const TimeZ = z.string().regex(
  /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  'Time must be in HH:mm format (24-hour)'
)

/**
 * Optional URL schema
 */
export const UrlZ = z.string().url('Invalid URL format').optional().nullable()

/**
 * Service item schema for line items
 */
export const ServiceItemZ = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Service item name is required').max(200, 'Name too long'),
  qty: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPriceCents: z.number().int().min(0, 'Price cannot be negative'),
  notes: z.string().max(500, 'Notes too long').optional()
})

// =============================================================================
// HELPER UTILITIES
// =============================================================================

/**
 * Coerce various date inputs to ISO date string
 */
export const coerceIsoDate = z.coerce.string().transform((val, ctx) => {
  // If already a string, validate format
  if (typeof val === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_string,
        validation: 'regex',
        message: 'Date must be in YYYY-MM-DD format'
      })
      return z.NEVER
    }
    return val
  }

  // If Date object, format to ISO date
  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_date,
        message: 'Invalid date'
      })
      return z.NEVER
    }
    return val.toISOString().split('T')[0]
  }

  ctx.addIssue({
    code: z.ZodIssueCode.invalid_type,
    expected: 'string or Date',
    received: typeof val,
    message: 'Expected date string or Date object'
  })
  return z.NEVER
})

/**
 * Normalize time range ensuring both are provided if either is provided
 */
export function normalizeTimeRange(
  start?: string | null,
  end?: string | null
): [string, string] | [null, null] {
  // If neither provided, return nulls
  if (!start && !end) {
    return [null, null]
  }

  // If only one provided, this is invalid - will be caught by refinement
  if (!start || !end) {
    throw new Error('Both start and end times must be provided together')
  }

  // Validate time format
  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(start)) {
    throw new Error('Start time must be in HH:mm format')
  }

  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(end)) {
    throw new Error('End time must be in HH:mm format')
  }

  // Validate time order
  const [startHour, startMin] = start.split(':').map(Number)
  const [endHour, endMin] = end.split(':').map(Number)
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin

  if (startMinutes >= endMinutes) {
    throw new Error('Start time must be before end time')
  }

  return [start, end]
}

// =============================================================================
// CREATE SCHEMA
// =============================================================================

/**
 * Schema for creating new jobs
 */
export const JobCreateSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  technicianId: z.string().uuid('Invalid technician ID').optional().nullable(),
  zone: ZoneZ.optional().nullable(),
  status: z.literal('scheduled').default('scheduled'),
  scheduledDate: IsoDateZ.optional().nullable(),
  scheduledTimeStart: TimeZ.optional().nullable(),
  scheduledTimeEnd: TimeZ.optional().nullable(),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  internalNotes: z.string().max(2000, 'Internal notes too long').optional().nullable(),
  invoiceUrl: UrlZ,
  serviceItems: z.array(ServiceItemZ).max(50, 'Too many service items').default([])
}).refine(
  (data) => {
    // If either time is provided, both must be provided
    const hasStart = data.scheduledTimeStart && data.scheduledTimeStart.trim() !== ''
    const hasEnd = data.scheduledTimeEnd && data.scheduledTimeEnd.trim() !== ''

    if (hasStart !== hasEnd) {
      return false
    }

    // If both times provided, validate order
    if (hasStart && hasEnd) {
      try {
        normalizeTimeRange(data.scheduledTimeStart, data.scheduledTimeEnd)
        return true
      } catch {
        return false
      }
    }

    return true
  },
  {
    message: 'Both start and end times must be provided together, and start must be before end',
    path: ['scheduledTimeStart']
  }
).refine(
  (data) => {
    // Only allow 'scheduled' status at creation
    return data.status === 'scheduled'
  },
  {
    message: 'New jobs must be created with scheduled status',
    path: ['status']
  }
)

// =============================================================================
// UPDATE SCHEMA
// =============================================================================

/**
 * Schema for updating existing jobs
 */
export const JobUpdateSchema = z.object({
  id: z.string().uuid('Invalid job ID'),
  customerId: z.string().uuid('Invalid customer ID').optional(),
  technicianId: z.string().uuid('Invalid technician ID').optional().nullable(),
  zone: ZoneZ.optional().nullable(),
  status: JobStatusZ.optional(),
  scheduledDate: IsoDateZ.optional().nullable(),
  scheduledTimeStart: TimeZ.optional().nullable(),
  scheduledTimeEnd: TimeZ.optional().nullable(),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  internalNotes: z.string().max(2000, 'Internal notes too long').optional().nullable(),
  invoiceUrl: UrlZ,
  serviceItems: z.array(ServiceItemZ).max(50, 'Too many service items').optional(),
  // For status transition validation
  currentStatus: JobStatusZ.optional()
}).refine(
  (data) => {
    // If either time is provided, both must be provided
    const hasStart = data.scheduledTimeStart !== undefined
    const hasEnd = data.scheduledTimeEnd !== undefined

    if (hasStart && hasEnd) {
      // Both provided - validate if both have values
      if (data.scheduledTimeStart && data.scheduledTimeEnd) {
        try {
          normalizeTimeRange(data.scheduledTimeStart, data.scheduledTimeEnd)
          return true
        } catch {
          return false
        }
      }
      // Both null/empty is fine
      return true
    }

    // If only one provided, that's invalid
    if (hasStart || hasEnd) {
      return false
    }

    // Neither provided is fine
    return true
  },
  {
    message: 'Both start and end times must be updated together, and start must be before end',
    path: ['scheduledTimeStart']
  }
).refine(
  (data) => {
    // Validate status transition if both current and new status provided
    if (data.currentStatus && data.status) {
      return canTransition(data.currentStatus, data.status)
    }
    return true
  },
  {
    message: 'Invalid status transition',
    path: ['status']
  }
)

// =============================================================================
// LIST FILTER SCHEMA
// =============================================================================

/**
 * Schema for job list filtering and search
 */
export const JobListFilterSchema = z.object({
  q: z.string().max(200, 'Search query too long').optional(),
  status: JobStatusZ.optional(),
  zone: ZoneZ.optional(),
  technicianId: z.string().uuid('Invalid technician ID').optional(),
  fromDate: IsoDateZ.optional(),
  toDate: IsoDateZ.optional(),
  page: z.number().int().min(1, 'Page must be at least 1').default(1),
  pageSize: z.number().int().min(1, 'Page size must be at least 1').max(100, 'Page size too large').default(25)
}).refine(
  (data) => {
    // If both dates provided, from must be <= to
    if (data.fromDate && data.toDate) {
      return data.fromDate <= data.toDate
    }
    return true
  },
  {
    message: 'From date must be before or equal to to date',
    path: ['fromDate']
  }
)

// =============================================================================
// STATUS TRANSITION SCHEMA
// =============================================================================

/**
 * Schema for job status transitions
 */
export const JobTransitionSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
  to: JobStatusZ,
  from: JobStatusZ.optional(), // For validation
  notes: z.string().max(1000, 'Notes too long').optional()
}).refine(
  (data) => {
    // Validate transition if from status provided
    if (data.from) {
      return canTransition(data.from, data.to)
    }
    return true
  },
  {
    message: 'Invalid status transition',
    path: ['to']
  }
)

// =============================================================================
// JOB COMPLETION SCHEMA
// =============================================================================

/**
 * Schema for completing jobs (creates service history)
 */
export const JobCompleteSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
  completedAt: z.string().datetime('Invalid completion timestamp').optional(),
  notes: z.string().max(2000, 'Notes too long').optional(),
  serviceItems: z.array(ServiceItemZ).max(50, 'Too many service items').optional(),
  beforePhotos: z.array(z.string().url()).max(5, 'Too many before photos').optional(),
  afterPhotos: z.array(z.string().url()).min(1, 'At least one after photo is required').max(5, 'Too many after photos')
})

// =============================================================================
// SEARCH SCHEMAS
// =============================================================================

/**
 * Schema for quick job search (similar to customer search)
 */
export const JobQuickSearchSchema = z.object({
  q: z.string().min(1, 'Search query required').max(200, 'Search query too long'),
  limit: z.number().int().min(1).max(50).default(10)
})

/**
 * Schema for technician schedule view
 */
export const TechnicianScheduleSchema = z.object({
  technicianId: z.string().uuid('Invalid technician ID'),
  date: IsoDateZ,
  includePending: z.boolean().default(true)
})

// =============================================================================
// EXPORT TYPES
// =============================================================================

/**
 * Inferred types for use in components and actions
 */
export type JobCreateInput = z.infer<typeof JobCreateSchema>
export type JobUpdateInput = z.infer<typeof JobUpdateSchema>
export type JobListFilter = z.infer<typeof JobListFilterSchema>
export type JobTransitionInput = z.infer<typeof JobTransitionSchema>
export type JobCompleteInput = z.infer<typeof JobCompleteSchema>
export type JobQuickSearchInput = z.infer<typeof JobQuickSearchSchema>
export type TechnicianScheduleInput = z.infer<typeof TechnicianScheduleSchema>

// =============================================================================
// UTILITY SCHEMAS
// =============================================================================

/**
 * Schema for validating job IDs
 */
export const JobIdSchema = z.object({
  id: z.string().uuid('Invalid job ID')
})

/**
 * Schema for validating date ranges
 */
export const DateRangeSchema = z.object({
  from: IsoDateZ,
  to: IsoDateZ
}).refine(
  (data) => data.from <= data.to,
  {
    message: 'From date must be before or equal to to date',
    path: ['from']
  }
)

/**
 * Schema for bulk job operations
 */
export const BulkJobOperationSchema = z.object({
  jobIds: z.array(z.string().uuid()).min(1, 'At least one job ID required').max(100, 'Too many jobs'),
  operation: z.enum(['cancel', 'reschedule', 'assign_technician']),
  data: z.record(z.unknown()).optional() // Operation-specific data
})

// =============================================================================
// TRANSFORM UTILITIES
// =============================================================================

/**
 * Transform raw job data to normalized format
 */
export function transformJobData(raw: Record<string, unknown>): Record<string, unknown> {
  const transformed = { ...raw }

  // Normalize time range
  if (transformed.scheduledTimeStart || transformed.scheduledTimeEnd) {
    try {
      const [start, end] = normalizeTimeRange(
        transformed.scheduledTimeStart as string,
        transformed.scheduledTimeEnd as string
      )
      transformed.scheduledTimeStart = start
      transformed.scheduledTimeEnd = end
    } catch {
      // Let validation handle the error
    }
  }

  // Ensure service items array
  if (!Array.isArray(transformed.serviceItems)) {
    transformed.serviceItems = []
  }

  return transformed
}

/**
 * Validate and transform job input for database operations
 */
export function prepareJobForDatabase(input: JobCreateInput | JobUpdateInput): Record<string, unknown> {
  const prepared = { ...input }

  // Remove client-only fields
  delete prepared.currentStatus

  // Transform service items to JSON if needed
  if (prepared.serviceItems) {
    prepared.serviceItems = JSON.stringify(prepared.serviceItems)
  }

  return prepared
}