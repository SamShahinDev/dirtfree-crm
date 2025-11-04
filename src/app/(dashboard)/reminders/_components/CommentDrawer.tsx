'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MessageSquare, Send, X, User } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarInitials } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

import { addComment, getReminder, type ReminderRow, type ReminderDetail } from '../actions'
import { CommentZ, type CommentInput, REMINDER_STATUS_COLORS, REMINDER_STATUS_LABELS } from '../schema'

interface CommentDrawerProps {
  open: boolean
  onClose: () => void
  reminder: ReminderRow
}

interface Comment {
  id: string
  body: string
  created_at: string
  created_by: string
  author_name: string
}

export function CommentDrawer({
  open,
  onClose,
  reminder
}: CommentDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reminderDetail, setReminderDetail] = useState<ReminderDetail | null>(null)
  const [comments, setComments] = useState<Comment[]>([])

  const form = useForm<CommentInput>({
    resolver: zodResolver(CommentZ),
    defaultValues: {
      id: reminder.id,
      body: ''
    }
  })

  // Load reminder details and comments when drawer opens
  useEffect(() => {
    if (open) {
      loadReminderDetail()
      form.reset({
        id: reminder.id,
        body: ''
      })
    }
  }, [open, reminder.id, form])

  const loadReminderDetail = async () => {
    try {
      setLoading(true)

      const result = await getReminder({ id: reminder.id })

      if (result.success) {
        setReminderDetail(result.data)
        setComments(result.data.comments)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error('Failed to load reminder details:', error)
      toast.error('Failed to load reminder details')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: CommentInput) => {
    try {
      setSubmitting(true)

      const result = await addComment(data)

      if (result.success) {
        // Add comment optimistically
        const newComment: Comment = {
          id: result.data.commentId,
          body: data.body,
          created_at: new Date().toISOString(),
          created_by: 'current-user', // This would be set by the server
          author_name: 'You' // This would be the current user's name
        }

        setComments(prev => [...prev, newComment])
        form.reset({ id: reminder.id, body: '' })
        toast.success('Comment added successfully')

        // Reload to get accurate data
        setTimeout(() => {
          loadReminderDetail()
        }, 500)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
      toast.error('Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      relative: formatDistanceToNow(date, { addSuffix: true }),
      absolute: date.toLocaleString()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[500px] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-6 pb-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <SheetTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Reminder Comments
                </SheetTitle>
                <SheetDescription>
                  View and add comments for this reminder
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {loading ? (
            <div className="px-6 space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : reminderDetail ? (
            <>
              {/* Reminder Summary */}
              <div className="px-6 pb-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{reminderDetail.title}</h3>
                    <Badge className={REMINDER_STATUS_COLORS[reminderDetail.status]}>
                      {REMINDER_STATUS_LABELS[reminderDetail.status]}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer:</span>
                      <span>{reminderDetail.customer_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Scheduled:</span>
                      <span>{new Date(reminderDetail.scheduled_date).toLocaleDateString()}</span>
                    </div>
                    {reminderDetail.technician_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assigned to:</span>
                        <span>{reminderDetail.technician_name}</span>
                      </div>
                    )}
                    {reminderDetail.snoozed_until && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Snoozed until:</span>
                        <span>{new Date(reminderDetail.snoozed_until).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {reminderDetail.body && (
                    <div className="border-t pt-3">
                      <p className="text-sm text-muted-foreground">Message:</p>
                      <p className="text-sm mt-1">{reminderDetail.body}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Comments Thread */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-6 py-4">
                  <h4 className="font-medium text-sm">Comments ({comments.length})</h4>
                </div>

                <ScrollArea className="flex-1 px-6">
                  {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-sm font-medium">No comments yet</h3>
                      <p className="text-sm text-muted-foreground">
                        Be the first to add a comment to this reminder.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-4">
                      {comments.map((comment, index) => {
                        const dateTime = formatDateTime(comment.created_at)

                        return (
                          <div key={comment.id} className="space-y-2">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarFallback>
                                  <AvatarInitials name={comment.author_name} />
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium">
                                    {comment.author_name}
                                  </span>
                                  <span
                                    className="text-xs text-muted-foreground"
                                    title={dateTime.absolute}
                                  >
                                    {dateTime.relative}
                                  </span>
                                </div>

                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {comment.body}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {index < comments.length - 1 && (
                              <Separator className="ml-11" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Add Comment Form */}
                <div className="border-t bg-background">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="p-4 space-y-3">
                      <FormField
                        control={form.control}
                        name="body"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Add a comment..."
                                rows={3}
                                maxLength={2000}
                                className="resize-none"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-between items-center">
                        <div className="text-xs text-muted-foreground">
                          {form.watch('body')?.length || 0} / 2000 characters
                        </div>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={submitting || !form.watch('body')?.trim()}
                          className="gap-2"
                        >
                          <Send className="h-4 w-4" />
                          {submitting ? 'Adding...' : 'Add Comment'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold">Failed to load reminder</h3>
                <p className="text-muted-foreground">
                  Unable to load reminder details. Please try again.
                </p>
                <Button
                  variant="outline"
                  onClick={loadReminderDetail}
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}