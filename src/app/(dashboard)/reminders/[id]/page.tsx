'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  FileText,
  MessageSquare,
  Send,
  Edit,
  Check,
  X,
  Building
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarInitials } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

import { formatForDisplay } from '@/lib/utils/phone'
import { cn } from '@/lib/utils'
import {
  getReminder,
  assignReminder,
  snoozeReminder,
  completeReminder,
  cancelReminder,
  sendReminderNow,
  addComment,
  type ReminderDetail
} from '../actions'
import {
  REMINDER_STATUS_LABELS,
  REMINDER_TYPE_LABELS,
  REMINDER_STATUS_COLORS,
  type ReminderStatus
} from '../schema'

// import { AssignReminderDialog } from '../_components/AssignReminderDialog' // COMMENTED OUT - causing import errors
import { SnoozeDialog } from '../_components/SnoozeDialog'
import { ReminderDialog } from '../_components/ReminderDialog'

export default function ReminderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reminderId = params.id as string

  const [reminder, setReminder] = useState<ReminderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Dialog states
  const [showEditDialog, setShowEditDialog] = useState(false)
  // const [showAssignDialog, setShowAssignDialog] = useState(false) // COMMENTED OUT
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false)

  // Load reminder details
  useEffect(() => {
    if (reminderId) {
      loadReminder()
    }
  }, [reminderId])

  const loadReminder = async () => {
    try {
      setLoading(true)

      const result = await getReminder({ id: reminderId })

      if (result.success) {
        setReminder(result.data)
      } else {
        toast.error(result.error)
        router.push('/reminders')
      }
    } catch (error) {
      console.error('Failed to load reminder:', error)
      toast.error('Failed to load reminder')
      router.push('/reminders')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: () => Promise<void>, actionId: string) => {
    setActionLoading(actionId)
    try {
      await action()
      loadReminder() // Reload to get updated data
    } finally {
      setActionLoading(null)
    }
  }

  const handleComplete = async () => {
    if (!reminder) return

    const result = await completeReminder({ id: reminder.id })
    if (result.success) {
      toast.success('Reminder completed')
    } else {
      toast.error(result.error)
    }
  }

  const handleCancel = async () => {
    if (!reminder) return

    const result = await cancelReminder({ id: reminder.id })
    if (result.success) {
      toast.success('Reminder cancelled')
    } else {
      toast.error(result.error)
    }
  }

  const handleSendNow = async () => {
    if (!reminder) return

    const result = await sendReminderNow({ id: reminder.id })
    if (result.success) {
      if (result.data.ok) {
        toast.success('SMS sent successfully')
      } else {
        toast.error(result.data.error || 'Failed to send SMS')
      }
    } else {
      toast.error(result.error)
    }
  }

  const canPerformActions = (status: ReminderStatus) => {
    return status === 'pending' || status === 'snoozed'
  }

  const getStatusIcon = (status: ReminderStatus) => {
    switch (status) {
      case 'pending':
        return <Calendar className="h-4 w-4" />
      case 'snoozed':
        return <Clock className="h-4 w-4" />
      case 'completed':
        return <Check className="h-4 w-4" />
      case 'cancelled':
        return <X className="h-4 w-4" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col space-y-6 rounded-lg bg-white p-5 lg:p-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!reminder) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg bg-white p-5 lg:p-6">
        <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Reminder not found</h2>
        <p className="text-muted-foreground mb-6">
          The reminder you're looking for doesn't exist or you don't have permission to view it.
        </p>
        <Button onClick={() => router.push('/reminders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reminders
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col space-y-6 rounded-lg bg-white p-5 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/reminders')}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{reminder.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("gap-1", REMINDER_STATUS_COLORS[reminder.status])}>
                  {getStatusIcon(reminder.status)}
                  {REMINDER_STATUS_LABELS[reminder.status]}
                </Badge>
                <Badge variant="outline">
                  {REMINDER_TYPE_LABELS[reminder.type as keyof typeof REMINDER_TYPE_LABELS] || reminder.type}
                </Badge>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {canPerformActions(reminder.status) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditDialog(true)}
                  disabled={actionLoading !== null}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>

                {/* COMMENTED OUT - Assign dialog disabled
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssignDialog(true)}
                  disabled={actionLoading !== null}
                >
                  <User className="mr-2 h-4 w-4" />
                  {reminder.technician_name ? 'Reassign' : 'Assign'}
                </Button>
                */}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSnoozeDialog(true)}
                  disabled={actionLoading !== null}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Snooze
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(handleComplete, 'complete')}
                  disabled={actionLoading !== null}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {actionLoading === 'complete' ? 'Completing...' : 'Complete'}
                </Button>

                {reminder.customer_phone && (
                  <Button
                    size="sm"
                    onClick={() => handleAction(handleSendNow, 'send')}
                    disabled={actionLoading !== null}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {actionLoading === 'send' ? 'Sending...' : 'Send SMS'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Reminder details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Reminder Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <p className="mt-1">
                      {REMINDER_TYPE_LABELS[reminder.type as keyof typeof REMINDER_TYPE_LABELS] || reminder.type}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Scheduled Date</label>
                    <p className="mt-1">{format(new Date(reminder.scheduled_date), 'PPP')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="mt-1">{format(new Date(reminder.created_at), 'PPp')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                    <p className="mt-1">{format(new Date(reminder.updated_at), 'PPp')}</p>
                  </div>
                </div>

                {reminder.body && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Custom Message</label>
                    <div className="mt-1 p-3 bg-muted/50 rounded-lg">
                      <p className="whitespace-pre-wrap">{reminder.body}</p>
                    </div>
                  </div>
                )}

                {reminder.status === 'snoozed' && reminder.snoozed_until && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Snoozed Until</label>
                    <p className="mt-1">{format(new Date(reminder.snoozed_until), 'PPp')}</p>
                  </div>
                )}

                {reminder.attempt_count > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Attempts</label>
                    <p className="mt-1">{reminder.attempt_count} attempt{reminder.attempt_count !== 1 ? 's' : ''}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent communication logs */}
            {reminder.communication_logs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Recent Communications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reminder.communication_logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                      >
                        <div className={cn(
                          "h-2 w-2 rounded-full mt-2 flex-shrink-0",
                          log.direction === 'outbound' ? "bg-blue-500" : "bg-green-500"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">
                              {log.direction === 'outbound' ? 'Sent' : 'Received'}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.status}
                            </Badge>
                            <span className="text-muted-foreground">
                              {format(new Date(log.created_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          {log.body?.text && (
                            <p className="text-sm mt-1 text-muted-foreground">
                              {log.body.text}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      <AvatarInitials name={reminder.customer_name} />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{reminder.customer_name}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {reminder.customer_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatForDisplay(reminder.customer_phone)}</span>
                    </div>
                  )}
                  {reminder.customer_email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{reminder.customer_email}</span>
                    </div>
                  )}
                  {reminder.customer_address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-sm">{reminder.customer_address}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Technician info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Assignment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reminder.technician_name ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <AvatarInitials name={reminder.technician_name} />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{reminder.technician_name}</p>
                      <p className="text-sm text-muted-foreground">Assigned Technician</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No technician assigned</p>
                    {/* COMMENTED OUT - Assign dialog disabled
                    {canPerformActions(reminder.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAssignDialog(true)}
                        className="mt-2"
                      >
                        Assign Technician
                      </Button>
                    )}
                    */}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Job info */}
            {reminder.job_date && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Related Job
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Date:</span>
                      <span className="text-sm">{format(new Date(reminder.job_date), 'PPP')}</span>
                    </div>
                    {reminder.job_time_start && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Time:</span>
                        <span className="text-sm">
                          {reminder.job_time_start}
                          {reminder.job_time_end && ` - ${reminder.job_time_end}`}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments ({reminder.comments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reminder.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No comments yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {reminder.comments.slice(-3).map((comment) => (
                      <div key={comment.id} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{comment.author_name}</span>
                          <span className="text-muted-foreground text-xs">
                            {format(new Date(comment.created_at), 'MMM d')}
                          </span>
                        </div>
                        <p className="text-muted-foreground line-clamp-2">
                          {comment.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Dialogs */}
        {showEditDialog && (
          <ReminderDialog
            open={true}
            onClose={() => setShowEditDialog(false)}
            onSuccess={() => {
              setShowEditDialog(false)
              loadReminder()
            }}
            reminderToEdit={reminder}
          />
        )}

        {/* COMMENTED OUT - AssignReminderDialog disabled
        {showAssignDialog && (
          <AssignReminderDialog
            open={true}
            onClose={() => setShowAssignDialog(false)}
            onSuccess={() => {
              setShowAssignDialog(false)
              loadReminder()
            }}
            reminder={reminder}
          />
        )}
        */}

        {showSnoozeDialog && (
          <SnoozeDialog
            open={true}
            onClose={() => setShowSnoozeDialog(false)}
            onSuccess={() => {
              setShowSnoozeDialog(false)
              loadReminder()
            }}
            reminder={reminder}
          />
        )}
      </div>
    </TooltipProvider>
  )
}