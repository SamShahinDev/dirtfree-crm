'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, User } from 'lucide-react'

export interface ConflictJob {
  id: string
  customerId: string
  customerName: string
  scheduledDate: string
  scheduledTimeStart: string
  scheduledTimeEnd: string
  status: string
  description?: string | null
}

interface ConflictConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflictMessage?: string
  conflicts?: ConflictJob[]
  onConfirm: () => void
  onCancel: () => void
  title?: string
  description?: string
}

export function ConflictConfirmDialog({
  open,
  onOpenChange,
  conflictMessage,
  conflicts = [],
  onConfirm,
  onCancel,
  title = 'Scheduling Conflict Detected',
  description = 'The following conflicts were detected. Do you want to proceed anyway?'
}: ConflictConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      console.error('Conflict confirmation error:', error)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {conflictMessage && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm text-amber-800">{conflictMessage}</p>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Conflicting Jobs:</h4>
              {conflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="rounded-lg border bg-card p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {conflict.customerName}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {conflict.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {conflict.scheduledTimeStart} - {conflict.scheduledTimeEnd}
                    </span>
                  </div>

                  {conflict.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {conflict.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isConfirming ? 'Proceeding...' : 'Proceed Anyway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}