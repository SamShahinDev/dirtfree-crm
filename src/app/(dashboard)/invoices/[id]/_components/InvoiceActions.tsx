/**
 * Invoice Actions Component
 * Displays status-appropriate actions for invoices
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  FileTextIcon,
  MailIcon,
  CreditCardIcon,
  DownloadIcon,
  CopyIcon,
  SendIcon,
  TrashIcon,
  MoreHorizontalIcon,
  ExternalLinkIcon,
} from 'lucide-react'
import {
  renderInvoicePdf,
  generateStripePaymentLink,
  sendInvoiceEmailAction,
  voidInvoice,
  getInvoicePdfUrl,
  resendInvoiceEmail,
} from '../../actions'
import type { InvoiceStatus } from '@/types/invoice'

// =============================================================================
// TYPES
// =============================================================================

interface InvoiceWithRelations {
  id: string
  number: string
  status: InvoiceStatus
  payment_link: string | null
  pdf_key: string | null
  customer: {
    name: string
    email: string
  }
}

interface InvoiceActionsProps {
  invoice: InvoiceWithRelations
}

// =============================================================================
// COMPONENT
// =============================================================================

export function InvoiceActions({ invoice }: InvoiceActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showVoidDialog, setShowVoidDialog] = useState(false)
  const [showPaymentLinkDialog, setShowPaymentLinkDialog] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState<string | null>(null)

  // =============================================================================
  // ACTIONS
  // =============================================================================

  const handleGeneratePdf = async () => {
    startTransition(async () => {
      const result = await renderInvoicePdf(invoice.id)
      if (result.success) {
        toast.success('PDF generated successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to generate PDF')
      }
    })
  }

  const handleDownloadPdf = async () => {
    try {
      const result = await getInvoicePdfUrl(invoice.id)
      if (result.success && result.downloadUrl) {
        window.open(result.downloadUrl, '_blank')
        toast.success('PDF opened in new tab')
      } else {
        toast.error(result.error || 'Failed to download PDF')
      }
    } catch (error) {
      console.error('PDF download error:', error)
      toast.error('Failed to download PDF')
    }
  }

  const handleGeneratePaymentLink = async () => {
    startTransition(async () => {
      const result = await generateStripePaymentLink(invoice.id)
      if (result.success && result.paymentLink) {
        setGeneratedPaymentLink(result.paymentLink)
        setShowPaymentLinkDialog(true)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to generate payment link')
      }
    })
  }

  const handleCopyPaymentLink = () => {
    if (invoice.payment_link) {
      navigator.clipboard.writeText(invoice.payment_link)
      toast.success('Payment link copied to clipboard')
    }
  }

  const handleSendEmail = async () => {
    startTransition(async () => {
      const result = await sendInvoiceEmailAction(invoice.id)
      if (result.success) {
        toast.success(`Invoice sent to ${invoice.customer.email}`)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to send invoice email')
      }
    })
  }

  const handleResendEmail = async () => {
    startTransition(async () => {
      const result = await resendInvoiceEmail(invoice.id)
      if (result.success) {
        toast.success(`Invoice resent to ${invoice.customer.email}`)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to resend invoice email')
      }
    })
  }

  const handleVoidInvoice = async () => {
    if (!voidReason.trim()) {
      toast.error('Please provide a reason for voiding the invoice')
      return
    }

    startTransition(async () => {
      const result = await voidInvoice({
        invoiceId: invoice.id,
        reason: voidReason
      })

      if (result.success) {
        toast.success('Invoice voided successfully')
        setShowVoidDialog(false)
        setVoidReason('')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to void invoice')
      }
    })
  }

  const handleEmailCustomer = () => {
    const subject = encodeURIComponent(`Invoice ${invoice.number}`)
    const body = encodeURIComponent(
      `Hi ${invoice.customer.name},\n\nPlease find your invoice ${invoice.number} attached.\n\nBest regards,\nDirt Free Carpet`
    )
    window.open(`mailto:${invoice.customer.email}?subject=${subject}&body=${body}`)
  }

  // =============================================================================
  // STATUS-BASED ACTIONS
  // =============================================================================

  const getDraftActions = () => (
    <>
      <Button
        onClick={handleGeneratePdf}
        disabled={isPending}
        variant="default"
        size="sm"
      >
        <FileTextIcon className="h-4 w-4 mr-2" />
        {invoice.pdf_key ? 'Regenerate PDF' : 'Generate PDF'}
      </Button>

      <Button
        onClick={handleGeneratePaymentLink}
        disabled={isPending || !invoice.pdf_key}
        variant="outline"
        size="sm"
      >
        <CreditCardIcon className="h-4 w-4 mr-2" />
        Create Payment Link
      </Button>

      <Button
        onClick={handleSendEmail}
        disabled={isPending || !invoice.pdf_key || !invoice.payment_link}
        variant="outline"
        size="sm"
      >
        <SendIcon className="h-4 w-4 mr-2" />
        Send to Customer
      </Button>
    </>
  )

  const getSentActions = () => (
    <>
      <Button
        onClick={handleCopyPaymentLink}
        disabled={!invoice.payment_link}
        variant="default"
        size="sm"
      >
        <CopyIcon className="h-4 w-4 mr-2" />
        Copy Payment Link
      </Button>

      <Button
        onClick={handleResendEmail}
        disabled={isPending}
        variant="outline"
        size="sm"
      >
        <MailIcon className="h-4 w-4 mr-2" />
        Resend Email
      </Button>
    </>
  )

  const getPaidActions = () => (
    <>
      <Button
        onClick={handleDownloadPdf}
        disabled={!invoice.pdf_key}
        variant="default"
        size="sm"
      >
        <DownloadIcon className="h-4 w-4 mr-2" />
        Download PDF
      </Button>

      <Button
        onClick={handleEmailCustomer}
        variant="outline"
        size="sm"
      >
        <MailIcon className="h-4 w-4 mr-2" />
        Email Customer
      </Button>
    </>
  )

  const getVoidActions = () => (
    <Button
      onClick={handleDownloadPdf}
      disabled={!invoice.pdf_key}
      variant="outline"
      size="sm"
    >
      <DownloadIcon className="h-4 w-4 mr-2" />
      Download PDF
    </Button>
  )

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <>
      <div className="flex items-center space-x-2">
        {/* Status-based primary actions */}
        {invoice.status === 'draft' && getDraftActions()}
        {invoice.status === 'sent' && getSentActions()}
        {invoice.status === 'paid' && getPaidActions()}
        {invoice.status === 'void' && getVoidActions()}

        {/* Additional actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontalIcon className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Download PDF - always available if PDF exists */}
            {invoice.pdf_key && (
              <DropdownMenuItem onClick={handleDownloadPdf}>
                <DownloadIcon className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
            )}

            {/* View payment link */}
            {invoice.payment_link && (
              <DropdownMenuItem onClick={() => window.open(invoice.payment_link!, '_blank')}>
                <ExternalLinkIcon className="h-4 w-4 mr-2" />
                View Payment Link
              </DropdownMenuItem>
            )}

            {/* Email actions */}
            <DropdownMenuItem onClick={handleEmailCustomer}>
              <MailIcon className="h-4 w-4 mr-2" />
              Compose Email
            </DropdownMenuItem>

            {/* Void action - only for draft and sent invoices */}
            {(invoice.status === 'draft' || invoice.status === 'sent') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowVoidDialog(true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Void Invoice
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Void confirmation dialog */}
      <AlertDialog open={showVoidDialog} onOpenChange={setShowVoidDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to void invoice {invoice.number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="void-reason">Reason for voiding (required)</Label>
            <Textarea
              id="void-reason"
              placeholder="Enter reason for voiding this invoice..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidInvoice}
              disabled={!voidReason.trim() || isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? 'Voiding...' : 'Void Invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment link success dialog */}
      <Dialog open={showPaymentLinkDialog} onOpenChange={setShowPaymentLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Link Created</DialogTitle>
            <DialogDescription>
              A secure payment link has been generated for invoice {invoice.number}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Payment Link</Label>
              <div className="flex mt-2">
                <input
                  type="text"
                  value={generatedPaymentLink || ''}
                  readOnly
                  className="flex-1 px-3 py-2 border border-input bg-background rounded-l-md text-sm"
                />
                <Button
                  onClick={() => {
                    if (generatedPaymentLink) {
                      navigator.clipboard.writeText(generatedPaymentLink)
                      toast.success('Payment link copied to clipboard')
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-l-none"
                >
                  <CopyIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (generatedPaymentLink) {
                  window.open(generatedPaymentLink, '_blank')
                }
              }}
              variant="outline"
            >
              <ExternalLinkIcon className="h-4 w-4 mr-2" />
              Open Link
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={isPending}
            >
              <SendIcon className="h-4 w-4 mr-2" />
              {isPending ? 'Sending...' : 'Send to Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}