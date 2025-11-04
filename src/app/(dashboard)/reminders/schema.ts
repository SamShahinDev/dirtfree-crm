import { z } from 'zod'

// Enums aligned with Phase 8 specification
export const ReminderStatusZ = z.enum(['pending', 'snoozed', 'complete', 'canceled'])
export const ReminderTypeZ = z.enum(['customer', 'job', 'truck', 'tool', 'follow_up'])

// Core schemas
export const ReminderCreateZ = z.object({
  customerId: z.string().uuid('Customer ID must be a valid UUID').optional(),
  jobId: z.string().uuid('Job ID must be a valid UUID').optional(),
  assignedTo: z.string().uuid('Assigned to must be a valid UUID').optional(),
  type: ReminderTypeZ,
  origin: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  body: z.string().max(2000, 'Body must be 2000 characters or less').optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Scheduled date must be in YYYY-MM-DD format')
})

export const ReminderUpdateZ = ReminderCreateZ.partial().extend({
  status: ReminderStatusZ.optional()
})

export const ReminderFilterZ = z.object({
  search: z.string().optional(),
  types: z.array(ReminderTypeZ).optional(),
  statuses: z.array(ReminderStatusZ).optional(),
  assigneeId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  showSnoozed: z.boolean().default(false),
  page: z.number().int().min(1).optional().default(1),
  size: z.number().int().min(1).max(100).optional().default(25)
})

export const SnoozeZ = z.object({
  id: z.string().uuid('Reminder ID must be a valid UUID'),
  snoozedUntil: z.string().datetime('Snooze until must be a valid ISO datetime string').refine((date) => new Date(date) > new Date(), {
    message: 'Snooze time must be in the future'
  })
})

export const ReassignZ = z.object({
  id: z.string().uuid('Reminder ID must be a valid UUID'),
  userId: z.string().uuid('User ID must be a valid UUID')
})

export const CommentZ = z.object({
  id: z.string().uuid('Reminder ID must be a valid UUID'),
  body: z.string().min(1, 'Comment body is required').max(2000, 'Comment must be 2000 characters or less')
})

export const CompleteZ = z.object({
  id: z.string().uuid('Reminder ID must be a valid UUID')
})

export const CancelZ = z.object({
  id: z.string().uuid('Reminder ID must be a valid UUID')
})

// Add follow-up creation schema for job completion
export const CreateFollowUpZ = z.object({
  jobId: z.string().uuid('Job ID must be a valid UUID'),
  customerId: z.string().uuid('Customer ID must be a valid UUID'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Scheduled date must be in YYYY-MM-DD format'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  body: z.string().max(2000, 'Body too long').optional()
})

// TypeScript types
export type ReminderStatus = z.infer<typeof ReminderStatusZ>
export type ReminderType = z.infer<typeof ReminderTypeZ>
export type ReminderCreate = z.infer<typeof ReminderCreateZ>
export type ReminderUpdate = z.infer<typeof ReminderUpdateZ>
export type ReminderFilter = z.infer<typeof ReminderFilterZ>
export type SnoozeInput = z.infer<typeof SnoozeZ>
export type ReassignInput = z.infer<typeof ReassignZ>
export type CommentInput = z.infer<typeof CommentZ>
export type CompleteInput = z.infer<typeof CompleteZ>
export type CancelInput = z.infer<typeof CancelZ>
export type CreateFollowUpInput = z.infer<typeof CreateFollowUpZ>

// Status transition validation
export function isValidStatusTransition(from: ReminderStatus, to: ReminderStatus): boolean {
  const transitions: Record<ReminderStatus, ReminderStatus[]> = {
    pending: ['snoozed', 'complete', 'canceled'],
    snoozed: ['pending', 'complete', 'canceled'],
    complete: [], // Terminal state
    canceled: [] // Terminal state
  }

  return transitions[from]?.includes(to) ?? false
}

// Type guards for reminder types
export const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  customer: 'Customer',
  job: 'Job',
  truck: 'Truck',
  tool: 'Tool',
  follow_up: 'Follow Up'
}

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: 'Pending',
  snoozed: 'Snoozed',
  complete: 'Complete',
  canceled: 'Canceled'
}

// Status color mapping for UI badges
export const REMINDER_STATUS_COLORS: Record<ReminderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  snoozed: 'bg-blue-100 text-blue-800 border-blue-200',
  complete: 'bg-green-100 text-green-800 border-green-200',
  canceled: 'bg-gray-100 text-gray-800 border-gray-200'
}