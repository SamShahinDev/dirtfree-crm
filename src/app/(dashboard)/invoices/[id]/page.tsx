/**
 * Invoice Detail Page
 * Displays full invoice details with status-based actions
 */

import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeftIcon,
  FileTextIcon,
  MailIcon,
  CreditCardIcon,
  XIcon,
  DownloadIcon,
  CopyIcon,
  SendIcon,
  TrashIcon,
} from 'lucide-react'
import {
  formatCurrency,
  getInvoiceStatusColor,
  getInvoiceStatusLabel,
  type InvoiceStatus,
} from '@/types/invoice'
import { InvoiceActions } from './_components/InvoiceActions'
import { InvoicePaymentHistory } from './_components/InvoicePaymentHistory'

// =============================================================================
// TYPES
// =============================================================================

interface InvoiceDetailPageProps {
  params: { id: string }
}

interface InvoiceWithRelations {
  id: string
  number: string
  status: InvoiceStatus
  subtotal_cents: number
  tax_cents: number
  discount_cents: number
  total_cents: number
  currency: string
  created_at: string
  emailed_at: string | null
  paid_at: string | null
  payment_link: string | null
  pdf_key: string | null
  customer: {
    id: string
    name: string
    email: string
    phone: string
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
  }
  job: {
    id: string
    service_type: string
    rooms: string[] | null
    scheduled_date: string
    completed_at: string | null
    notes: string | null
    assigned_technician?: {
      id: string
      name: string
    }
  }
  items: Array<{
    id: string
    description: string
    quantity: number
    unit_cents: number
    line_total_cents: number
  }>
}

// =============================================================================
// DATA FETCHING
// =============================================================================

