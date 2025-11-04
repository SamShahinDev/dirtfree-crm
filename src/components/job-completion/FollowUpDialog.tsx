'use client'

import { useState } from 'react'
import { Calendar, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { addMonths, format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { createFollowUpReminder } from '@/app/(dashboard)/reminders/actions'

interface FollowUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  customerId: string
  customerName: string
  onSuccess?: () => void
}

export function FollowUpDialog({
  open,
  onOpenChange,
  jobId,
  customerId,
  customerName,
  onSuccess
}: FollowUpDialogProps) {
  // Default to 12 months from today as per Phase 8 spec
  const defaultDate = format(addMonths(new Date(), 12), 'yyyy-MM-dd')

  const [scheduledDate, setScheduledDate] = useState(defaultDate)
  const [title, setTitle] = useState(`Follow-up service for ${customerName}`)
  const [body, setBody] = useState('Annual follow-up service reminder')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!scheduledDate.trim()) {
      toast.error('Please select a follow-up date')
      return
    }

    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    setSubmitting(true)

    try {
      const result = await createFollowUpReminder({
        jobId,
        customerId,
        scheduledDate,
        title: title.trim(),
        body: body.trim() || undefined
      })

      toast.success('Follow-up reminder created successfully!')
      onSuccess?.()
      onOpenChange(false)

      // Reset form
      setScheduledDate(defaultDate)
      setTitle(`Follow-up service for ${customerName}`)
      setBody('Annual follow-up service reminder')

    } catch (error) {
      console.error('Error creating follow-up reminder:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create follow-up reminder'
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Set Follow-Up Reminder
          </DialogTitle>
          <DialogDescription>
            Create a reminder for future service follow-up with {customerName}.
            Default is set to 12 months from today.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Scheduled Date */}
          <div className="space-y-2">
            <Label htmlFor="scheduledDate">Follow-up Date</Label>
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')} // Can't schedule in the past
              required
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Reminder Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="Enter reminder title"
            />
            <div className="text-xs text-gray-500 text-right">
              {title.length}/200 characters
            </div>
          </div>

          {/* Body/Description */}
          <div className="space-y-2">
            <Label htmlFor="body">Description (optional)</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Enter reminder description"
            />
            <div className="text-xs text-gray-500 text-right">
              {body.length}/2000 characters
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !scheduledDate.trim() || !title.trim()}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Follow-Up
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}