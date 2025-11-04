'use client'

import React, { useState, useTransition } from 'react'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, Plus, Trash2, CheckCircle, Camera } from 'lucide-react'

import { type JobStatus } from '@/types/job'
import { JobCompleteSchema, type JobCompleteInput } from '../schemas/job.zod'
import { completeJob } from '../actions'
import { PostCompletionDialog } from './PostCompletionDialog'
import { FileUpload } from '@/components/ui/file-upload'
import { STORAGE_BUCKETS } from '@/lib/storage/utils'
import type { UploadResult } from '@/lib/hooks/use-file-upload'

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

interface CompleteJobDialogProps {
  job: JobData | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CompleteJobDialog({
  job,
  open,
  onOpenChange,
  onSuccess
}: CompleteJobDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [showPostCompletion, setShowPostCompletion] = useState(false)
  const [beforePhotos, setBeforePhotos] = useState<string[]>([])
  const [afterPhotos, setAfterPhotos] = useState<string[]>([])

  const form = useForm<JobCompleteInput>({
    resolver: zodResolver(JobCompleteSchema),
    defaultValues: {
      jobId: job?.id || '',
      completedAt: undefined,
      notes: '',
      serviceItems: [],
      beforePhotos: [],
      afterPhotos: []
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'serviceItems'
  })

  // Reset form when job changes
  React.useEffect(() => {
    if (job) {
      form.reset({
        jobId: job.id,
        completedAt: undefined,
        notes: '',
        serviceItems: [],
        beforePhotos: [],
        afterPhotos: []
      })
      setBeforePhotos([])
      setAfterPhotos([])
    }
  }, [job, form])

  const handleSubmit = (data: JobCompleteInput) => {
    if (!job) return

    startTransition(async () => {
      try {
        const submitData = {
          ...data,
          beforePhotos: beforePhotos.length > 0 ? beforePhotos : undefined,
          afterPhotos: afterPhotos.length > 0 ? afterPhotos : undefined
        }
        const response = await completeJob(submitData)

        if (!response.ok) {
          throw new Error(response.error || 'Failed to complete job')
        }

        toast.success('Job completed successfully')
        onOpenChange(false)
        setShowPostCompletion(true)
        onSuccess?.()
      } catch (error) {
        console.error('Complete job error:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to complete job'
        )
      }
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isPending) {
      onOpenChange(newOpen)
      if (!newOpen) {
        form.reset()
        setBeforePhotos([])
        setAfterPhotos([])
      }
    }
  }

  // Photo upload handlers
  const handleBeforePhotoUpload = (result: UploadResult) => {
    if (result.success && result.url) {
      setBeforePhotos(prev => [...prev, result.url!])
      toast.success('Before photo uploaded successfully')
    }
  }

  const handleAfterPhotoUpload = (result: UploadResult) => {
    if (result.success && result.url) {
      setAfterPhotos(prev => [...prev, result.url!])
      toast.success('After photo uploaded successfully')
    }
  }

  const handlePhotoUploadError = (error: string) => {
    toast.error(`Photo upload failed: ${error}`)
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

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD'
    })
  }

  const calculateTotal = () => {
    return fields.reduce((total, field, index) => {
      const qty = form.getValues(`serviceItems.${index}.qty`) || 0
      const unitPrice = form.getValues(`serviceItems.${index}.unitPriceCents`) || 0
      return total + (qty * unitPrice)
    }, 0)
  }

  if (!job) return null

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto"
          aria-describedby="complete-job-dialog-description"
        >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Complete Job
          </DialogTitle>
          <p id="complete-job-dialog-description" className="text-sm text-muted-foreground">
            Mark this job as completed and create a service history record.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Job Summary */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium flex items-center gap-2">
                Job Summary
                <Badge variant="secondary">{job.status.replace('_', ' ')}</Badge>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><span className="font-medium">Customer:</span> {job.customer?.name}</p>
                  {job.customer?.phone_e164 && (
                    <p><span className="font-medium">Phone:</span> {job.customer.phone_e164}</p>
                  )}
                  {job.customer?.city && job.customer?.state && (
                    <p><span className="font-medium">Location:</span> {job.customer.city}, {job.customer.state}</p>
                  )}
                </div>
                <div>
                  {job.technician && (
                    <p><span className="font-medium">Technician:</span> {job.technician.display_name}</p>
                  )}
                  {job.scheduledDate && (
                    <p><span className="font-medium">Date:</span> {new Date(job.scheduledDate).toLocaleDateString()}</p>
                  )}
                  {job.zone && (
                    <p><span className="font-medium">Zone:</span> {job.zone === 'Central' ? 'Central' : `Zone ${job.zone}`}</p>
                  )}
                </div>
              </div>
              {job.description && (
                <div>
                  <p className="font-medium text-sm">Job Description:</p>
                  <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Completion Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Completion Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what work was completed, any issues encountered, or additional notes..."
                      className="min-h-[100px]"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    These notes will be saved in the service history for future reference.
                  </p>
                </FormItem>
              )}
            />

            <Separator />

            {/* Before/After Photos */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-medium">Before & After Photos</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Document the condition before and after service completion. At least one after photo is required.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Before Photos */}
                <div className="space-y-3">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700">Before Photos (Optional)</h5>
                    <p className="text-xs text-gray-500">Up to 5 photos showing initial condition</p>
                  </div>

                  <FileUpload
                    bucket={STORAGE_BUCKETS.JOB_PHOTOS}
                    accept="images"
                    maxFiles={5}
                    onUploadComplete={handleBeforePhotoUpload}
                    onUploadError={handlePhotoUploadError}
                    disabled={isPending}
                  />

                  {beforePhotos.length > 0 && (
                    <div className="text-xs text-green-600">
                      {beforePhotos.length} before photo{beforePhotos.length === 1 ? '' : 's'} uploaded
                    </div>
                  )}
                </div>

                {/* After Photos */}
                <div className="space-y-3">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700">
                      After Photos <span className="text-red-500">*</span>
                    </h5>
                    <p className="text-xs text-gray-500">Required: up to 5 photos showing completed work</p>
                  </div>

                  <FileUpload
                    bucket={STORAGE_BUCKETS.JOB_PHOTOS}
                    accept="images"
                    maxFiles={5}
                    onUploadComplete={handleAfterPhotoUpload}
                    onUploadError={handlePhotoUploadError}
                    disabled={isPending}
                  />

                  {afterPhotos.length > 0 && (
                    <div className="text-xs text-green-600">
                      {afterPhotos.length} after photo{afterPhotos.length === 1 ? '' : 's'} uploaded
                    </div>
                  )}

                  {afterPhotos.length === 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                      At least one after photo is required to complete the job
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Service Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium">Services Performed</h4>
                  <p className="text-xs text-muted-foreground">
                    Document the services provided for this job completion.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addServiceItem}
                  disabled={isPending}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Service
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                  No services added yet. Click &quot;Add Service&quot; to document the work performed.
                </p>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-medium">Service {index + 1}</h5>
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
                          <FormLabel>Service Name <span className="text-destructive">*</span></FormLabel>
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
                        <FormLabel>Service Notes</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Additional details about this service..."
                            {...field}
                            disabled={isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Line Total */}
                  <div className="text-right text-sm">
                    <span className="font-medium">
                      Line Total: {formatCurrency(
                        (form.watch(`serviceItems.${index}.qty`) || 0) *
                        (form.watch(`serviceItems.${index}.unitPriceCents`) || 0)
                      )}
                    </span>
                  </div>
                </div>
              ))}

              {/* Total */}
              {fields.length > 0 && (
                <div className="flex justify-end p-4 bg-muted/50 rounded-lg">
                  <div className="text-right">
                    <p className="text-lg font-semibold">
                      Total: {formatCurrency(calculateTotal())}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This total will be recorded in the service history.
                    </p>
                  </div>
                </div>
              )}
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
              <Button
                type="submit"
                disabled={isPending || afterPhotos.length === 0}
                aria-live="polite"
                aria-label={isPending ? 'Completing job...' : 'Complete job'}
                className="gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? 'Completing...' : 'Complete Job'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <PostCompletionDialog
      job={job}
      open={showPostCompletion}
      onOpenChange={setShowPostCompletion}
    />
    </>
  )
}