async function getInvoice(invoiceId: string): Promise<InvoiceWithRelations | null> {
  const supabase = createClient()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customer:customers(
        id,
        name,
        email,
        phone,
        address,
        city,
        state,
        zip
      ),
      job:jobs(
        id,
        service_type,
        rooms,
        scheduled_date,
        completed_at,
        notes,
        assigned_technician:users(
          id,
          name
        )
      ),
      items:invoice_items(
        id,
        description,
        quantity,
        unit_cents,
        line_total_cents
      )
    `)
    .eq('id', invoiceId)
    .single()

  if (error || !invoice) {
    return null
  }

  return invoice as InvoiceWithRelations
}

async function getPaymentHistory(invoiceId: string) {
  const supabase = createClient()

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false })

  return payments || []
}

// =============================================================================
// LOADING COMPONENTS
// =============================================================================

function InvoiceDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex space-x-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// COMPONENTS
// =============================================================================

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const color = getInvoiceStatusColor(status)
  const label = getInvoiceStatusLabel(status)

  const colorClasses = {
    gray: 'bg-gray-100 text-gray-800 border-gray-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    red: 'bg-red-100 text-red-800 border-red-200',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  }

  return (
    <Badge
      variant="outline"
      className={colorClasses[color as keyof typeof colorClasses] || colorClasses.gray}
    >
      {label}
    </Badge>
  )
}

function InvoiceHeader({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <div className="flex items-center space-x-4">
          <Link href="/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-bold tracking-tight">
            Invoice {invoice.number}
          </h1>
          <StatusBadge status={invoice.status} />
        </div>
        <p className="text-muted-foreground">
          Created {format(new Date(invoice.created_at), 'MMMM d, yyyy')}
        </p>
      </div>

      <InvoiceActions invoice={invoice} />
    </div>
  )
}

function CustomerInfo({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold">{invoice.customer.name}</h3>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p>{invoice.customer.email}</p>
          </div>
          {invoice.customer.phone && (
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p>{invoice.customer.phone}</p>
            </div>
          )}
          {invoice.customer.address && (
            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <div className="text-sm">
                <p>{invoice.customer.address}</p>
                {invoice.customer.city && (
                  <p>
                    {invoice.customer.city}
                    {invoice.customer.state && `, ${invoice.customer.state}`}
                    {invoice.customer.zip && ` ${invoice.customer.zip}`}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function JobInfo({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Service Type</p>
            <p className="font-medium">{invoice.job.service_type}</p>
          </div>

          {invoice.job.rooms && invoice.job.rooms.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground">Rooms/Areas</p>
              <p>{invoice.job.rooms.join(', ')}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground">Scheduled Date</p>
            <p>{format(new Date(invoice.job.scheduled_date), 'MMMM d, yyyy')}</p>
          </div>

          {invoice.job.completed_at && (
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p>{format(new Date(invoice.job.completed_at), 'MMMM d, yyyy h:mm a')}</p>
            </div>
          )}

          {invoice.job.assigned_technician && (
            <div>
              <p className="text-sm text-muted-foreground">Technician</p>
              <p>{invoice.job.assigned_technician.name}</p>
            </div>
          )}

          {invoice.job.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{invoice.job.notes}</p>
            </div>
          )}

          <div className="pt-2">
            <Link href={`/jobs/${invoice.job.id}`}>
              <Button variant="outline" size="sm">
                View Job Details
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InvoiceItems({ invoice }: { invoice: InvoiceWithRelations }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Items</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Items table */}
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Description</th>
                  <th className="text-right py-2 font-medium w-20">Qty</th>
                  <th className="text-right py-2 font-medium w-24">Rate</th>
                  <th className="text-right py-2 font-medium w-24">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3">
                      <div className="font-medium">{item.description}</div>
                    </td>
                    <td className="text-right py-3">{item.quantity}</td>
                    <td className="text-right py-3">
                      {formatCurrency(item.unit_cents)}
                    </td>
                    <td className="text-right py-3 font-medium">
                      {formatCurrency(item.line_total_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal_cents)}</span>
            </div>

            {invoice.discount_cents > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discount_cents)}</span>
              </div>
            )}

            {invoice.tax_cents > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCurrency(invoice.tax_cents)}</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>{formatCurrency(invoice.total_cents)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InvoiceTimeline({ invoice }: { invoice: InvoiceWithRelations }) {
  const events = [
    {
      title: 'Invoice Created',
      date: invoice.created_at,
      icon: FileTextIcon,
      color: 'blue'
    }
  ]

  if (invoice.emailed_at) {
    events.push({
      title: 'Invoice Sent',
      date: invoice.emailed_at,
      icon: MailIcon,
      color: 'yellow'
    })
  }

  if (invoice.paid_at) {
    events.push({
      title: 'Payment Received',
      date: invoice.paid_at,
      icon: CreditCardIcon,
      color: 'green'
    })
  }

  if (invoice.status === 'void') {
    events.push({
      title: 'Invoice Voided',
      date: invoice.created_at, // This would be void date in real implementation
      icon: XIcon,
      color: 'red'
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => {
            const Icon = event.icon
            return (
              <div key={index} className="flex items-start space-x-3">
                <div className={`p-2 rounded-full bg-${event.color}-100`}>
                  <Icon className={`h-4 w-4 text-${event.color}-600`} />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(event.date), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// =============================================================================
// PAGE COMPONENTS
// =============================================================================

async function InvoiceDetailContent({ invoiceId }: { invoiceId: string }) {
  const [invoice, paymentHistory] = await Promise.all([
    getInvoice(invoiceId),
    getPaymentHistory(invoiceId)
  ])

  if (!invoice) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <InvoiceHeader invoice={invoice} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <InvoiceItems invoice={invoice} />

            {paymentHistory.length > 0 && (
              <InvoicePaymentHistory payments={paymentHistory} />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <CustomerInfo invoice={invoice} />
            <JobInfo invoice={invoice} />
            <InvoiceTimeline invoice={invoice} />
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  return (
    <Suspense fallback={<InvoiceDetailSkeleton />}>
      <InvoiceDetailContent invoiceId={params.id} />
    </Suspense>
  )
}

// =============================================================================
// METADATA
// =============================================================================

export const metadata = {
  title: 'Invoice Details - Dirt Free CRM',
  description: 'View invoice details, status, and payment information'
}