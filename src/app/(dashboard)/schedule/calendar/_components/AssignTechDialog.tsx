'use client'

import React, { useState, useTransition } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, UserPlus, Clock, Calendar, MapPin } from 'lucide-react'

import type { JobEvent, TechnicianResource } from '../../actions'
import { assignEventTechnician, unassignTechnician, checkConflicts } from '../../actions'
import type { ConflictJob } from '@/lib/schedule/conflicts'

export interface AssignTechDialogProps {
  event: JobEvent | null
  technicians: TechnicianResource[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AssignTechDialog({
  event,
  technicians,
  open,
  onOpenChange,
  onSuccess
}: AssignTechDialogProps) {
  const [selectedTechId, setSelectedTechId] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const [conflicts, setConflicts] = useState<ConflictJob[]>([])

  // Reset state when event changes
  React.useEffect(() => {
    if (event) {
      setSelectedTechId(event.resourceId || '')
      setConflicts([])
    }
  }, [event])

  const handleTechnicianSelect = async (technicianId: string) => {
    setSelectedTechId(technicianId)
    setConflicts([])

    if (!event || !technicianId) return

    // Check for conflicts
    try {
      const result = await checkConflicts({
        technicianId,
        start: event.start,
        end: event.end,
        excludeJobId: event.id
      })

      if (!result.ok || (result.data && result.data.conflicts.length > 0)) {
        setConflicts(result.data?.conflicts || [])
      }
    } catch (error) {
      console.error('Error checking conflicts:', error)
    }
  }

  const handleAssign = () => {
    if (!event || !selectedTechId) return

    startTransition(async () => {
      try {
        const result = await assignEventTechnician({
          jobId: event.id,
          technicianId: selectedTechId
        })

        if (!result.ok) {
          throw new Error(result.error || 'Failed to assign technician')
        }

        toast.success('Technician assigned successfully')
        onOpenChange(false)
        onSuccess?.()
      } catch (error) {
        console.error('Assign technician error:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to assign technician'
        )
      }
    })
  }

  const handleUnassign = () => {
    if (!event) return

    startTransition(async () => {
      try {
        const result = await unassignTechnician({
          jobId: event.id
        })

        if (!result.ok) {
          throw new Error(result.error || 'Failed to unassign technician')
        }

        toast.success('Technician unassigned successfully')
        onOpenChange(false)
        onSuccess?.()
      } catch (error) {
        console.error('Unassign technician error:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to unassign technician'
        )
      }
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isPending) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setSelectedTechId('')
        setConflicts([])
      }
    }
  }

  const getSelectedTechnician = () => {
    return technicians.find(tech => tech.id === selectedTechId)
  }

  const getCurrentTechnician = () => {
    if (!event?.resourceId) return null
    return technicians.find(tech => tech.id === event.resourceId)
  }

  const formatEventTime = (start: string, end: string) => {
    const startTime = new Date(start).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    const endTime = new Date(end).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    return `${startTime} - ${endTime}`
  }

  const formatEventDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (!event) return null

  const currentTech = getCurrentTechnician()
  const selectedTech = getSelectedTechnician()
  const hasConflicts = conflicts.length > 0
  const isTerminal = event.extendedProps.status === 'completed' || event.extendedProps.status === 'cancelled'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Assign Technician
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job Details */}
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium">Job Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Customer:</span>
                <span>{event.extendedProps.customerName}</span>
                <Badge variant="outline" className="ml-auto">
                  {event.extendedProps.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{formatEventDate(event.start)}</span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{formatEventTime(event.start, event.end)}</span>
              </div>

              {event.extendedProps.zone && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {event.extendedProps.zone === 'Central' ? 'Central Zone' : `Zone ${event.extendedProps.zone}`}
                  </span>
                </div>
              )}

              {event.extendedProps.description && (
                <div>
                  <span className="font-medium">Description:</span>
                  <p className="text-muted-foreground mt-1">{event.extendedProps.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Current Assignment */}
          {currentTech && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">Currently assigned:</span>{' '}
                {currentTech.displayName}
                {currentTech.zone && ` (${currentTech.zone === 'Central' ? 'Central' : `Zone ${currentTech.zone}`})`}
              </p>
            </div>
          )}

          <Separator />

          {/* Terminal Job Warning */}
          {isTerminal && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Notice:</span> This job is {event.extendedProps.status}.
                Assignment changes may not be advisable.
              </p>
            </div>
          )}

          {/* Technician Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Technician</label>
            <Select
              value={selectedTechId}
              onValueChange={handleTechnicianSelect}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a technician..." />
              </SelectTrigger>
              <SelectContent>
                {technicians.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{tech.displayName}</span>
                      {tech.zone && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {tech.zone === 'Central' ? 'Central' : `Zone ${tech.zone}`}
                        </Badge>
                      )}
                      {/* Zone match indicator */}
                      {event.extendedProps.zone === tech.zone && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Zone Match
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Zone Match Info */}
            {selectedTech && event.extendedProps.zone && (
              <div className={`p-2 rounded text-xs ${
                selectedTech.zone === event.extendedProps.zone
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-orange-50 text-orange-700 border border-orange-200'
              }`}>
                {selectedTech.zone === event.extendedProps.zone
                  ? '✓ Technician zone matches job zone'
                  : '⚠ Technician zone does not match job zone'
                }
              </div>
            )}
          </div>

          {/* Conflict Warning */}
          {hasConflicts && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <h5 className="text-sm font-medium text-red-800 mb-2">
                Scheduling Conflicts Detected
              </h5>
              <p className="text-sm text-red-700 mb-3">
                This assignment would conflict with existing jobs:
              </p>
              <div className="space-y-2">
                {conflicts.slice(0, 3).map((conflict) => (
                  <div key={conflict.id} className="text-xs bg-red-100 p-2 rounded">
                    <div className="font-medium">{conflict.customerName}</div>
                    <div>{conflict.scheduledTimeStart} - {conflict.scheduledTimeEnd}</div>
                  </div>
                ))}
                {conflicts.length > 3 && (
                  <p className="text-xs text-red-600">
                    ...and {conflicts.length - 3} more conflicts
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {currentTech && (
            <Button
              type="button"
              variant="outline"
              onClick={handleUnassign}
              disabled={isPending}
              className="mr-auto"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Unassigning...
                </>
              ) : (
                'Unassign'
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleAssign}
            disabled={isPending || !selectedTechId || (hasConflicts && !isTerminal)}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? 'Assigning...' : 'Assign Technician'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}