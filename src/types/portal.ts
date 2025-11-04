/**
 * Customer Portal API Type Definitions
 *
 * This file contains all TypeScript types for the customer portal API,
 * including request/response schemas for portal endpoints.
 */

/**
 * Portal API version
 */
export type PortalAPIVersion = 'v1'

/**
 * Generic portal API response wrapper
 */
export interface PortalAPIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
  version: PortalAPIVersion
  timestamp?: string
}

/**
 * Portal API error response
 */
export interface PortalAPIError {
  success: false
  error: string
  message: string
  code?: string
  details?: unknown
  version: PortalAPIVersion
}

/**
 * Portal API success response
 */
export interface PortalAPISuccess<T> {
  success: true
  data: T
  version: PortalAPIVersion
  timestamp: string
}

/**
 * Portal authentication response
 */
export interface PortalAuthResponse {
  customerId: string
  email: string
  name: string
  token: string
  expiresAt: string
}

/**
 * Customer profile data (portal view)
 * Limited fields visible to customers
 */
export interface PortalCustomerProfile {
  id: string
  name: string
  email: string | null
  phone: string | null // Display format (not E.164)
  address: {
    line1: string | null
    line2: string | null
    city: string | null
    state: string | null
    postalCode: string | null
  }
  preferences: {
    emailNotifications: boolean
    smsNotifications: boolean
    preferredCommunication: 'email' | 'phone' | 'both'
    marketingOptOut: boolean
  }
  createdAt: string
  updatedAt: string
}

/**
 * Update customer profile request
 */
export interface UpdateCustomerProfileRequest {
  name?: string
  email?: string
  phone?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
  }
  preferences?: {
    emailNotifications?: boolean
    smsNotifications?: boolean
    preferredCommunication?: 'email' | 'phone' | 'both'
    marketingOptOut?: boolean
  }
}

/**
 * Job status for portal display
 */
export type PortalJobStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

/**
 * Job data for portal (customer view)
 */
export interface PortalJob {
  id: string
  status: PortalJobStatus
  scheduledDate: string | null
  completedDate: string | null
  description: string | null
  services: string[] // List of services performed
  technician: {
    name: string | null
    phone: string | null
  } | null
  notes: string | null
  beforePhotos: string[] // URLs
  afterPhotos: string[] // URLs
  invoiceId: string | null
  totalAmount: number | null
  createdAt: string
  updatedAt: string
}

/**
 * Jobs list request params
 */
export interface PortalJobsListRequest {
  status?: PortalJobStatus
  startDate?: string // ISO 8601
  endDate?: string // ISO 8601
  page?: number
  limit?: number
}

/**
 * Jobs list response
 */
