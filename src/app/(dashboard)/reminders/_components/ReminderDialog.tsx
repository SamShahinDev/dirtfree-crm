'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon, User, FileText, MessageSquare, Calendar } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'

import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { CustomerPicker } from '../../jobs/_components/CustomerPicker'
import { createReminder, updateReminder, type ReminderRow } from '../actions'
import {
  ReminderCreateZ,
  REMINDER_TYPE_LABELS,
  type ReminderCreate,
  type ReminderType
} from '../schema'

interface ReminderDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  reminderToEdit?: ReminderRow
}

interface Customer {
  id: string
  name: string
  phone_e164?: string | null
  email?: string | null
}

interface Job {
  id: string
  scheduled_date: string
  scheduled_time_start?: string
  scheduled_time_end?: string
  description?: string
}

export function ReminderDialog({
  open,
  onClose,
  onSuccess,
  reminderToEdit
}: ReminderDialogProps) {
  const [loading, setLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)

  const isEditing = !!reminderToEdit

  const form = useForm<ReminderCreate>({
    resolver: zodResolver(ReminderCreateZ),
    defaultValues: {
      customerId: '',
      jobId: undefined,
      technicianId: undefined,
      type: 'follow_up',
      title: '',
      body: '',
      scheduledDate: ''
    }
  })

  // Load initial data when editing
  useEffect(() => {
    if (reminderToEdit && open) {
      form.reset({
        customerId: reminderToEdit.customer_id,
        jobId: reminderToEdit.job_id || undefined,
        technicianId: reminderToEdit.technician_id || undefined,
        type: reminderToEdit.type as ReminderType,
        title: reminderToEdit.title,
        body: reminderToEdit.body || '',
        scheduledDate: reminderToEdit.scheduled_date
      })

      // Set customer data
      setSelectedCustomer({
        id: reminderToEdit.customer_id,
        name: reminderToEdit.customer_name,
        phone_e164: reminderToEdit.customer_phone,
        email: reminderToEdit.customer_email
      })

      // Load customer's jobs
      if (reminderToEdit.customer_id) {
        loadCustomerJobs(reminderToEdit.customer_id)
      }
    } else if (open) {
      // Reset form when opening for create
      form.reset({
        customerId: '',
        jobId: undefined,
        technicianId: undefined,
        type: 'follow_up',
        title: '',
        body: '',
        scheduledDate: ''
      })
      setSelectedCustomer(null)
      setAvailableJobs([])
    }
  }, [reminderToEdit, open, form])

  // Load customer's jobs when customer changes
  const loadCustomerJobs = async (customerId: string) => {
    if (!customerId) {
      setAvailableJobs([])
      return
    }

    try {
      setLoadingJobs(true)

      // Use client Supabase instead of server version
      const { getSupabaseBrowserClient } = await import('@/lib/supabase/client')
      const supabase = getSupabaseBrowserClient()

      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, scheduled_date, scheduled_time_start, scheduled_time_end, description')
        .eq('customer_id', customerId)
        .in('status', ['scheduled', 'in_progress', 'completed'])
        .order('scheduled_date', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Failed to load customer jobs:', error)
        setAvailableJobs([])
        return
      }

      setAvailableJobs(jobs || [])
    } catch (error) {
      console.error('Failed to load customer jobs:', error)
      setAvailableJobs([])
    } finally {
      setLoadingJobs(false)
    }
  }

  // Handle customer selection
  const handleCustomerChange = (customer: Customer | null) => {
    setSelectedCustomer(customer)
    form.setValue('customerId', customer?.id || '')
    form.setValue('jobId', undefined)

    if (customer) {
      loadCustomerJobs(customer.id)
    } else {
      setAvailableJobs([])
    }
  }

  // Handle form submission
  const handleSubmit = async (data: ReminderCreate) => {
    try {
      setLoading(true)

      if (isEditing && reminderToEdit) {
        const result = await updateReminder({
          id: reminderToEdit.id,
          input: data
        })

        if (result.success) {
          toast.success('Reminder updated successfully')
          onSuccess()
          onClose()
        } else {
          toast.error(result.error)
        }
      } else {
        const result = await createReminder(data)

        if (result.success) {
          toast.success('Reminder created successfully')
          onSuccess()
          onClose()
        } else {
          toast.error(result.error)
        }
      }
    } catch (error) {
      console.error('Failed to save reminder:', error)
      toast.error('Failed to save reminder')
    } finally {
      setLoading(false)
    }
  }

  // Parse date for calendar
  const parseDate = (dateString: string): Date | undefined => {
    if (!dateString) return undefined
    const date = new Date(dateString + 'T00:00:00')
    return isNaN(date.getTime()) ? undefined : date
  }

  // Format date for input
  const formatDate = (date: Date): string => {
    return format(date, 'yyyy-MM-dd')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {isEditing ? 'Edit Reminder' : 'Create New Reminder'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the reminder details below.'
              : 'Create a new reminder for a customer. You can optionally link it to a specific job.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Customer *</Label>
              <CustomerPicker
                selectedCustomer={selectedCustomer}
                onCustomerChange={handleCustomerChange}
                placeholder="Search for a customer..."
              />
              {form.formState.errors.customerId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.customerId.message}
                </p>
              )}
            </div>

            {/* Job Selection (Optional) */}
            {selectedCustomer && (
              <FormField
                control={form.control}
                name="jobId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Related Job (Optional)
                    </FormLabel>
                    <Select
                      value={field.value || 'none'}
                      onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)}
                      disabled={loadingJobs}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingJobs ? "Loading jobs..." : "Select a job (optional)"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No job selected</SelectItem>
                        {availableJobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.scheduled_date} {job.scheduled_time_start && `at ${job.scheduled_time_start}`}
                            {job.description && ` - ${job.description.substring(0, 50)}...`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Type *
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reminder type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(REMINDER_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Title *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief description of the reminder"
                      maxLength={200}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Body (Optional) */}
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Custom Message (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Optional custom message to send. If left blank, a template will be used based on the type."
                      rows={4}
                      maxLength={2000}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Scheduled Date */}
            <FormField
              control={form.control}
              name="scheduledDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Scheduled Date *
                  </FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(parseDate(field.value)!, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={parseDate(field.value)}
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(formatDate(date))
                          }
                        }}
                        disabled={(date) =>
                          date < new Date(new Date().setHours(0, 0, 0, 0))
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={form.handleSubmit(handleSubmit)}
            disabled={loading}
          >
            {loading ? 'Saving...' : isEditing ? 'Update Reminder' : 'Create Reminder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}