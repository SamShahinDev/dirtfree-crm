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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

import { assignTechnician } from '../actions'

const AssignTechnicianSchema = z.object({
  technicianId: z.string().min(1, 'Please select a technician'),
  scheduledDate: z.string().optional()
})

type AssignTechnicianForm = z.infer<typeof AssignTechnicianSchema>

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

interface Technician {
  user_id: string
  display_name?: string | null
  zone?: string | null
}

interface AssignTechnicianDialogProps {
  job: JobData | null
  technicians: Technician[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AssignTechnicianDialog({
  job,
  technicians,
  open,
  onOpenChange,
  onSuccess
}: AssignTechnicianDialogProps) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<AssignTechnicianForm>({
    resolver: zodResolver(AssignTechnicianSchema),
    defaultValues: {
      technicianId: job?.technicianId || '',
      scheduledDate: job?.scheduledDate || ''
    }
  })

  // Reset form when job changes
  React.useEffect(() => {
    if (job) {
      form.reset({
        technicianId: job.technicianId || '',
        scheduledDate: job.scheduledDate || ''
      })
    }
  }, [job, form])

  const handleSubmit = (data: AssignTechnicianForm) => {
    if (!job) return

    startTransition(async () => {
      try {
        const response = await assignTechnician({
          jobId: job.id,
          technicianId: data.technicianId,
          scheduledDate: data.scheduledDate || undefined
        })

        if (!response.ok) {
          throw new Error(response.error || 'Failed to assign technician')
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

  const handleOpenChange = (newOpen: boolean) => {
    if (!isPending) {
      onOpenChange(newOpen)
      if (!newOpen) {
        form.reset()
      }
    }
  }

  const getZoneMatchText = (techZone: string | null, jobZone: string | null) => {
    if (!techZone || !jobZone) return ''
    return techZone === jobZone ? ' (Zone Match)' : ` (Zone ${techZone})`
  }

  if (!job) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Technician</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Assign a technician to job for {job.customer?.name}
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Current Assignment */}
            {job.technician && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Currently assigned:</span>{' '}
                  {job.technician.display_name || 'Unknown'}
                </p>
              </div>
            )}

            {/* Technician Selection */}
            <FormField
              control={form.control}
              name="technicianId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Technician <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a technician" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.user_id} value={tech.user_id}>
                          {tech.display_name || 'Unknown'}
                          {getZoneMatchText(tech.zone, job.zone)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Optional Scheduled Date Update */}
            <FormField
              control={form.control}
              name="scheduledDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled Date (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to keep current date: {job.scheduledDate || 'Not set'}
                  </p>
                </FormItem>
              )}
            />

            {/* Job Details */}
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              <h4 className="text-sm font-medium">Job Details</h4>
              <div className="text-sm space-y-1">
                <p>
                  <span className="font-medium">Customer:</span> {job.customer?.name}
                </p>
                {job.zone && (
                  <p>
                    <span className="font-medium">Zone:</span>{' '}
                    {job.zone === 'Central' ? 'Central' : `Zone ${job.zone}`}
                  </p>
                )}
                {job.scheduledDate && (
                  <p>
                    <span className="font-medium">Date:</span>{' '}
                    {new Date(job.scheduledDate).toLocaleDateString()}
                  </p>
                )}
                {job.description && (
                  <p>
                    <span className="font-medium">Description:</span>{' '}
                    {job.description}
                  </p>
                )}
              </div>
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
                disabled={isPending}
                aria-live="polite"
                aria-label={isPending ? 'Assigning technician...' : 'Assign technician'}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? 'Assigning...' : 'Assign Technician'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}