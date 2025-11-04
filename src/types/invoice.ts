/**
 * Invoice System Types
 * Comprehensive type definitions for invoice management, PDF generation, and payments
 */

import { z } from 'zod'

// =============================================================================
// ENUMS
// =============================================================================

export const InvoiceStatus = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  VOID: 'void'
} as const

export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus]

export const PaymentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELED: 'canceled',
  REFUNDED: 'refunded'
} as const

export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus]

// =============================================================================
// CORE TYPES
// =============================================================================

export interface Invoice {
  id: string
  job_id: string
  customer_id: string

  // Invoice identification
  number: string // Format: DF-YYYYMMDD-####

  // Status and workflow
  status: InvoiceStatus

  // Financial details (in cents)
  subtotal_cents: number
  tax_cents: number
  discount_cents: number
  total_cents: number
  currency: string

  // Payment and delivery
  payment_link?: string | null
  pdf_key?: string | null

  // Timestamps
  emailed_at?: string | null
  paid_at?: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string

  // Item details
  description: string
  quantity: number
  unit_cents: number
  line_total_cents: number

  // Ordering
  sort_order: number

  // Timestamps
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  invoice_id: string

  // Payment provider details
  provider: string
  provider_ref: string // Stripe payment intent ID, session ID, etc.

  // Payment details
  amount_cents: number
  currency: string
  status: PaymentStatus

  // Provider-specific metadata
  provider_data?: Record<string, any> | null

  // Timestamps
  processed_at?: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// EXTENDED TYPES (with relations)
// =============================================================================

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[]
}

export interface InvoiceWithRelations extends Invoice {
  items: InvoiceItem[]
  payments: Payment[]
  customer: {
    id: string
    name: string
    email: string
    phone: string
    address: string
  }
  job: {
    id: string
    service_type: string
    scheduled_date: string
    assigned_technician: string
    status: string
  }
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface CreateInvoiceFromJobInput {
  jobId: string
  taxRatePercent?: number
  discountCents?: number
}

export interface CreateInvoiceItemInput {
  description: string
  quantity: number
  unitCents: number
}

export interface CreateInvoiceInput {
  jobId: string
  customerId: string
  items: CreateInvoiceItemInput[]
  taxRatePercent?: number
  discountCents?: number
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus
  paymentLink?: string
  pdfKey?: string
  emailedAt?: string
  paidAt?: string
}

export interface VoidInvoiceInput {
  invoiceId: string
  reason?: string
}

// =============================================================================
// CALCULATION HELPERS
// =============================================================================

export interface InvoiceTotals {
  subtotal_cents: number
  tax_cents: number
  discount_cents: number
  total_cents: number
}

/**
 * Calculate invoice totals from line items
 */
export function calcTotals(
  items: Pick<InvoiceItem, 'line_total_cents'>[],
  taxRatePercent: number = 0,
  discountCents: number = 0
): InvoiceTotals {
  const subtotal_cents = items.reduce((sum, item) => sum + item.line_total_cents, 0)
  const tax_cents = Math.round(subtotal_cents * taxRatePercent / 100)
  const total_cents = Math.max(0, subtotal_cents + tax_cents - discountCents)

  return {
    subtotal_cents,
    tax_cents,
    discount_cents: discountCents,
    total_cents
  }
}

/**
 * Calculate line item total
 */
export function calcLineTotal(quantity: number, unitCents: number): number {
  return Math.round(quantity * unitCents)
}

/**
 * Format currency amount from cents
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  const amount = cents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amount)
}

/**
 * Parse currency amount to cents
 */
export function parseCurrencyToCents(amount: string | number): number {
  if (typeof amount === 'number') {
    return Math.round(amount * 100)
  }

  // Remove currency symbols and parse
  const cleaned = amount.replace(/[$,\s]/g, '')
  const parsed = parseFloat(cleaned)

  if (isNaN(parsed)) {
    return 0
  }

  return Math.round(parsed * 100)
}

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

export const InvoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  quantity: z.number().positive('Quantity must be positive'),
  unitCents: z.number().int().min(0, 'Unit price must be non-negative'),
  sortOrder: z.number().int().optional().default(0)
})

export const CreateInvoiceFromJobSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
  taxRatePercent: z.number().min(0).max(100).optional().default(0),
  discountCents: z.number().int().min(0).optional().default(0)
})

export const CreateInvoiceSchema = z.object({
  jobId: z.string().uuid('Invalid job ID'),
  customerId: z.string().uuid('Invalid customer ID'),
  items: z.array(InvoiceItemSchema).min(1, 'At least one item is required'),
  taxRatePercent: z.number().min(0).max(100).optional().default(0),
  discountCents: z.number().int().min(0).optional().default(0)
})

