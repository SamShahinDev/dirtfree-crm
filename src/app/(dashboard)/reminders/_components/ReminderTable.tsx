'use client'

import { useState } from 'react'
import {
  MoreHorizontal,
  User,
  Clock,
  Check,
  X,
  MessageSquare,
  Send,
  Edit,
  Eye,
  Phone,
  Calendar
} from 'lucide-react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarInitials } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

import { formatForDisplay } from '@/lib/utils/phone'
import { cn } from '@/lib/utils'
import { type ReminderRow } from '../actions'
import {
  REMINDER_STATUS_LABELS,
  REMINDER_TYPE_LABELS,
  REMINDER_STATUS_COLORS,
  type ReminderStatus
} from '../schema'

interface ReminderTableProps {
  reminders: ReminderRow[]
  onEdit: (reminder: ReminderRow) => void
  onAssign: (reminder: ReminderRow) => void
  onSnooze: (reminder: ReminderRow) => void
  onComplete: (reminder: ReminderRow) => void
  onCancel: (reminder: ReminderRow) => void
  onComment: (reminder: ReminderRow) => void
  onSendNow: (reminder: ReminderRow) => void
}

export function ReminderTable({
  reminders,
  onEdit,
  onAssign,
  onSnooze,
  onComplete,
  onCancel,
  onComment,
  onSendNow
}: ReminderTableProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const handleAction = async (action: () => Promise<void> | void, actionId: string) => {
    setLoadingAction(actionId)
    try {
      await action()
    } finally {
      setLoadingAction(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    let formatted = format(date, 'MMM d, yyyy')

    if (diffDays < 0) {
      formatted += ` (${Math.abs(diffDays)}d overdue)`
    } else if (diffDays === 0) {
      formatted += ' (today)'
    } else if (diffDays === 1) {
      formatted += ' (tomorrow)'
    } else if (diffDays <= 7) {
      formatted += ` (in ${diffDays}d)`
    }

    return { formatted, overdue: diffDays < 0, today: diffDays === 0 }
  }

  const getStatusIcon = (status: ReminderStatus) => {
    switch (status) {
      case 'pending':
        return <Calendar className="h-3 w-3" />
      case 'snoozed':
        return <Clock className="h-3 w-3" />
      case 'completed':
        return <Check className="h-3 w-3" />
      case 'cancelled':
        return <X className="h-3 w-3" />
      default:
        return null
    }
  }

  const canPerformActions = (reminder: ReminderRow) => {
    return reminder.status === 'pending' || reminder.status === 'snoozed'
  }

  return (
    <TooltipProvider>
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Customer</TableHead>
              <TableHead className="w-[200px]">Reminder</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[140px]">Technician</TableHead>
              <TableHead className="w-[140px]">Scheduled</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reminders.map((reminder) => {
              const scheduledDate = formatDate(reminder.scheduled_date)

              return (
                <TableRow key={reminder.id} className="group">
                  {/* Customer */}
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{reminder.customer_name}</div>
                      {reminder.customer_phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {formatForDisplay(reminder.customer_phone)}
                        </div>
                      )}
                      {reminder.customer_address && (
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {reminder.customer_address}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Reminder */}
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium line-clamp-2">{reminder.title}</div>
                      {reminder.body && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-sm text-muted-foreground line-clamp-1 cursor-help">
                              {reminder.body}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{reminder.body}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {reminder.job_date && (
                        <div className="text-xs text-muted-foreground">
                          Job: {format(new Date(reminder.job_date), 'MMM d')}
                          {reminder.job_time_start && ` at ${reminder.job_time_start}`}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <Badge variant="outline">
                      {REMINDER_TYPE_LABELS[reminder.type as keyof typeof REMINDER_TYPE_LABELS] || reminder.type}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={cn("gap-1", REMINDER_STATUS_COLORS[reminder.status])}>
                        {getStatusIcon(reminder.status)}
                        {REMINDER_STATUS_LABELS[reminder.status]}
                      </Badge>
                      {reminder.status === 'snoozed' && reminder.snoozed_until && (
                        <div className="text-xs text-muted-foreground">
                          Until {format(new Date(reminder.snoozed_until), 'MMM d, h:mm a')}
                        </div>
                      )}
                      {reminder.attempt_count > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {reminder.attempt_count} attempt{reminder.attempt_count !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Technician */}
                  <TableCell>
                    {reminder.technician_name ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>
                            <AvatarInitials name={reminder.technician_name} />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{reminder.technician_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>

                  {/* Scheduled Date */}
                  <TableCell>
                    <div className={cn(
                      "text-sm",
                      scheduledDate.overdue && "text-destructive font-medium",
                      scheduledDate.today && "text-orange-600 font-medium"
                    )}>
                      {scheduledDate.formatted}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={loadingAction !== null}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open actions menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {/* View/Edit */}
                        <DropdownMenuItem
                          onClick={() => handleAction(() => onEdit(reminder), `edit-${reminder.id}`)}
                          disabled={loadingAction === `edit-${reminder.id}`}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Reminder
                        </DropdownMenuItem>

                        {/* Assign */}
                        <DropdownMenuItem
                          onClick={() => handleAction(() => onAssign(reminder), `assign-${reminder.id}`)}
                          disabled={loadingAction === `assign-${reminder.id}`}
                        >
                          <User className="mr-2 h-4 w-4" />
                          {reminder.technician_name ? 'Reassign' : 'Assign'} Technician
                        </DropdownMenuItem>

                        {/* Comments */}
                        <DropdownMenuItem
                          onClick={() => handleAction(() => onComment(reminder), `comment-${reminder.id}`)}
                          disabled={loadingAction === `comment-${reminder.id}`}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Comments
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Status Actions */}
                        {canPerformActions(reminder) && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleAction(() => onSnooze(reminder), `snooze-${reminder.id}`)}
                              disabled={loadingAction === `snooze-${reminder.id}`}
                            >
                              <Clock className="mr-2 h-4 w-4" />
                              Snooze
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleAction(() => onComplete(reminder), `complete-${reminder.id}`)}
                              disabled={loadingAction === `complete-${reminder.id}`}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Mark Complete
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => handleAction(() => onCancel(reminder), `cancel-${reminder.id}`)}
                              disabled={loadingAction === `cancel-${reminder.id}`}
                              className="text-destructive focus:text-destructive"
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Send SMS Now */}
                            {reminder.customer_phone && (
                              <DropdownMenuItem
                                onClick={() => handleAction(() => onSendNow(reminder), `send-${reminder.id}`)}
                                disabled={loadingAction === `send-${reminder.id}`}
                                className="text-primary focus:text-primary"
                              >
                                <Send className="mr-2 h-4 w-4" />
                                {loadingAction === `send-${reminder.id}` ? 'Sending...' : 'Send SMS Now'}
                              </DropdownMenuItem>
                            )}
                          </>
                        )}

                        {!canPerformActions(reminder) && (
                          <DropdownMenuItem disabled>
                            <Eye className="mr-2 h-4 w-4" />
                            View Only
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {reminders.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No reminders found.
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}