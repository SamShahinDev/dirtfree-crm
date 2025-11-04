'use client'

import { useState, useEffect } from 'react'
import { User, Plus, Trash2, AlertTriangle, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'
import {
  listTruckAssignments,
  listAvailableTechnicians,
  assignTechnician,
  unassignTechnician
} from '../../actions'

interface TruckAssignmentsDialogProps {
  truckId: string
  truckName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Assignment {
  id: string
  userId: string
  userName: string
  assignedAt: string
  assignedBy: string | null
}

interface Technician {
  id: string
  name: string
  email: string
}

export function TruckAssignmentsDialog({
  truckId,
  truckName,
  open,
  onOpenChange
}: TruckAssignmentsDialogProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [availableTechs, setAvailableTechs] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTechId, setSelectedTechId] = useState<string>('')
  const [assigning, setAssigning] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Load assignments and available technicians
  const loadData = async () => {
    if (!open) return

    setLoading(true)
    try {
      const [assignmentsResult, techsResult] = await Promise.all([
        listTruckAssignments({ truckId }),
        listAvailableTechnicians({ truckId })
      ])

      if (assignmentsResult.success) {
        setAssignments(assignmentsResult.data)
      } else {
        toast.error('Failed to load assignments')
      }

      if (techsResult.success) {
        setAvailableTechs(techsResult.data)
        setSelectedTechId('')
      } else {
        toast.error('Failed to load available technicians')
      }
    } catch (error) {
      console.error('Error loading assignment data:', error)
      toast.error('Failed to load assignment data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [open, truckId])

  // Handle adding assignment
  const handleAssign = async () => {
    if (!selectedTechId || assigning) return

    setAssigning(true)
    try {
      const result = await assignTechnician({
        truckId,
        userId: selectedTechId
      })

      if (result.success) {
        toast.success('Technician assigned successfully')
        await loadData() // Reload data
      } else {
        toast.error('Failed to assign technician')
      }
    } catch (error) {
      console.error('Error assigning technician:', error)
      toast.error('Failed to assign technician')
    } finally {
      setAssigning(false)
    }
  }

  // Handle removing assignment
  const handleUnassign = async (userId: string) => {
    if (removingId) return

    setRemovingId(userId)
    try {
      const result = await unassignTechnician({
        truckId,
        userId
      })

      if (result.success) {
        toast.success('Technician unassigned successfully')
        await loadData() // Reload data
      } else {
        toast.error('Failed to unassign technician')
      }
    } catch (error) {
      console.error('Error unassigning technician:', error)
      toast.error('Failed to unassign technician')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            Technician Assignments - {truckName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Assignment */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">Assign New Technician</h3>

            {availableTechs.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-gray-400" />
                All available technicians are already assigned to this truck
              </div>
            ) : (
              <div className="flex space-x-2">
                <Select
                  value={selectedTechId}
                  onValueChange={setSelectedTechId}
                  disabled={loading || assigning}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a technician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTechs.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{tech.name}</span>
                          <span className="text-xs text-gray-500">{tech.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssign}
                  disabled={!selectedTechId || assigning || loading}
                  size="sm"
                >
                  {assigning ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Current Assignments */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">
              Current Assignments ({assignments.length})
            </h3>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No technicians assigned to this truck</p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignments.map((assignment) => (
                  <Card key={assignment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {assignment.userName}
                            </p>
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <span>
                                Assigned {formatDistanceToNow(new Date(assignment.assignedAt), { addSuffix: true })}
                              </span>
                              {assignment.assignedBy && (
                                <>
                                  <span>•</span>
                                  <span>by {assignment.assignedBy}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnassign(assignment.userId)}
                          disabled={removingId === assignment.userId}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {removingId === assignment.userId ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}