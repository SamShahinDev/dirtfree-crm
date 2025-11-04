'use client'

import { useState, useEffect } from 'react'
import { Package, AlertTriangle, Calendar, Plus, Check, X, Edit2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { updateToolQty, createLowStockReminder, checkLowStockReminder } from '../../actions'
import { formatCalibrationStatus } from '@/lib/trucks/format'
import { getToolStatus, type TruckTool } from '@/types/truck'

interface ToolsTableProps {
  tools: TruckTool[]
  truckId: string
  canEdit: boolean
}

interface EditingState {
  toolId: string | null
  value: string
}

interface ReminderExistence {
  [toolId: string]: boolean
}

export function ToolsTable({ tools, truckId, canEdit }: ToolsTableProps) {
  const [editing, setEditing] = useState<EditingState>({ toolId: null, value: '' })
  const [saving, setSaving] = useState(false)
  const [creatingReminder, setCreatingReminder] = useState<string | null>(null)
  const [reminderExists, setReminderExists] = useState<ReminderExistence>({})

  // Check for existing reminders for low stock tools
  useEffect(() => {
    const checkReminders = async () => {
      const lowStockTools = tools.filter(tool => getToolStatus(tool).isLow)
      const checks: ReminderExistence = {}

      await Promise.all(
        lowStockTools.map(async (tool) => {
          const result = await checkLowStockReminder({ truckId, toolId: tool.id })
          if (result.success) {
            checks[tool.id] = result.data.exists
          }
        })
      )

      setReminderExists(checks)
    }

    checkReminders()
  }, [tools, truckId])

  const startEditing = (tool: TruckTool) => {
    setEditing({
      toolId: tool.id,
      value: tool.qtyOnTruck.toString()
    })
  }

  const cancelEditing = () => {
    setEditing({ toolId: null, value: '' })
  }

  const saveQty = async (toolId: string) => {
    const newQty = parseInt(editing.value)

    if (isNaN(newQty) || newQty < 0 || newQty > 999) {
      toast.error('Quantity must be between 0 and 999')
      return
    }

    setSaving(true)

    try {
      const result = await updateToolQty({ toolId, qtyOnTruck: newQty })

      if (result.success) {
        toast.success('Tool quantity updated')
        setEditing({ toolId: null, value: '' })
        // Refresh the page to show updated data
        window.location.reload()
      } else {
        toast.error('Failed to update quantity')
      }
    } catch (error) {
      toast.error('An error occurred while updating')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateReminder = async (tool: TruckTool) => {
    setCreatingReminder(tool.id)

    try {
      const result = await createLowStockReminder({ truckId, toolId: tool.id })

      if (result.success) {
        if (result.data.ok) {
          toast.success('Reminder created successfully')
          setReminderExists(prev => ({ ...prev, [tool.id]: true }))
        } else if (result.data.error === 'A reminder for this tool already exists') {
          toast.info('A reminder already exists for this tool')
          setReminderExists(prev => ({ ...prev, [tool.id]: true }))
        } else {
          toast.error(result.data.error || 'Failed to create reminder')
        }
      } else {
        toast.error('Failed to create reminder')
      }
    } catch (error) {
      toast.error('An error occurred while creating the reminder')
    } finally {
      setCreatingReminder(null)
    }
  }

  if (tools.length === 0) {
    return (
      <Card className="rounded-lg">
        <CardContent className="py-12 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tools configured</h3>
          <p className="text-gray-600">Tools will appear here once added to this truck.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center">
          <Package className="w-5 h-5 mr-2 text-blue-600" />
          Tools Inventory
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tool</TableHead>
              <TableHead className="text-center">Min Qty</TableHead>
              <TableHead className="text-center">On Truck</TableHead>
              <TableHead>Calibration Due</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map((tool) => {
              const status = getToolStatus(tool)
              const calibration = formatCalibrationStatus(tool.calibrationDueAt)
              const isEditing = editing.toolId === tool.id

              return (
                <TableRow
                  key={tool.id}
                  className={cn(
                    status.isLow && 'bg-orange-25',
                    status.needsCalibration && !status.isLow && 'bg-yellow-25'
                  )}
                >
                  <TableCell className="font-medium">{tool.name}</TableCell>

                  <TableCell className="text-center">{tool.minQty}</TableCell>

                  <TableCell className="text-center">
                    {canEdit && isEditing ? (
                      <div className="flex items-center justify-center space-x-1">
                        <Input
                          type="number"
                          min="0"
                          max="999"
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          className="w-16 h-8 text-center relative z-10"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveQty(tool.id)
                            if (e.key === 'Escape') cancelEditing()
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 relative z-10 cursor-pointer"
                          onClick={() => saveQty(tool.id)}
                          disabled={saving}
                          aria-label="Save quantity"
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 relative z-10 cursor-pointer"
                          onClick={cancelEditing}
                          disabled={saving}
                          aria-label="Cancel editing"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-1">
                        <span className={cn(status.isLow && 'font-semibold text-orange-700')}>
                          {tool.qtyOnTruck}
                        </span>
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 relative z-10 cursor-pointer"
                            onClick={() => startEditing(tool)}
                            aria-label={`Edit quantity for ${tool.name}`}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <span className={cn(
                      calibration.variant === 'destructive' && 'text-red-600 font-medium',
                      calibration.variant === 'warning' && 'text-orange-600 font-medium'
                    )}>
                      {calibration.text}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-2">
                      {status.isLow && (
                        <Badge
                          variant="outline"
                          className="border-orange-300 text-orange-700 bg-orange-50"
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Low
                        </Badge>
                      )}
                      {status.needsCalibration && (
                        <Badge
                          variant={calibration.variant === 'destructive' ? 'destructive' : 'secondary'}
                          className={calibration.variant === 'warning' ? 'bg-yellow-100 text-yellow-800' : ''}
                        >
                          <Calendar className="w-3 h-3 mr-1" />
                          Calibration
                        </Badge>
                      )}
                      {!status.isLow && !status.needsCalibration && (
                        <Badge variant="secondary" className="text-green-700 bg-green-50">
                          OK
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {canEdit && (
                    <TableCell className="text-right">
                      {status.isLow && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCreateReminder(tool)}
                          disabled={creatingReminder === tool.id || reminderExists[tool.id]}
                          className="text-xs relative z-10 cursor-pointer"
                          aria-label={`Create reminder for ${tool.name}`}
                        >
                          {creatingReminder === tool.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-1" />
                              Creating...
                            </>
                          ) : reminderExists[tool.id] ? (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Reminder Set
                            </>
                          ) : (
                            <>
                              <Plus className="w-3 h-3 mr-1" />
                              Create Reminder
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}