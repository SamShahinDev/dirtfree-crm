import { z } from 'zod'

/**
 * Zone enumeration for geographic areas
 */
export const ZONES = ['N', 'S', 'E', 'W', 'Central'] as const
export type Zone = typeof ZONES[number]

/**
 * Communication preferences for customers
 */
export const COMMUNICATION_METHODS = ['email', 'phone', 'both'] as const
export type CommunicationMethod = typeof COMMUNICATION_METHODS[number]

/**
 * Zod schema for customer form validation
 */
export const CustomerFormSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters'),

  email: z.string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),

  phone: z.string()
    .optional()
    .or(z.literal('')),

  address_line1: z.string()
    .max(255, 'Address line 1 must be less than 255 characters')
    .optional()
    .or(z.literal('')),

  address_line2: z.string()
    .max(255, 'Address line 2 must be less than 255 characters')
    .optional()
    .or(z.literal('')),

  city: z.string()
    .max(100, 'City must be less than 100 characters')
    .optional()
    .or(z.literal('')),

  state: z.string()
    .max(50, 'State must be less than 50 characters')
    .optional()
    .or(z.literal('')),

  postal_code: z.string()
    .max(20, 'Postal code must be less than 20 characters')
    .optional()
    .or(z.literal('')),

  zone: z.enum(ZONES)
    .optional(),

  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
    .or(z.literal('')),

  // Email preferences
  email_notifications: z.boolean()
    .default(true),

  sms_notifications: z.boolean()
    .default(false),

  preferred_communication: z.enum(COMMUNICATION_METHODS)
    .default('email'),

  marketing_opt_out: z.boolean()
    .default(false)
})

/**
 * TypeScript type for customer form inputs
 */
export type CustomerFormData = z.infer<typeof CustomerFormSchema>

/**
 * Customer data as stored in database
 */
export interface Customer {
  id: string
  name: string
  phone_e164: string | null
  email: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  zone: Zone | null
  notes: string | null
  // Email preferences
  email_notifications: boolean
  sms_notifications: boolean
  preferred_communication: CommunicationMethod
  marketing_opt_out: boolean
  created_at: string
  updated_at: string
}

/**
 * Customer list row with computed fields
 */
export interface CustomerListRow extends Customer {
  last_service_date?: string | null
  job_count?: number
}

/**
 * Service history entry for customer detail
 */
export interface ServiceHistoryEntry {
  id: string
  job_id: string
  completed_at: string | null
  notes: string | null
  technician_name: string | null
  job_description: string | null
  invoice_url: string | null
}

/**
 * Customer search and filter parameters
 */
export interface CustomerSearchParams {
  q?: string
  zone?: Zone
  page?: number
  pageSize?: number
}

/**
 * Paginated customer list response
 */
export interface CustomerListResponse {
  rows: CustomerListRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Customer detail with service history
 */
export interface CustomerDetail extends Customer {
  service_history: ServiceHistoryEntry[]
}

/**
 * Standard action response format
 */
export interface ActionResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}