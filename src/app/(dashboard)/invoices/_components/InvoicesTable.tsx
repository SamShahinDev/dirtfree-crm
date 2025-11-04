/**
 * Invoices Table Component
 * Displays invoices in a sortable, paginated table with status indicators
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import {
  ChevronUpIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
  EyeIcon,
  DownloadIcon,
  MailIcon,
  CopyIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  formatCurrency,
  getInvoiceStatusColor,
  getInvoiceStatusLabel,
  type InvoiceStatus,
} from '@/types/invoice'
import { getInvoicePdfUrl } from '../actions'

// =============================================================================
// TYPES
// =============================================================================

interface InvoiceTableItem {
  id: string
  number: string
  status: InvoiceStatus
  total_cents: number
  created_at: string
  emailed_at: string | null
  paid_at: string | null
  payment_link: string | null
  customer: {
    id: string
    name: string
    email: string
    phone: string
  }
  job: {
    id: string
    service_type: string
    assigned_technician?: {
      id: string
      name: string
    }
  }
}

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalCount: number
}

interface SortInfo {
  field: string
  order: 'asc' | 'desc'
}

interface InvoicesTableProps {
  invoices: InvoiceTableItem[]
  pagination: PaginationInfo
  currentSort: SortInfo
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function updateSearchParams(
  searchParams: URLSearchParams,
  updates: Record<string, string | null>
): URLSearchParams {
  const newParams = new URLSearchParams(searchParams)

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null) {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
  })

  return newParams
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

function SortableHeader({
  children,
  field,
  currentSort,
  onSort,
}: {
  children: React.ReactNode
  field: string
  currentSort: SortInfo
  onSort: (field: string) => void
}) {
  const isActive = currentSort.field === field
  const isAsc = isActive && currentSort.order === 'asc'

  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center space-x-1 hover:text-foreground transition-colors"
    >
      <span>{children}</span>
      {isActive && (
        isAsc ? (
          <ChevronUpIcon className="h-4 w-4" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" />
        )
      )}
    </button>
  )
}

function InvoiceRowActions({ invoice }: { invoice: InvoiceTableItem }) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true)
      const result = await getInvoicePdfUrl(invoice.id)

      if (result.success && result.downloadUrl) {
        // Open PDF in new tab
        window.open(result.downloadUrl, '_blank')
        toast.success('PDF opened in new tab')
      } else {
        toast.error(result.error || 'Failed to download PDF')
      }
    } catch (error) {
      console.error('PDF download error:', error)
      toast.error('Failed to download PDF')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleCopyPaymentLink = () => {
    if (invoice.payment_link) {
      navigator.clipboard.writeText(invoice.payment_link)
      toast.success('Payment link copied to clipboard')
    }
  }

  const handleEmailCustomer = () => {
    const subject = encodeURIComponent(`Invoice ${invoice.number}`)
    const body = encodeURIComponent(
      `Hi ${invoice.customer.name},\n\nPlease find your invoice ${invoice.number} attached.\n\nBest regards,\nDirt Free Carpet`
    )
    window.open(`mailto:${invoice.customer.email}?subject=${subject}&body=${body}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontalIcon className="h-4 w-4" />
          <span className="sr-only">Open actions menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/invoices/${invoice.id}`} className="flex items-center">
            <EyeIcon className="h-4 w-4 mr-2" />
            View Details
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleDownloadPdf}
          disabled={isDownloading}
        >
          <DownloadIcon className="h-4 w-4 mr-2" />
          {isDownloading ? 'Downloading...' : 'Download PDF'}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={handleEmailCustomer}>
          <MailIcon className="h-4 w-4 mr-2" />
          Email Customer
        </DropdownMenuItem>

        {invoice.payment_link && (
          <DropdownMenuItem onClick={handleCopyPaymentLink}>
            <CopyIcon className="h-4 w-4 mr-2" />
            Copy Payment Link
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-12 h-12 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
      <p className="text-muted-foreground mb-4">
        No invoices match your current filters. Try adjusting your search criteria.
      </p>
      <Button variant="outline" asChild>
        <Link href="/jobs?status=completed">
          View Completed Jobs
        </Link>
      </Button>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InvoicesTable({
  invoices,
  pagination,
  currentSort,
}: InvoicesTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSort = (field: string) => {
    const newOrder = currentSort.field === field && currentSort.order === 'asc' ? 'desc' : 'asc'
    const newParams = updateSearchParams(searchParams, {
      sort: field,
      order: newOrder,
      page: '1', // Reset to first page when sorting
    })

    router.push(`/invoices?${newParams.toString()}`)
  }

  const handlePageChange = (page: number) => {
    const newParams = updateSearchParams(searchParams, {
      page: page.toString(),
    })

    router.push(`/invoices?${newParams.toString()}`)
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>
          {pagination.totalCount} total invoice{pagination.totalCount !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader
                    field="number"
                    currentSort={currentSort}
                    onSort={handleSort}
                  >
                    Number
                  </SortableHeader>
                </TableHead>
                <TableHead>
                  <SortableHeader
                    field="customer.name"
                    currentSort={currentSort}
                    onSort={handleSort}
                  >
                    Customer
                  </SortableHeader>
                </TableHead>
                <TableHead>Job</TableHead>
                <TableHead>
                  <SortableHeader
                    field="total_cents"
                    currentSort={currentSort}
                    onSort={handleSort}
                  >
                    Total
                  </SortableHeader>
                </TableHead>
                <TableHead>
                  <SortableHeader
                    field="status"
                    currentSort={currentSort}
                    onSort={handleSort}
                  >
                    Status
                  </SortableHeader>
                </TableHead>
                <TableHead>
                  <SortableHeader
                    field="created_at"
                    currentSort={currentSort}
                    onSort={handleSort}
                  >
                    Created
                  </SortableHeader>
                </TableHead>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="text-primary hover:underline"
                    >
                      {invoice.number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{invoice.customer.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {invoice.customer.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{invoice.job.service_type}</div>
                      {invoice.job.assigned_technician && (
                        <div className="text-sm text-muted-foreground">
                          {invoice.job.assigned_technician.name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(invoice.total_cents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>
                      {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                    </div>
                    <div className="text-xs">
                      {format(new Date(invoice.created_at), 'h:mm a')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <InvoiceRowActions invoice={invoice} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="mt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      if (pagination.currentPage > 1) {
                        handlePageChange(pagination.currentPage - 1)
                      }
                    }}
                    className={pagination.currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>

                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1
                  } else {
                    const start = Math.max(1, pagination.currentPage - 2)
                    const end = Math.min(pagination.totalPages, start + 4)
                    pageNum = start + i
                    if (pageNum > end) return null
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          handlePageChange(pageNum)
                        }}
                        isActive={pageNum === pagination.currentPage}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  )
                }).filter(Boolean)}

                {pagination.totalPages > 5 && pagination.currentPage < pagination.totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      if (pagination.currentPage < pagination.totalPages) {
                        handlePageChange(pagination.currentPage + 1)
                      }
                    }}
                    className={pagination.currentPage >= pagination.totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  )
}