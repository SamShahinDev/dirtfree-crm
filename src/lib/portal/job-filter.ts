/**
 * Job Data Filtering for Portal API
 *
 * Filters job data to only include fields safe for customer portal view.
 * Removes CRM-only fields and sensitive internal data.
 */

import type { Database } from '@/types/supabase'
import { formatForDisplay } from '@/lib/utils/phone'
import { getServiceTypeDisplay, getStatusDisplay, type JobStatus } from '@/types/job'

type JobRow = Database['public']['Tables']['jobs']['Row']
type TruckPostRow = Database['public']['Tables']['truck_posts']['Row']

/**
 * Portal job status (simplified for customers)
 */
export type PortalJobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

/**
 * Job data for portal list view
 */
export interface PortalJobListItem {
  id: string
  status: PortalJobStatus
  scheduledDate: string | null
  scheduledTime: string | null
  serviceType: string | null
  description: string | null
  totalAmount: number | null
  createdAt: string
}

/**
 * Job data for portal detail view
 */
export interface PortalJobDetail {
  id: string
  status: PortalJobStatus
  statusDisplay: string
  scheduledDate: string | null
  scheduledTime: string | null
  serviceType: string | null
  serviceTypeDisplay: string | null
  description: string | null
  serviceItems: Array<{
    name: string
    quantity: number
    unitPrice: number
    total: number
  }>
  technician: {
    name: string | null
    phone: string | null
  } | null
  address: {
    line1: string | null
    line2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
  }
  photos: {
    before: string[]
    after: string[]
  }
  totalAmount: number | null
  invoiceId: string | null
  invoiceUrl: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Filter job for portal list view
 */
export function filterJobForPortalList(
  job: JobRow & {
    invoice?: { id: string; total_amount_cents: number } | null
  }
): PortalJobListItem {
  const scheduledTime = job.scheduled_time_start
    ? `${job.scheduled_time_start}${job.scheduled_time_end ? ` - ${job.scheduled_time_end}` : ''}`
    : null

  return {
    id: job.id,
    status: job.status as PortalJobStatus,
    scheduledDate: job.scheduled_date,
    scheduledTime,
    serviceType: job.service_type,
    description: job.description,
    totalAmount: job.invoice ? job.invoice.total_amount_cents / 100 : null,
    createdAt: job.created_at,
  }
}

/**
 * Filter job for portal detail view
 */
export function filterJobForPortalDetail(
  job: JobRow & {
    technician?: { display_name: string | null; phone_e164: string | null } | null
    customer?: {
      address_line1: string | null
      address_line2: string | null
      city: string | null
      state: string | null
      postal_code: string | null
    } | null
    invoice?: {
      id: string
      total_amount_cents: number
      invoice_url: string | null
    } | null
    service_history?: { completed_at: string | null }[] | null
    truck_posts?: TruckPostRow[] | null
  }
): PortalJobDetail {
  const scheduledTime = job.scheduled_time_start
    ? `${job.scheduled_time_start}${job.scheduled_time_end ? ` - ${job.scheduled_time_end}` : ''}`
    : null

  // Extract photos from truck_posts
  const beforePhotos: string[] = []
  const afterPhotos: string[] = []

  if (job.truck_posts) {
    job.truck_posts.forEach(post => {
      if (post.image_urls && Array.isArray(post.image_urls)) {
        // Determine if before or after based on post content/timing
        // For now, we'll add all to a general array
        // In practice, you might need a field to distinguish before/after
        post.image_urls.forEach(url => {
          if (post.content?.toLowerCase().includes('before')) {
            beforePhotos.push(url)
          } else if (post.content?.toLowerCase().includes('after')) {
            afterPhotos.push(url)
          } else {
            // Default to after photos if not specified
            afterPhotos.push(url)
          }
        })
      }
    })
  }

  // Parse service items
  const serviceItems = Array.isArray(job.service_items)
    ? job.service_items.map((item: any) => ({
        name: item.name || 'Service',
        quantity: item.qty || 1,
        unitPrice: (item.unitPriceCents || 0) / 100,
        total: ((item.qty || 1) * (item.unitPriceCents || 0)) / 100,
      }))
    : []

  // Get completed date from service history
  const completedAt = job.service_history?.[0]?.completed_at || null

  return {
    id: job.id,
    status: job.status as PortalJobStatus,
    statusDisplay: getStatusDisplay(job.status as JobStatus),
    scheduledDate: job.scheduled_date,
    scheduledTime,
    serviceType: job.service_type,
    serviceTypeDisplay: job.service_type
      ? getServiceTypeDisplay(job.service_type as any)
      : null,
    description: job.description,
    serviceItems,
    technician: job.technician
      ? {
          name: job.technician.display_name,
          phone: job.technician.phone_e164
            ? formatForDisplay(job.technician.phone_e164)
            : null,
        }
      : null,
    address: job.customer
      ? {
          line1: job.customer.address_line1,
          line2: job.customer.address_line2,
          city: job.customer.city,
          state: job.customer.state,
          postalCode: job.customer.postal_code,
        }
      : {
          line1: null,
          line2: null,
          city: null,
          state: null,
          postalCode: null,
        },
    photos: {
      before: beforePhotos,
      after: afterPhotos,
    },
    totalAmount: job.invoice ? job.invoice.total_amount_cents / 100 : null,
    invoiceId: job.invoice?.id || null,
    invoiceUrl: job.invoice?.invoice_url || job.invoice_url || null,
    completedAt,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  }
}

/**
 * Job reschedule request data
 */
export interface JobRescheduleRequest {
  jobId: string
  preferredDate: string // ISO date YYYY-MM-DD
  preferredTime: 'morning' | 'afternoon' | 'evening'
  reason?: string
}

/**
 * Job cancellation request data
 */
export interface JobCancellationRequest {
  jobId: string
  reason: string
  cancellationType: 'customer_request' | 'emergency' | 'other'
}
