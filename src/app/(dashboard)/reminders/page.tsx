'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Filter, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import PageShell from "@/components/shell/PageShell"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { formatForDisplay } from '@/lib/utils/phone'
import { listReminders, type ListRemindersResult, type ReminderRow } from './actions'
import {
  REMINDER_STATUS_LABELS,
  REMINDER_TYPE_LABELS,
  REMINDER_STATUS_COLORS,
  type ReminderStatus,
  type ReminderFilter
} from './schema'

import { ReminderTable } from './_components/ReminderTable'
import { ReminderDialog } from './_components/ReminderDialog'
// import { AssignReminderDialog } from './_components/AssignReminderDialog' // COMMENTED OUT - causing import errors
import { SnoozeDialog } from './_components/SnoozeDialog'
import { CommentDrawer } from './_components/CommentDrawer'

export default function RemindersPage() {
  // State for filters
  const [search, setSearch] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<ReminderStatus[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedTechnician, setSelectedTechnician] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // State for data and pagination
  const [reminders, setReminders] = useState<ListRemindersResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingReminder, setEditingReminder] = useState<ReminderRow | null>(null)
  // const [assigningReminder, setAssigningReminder] = useState<ReminderRow | null>(null) // COMMENTED OUT
  const [snoozingReminder, setSnoozingReminder] = useState<ReminderRow | null>(null)
  const [commentingReminder, setCommentingReminder] = useState<ReminderRow | null>(null)

  // Debounced search value
  const debouncedSearch = useDebouncedValue(search, 300)

  // Load reminders
  const loadReminders = useCallback(async () => {
    try {
      setLoading(true)

      const filters: ReminderFilter = {
        q: debouncedSearch || undefined,
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
        type: selectedTypes.length > 0 ? selectedTypes : undefined,
        technicianId: selectedTechnician || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        size: 25
      }

      const result = await listReminders(filters)

      if (result.success) {
        setReminders(result.data)
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error('Failed to load reminders:', error)
      toast.error('Failed to load reminders')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, selectedStatuses, selectedTypes, selectedTechnician, dateFrom, dateTo, page])

  // Load reminders when filters change
  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, selectedStatuses, selectedTypes, selectedTechnician, dateFrom, dateTo])

  // Reset all filters
  const resetFilters = () => {
    setSearch('')
    setSelectedStatuses([])
    setSelectedTypes([])
    setSelectedTechnician('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  // Handle reminder actions
  const handleEditReminder = (reminder: ReminderRow) => {
    setEditingReminder(reminder)
  }

  const handleAssignReminder = (reminder: ReminderRow) => {
    // setAssigningReminder(reminder) // COMMENTED OUT
    toast.info('Assign feature temporarily disabled')
  }

  const handleSnoozeReminder = (reminder: ReminderRow) => {
    setSnoozingReminder(reminder)
  }

  const handleCommentReminder = (reminder: ReminderRow) => {
    setCommentingReminder(reminder)
  }

  const handleSendReminderNow = async (reminder: ReminderRow) => {
    try {
      const { sendReminderNow } = await import('./actions')
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
    } catch (error) {
      console.error('Failed to send SMS:', error)
      toast.error('Failed to send SMS')
    }
  }

  const handleCompleteReminder = async (reminder: ReminderRow) => {
    try {
      const { completeReminder } = await import('./actions')
      const result = await completeReminder({ id: reminder.id })

      if (result.success) {
        toast.success('Reminder completed')
        loadReminders()
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error('Failed to complete reminder:', error)
      toast.error('Failed to complete reminder')
    }
  }

  const handleCancelReminder = async (reminder: ReminderRow) => {
    try {
      const { cancelReminder } = await import('./actions')
      const result = await cancelReminder({ id: reminder.id })

      if (result.success) {
        toast.success('Reminder cancelled')
        loadReminders()
      } else {
        toast.error(result.error)
      }
    } catch (error) {
      console.error('Failed to cancel reminder:', error)
      toast.error('Failed to cancel reminder')
    }
  }

  // Handle dialog success actions
  const handleDialogSuccess = () => {
    loadReminders()
    setEditingReminder(null)
    // setAssigningReminder(null) // COMMENTED OUT
    setSnoozingReminder(null)
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHeader
          title="Reminders"
          description="Manage customer reminders and follow-ups"
          actions={
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New Reminder
            </Button>
          }
        />

        {/* Filters */}
        <div className="section-card">
          <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex items-center gap-2 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, phone, or title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-background"
          />
        </div>

        {/* Status filter */}
        <div className="min-w-[160px]">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={selectedStatuses.join(',') || 'all'}
            onValueChange={(value) => setSelectedStatuses(value === 'all' || !value ? [] : value.split(',') as ReminderStatus[])}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(REMINDER_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type filter */}
        <div className="min-w-[160px]">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select
            value={selectedTypes.join(',') || 'all'}
            onValueChange={(value) => setSelectedTypes(value === 'all' || !value ? [] : value.split(','))}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(REMINDER_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <div className="min-w-[120px]">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="min-w-[120px]">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-background"
            />
          </div>
        </div>

            {/* Reset button */}
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="gap-2 ml-auto"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Active filters display */}
        {(selectedStatuses.length > 0 || selectedTypes.length > 0 || selectedTechnician || dateFrom || dateTo || debouncedSearch) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {debouncedSearch && (
              <Badge variant="secondary" className="gap-1">
                Search: {debouncedSearch}
              </Badge>
            )}
            {selectedStatuses.map((status) => (
              <Badge key={status} variant="secondary" className="gap-1">
                Status: {REMINDER_STATUS_LABELS[status]}
              </Badge>
            ))}
            {selectedTypes.map((type) => (
              <Badge key={type} variant="secondary" className="gap-1">
                Type: {REMINDER_TYPE_LABELS[type as keyof typeof REMINDER_TYPE_LABELS] || type}
              </Badge>
            ))}
            {dateFrom && (
              <Badge variant="secondary" className="gap-1">
                From: {dateFrom}
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="gap-1">
                To: {dateTo}
              </Badge>
            )}
          </div>
        )}

        {/* Content */}
        <div className="section-card">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="table-row w-full" />
                </div>
              ))}
            </div>
          ) : !reminders || reminders.rows.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No reminders found</h3>
              <p className="text-muted-foreground mb-4">
                {(selectedStatuses.length > 0 || selectedTypes.length > 0 || selectedTechnician || dateFrom || dateTo || debouncedSearch)
                  ? "Try adjusting your filters or search terms"
                  : "Get started by creating your first reminder"
                }
              </p>
              {!(selectedStatuses.length > 0 || selectedTypes.length > 0 || selectedTechnician || dateFrom || dateTo || debouncedSearch) && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  Create New Reminder
                </Button>
              )}
            </div>
          </div>
          ) : (
            <div className="space-y-4">
              <ReminderTable
                reminders={reminders.rows}
                onEdit={handleEditReminder}
                onAssign={handleAssignReminder}
                onSnooze={handleSnoozeReminder}
                onComplete={handleCompleteReminder}
                onCancel={handleCancelReminder}
                onComment={handleCommentReminder}
                onSendNow={handleSendReminderNow}
              />

              {/* Pagination */}
              {reminders.total > reminders.size && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {((page - 1) * reminders.size) + 1} to {Math.min(page * reminders.size, reminders.total)} of {reminders.total} reminders
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {page} of {Math.ceil(reminders.total / reminders.size)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= Math.ceil(reminders.total / reminders.size)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dialogs */}
        <ReminderDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={handleDialogSuccess}
        />

        {editingReminder && (
          <ReminderDialog
            open={true}
            onClose={() => setEditingReminder(null)}
            onSuccess={handleDialogSuccess}
            reminderToEdit={editingReminder}
          />
        )}

        {/* COMMENTED OUT - AssignReminderDialog causing import errors
        {assigningReminder && (
          <AssignReminderDialog
            open={true}
            onClose={() => setAssigningReminder(null)}
            onSuccess={handleDialogSuccess}
            reminder={assigningReminder}
          />
        )}
        */}

        {snoozingReminder && (
          <SnoozeDialog
            open={true}
            onClose={() => setSnoozingReminder(null)}
            onSuccess={handleDialogSuccess}
            reminder={snoozingReminder}
          />
        )}

        {commentingReminder && (
          <CommentDrawer
            open={true}
            onClose={() => setCommentingReminder(null)}
            reminder={commentingReminder}
          />
        )}
      </div>
    </PageShell>
  )
}