export interface PortalJobsListResponse {
  jobs: PortalJob[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Invoice status for portal display
 */
export type PortalInvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled'

/**
 * Invoice line item
 */
export interface PortalInvoiceLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

/**
 * Invoice data for portal (customer view)
 */
export interface PortalInvoice {
  id: string
  invoiceNumber: string
  status: PortalInvoiceStatus
  jobId: string | null
  issuedDate: string
  dueDate: string | null
  paidDate: string | null
  lineItems: PortalInvoiceLineItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  amountPaid: number
  amountDue: number
  notes: string | null
  pdfUrl: string | null
  paymentUrl: string | null // Stripe payment link
  createdAt: string
  updatedAt: string
}

/**
 * Invoices list request params
 */
export interface PortalInvoicesListRequest {
  status?: PortalInvoiceStatus
  startDate?: string // ISO 8601
  endDate?: string // ISO 8601
  page?: number
  limit?: number
}

/**
 * Invoices list response
 */
export interface PortalInvoicesListResponse {
  invoices: PortalInvoice[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Payment request
 */
export interface PortalPaymentRequest {
  invoiceId: string
  amount: number
  paymentMethodId?: string // Stripe payment method
}

/**
 * Payment response
 */
export interface PortalPaymentResponse {
  success: boolean
  paymentIntentId: string
  status: 'succeeded' | 'processing' | 'requires_action' | 'failed'
  clientSecret?: string // For 3D Secure
  receiptUrl?: string
}

/**
 * Loyalty points data for portal
 */
export interface PortalLoyaltyPoints {
  totalPoints: number
  availablePoints: number
  lifetimePoints: number
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null
  nextTier: {
    name: string
    pointsNeeded: number
  } | null
  expiringPoints: {
    points: number
    expiresAt: string
  } | null
  history: PortalLoyaltyTransaction[]
}

/**
 * Loyalty transaction
 */
export interface PortalLoyaltyTransaction {
  id: string
  type: 'earned' | 'redeemed' | 'expired' | 'adjusted'
  points: number
  description: string
  jobId: string | null
  createdAt: string
}

/**
 * Redeem loyalty points request
 */
export interface RedeemLoyaltyPointsRequest {
  points: number
  redemptionType: 'discount' | 'service' | 'gift_card'
  jobId?: string
}

/**
 * Redeem loyalty points response
 */
export interface RedeemLoyaltyPointsResponse {
  success: boolean
  pointsRedeemed: number
  remainingPoints: number
  redemptionCode?: string
  discountAmount?: number
}

/**
 * Message thread data for portal
 */
export interface PortalMessage {
  id: string
  subject: string
  status: 'open' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  createdAt: string
  updatedAt: string
  lastReplyAt: string | null
  unreadCount: number
  replies: PortalMessageReply[]
}

/**
 * Message reply
 */
export interface PortalMessageReply {
  id: string
  messageId: string
  content: string
  attachments: PortalMessageAttachment[]
  sender: {
    type: 'customer' | 'staff'
    name: string
  }
  isRead: boolean
  createdAt: string
}

/**
 * Message attachment
 */
export interface PortalMessageAttachment {
  id: string
  filename: string
  fileSize: number
  mimeType: string
  url: string
}

/**
 * Create message request
 */
export interface CreateMessageRequest {
  subject: string
  content: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  attachments?: File[]
}

/**
 * Reply to message request
 */
export interface ReplyToMessageRequest {
  messageId: string
  content: string
  attachments?: File[]
}

/**
 * Messages list request params
 */
export interface PortalMessagesListRequest {
  status?: 'open' | 'closed'
  page?: number
  limit?: number
}

/**
 * Messages list response
 */
export interface PortalMessagesListResponse {
  messages: PortalMessage[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  unreadTotal: number
}

/**
 * Book appointment request
 */
export interface BookAppointmentRequest {
  serviceType: string
  preferredDate: string // ISO 8601
  preferredTimeSlot: 'morning' | 'afternoon' | 'evening'
  address?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
  }
  notes?: string
}

/**
 * Available time slots response
 */
export interface AvailableTimeSlotsResponse {
  date: string
  slots: {
    time: string // HH:mm format
    available: boolean
    technicianId?: string
  }[]
}

/**
 * Portal dashboard summary
 */
export interface PortalDashboardSummary {
  upcomingJobs: PortalJob[]
  recentInvoices: PortalInvoice[]
  loyaltyPoints: {
    total: number
    available: number
    expiringPoints: {
      points: number
      expiresAt: string
    } | null
  }
  unreadMessages: number
  lastServiceDate: string | null
  nextScheduledService: string | null
}

/**
 * Service area check request
 */
export interface ServiceAreaCheckRequest {
  postalCode: string
}

/**
 * Service area check response
 */
export interface ServiceAreaCheckResponse {
  available: boolean
  zone: string | null
  message: string
  estimatedResponseTime?: string
}

/**
 * Request quote
 */
export interface RequestQuoteRequest {
  serviceType: string
  address: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
  }
  squareFootage?: number
  description: string
  preferredContactMethod: 'email' | 'phone'
  photos?: File[]
}

/**
 * Request quote response
 */
export interface RequestQuoteResponse {
  quoteId: string
  estimatedAmount?: {
    min: number
    max: number
  }
  message: string
}
