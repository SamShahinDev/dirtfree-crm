'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, CheckCircle, Clock, XCircle, Calendar } from 'lucide-react'

import { canTransition, getStatusColor, type JobStatus, JOB_STATUSES } from '@/types/job'
import { transitionStatus } from '../actions'

interface JobData {
  id: string
  customerId: string
  technicianId?: string | null
  zone?: string | null
  status: string
  scheduledDate?: string | null
  scheduledTimeStart?: string | null
  scheduledTimeEnd?: string | null
  description?: string | null
  customer?: {
    id: string
    name: string
    phone_e164?: string | null
    email?: string | null
    address_line1?: string | null
    city?: string | null
    state?: string | null
  }
  technician?: {
    id: string
    display_name?: string | null
  }
}

interface StatusMenuProps {
  job: JobData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function StatusMenu({
  job,
  open,
  onOpenChange,
  onSuccess
}: StatusMenuProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedStatus, setSelectedStatus] = useState<JobStatus | null>(null)

  const handleStatusChange = (newStatus: JobStatus) => {
    if (!job || !canTransition(job.status as JobStatus, newStatus)) return

    setSelectedStatus(newStatus)

    startTransition(async () => {
      try {
        const response = await transitionStatus({
          jobId: job.id,
          toStatus: newStatus,
          currentStatus: job.status as JobStatus
        })

        if (!response.ok) {
          throw new Error(response.error || 'Failed to update job status')
        }

        toast.success(`Job status updated to ${getStatusDisplay(newStatus)}`)
        onOpenChange(false)
        onSuccess?.()
      } catch (error) {
        console.error('Status transition error:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to update job status'
        )
      } finally {
        setSelectedStatus(null)
      }
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isPending) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setSelectedStatus(null)
      }
    }
  }

  const getStatusDisplay = (status: JobStatus) => {
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const getStatusBadgeVariant = (status: JobStatus) => {
    const color = getStatusColor(status)
    switch (color) {
      case 'blue': return 'default'
      case 'yellow': return 'secondary'
      case 'green': return 'default'
      case 'red': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'scheduled':
        return <Calendar className="h-4 w-4" />
      case 'in_progress':
        return <Clock className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const getAvailableTransitions = (currentStatus: JobStatus): JobStatus[] => {
    return JOB_STATUSES.filter(status =>
      status !== currentStatus && canTransition(currentStatus, status)
    )
  }

  if (!job) return null

  const currentStatus = job.status as JobStatus
  const availableTransitions = getAvailableTransitions(currentStatus)

  if (availableTransitions.length === 0) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Job Status</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Status change options for job #{job.id.slice(-8)}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {getStatusIcon(currentStatus)}
              <div>
                <p className="text-sm font-medium">Current Status</p>
                <Badge variant={getStatusBadgeVariant(currentStatus)}>
                  {getStatusDisplay(currentStatus)}
                </Badge>
              </div>
            </div>

            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                No status transitions available for this job.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {currentStatus === 'completed' || currentStatus === 'cancelled'
                  ? 'This job has already been finalized.'
                  : 'All possible transitions have been exhausted.'
                }
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change Job Status</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Update the status for {job.customer?.name}&apos;s job
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {getStatusIcon(currentStatus)}
            <div>
              <p className="text-sm font-medium">Current Status</p>
              <Badge variant={getStatusBadgeVariant(currentStatus)}>
                {getStatusDisplay(currentStatus)}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Available Transitions */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Available Status Changes</h4>
            <div className="grid gap-2">
              {availableTransitions.map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  className="justify-start h-auto p-3"
                  onClick={() => handleStatusChange(status)}
                  disabled={isPending}
                >
                  <div className="flex items-center gap-3 w-full">
                    {selectedStatus === status && isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      getStatusIcon(status)
                    )}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Change to {getStatusDisplay(status)}
                        </span>
                        <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
                          {getStatusDisplay(status)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {status === 'in_progress' && 'Mark job as actively being worked on'}
                        {status === 'completed' && 'Mark job as finished and create service history'}
                        {status === 'cancelled' && 'Cancel this job - this cannot be undone'}
                        {status === 'scheduled' && 'Return job to scheduled status'}
                      </p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Job Details */}
          <Separator />
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium">Job Details</h4>
            <div className="text-sm space-y-1">
              <p>
                <span className="font-medium">Customer:</span> {job.customer?.name}
              </p>
              {job.technician && (
                <p>
                  <span className="font-medium">Technician:</span> {job.technician.display_name || 'Unknown'}
                </p>
              )}
              {job.scheduledDate && (
                <p>
                  <span className="font-medium">Scheduled:</span>{' '}
                  {new Date(job.scheduledDate).toLocaleDateString()}
                  {job.scheduledTimeStart && job.scheduledTimeEnd && (
                    <span> • {job.scheduledTimeStart} - {job.scheduledTimeEnd}</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}