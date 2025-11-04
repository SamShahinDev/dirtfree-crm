'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Clock, Calendar, CalendarIcon, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, addHours, addWeeks, startOfDay, setHours, setMinutes } from 'date-fns'

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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

import { cn } from '@/lib/utils'
import { snoozeReminder, type ReminderRow } from '../actions'
import { SnoozeZ, type SnoozeInput } from '../schema'

interface SnoozeDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  reminder: ReminderRow
}

interface QuickSnoozeOption {
  label: string
  value: string
  getDateTime: () => Date
}

export function SnoozeDialog({
  open,
  onClose,
  onSuccess,
  reminder
}: SnoozeDialogProps) {
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState('')

  const form = useForm<SnoozeInput>({
    resolver: zodResolver(SnoozeZ),
    defaultValues: {
      id: reminder.id,
      until: '',
      reason: ''
    }
  })

  // Quick snooze options
  const quickOptions: QuickSnoozeOption[] = [
    {
      label: '1 hour',
      value: '1h',
      getDateTime: () => addHours(new Date(), 1)
    },
    {
      label: '4 hours',
      value: '4h',
      getDateTime: () => addHours(new Date(), 4)
    },
    {
      label: 'Tomorrow 9 AM',
      value: 'tomorrow',
      getDateTime: () => setHours(setMinutes(addDays(startOfDay(new Date()), 1), 0), 9)
    },
    {
      label: 'Next week',
      value: '1w',
      getDateTime: () => addWeeks(new Date(), 1)
    },
    {
      label: 'Next Monday 9 AM',
      value: 'next-monday',
      getDateTime: () => {
        const now = new Date()
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7
        return setHours(setMinutes(addDays(startOfDay(now), daysUntilMonday), 0), 9)
      }
    }
  ]

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        id: reminder.id,
        until: '',
        reason: ''
      })
      setSelectedDate(undefined)
      setSelectedTime('')
    }
  }, [open, reminder, form])

  // Update form when date/time changes
  useEffect(() => {
    if (selectedDate && selectedTime) {
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const dateTime = setHours(setMinutes(selectedDate, minutes), hours)
      form.setValue('until', dateTime.toISOString())
    }
  }, [selectedDate, selectedTime, form])

  const handleQuickSnooze = (option: QuickSnoozeOption) => {
    const dateTime = option.getDateTime()
    const isoString = dateTime.toISOString()

    form.setValue('until', isoString)
    setSelectedDate(dateTime)
    setSelectedTime(format(dateTime, 'HH:mm'))
  }

  const handleSubmit = async (data: SnoozeInput) => {
    try {
      setLoading(true)

      // Validate that the snooze time is in the future
      const snoozeDate = new Date(data.until)
      if (snoozeDate <= new Date()) {
        toast.error('Snooze time must be in the future')
        return
      }

      const result = await snoozeReminder(data)

      if (result.success) {
        toast.success(`Reminder snoozed until ${format(snoozeDate, 'PPp')}`)
        onSuccess()
        onClose()
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error('Failed to snooze reminder:', error)
      toast.error('Failed to snooze reminder')
    } finally {
      setLoading(false)
    }
  }

  const parseDateTime = (isoString: string): { date: Date | undefined; time: string } => {
    if (!isoString) return { date: undefined, time: '' }

    try {
      const date = new Date(isoString)
      return {
        date: date,
        time: format(date, 'HH:mm')
      }
    } catch {
      return { date: undefined, time: '' }
    }
  }

  const currentSnoozeDateTime = parseDateTime(form.watch('until'))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-lg p-6 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Snooze Reminder
          </DialogTitle>
          <DialogDescription>
            Set when this reminder should become active again.
          </DialogDescription>
        </DialogHeader>

        {/* Current reminder info */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Customer:</span>
            <span className="text-sm">{reminder.customer_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Title:</span>
            <span className="text-sm">{reminder.title}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Originally scheduled:</span>
            <span className="text-sm">{new Date(reminder.scheduled_date).toLocaleDateString()}</span>
          </div>
          {reminder.snoozed_until && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Currently snoozed until:</span>
              <Badge variant="secondary">
                {format(new Date(reminder.snoozed_until), 'MMM d, h:mm a')}
              </Badge>
            </div>
          )}
        </div>

        {/* Quick snooze options */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Quick snooze options:</h4>
          <div className="flex flex-wrap gap-2">
            {quickOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickSnooze(option)}
                className="text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom date/time selection */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-medium">Or set custom date & time:</h4>

          <div className="grid grid-cols-2 gap-4">
            {/* Date picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                disabled={!selectedDate}
              />
            </div>
          </div>

          {/* Show selected datetime */}
          {currentSnoozeDateTime.date && (
            <div className="rounded-lg border bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Snooze until: {format(currentSnoozeDateTime.date, 'PPP p')}
                </span>
              </div>
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Reason (optional) */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Optional reason for snoozing this reminder..."
                      rows={3}
                      maxLength={500}
                    />
                  </FormControl>
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
            disabled={loading || !form.watch('until')}
          >
            {loading ? 'Snoozing...' : 'Snooze Reminder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}