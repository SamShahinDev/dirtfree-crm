'use client'

import { useTransition, useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Loader2, Plus, Trash2, ExternalLink, AlertCircle, Zap, Copy } from 'lucide-react'

import { ZONES } from '@/types/job'
import { JobCreateSchema, type JobCreateInput } from '../schemas/job.zod'
import { createJob, updateJob, getTechnicians, checkSchedulingConflict } from '../actions'
import { CustomerPicker } from './CustomerPicker'
import { calculateEndTime, getServiceDuration } from '@/lib/utils/scheduling'
import { SERVICE_TEMPLATES } from '@/lib/data/service-templates'

interface JobDialogProps {
  mode: 'create' | 'edit'
  initialData?: JobUpdateData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface Technician {
  user_id: string
  display_name?: string | null
  zone?: string | null
}

interface JobUpdateData {
  id: string
  customer_id: string
  technician_id?: string | null
  zone?: string | null
  status: string
  scheduled_date?: string | null
  scheduled_time_start?: string | null
  scheduled_time_end?: string | null
  description?: string | null
  internal_notes?: string | null
  invoice_url?: string | null
  customer?: {
    id: string
    name: string
  } | null
  customerName?: string
  serviceItems?: Array<{
    name: string
    qty: number
    unitPriceCents: number
    notes?: string
  }>
}

export function JobDialog({
  mode,
  initialData,
  open,
  onOpenChange,
  onSuccess
}: JobDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [schedulingConflict, setSchedulingConflict] = useState<{
    hasConflict: boolean
    conflictingJob?: { id: string; time: string }
  } | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const form = useForm<JobCreateInput>({
    resolver: zodResolver(JobCreateSchema),
    defaultValues: {
      customerId: initialData?.customer_id || '',
      technicianId: initialData?.technician_id || '',
      zone: initialData?.zone || undefined,
      scheduledDate: initialData?.scheduled_date || '',
      scheduledTimeStart: initialData?.scheduled_time_start || '',
      scheduledTimeEnd: initialData?.scheduled_time_end || '',
      description: initialData?.description || '',
      internalNotes: initialData?.internal_notes || '',
      invoiceUrl: initialData?.invoice_url || '',
      serviceItems: initialData?.serviceItems || []
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'serviceItems'
  })

  // Load technicians
  useEffect(() => {
    const loadTechnicians = async () => {
      try {
        const response = await getTechnicians({})
        if (response.success) {
          setTechnicians(response.data)
        }
      } catch (error) {
        console.error('Failed to load technicians:', error)
      }
    }

    if (open) {
      loadTechnicians()
    }
  }, [open])

  // Reset form with initialData when it changes or dialog opens
  useEffect(() => {
    if (open && initialData) {
      console.log('🔄 Resetting form with initial data:', initialData)
      form.reset({
        customerId: initialData.customer_id || '',
        technicianId: initialData.technician_id || '',
        zone: initialData.zone || undefined,
        scheduledDate: initialData.scheduled_date || '',
        scheduledTimeStart: initialData.scheduled_time_start || '',
        scheduledTimeEnd: initialData.scheduled_time_end || '',
        description: initialData.description || '',
        internalNotes: initialData.internal_notes || '',
        invoiceUrl: initialData.invoice_url || '',
        serviceItems: initialData.serviceItems || []
      })
    }
  }, [open, initialData, form])

  // Check for scheduling conflicts
  useEffect(() => {
    const checkConflict = async () => {
      const technicianId = form.watch('technicianId')
      const scheduledDate = form.watch('scheduledDate')
      const scheduledTimeStart = form.watch('scheduledTimeStart')
      const scheduledTimeEnd = form.watch('scheduledTimeEnd')

      if (technicianId && scheduledDate && scheduledTimeStart) {
        try {
          const result = await checkSchedulingConflict({
            technician_id: technicianId,
            scheduled_date: scheduledDate,
            scheduled_time_start: scheduledTimeStart,
            scheduled_time_end: scheduledTimeEnd,
            exclude_job_id: initialData?.id
          })

          if (result.success) {
            setSchedulingConflict(result.data)
          }
        } catch (error) {
          console.error('Failed to check scheduling conflict:', error)
        }
      } else {
        setSchedulingConflict(null)
      }
    }

    checkConflict()
  }, [form.watch('technicianId'), form.watch('scheduledDate'), form.watch('scheduledTimeStart'), form.watch('scheduledTimeEnd'), initialData?.id])

  // Auto-calculate end time based on description
  useEffect(() => {
    const startTime = form.watch('scheduledTimeStart')
    const description = form.watch('description')
    const currentEndTime = form.watch('scheduledTimeEnd')

    if (startTime && !currentEndTime) {
      const duration = getServiceDuration(description)
      const endTime = calculateEndTime(startTime, duration)
      form.setValue('scheduledTimeEnd', endTime)
    }
  }, [form.watch('scheduledTimeStart'), form.watch('description'), form])

  // Check for validation warnings
  useEffect(() => {
    const newWarnings: string[] = []

    const scheduledDate = form.watch('scheduledDate')
    const scheduledTimeStart = form.watch('scheduledTimeStart')

    // Check if scheduling outside business hours
    if (scheduledTimeStart) {
      const [hours] = scheduledTimeStart.split(':').map(Number)
      if (hours < 8 || hours >= 18) {
        newWarnings.push('Scheduling outside typical business hours (8 AM - 6 PM)')
      }
    }

    // Check if scheduling on weekend
    if (scheduledDate) {
      const date = new Date(scheduledDate)
      const day = date.getDay()
      if (day === 0 || day === 6) {
        newWarnings.push('Scheduling on weekend - confirm availability')
      }
    }

    // Check if scheduling too far in future
    if (scheduledDate) {
      const date = new Date(scheduledDate)
      const daysOut = Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (daysOut > 60) {
        newWarnings.push('Scheduling more than 2 months in advance')
      }
    }

    setWarnings(newWarnings)
  }, [form.watch('scheduledDate'), form.watch('scheduledTimeStart')])

  const handleSubmit = (data: JobCreateInput) => {
    startTransition(async () => {
      try {
        let result

        if (mode === 'create') {
          const response = await createJob(data)
          if (!response.ok) {
            throw new Error(response.error || 'Failed to create job')
          }
          result = response
        } else if (initialData) {
          const updateData = {
            ...data,
            id: initialData.id,
            currentStatus: initialData.status
          }
          const response = await updateJob(updateData)
          if (!response.ok) {
            throw new Error(response.error || 'Failed to update job')
          }
          result = response
        }

        if (result) {
          toast.success(
            mode === 'create'
              ? 'Job created successfully'
              : 'Job updated successfully'
          )

          form.reset()
          onOpenChange(false)
          onSuccess?.()
        }
      } catch (error) {
        console.error('Job operation error:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to ${mode} job`
        )
      }
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isPending) {
      onOpenChange(newOpen)
      if (!newOpen) {
        form.reset()
      }
    }
  }

  const addServiceItem = () => {
    append({
      name: '',
      qty: 1,
      unitPriceCents: 0,
      notes: ''
    })
  }

  const removeServiceItem = (index: number) => {
    remove(index)
  }

  const applyTemplate = (templateId: string) => {
    const template = SERVICE_TEMPLATES.find(t => t.id === templateId)
    if (!template) return

    form.setValue('description', template.description)

    if (template.service_items) {
      form.setValue('serviceItems', template.service_items)
    }

    // Auto-calculate end time if start time exists
    const startTime = form.watch('scheduledTimeStart')
    if (startTime) {
      const endTime = calculateEndTime(startTime, template.duration_hours)
      form.setValue('scheduledTimeEnd', endTime)
    }

    toast.success(`Applied template: ${template.name}`)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto"
        aria-describedby="job-dialog-description"
      >
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create New Job' : 'Edit Job'}
          </DialogTitle>
          <p id="job-dialog-description" className="text-sm text-muted-foreground">
            {mode === 'create'
              ? 'Schedule a new service appointment.'
              : 'Update job information and scheduling.'
            }
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Customer Selection */}
            <div className="flex items-start gap-2">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>
                      Customer <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <CustomerPicker
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isPending}
                        placeholder="Select a customer..."
                        initialCustomerName={
                          initialData?.customer?.name ||
                          (initialData as any)?.customerName
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch('customerId') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-8"
                  onClick={() => window.open(`/customers/${form.watch('customerId')}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View Profile
                </Button>
              )}
            </div>

            {/* Job Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Zone</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select zone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ZONES.map((zone) => (
                          <SelectItem key={zone} value={zone}>
                            {zone === 'Central' ? 'Central' : `Zone ${zone}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="technicianId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Technician</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === 'unassigned' ? '' : value)}
                      value={field.value || 'unassigned'}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign technician" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.user_id} value={tech.user_id}>
                            {tech.display_name || 'Unknown'}
                            {tech.zone && ` (Zone ${tech.zone})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Scheduling */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Scheduling</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduledTimeStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduledTimeEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Conflict Alert */}
              {schedulingConflict?.hasConflict && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Scheduling conflict: This technician already has a job scheduled at {schedulingConflict.conflictingJob?.time}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Description */}
            <div className="flex items-start gap-2">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Description (Customer-Facing)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe the work to be performed..."
                        className="min-h-[60px]"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-8"
                    disabled={isPending}
                  >
                    <Zap className="h-4 w-4 mr-1" />
                    Templates
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[250px]">
                  {SERVICE_TEMPLATES.map(template => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => applyTemplate(template.id)}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {template.duration_hours}h • ${(template.default_price_cents || 0) / 100}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Internal Notes */}
            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Internal Notes
                    <span className="text-xs text-muted-foreground font-normal">
                      (Not visible to customer)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Access codes, special instructions, equipment needs..."
                      className="min-h-[60px]"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Invoice URL */}
            <FormField
              control={form.control}
              name="invoiceUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice URL</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://..."
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Validation Warnings */}
            {warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {warnings.map((warning, idx) => (
                      <li key={idx} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Service Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Service Items</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addServiceItem}
                  disabled={isPending}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No service items added yet. Click &quot;Add Item&quot; to get started.
                </p>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium">Item {index + 1}</h5>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeServiceItem(index)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name={`serviceItems.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Carpet cleaning"
                              {...field}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`serviceItems.${index}.qty`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`serviceItems.${index}.unitPriceCents`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit Price ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              {...field}
                              onChange={e => field.onChange(Math.round(parseFloat(e.target.value || '0') * 100))}
                              value={(field.value / 100).toFixed(2)}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`serviceItems.${index}.notes`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Additional notes..."
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>

              {mode === 'edit' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const values = form.getValues()
                    onOpenChange(false)
                    // Create new job with same data
                    setTimeout(() => {
                      toast.info('Duplicate job: Opening create dialog with pre-filled data')
                      // TODO: This would need parent component support to open create dialog with initial values
                    }, 300)
                  }}
                  disabled={isPending}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Duplicate
                </Button>
              )}

              <Button
                type="submit"
                disabled={isPending}
                aria-live="polite"
                aria-label={
                  isPending
                    ? `${mode === 'create' ? 'Creating' : 'Updating'} job...`
                    : `${mode === 'create' ? 'Create' : 'Update'} job`
                }
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending
                  ? (mode === 'create' ? 'Creating...' : 'Updating...')
                  : (mode === 'create' ? 'Create Job' : 'Update Job')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}