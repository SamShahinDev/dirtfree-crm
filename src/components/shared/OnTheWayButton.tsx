'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { Send, Loader2 } from 'lucide-react'

import { formatForDisplay } from '@/lib/utils/phone'
import { sendOnTheWay, type OnTheWayResponse } from '@/app/(dashboard)/jobs/actions-on-the-way'

export interface OnTheWayButtonProps {
  jobId: string
  customerName?: string | null
  customerPhone?: string | null
  jobStatus: string
  variant?: 'default' | 'outline' | 'ghost' | 'icon'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
  className?: string
  showTooltip?: boolean
  tooltipText?: string
}

export function OnTheWayButton({
  jobId,
  customerName,
  customerPhone,
  jobStatus,
  variant = 'default',
  size = 'default',
  disabled = false,
  className,
  showTooltip = false,
  tooltipText = 'Send On The Way SMS'
}: OnTheWayButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Check if button should be disabled
  const isTerminalStatus = ['completed', 'cancelled'].includes(jobStatus)
  const hasNoPhone = !customerPhone
  const isDisabled = disabled || isTerminalStatus || hasNoPhone || isPending

  const getDisabledReason = () => {
    if (isTerminalStatus) return 'Job is completed or cancelled'
    if (hasNoPhone) return 'Customer has no phone number'
    return undefined
  }

  const handleClick = () => {
    if (isDisabled) return
    setIsDialogOpen(true)
  }

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        const result = await sendOnTheWay({ jobId })

        if (result.ok) {
          toast.success('On The Way SMS sent successfully!')
          setIsDialogOpen(false)
        } else {
          let errorMessage = 'Failed to send SMS'

          switch (result.error) {
            case 'no_permission':
              errorMessage = 'You do not have permission to send SMS for this job'
              break
            case 'terminal_status':
              errorMessage = 'Cannot send SMS for completed or cancelled jobs'
              break
            case 'no_phone':
              errorMessage = 'Customer has no phone number on file'
              break
            case 'opted_out':
              errorMessage = 'Customer has opted out of SMS messages'
              break
            case 'job_not_found':
              errorMessage = 'Job not found'
              break
            case 'send_failed':
              errorMessage = result.message || 'Failed to send SMS'
              break
            default:
              errorMessage = 'An unexpected error occurred'
          }

          toast.error(errorMessage)
        }
      } catch (error) {
        console.error('Send on the way error:', error)
        toast.error('An unexpected error occurred')
      }
    })
  }

  const buttonContent = (
    <Button
      variant={variant}
      size={size}
      disabled={isDisabled}
      onClick={handleClick}
      className={className}
      aria-label="Send On The Way SMS"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" strokeWidth={1.5} />
      )}
      {size !== 'icon' && !isPending && (
        <span className="ml-2">On The Way</span>
      )}
    </Button>
  )

  const button = showTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {buttonContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>{getDisabledReason() || tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : buttonContent

  return (
    <>
      {button}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send "On The Way" SMS</DialogTitle>
            <DialogDescription>
              Send an SMS notification to let the customer know you're on your way.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Customer:</span>
                <span className="text-sm">{customerName || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Phone:</span>
                <span className="text-sm font-mono">
                  {customerPhone ? formatForDisplay(customerPhone) : 'Not available'}
                </span>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              This action will be logged and cannot be undone.
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              className="gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send SMS
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}