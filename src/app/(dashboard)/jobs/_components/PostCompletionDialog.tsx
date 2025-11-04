/**
 * Post Job Completion Dialog
 * Shows after job completion to offer invoice creation and next steps
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircleIcon,
  FileTextIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  Loader2Icon,
} from 'lucide-react'
import { createInvoiceFromJob } from '../../invoices/actions'

// =============================================================================
// TYPES
// =============================================================================

interface JobData {
  id: string
  customerId: string
  status: string
  customer?: {
    id: string
    name: string
    email?: string | null
  }
}

interface PostCompletionDialogProps {
  job: JobData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PostCompletionDialog({
  job,
  open,
  onOpenChange,
}: PostCompletionDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)

  const handleCreateInvoice = () => {
    if (!job) return

    startTransition(async () => {
      try {
        const result = await createInvoiceFromJob({
          jobId: job.id,
          taxRatePercent: 0, // Default no tax, can be customized
          discountCents: 0, // Default no discount
        })

        if (result.success && result.invoiceId) {
          setCreatedInvoiceId(result.invoiceId)
          toast.success('Invoice created successfully!')
        } else {
          toast.error(result.error || 'Failed to create invoice')
        }
      } catch (error) {
        console.error('Invoice creation error:', error)
        toast.error('Failed to create invoice')
      }
    })
  }

  const handleViewInvoice = () => {
    if (createdInvoiceId) {
      router.push(`/invoices/${createdInvoiceId}`)
      onOpenChange(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setCreatedInvoiceId(null)
  }

  if (!job) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            Job Completed Successfully!
          </DialogTitle>
          <DialogDescription>
            The job has been marked as completed. What would you like to do next?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job Summary */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-medium text-green-900">
                  Job for {job.customer?.name}
                </p>
                <p className="text-sm text-green-700">
                  Status updated to completed
                </p>
              </div>
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                Completed
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Next Steps */}
          <div className="space-y-4">
            <h4 className="font-medium">Next Steps</h4>

            {createdInvoiceId ? (
              // Invoice created state
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <FileTextIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-900">
                        Invoice Created
                      </p>
                      <p className="text-sm text-blue-700">
                        Invoice has been generated and is ready for review
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleViewInvoice}
                    className="flex-1"
                  >
                    <FileTextIcon className="h-4 w-4 mr-2" />
                    View Invoice
                  </Button>

                  <Link href="/invoices" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <ArrowRightIcon className="h-4 w-4 mr-2" />
                      All Invoices
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              // Pre-invoice creation state
              <div className="space-y-3">
                <div className="p-4 border border-dashed border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <FileTextIcon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Create Invoice</p>
                      <p className="text-sm text-muted-foreground">
                        Generate an invoice for the completed work
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleCreateInvoice}
                  disabled={isPending}
                  className="w-full"
                >
                  {isPending && <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />}
                  {isPending ? 'Creating Invoice...' : 'Create Invoice'}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  You can also create invoices later from the Invoices page
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full">
            <Link href={`/jobs/${job.id}`} className="flex-1">
              <Button variant="outline" className="w-full">
                <ExternalLinkIcon className="h-4 w-4 mr-2" />
                View Job
              </Button>
            </Link>

            <Button onClick={handleClose} className="flex-1">
              Done
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}