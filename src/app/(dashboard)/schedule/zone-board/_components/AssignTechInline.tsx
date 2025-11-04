'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'

import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

import {
  Loader2,
  UserPlus,
  Check,
  X,
  AlertTriangle
} from 'lucide-react'

import { assignJob } from '../actions'
import { listTechnicians } from '../../actions'

export interface TechnicianOption {
  id: string
  displayName: string
  zone?: string | null
}

export interface AssignTechInlineProps {
  jobId: string
  currentTechId?: string | null
  jobZone?: string | null
  children: React.ReactNode
  onSuccess?: () => void
}

export function AssignTechInline({
  jobId,
  currentTechId,
  jobZone,
  children,
  onSuccess
}: AssignTechInlineProps) {
  const [open, setOpen] = useState(false)
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([])
  const [selectedTechId, setSelectedTechId] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(false)

  // Load technicians when popover opens
  useEffect(() => {
    if (open && technicians.length === 0) {
      loadTechnicians()
    }
  }, [open, technicians.length])

  // Reset selected tech when current tech changes
  useEffect(() => {
    setSelectedTechId(currentTechId || '')
  }, [currentTechId])

  const loadTechnicians = async () => {
    setLoading(true)
    try {
      const response = await listTechnicians({ includeInactive: false })

      if (response.ok && response.data) {
        setTechnicians(response.data.map(tech => ({
          id: tech.id,
          displayName: tech.displayName,
          zone: tech.zone
        })))
      } else {
        toast.error('Failed to load technicians')
      }
    } catch (error) {
      console.error('Failed to load technicians:', error)
      toast.error('Failed to load technicians')
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = () => {
    if (!selectedTechId || selectedTechId === currentTechId) {
      setOpen(false)
      return
    }

    startTransition(async () => {
      try {
        const response = await assignJob({
          jobId,
          technicianId: selectedTechId
        })

        if (!response.ok) {
          if (response.error === 'Potential scheduling conflict detected') {
            toast.error('Assignment would create a scheduling conflict')
          } else {
            throw new Error(response.error || 'Failed to assign technician')
          }
          return
        }

        toast.success('Technician assigned successfully')
        setOpen(false)
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

  const handleCancel = () => {
    setSelectedTechId(currentTechId || '')
    setOpen(false)
  }

  const getTechnicianInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getSelectedTechnician = () => {
    return technicians.find(tech => tech.id === selectedTechId)
  }

  const getCurrentTechnician = () => {
    return technicians.find(tech => tech.id === currentTechId)
  }

  const getZoneMatchIndicator = (techZone?: string | null) => {
    if (!jobZone || !techZone) return null

    if (techZone === jobZone) {
      return (
        <Badge variant="secondary" className="text-xs">
          Zone Match
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="text-xs">
        Zone {techZone}
      </Badge>
    )
  }

  const hasChanges = selectedTechId !== (currentTechId || '')
  const selectedTech = getSelectedTechnician()
  const currentTech = getCurrentTechnician()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <h4 className="font-medium text-sm">Assign Technician</h4>
          </div>

          {/* Current assignment */}
          {currentTech && (
            <div className="p-2 bg-muted/50 rounded-md">
              <p className="text-xs text-muted-foreground mb-1">Currently assigned:</p>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {getTechnicianInitials(currentTech.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{currentTech.displayName}</span>
                {getZoneMatchIndicator(currentTech.zone)}
              </div>
            </div>
          )}

          {/* Zone context */}
          {jobZone && (
            <div className="text-xs text-muted-foreground">
              Job zone: <span className="font-medium">{jobZone === 'Central' ? 'Central' : `Zone ${jobZone}`}</span>
            </div>
          )}

          <Separator />

          {/* Technician selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Technician</label>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading technicians...</span>
              </div>
            ) : (
              <Select
                value={selectedTechId}
                onValueChange={setSelectedTechId}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a technician..." />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-xs">
                              {getTechnicianInitials(tech.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{tech.displayName}</span>
                        </div>
                        {getZoneMatchIndicator(tech.zone)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Zone matching info */}
            {selectedTech && jobZone && (
              <div className={`p-2 rounded text-xs ${
                selectedTech.zone === jobZone
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-orange-50 text-orange-700 border border-orange-200'
              }`}>
                {selectedTech.zone === jobZone ? (
                  <div className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    <span>Technician zone matches job zone</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>
                      Technician is in {selectedTech.zone ? `Zone ${selectedTech.zone}` : 'no zone'},
                      job is in Zone {jobZone}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={isPending || !hasChanges || !selectedTechId}
              className="flex-1"
            >
              {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {isPending ? 'Assigning...' : 'Assign'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Warning about conflicts */}
          <div className="text-xs text-muted-foreground">
            <div className="flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>Assignment may be blocked if it creates scheduling conflicts.</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}