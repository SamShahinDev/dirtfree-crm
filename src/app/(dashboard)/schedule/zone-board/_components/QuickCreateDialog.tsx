'use client'

import React, { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2, Plus } from 'lucide-react'

import { ZONES } from '@/types/job'
import { getBucketDisplayName, type BucketKey } from '@/lib/schedule/board'
import { quickCreateJob } from '../actions'
import { CustomerPicker } from '../../../jobs/_components/CustomerPicker'

const QuickCreateSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer'),
  zone: z.string().nullable(),
  bucket: z.enum(['morning', 'afternoon', 'evening', 'any']),
  description: z.string().max(500, 'Description too long').optional()
})

type QuickCreateForm = z.infer<typeof QuickCreateSchema>

export interface QuickCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultZone?: string | null
  defaultBucket?: BucketKey
  onSuccess?: () => void
}

export function QuickCreateDialog({
  open,
  onOpenChange,
  defaultZone,
  defaultBucket,
  onSuccess
}: QuickCreateDialogProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<QuickCreateForm>({
    resolver: zodResolver(QuickCreateSchema),
    defaultValues: {
      customerId: '',
      zone: defaultZone || null,
      bucket: defaultBucket || 'any',
      description: ''
    }
  })

  // Reset form when dialog opens/closes or defaults change
  React.useEffect(() => {
    if (open) {
      form.reset({
        customerId: '',
        zone: defaultZone || null,
        bucket: defaultBucket || 'any',
        description: ''
      })
    }
  }, [open, defaultZone, defaultBucket, form])

  const handleSubmit = (data: QuickCreateForm) => {
    startTransition(async () => {
      try {
        const response = await quickCreateJob({
          customerId: data.customerId,
          zone: data.zone,
          bucket: data.bucket,
          description: data.description || null
        })

        if (!response.ok) {
          throw new Error(response.error || 'Failed to create job')
        }

        toast.success('Job created successfully')
        onOpenChange(false)
        onSuccess?.()
      } catch (error) {
        console.error('Quick create job error:', error)
        toast.error(
          error instanceof Error
            ? error.message
            : 'Failed to create job'
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

  const getBucketDescription = (bucket: BucketKey) => {
    switch (bucket) {
      case 'morning':
        return 'Scheduled for 9:00 AM - 11:00 AM'
      case 'afternoon':
        return 'Scheduled for 1:00 PM - 3:00 PM'
      case 'evening':
        return 'Scheduled for 5:00 PM - 7:00 PM'
      case 'any':
        return 'No specific time scheduled'
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Quick Create Job
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Create a new job and place it in the specified zone and time bucket.
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Customer Selection */}
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Customer <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <CustomerPicker
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                      placeholder="Select a customer..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Zone Selection */}
            <FormField
              control={form.control}
              name="zone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Zone</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === 'null' ? null : value)}
                    value={field.value || 'null'}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="null">Unassigned</SelectItem>
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

            {/* Time Bucket Selection */}
            <FormField
              control={form.control}
              name="bucket"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time Bucket</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select time bucket" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="morning">
                        <div>
                          <div className="font-medium">{getBucketDisplayName('morning')}</div>
                          <div className="text-xs text-muted-foreground">9:00 AM - 11:00 AM</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="afternoon">
                        <div>
                          <div className="font-medium">{getBucketDisplayName('afternoon')}</div>
                          <div className="text-xs text-muted-foreground">1:00 PM - 3:00 PM</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="evening">
                        <div>
                          <div className="font-medium">{getBucketDisplayName('evening')}</div>
                          <div className="text-xs text-muted-foreground">5:00 PM - 7:00 PM</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="any">
                        <div>
                          <div className="font-medium">{getBucketDisplayName('any')}</div>
                          <div className="text-xs text-muted-foreground">No specific time</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  {form.watch('bucket') && (
                    <p className="text-xs text-muted-foreground">
                      {getBucketDescription(form.watch('bucket'))}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the work to be performed..."
                      className="min-h-[80px]"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Brief description of the services needed.
                  </p>
                </FormItem>
              )}
            />

            {/* Preview */}
            {form.watch('zone') && form.watch('bucket') && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Job Preview</h4>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">Zone:</span>{' '}
                    {form.watch('zone')
                      ? (form.watch('zone') === 'Central' ? 'Central' : `Zone ${form.watch('zone')}`)
                      : 'Unassigned'
                    }
                  </p>
                  <p>
                    <span className="font-medium">Time:</span>{' '}
                    {getBucketDisplayName(form.watch('bucket'))}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span> Scheduled
                  </p>
                </div>
              </div>
            )}

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
                disabled={isPending}
                className="gap-2"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? 'Creating...' : 'Create Job'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}