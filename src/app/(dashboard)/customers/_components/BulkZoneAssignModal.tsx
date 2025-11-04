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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

import { ZONES, type Zone } from '../schema'
import { bulkAssignZone } from '../actions'

interface BulkZoneAssignModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCustomerIds: Set<string>
  onSuccess?: () => void
}

export function BulkZoneAssignModal({
  open,
  onOpenChange,
  selectedCustomerIds,
  onSuccess
}: BulkZoneAssignModalProps) {
  const [selectedZone, setSelectedZone] = useState<Zone | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  const handleAssignZone = () => {
    if (!selectedZone) {
      toast.error('Please select a zone')
      return
    }

    startTransition(async () => {
      try {
        const result = await bulkAssignZone({
          customerIds: Array.from(selectedCustomerIds),
          zone: selectedZone
        })

        if (result.success && result.data) {
          toast.success(`Zone ${selectedZone} assigned to ${result.data.updatedCount} customer${result.data.updatedCount !== 1 ? 's' : ''}`)
          onSuccess?.()
          onOpenChange(false)
          setSelectedZone(undefined)
        } else {
          throw new Error(result.error || 'Failed to assign zone')
        }
      } catch (error) {
        console.error('Bulk zone assignment failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to assign zone'
        toast.error(errorMessage)
      }
    })
  }

  const handleCancel = () => {
    onOpenChange(false)
    setSelectedZone(undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Zone to Customers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Assign a service zone to {selectedCustomerIds.size} selected customer{selectedCustomerIds.size !== 1 ? 's' : ''}
          </div>

          <div className="space-y-2">
            <Label htmlFor="zone">Service Zone</Label>
            <Select value={selectedZone} onValueChange={(value: Zone) => setSelectedZone(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a service zone" />
              </SelectTrigger>
              <SelectContent>
                {ZONES.map((zone) => (
                  <SelectItem key={zone} value={zone}>
                    {zone === 'Central' ? 'Central' : `Zone ${zone}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssignZone}
            disabled={isPending || !selectedZone}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Assign Zone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}