export const VoidInvoiceSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  reason: z.string().optional()
})

// =============================================================================
// INVOICE STATUS HELPERS
// =============================================================================

export function canEditInvoice(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.DRAFT
}

export function canSendInvoice(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.DRAFT
}

export function canVoidInvoice(status: InvoiceStatus): boolean {
  return status !== InvoiceStatus.VOID
}

export function canGeneratePaymentLink(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.DRAFT || status === InvoiceStatus.SENT
}

export function getInvoiceStatusColor(status: InvoiceStatus): string {
  switch (status) {
    case InvoiceStatus.DRAFT:
      return 'gray'
    case InvoiceStatus.SENT:
      return 'blue'
    case InvoiceStatus.PAID:
      return 'green'
    case InvoiceStatus.VOID:
      return 'red'
    default:
      return 'gray'
  }
}

export function getInvoiceStatusLabel(status: InvoiceStatus): string {
  switch (status) {
    case InvoiceStatus.DRAFT:
      return 'Draft'
    case InvoiceStatus.SENT:
      return 'Sent'
    case InvoiceStatus.PAID:
      return 'Paid'
    case InvoiceStatus.VOID:
      return 'Void'
    default:
      return 'Unknown'
  }
}

// =============================================================================
// PAYMENT HELPERS
// =============================================================================

export function getPaymentStatusColor(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatus.PENDING:
      return 'yellow'
    case PaymentStatus.PROCESSING:
      return 'blue'
    case PaymentStatus.SUCCEEDED:
      return 'green'
    case PaymentStatus.FAILED:
      return 'red'
    case PaymentStatus.CANCELED:
      return 'gray'
    case PaymentStatus.REFUNDED:
      return 'orange'
    default:
      return 'gray'
  }
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case PaymentStatus.PENDING:
      return 'Pending'
    case PaymentStatus.PROCESSING:
      return 'Processing'
    case PaymentStatus.SUCCEEDED:
      return 'Succeeded'
    case PaymentStatus.FAILED:
      return 'Failed'
    case PaymentStatus.CANCELED:
      return 'Canceled'
    case PaymentStatus.REFUNDED:
      return 'Refunded'
    default:
      return 'Unknown'
  }
}

// =============================================================================
// INVOICE NUMBER HELPERS
// =============================================================================

/**
 * Generate invoice number in format DF-YYYYMMDD-####
 */
export function generateInvoiceNumber(date: Date = new Date(), sequence: number): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
  const sequenceStr = sequence.toString().padStart(4, '0')
  return `DF-${dateStr}-${sequenceStr}`
}

/**
 * Parse invoice number to extract date and sequence
 */
export function parseInvoiceNumber(number: string): { date: Date; sequence: number } | null {
  const match = number.match(/^DF-(\d{8})-(\d{4})$/)
  if (!match) return null

  const [, dateStr, seqStr] = match
  const year = parseInt(dateStr.slice(0, 4))
  const month = parseInt(dateStr.slice(4, 6)) - 1 // Month is 0-indexed
  const day = parseInt(dateStr.slice(6, 8))

  return {
    date: new Date(year, month, day),
    sequence: parseInt(seqStr)
  }
}

// =============================================================================
// EXPORT HELPERS
// =============================================================================

export interface InvoiceExportData {
  invoice: InvoiceWithRelations
  companyInfo: {
    name: string
    address: string
    cityStateZip: string
    phone: string
    website: string
    email: string
  }
}

export interface PDFGenerationOptions {
  includeQRCode?: boolean
  includePaymentInstructions?: boolean
  templateStyle?: 'standard' | 'minimal' | 'branded'
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export class InvoiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public invoiceId?: string
  ) {
    super(message)
    this.name = 'InvoiceError'
  }
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public paymentId?: string,
    public providerError?: any
  ) {
    super(message)
    this.name = 'PaymentError'
  }
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return Object.values(InvoiceStatus).includes(value as InvoiceStatus)
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return Object.values(PaymentStatus).includes(value as PaymentStatus)
}

export function hasInvoiceItems(invoice: Invoice | InvoiceWithItems): invoice is InvoiceWithItems {
  return 'items' in invoice && Array.isArray(invoice.items)
}

export function hasInvoiceRelations(invoice: Invoice | InvoiceWithRelations): invoice is InvoiceWithRelations {
  return 'items' in invoice && 'payments' in invoice && 'customer' in invoice && 'job' in invoice
}