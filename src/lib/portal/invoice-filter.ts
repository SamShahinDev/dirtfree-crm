/**
 * Invoice Data Filtering for Portal API
 *
 * Filters invoice data to only include fields safe for customer portal view.
 * Removes CRM-only fields and sensitive internal data.
 */

import type { Database } from '@/types/supabase'
import { formatCurrency, getInvoiceStatusLabel, type InvoiceStatus, type PaymentStatus } from '@/types/invoice'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type InvoiceItemRow = Database['public']['Tables']['invoice_items']['Row']
type PaymentRow = Database['public']['Tables']['payments']['Row']

/**
 * Portal invoice status (for customer view)
 */
export type PortalInvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

/**
 * Invoice list item for portal
 */
export interface PortalInvoiceListItem {
  id: string
  number: string
  status: PortalInvoiceStatus
  statusLabel: string
  total: number
  totalFormatted: string
  dueDate: string | null
  paidDate: string | null
  issuedDate: string
  jobId: string | null
}

/**
 * Invoice line item for portal
 */
export interface PortalInvoiceLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  unitPriceFormatted: string
  lineTotal: number
  lineTotalFormatted: string
}

/**
 * Payment history item for portal
 */
export interface PortalPaymentHistoryItem {
  id: string
  amount: number
  amountFormatted: string
  status: string
  statusLabel: string
  processedAt: string | null
  createdAt: string
  paymentMethod?: string
}

/**
 * Detailed invoice for portal
 */
export interface PortalInvoiceDetail {
  id: string
  number: string
  status: PortalInvoiceStatus
  statusLabel: string

  // Financial details
  subtotal: number
  subtotalFormatted: string
  tax: number
  taxFormatted: string
  discount: number
  discountFormatted: string
  total: number
  totalFormatted: string
  amountPaid: number
  amountPaidFormatted: string
  amountDue: number
  amountDueFormatted: string

  // Line items
  items: PortalInvoiceLineItem[]

  // Payment information
  paymentHistory: PortalPaymentHistoryItem[]
  paymentLink: string | null

  // Job information
  jobId: string | null
  serviceType: string | null
  serviceDate: string | null

  // Dates
  issuedDate: string
  dueDate: string | null
  paidDate: string | null
  createdAt: string
}

/**
 * Determine portal invoice status
 * Adds "overdue" status for unpaid invoices past due date
 */
function getPortalInvoiceStatus(invoice: InvoiceRow): PortalInvoiceStatus {
  if (invoice.status === 'paid') {
    return 'paid'
  }

  if (invoice.status === 'draft') {
    return 'draft'
  }

  // Check if invoice is overdue
  if (invoice.status === 'sent') {
    // Calculate due date (30 days from created_at if not specified)
    const dueDate = invoice.created_at
      ? new Date(new Date(invoice.created_at).getTime() + (30 * 24 * 60 * 60 * 1000))
      : null

    if (dueDate && new Date() > dueDate) {
      return 'overdue'
    }

    return 'sent'
  }

  return 'sent'
}

/**
 * Filter invoice for portal list view
 */
export function filterInvoiceForPortalList(
  invoice: InvoiceRow
): PortalInvoiceListItem {
  const portalStatus = getPortalInvoiceStatus(invoice)

  // Calculate due date (30 days from created_at)
  const dueDate = invoice.created_at
    ? new Date(new Date(invoice.created_at).getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString()
    : null

  return {
    id: invoice.id,
    number: invoice.number,
    status: portalStatus,
    statusLabel: portalStatus === 'overdue' ? 'Overdue' : getInvoiceStatusLabel(invoice.status),
    total: invoice.total_cents / 100,
    totalFormatted: formatCurrency(invoice.total_cents, invoice.currency),
    dueDate,
    paidDate: invoice.paid_at,
    issuedDate: invoice.created_at,
    jobId: invoice.job_id,
  }
}

/**
 * Filter invoice for portal detail view
 */
export function filterInvoiceForPortalDetail(
  invoice: InvoiceRow & {
    items?: InvoiceItemRow[] | null
    payments?: PaymentRow[] | null
    job?: {
      service_type: string | null
      scheduled_date: string | null
    } | null
  }
): PortalInvoiceDetail {
  const portalStatus = getPortalInvoiceStatus(invoice)

  // Calculate due date (30 days from created_at)
  const dueDate = invoice.created_at
    ? new Date(new Date(invoice.created_at).getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString()
    : null

  // Process line items
  const items: PortalInvoiceLineItem[] = (invoice.items || []).map(item => ({
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unit_cents / 100,
    unitPriceFormatted: formatCurrency(item.unit_cents, invoice.currency),
    lineTotal: item.line_total_cents / 100,
    lineTotalFormatted: formatCurrency(item.line_total_cents, invoice.currency),
  }))

  // Process payment history
  const paymentHistory: PortalPaymentHistoryItem[] = (invoice.payments || []).map(payment => ({
    id: payment.id,
    amount: payment.amount_cents / 100,
    amountFormatted: formatCurrency(payment.amount_cents, payment.currency),
    status: payment.status,
    statusLabel: getPaymentStatusLabel(payment.status),
    processedAt: payment.processed_at,
    createdAt: payment.created_at,
    paymentMethod: payment.provider_data?.payment_method || payment.provider,
  }))

  // Calculate amount paid and due
  const amountPaid = paymentHistory
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)
  const amountDue = Math.max(0, (invoice.total_cents / 100) - amountPaid)

  return {
    id: invoice.id,
    number: invoice.number,
    status: portalStatus,
    statusLabel: portalStatus === 'overdue' ? 'Overdue' : getInvoiceStatusLabel(invoice.status),

    subtotal: invoice.subtotal_cents / 100,
    subtotalFormatted: formatCurrency(invoice.subtotal_cents, invoice.currency),
    tax: invoice.tax_cents / 100,
    taxFormatted: formatCurrency(invoice.tax_cents, invoice.currency),
    discount: invoice.discount_cents / 100,
    discountFormatted: formatCurrency(invoice.discount_cents, invoice.currency),
    total: invoice.total_cents / 100,
    totalFormatted: formatCurrency(invoice.total_cents, invoice.currency),
    amountPaid,
    amountPaidFormatted: formatCurrency(Math.round(amountPaid * 100), invoice.currency),
    amountDue,
    amountDueFormatted: formatCurrency(Math.round(amountDue * 100), invoice.currency),

    items,
    paymentHistory,
    paymentLink: invoice.payment_link,

    jobId: invoice.job_id,
    serviceType: invoice.job?.service_type || null,
    serviceDate: invoice.job?.scheduled_date || null,

    issuedDate: invoice.created_at,
    dueDate,
    paidDate: invoice.paid_at,
    createdAt: invoice.created_at,
  }
}

/**
 * Helper to get payment status label
 */
function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'pending': 'Pending',
    'processing': 'Processing',
    'succeeded': 'Succeeded',
    'failed': 'Failed',
    'canceled': 'Canceled',
    'refunded': 'Refunded',
  }
  return labels[status] || status
}
