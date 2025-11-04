/**
 * Message Data Filtering for Portal API
 *
 * Filters message thread data to only include fields safe for customer portal view.
 * Removes CRM-only fields and sensitive internal data.
 */

import type { Database } from '@/types/supabase'

type ThreadRow = Database['public']['Tables']['truck_threads']['Row']
type PostRow = Database['public']['Tables']['truck_posts']['Row']

/**
 * Portal message thread status
 */
export type PortalMessageStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

/**
 * Message thread list item for portal
 */
export interface PortalMessageThreadListItem {
  id: string
  subject: string
  status: PortalMessageStatus
  statusLabel: string
  isUrgent: boolean
  unreadCount: number
  messageCount: number
  lastMessageAt: string
  lastStaffReplyAt: string | null
  createdAt: string
  jobId: string | null
  jobDate: string | null
  jobServiceType: string | null
}

/**
 * Message post/reply for portal
 */
export interface PortalMessagePost {
  id: string
  content: string
  attachments: string[]
  isFromStaff: boolean
  staffName?: string
  createdAt: string
  isRead: boolean
}

/**
 * Detailed message thread for portal
 */
export interface PortalMessageThreadDetail {
  id: string
  subject: string
  status: PortalMessageStatus
  statusLabel: string
  isUrgent: boolean
  unreadCount: number
  messages: PortalMessagePost[]
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  jobId: string | null
  jobDate: string | null
  jobServiceType: string | null
}

/**
 * Get status label for portal
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'open': 'Open',
    'in_progress': 'In Progress',
    'acknowledged': 'In Progress',
    'resolved': 'Resolved',
    'closed': 'Closed',
  }
  return labels[status] || status
}

/**
 * Map database status to portal status
 */
function mapToPortalStatus(status: string): PortalMessageStatus {
  const mapping: Record<string, PortalMessageStatus> = {
    'open': 'open',
    'in_progress': 'in_progress',
    'acknowledged': 'in_progress',
    'resolved': 'resolved',
    'closed': 'closed',
  }
  return mapping[status] || 'open'
}

/**
 * Filter message thread for portal list view
 */
export function filterMessageThreadForPortalList(
  thread: ThreadRow & {
    message_count?: number
    last_staff_reply_at?: string | null
    job?: {
      scheduled_date: string | null
      service_type: string | null
    } | null
  }
): PortalMessageThreadListItem {
  return {
    id: thread.id,
    subject: thread.title,
    status: mapToPortalStatus(thread.status),
    statusLabel: getStatusLabel(thread.status),
    isUrgent: thread.urgent || false,
    unreadCount: thread.unread_count || 0,
    messageCount: thread.message_count || 0,
    lastMessageAt: thread.last_message_at || thread.created_at,
    lastStaffReplyAt: thread.last_staff_reply_at || null,
    createdAt: thread.created_at,
    jobId: thread.job_id,
    jobDate: thread.job?.scheduled_date || null,
    jobServiceType: thread.job?.service_type || null,
  }
}

/**
 * Filter message post for portal view
 */
export function filterMessagePostForPortal(
  post: PostRow & {
    staff?: {
      name: string
    } | null
  }
): PortalMessagePost {
  const isFromStaff = !!post.created_by

  return {
    id: post.id,
    content: post.content || post.body || '',
    attachments: post.image_urls || [],
    isFromStaff,
    staffName: isFromStaff ? post.staff?.name : undefined,
    createdAt: post.created_at,
    isRead: !!post.read_at,
  }
}

/**
 * Filter message thread for portal detail view
 */
export function filterMessageThreadForPortalDetail(
  thread: ThreadRow & {
    posts?: (PostRow & {
      staff?: {
        name: string
      } | null
    })[] | null
    job?: {
      scheduled_date: string | null
      service_type: string | null
    } | null
  }
): PortalMessageThreadDetail {
  // Sort messages by creation date (oldest first)
  const sortedPosts = (thread.posts || []).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return {
    id: thread.id,
    subject: thread.title,
    status: mapToPortalStatus(thread.status),
    statusLabel: getStatusLabel(thread.status),
    isUrgent: thread.urgent || false,
    unreadCount: thread.unread_count || 0,
    messages: sortedPosts.map(filterMessagePostForPortal),
    createdAt: thread.created_at,
    updatedAt: thread.updated_at,
    resolvedAt: thread.resolved_at,
    jobId: thread.job_id,
    jobDate: thread.job?.scheduled_date || null,
    jobServiceType: thread.job?.service_type || null,
  }
}

/**
 * Validate attachment file
 */
export function validateAttachment(file: {
  type: string
  size: number
}): { valid: boolean; error?: string } {
  const maxSize = 5 * 1024 * 1024 // 5MB
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ]

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only image files are allowed (JPEG, PNG, GIF, WebP)',
    }
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 5MB',
    }
  }

  return { valid: true }
}

/**
 * Generate unique filename for upload
 */
export function generateAttachmentFilename(
  customerId: string,
  threadId: string,
  originalFilename: string
): string {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  const ext = originalFilename.split('.').pop()
  return `portal-messages/${customerId}/${threadId}/${timestamp}-${randomStr}.${ext}`
}
