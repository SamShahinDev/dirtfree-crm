'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Search, Filter, RotateCcw, Calendar, User, Clock, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow, format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { formatForDisplay } from '@/lib/utils/phone'
import { cn } from '@/lib/utils'
import {
  listReminders,
  getReminder,
  reassignReminder,
  snoozeReminder,
  completeReminder,
  cancelReminder,
  addReminderComment,
  type ListRemindersResult,
  type ReminderRow,
  type ReminderDetail
} from './actions'
import {
  REMINDER_STATUS_LABELS,
  REMINDER_TYPE_LABELS,
  REMINDER_STATUS_COLORS,
  type ReminderStatus,
  type ReminderType,
  type ReminderFilter
} from './schema'

// Filter bar component
function FiltersBar({
  filters,
  onFiltersChange,
  onReset
}: {
  filters: ReminderFilter
  onFiltersChange: (filters: Partial<ReminderFilter>) => void
  onReset: () => void
}) {
  const statusOptions = Object.entries(REMINDER_STATUS_LABELS).map(([value, label]) => ({
    value: value as ReminderStatus,
    label
  }))

  const typeOptions = Object.entries(REMINDER_TYPE_LABELS).map(([value, label]) => ({
    value: value as ReminderType,
    label
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div>
          <Input
            placeholder="Search by customer name, phone, or title..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="w-full"
          />
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <label key={status.value} className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={filters.statuses?.includes(status.value) || false}
                  onCheckedChange={(checked) => {
                    const currentStatuses = filters.statuses || []
                    const newStatuses = checked
                      ? [...currentStatuses, status.value]
                      : currentStatuses.filter(s => s !== status.value)
                    onFiltersChange({ statuses: newStatuses })
                  }}
                />
                <span>{status.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Type Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((type) => (
              <label key={type.value} className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={filters.types?.includes(type.value) || false}
                  onCheckedChange={(checked) => {
                    const currentTypes = filters.types || []
                    const newTypes = checked
                      ? [...currentTypes, type.value]
                      : currentTypes.filter(t => t !== type.value)
                    onFiltersChange({ types: newTypes })
                  }}
                />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Show Snoozed */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showSnoozed"
            checked={filters.showSnoozed || false}
            onCheckedChange={(checked) => onFiltersChange({ showSnoozed: !!checked })}
          />
          <label htmlFor="showSnoozed" className="text-sm font-medium">
            Show snoozed reminders
          </label>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-sm font-medium">From Date</label>
            <Input
              type="date"
              value={filters.from || ''}
              onChange={(e) => onFiltersChange({ from: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium">To Date</label>
            <Input
              type="date"
              value={filters.to || ''}
              onChange={(e) => onFiltersChange({ to: e.target.value })}
            />
          </div>
        </div>

        <Button variant="outline" onClick={onReset} className="w-full">
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset Filters
        </Button>
      </CardContent>
    </Card>
  )
}

// Reminders table component
function RemindersTable({
  reminders,
  onReminderClick
}: {
  reminders: ReminderRow[]
  onReminderClick: (reminder: ReminderRow) => void
}) {
  const getStatusBadge = (status: ReminderStatus) => (
    <Badge className={cn('text-xs', REMINDER_STATUS_COLORS[status])}>
      {REMINDER_STATUS_LABELS[status]}
    </Badge>
  )

  const getTypeBadge = (type: string) => (
    <Badge variant="outline" className="text-xs">
      {REMINDER_TYPE_LABELS[type as ReminderType] || type}
    </Badge>
  )

  const isOverdue = (scheduledDate: string, status: ReminderStatus) => {
    if (status === 'complete' || status === 'canceled') return false
    return new Date(scheduledDate) < new Date() && status !== 'snoozed'
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reminders.map((reminder) => (
            <TableRow
              key={reminder.id}
              className={cn(
                'cursor-pointer hover:bg-muted/50',
                isOverdue(reminder.scheduled_date, reminder.status) && 'bg-red-50 hover:bg-red-100'
              )}
              onClick={() => onReminderClick(reminder)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {isOverdue(reminder.scheduled_date, reminder.status) && (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                  {reminder.title || 'Untitled'}
                </div>
              </TableCell>
              <TableCell>
                <div>
                  {reminder.customer_name || 'Unknown'}
                  {reminder.customer_phone && (
                    <div className="text-xs text-gray-500">
                      {formatForDisplay(reminder.customer_phone)}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>{getTypeBadge(reminder.type)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(reminder.scheduled_date), 'MMM dd, yyyy')}
                </div>
              </TableCell>
              <TableCell>
                {reminder.assigned_to_name ? (
                  <div className="flex items-center gap-1 text-sm">
                    <User className="w-3 h-3" />
                    {reminder.assigned_to_name}
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">Unassigned</span>
                )}
              </TableCell>
              <TableCell>{getStatusBadge(reminder.status)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(reminder.last_activity || reminder.updated_at), { addSuffix: true })}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {reminders.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                No reminders found matching your filters
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  )
}

// Main page component
export default function RemindersPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // State
  const [reminders, setReminders] = useState<ReminderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedReminder, setSelectedReminder] = useState<ReminderDetail | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Filters state from URL
  const [filters, setFilters] = useState<ReminderFilter>({
    search: searchParams.get('search') || '',
    types: searchParams.get('types')?.split(',').filter(Boolean) as ReminderType[] || [],
    statuses: searchParams.get('statuses')?.split(',').filter(Boolean) as ReminderStatus[] || [],
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
    showSnoozed: searchParams.get('showSnoozed') === 'true',
    page: parseInt(searchParams.get('page') || '1'),
    size: parseInt(searchParams.get('size') || '25')
  })

  const debouncedSearch = useDebouncedValue(filters.search, 300)

  // Update URL when filters change
  const updateFiltersInUrl = useCallback((newFilters: ReminderFilter) => {
    const params = new URLSearchParams()

    if (newFilters.search) params.set('search', newFilters.search)
    if (newFilters.types?.length) params.set('types', newFilters.types.join(','))
    if (newFilters.statuses?.length) params.set('statuses', newFilters.statuses.join(','))
    if (newFilters.from) params.set('from', newFilters.from)
    if (newFilters.to) params.set('to', newFilters.to)
    if (newFilters.showSnoozed) params.set('showSnoozed', 'true')
    if (newFilters.page && newFilters.page > 1) params.set('page', newFilters.page.toString())
    if (newFilters.size && newFilters.size !== 25) params.set('size', newFilters.size.toString())

    router.push(`/reminders?${params.toString()}`)
  }, [router])

  // Load reminders
  const loadReminders = useCallback(async () => {
    try {
      setLoading(true)
      const result = await listReminders({
        ...filters,
        search: debouncedSearch
      })
      setReminders(result.rows)
      setTotal(result.total)
    } catch (error) {
      console.error('Failed to load reminders:', error)
      toast.error('Failed to load reminders')
    } finally {
      setLoading(false)
    }
  }, [filters, debouncedSearch])

  // Load reminder detail
  const loadReminderDetail = async (reminderId: string) => {
    try {
      const detail = await getReminder({ id: reminderId })
      setSelectedReminder(detail)
      setSheetOpen(true)
    } catch (error) {
      console.error('Failed to load reminder detail:', error)
      toast.error('Failed to load reminder details')
    }
  }

  const handleFiltersChange = (newFilters: Partial<ReminderFilter>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 } // Reset to page 1 when filters change
    setFilters(updatedFilters)
    updateFiltersInUrl(updatedFilters)
  }

  const handleReset = () => {
    const defaultFilters: ReminderFilter = {
      search: '',
      types: [],
      statuses: [],
      from: '',
      to: '',
      showSnoozed: false,
      page: 1,
      size: 25
    }
    setFilters(defaultFilters)
    updateFiltersInUrl(defaultFilters)
  }

  const handleReminderClick = (reminder: ReminderRow) => {
    loadReminderDetail(reminder.id)
  }

  // Load reminders when filters change
  useEffect(() => {
    loadReminders()
  }, [loadReminders])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reminders Inbox</h1>
          <p className="text-gray-600">
            Manage and track all reminders ({total} total)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <div className="lg:col-span-1">
          <FiltersBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onReset={handleReset}
          />
        </div>

        {/* Reminders Table */}
        <div className="lg:col-span-3">
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <RemindersTable
              reminders={reminders}
              onReminderClick={handleReminderClick}
            />
          )}
        </div>
      </div>

      {/* Reminder Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[90vw] sm:w-[540px] sm:max-w-none">
          <SheetHeader>
            <SheetTitle>
              {selectedReminder?.title || 'Reminder Details'}
            </SheetTitle>
            <SheetDescription>
              Manage this reminder and view its details
            </SheetDescription>
          </SheetHeader>

          {selectedReminder && (
            <div className="mt-6 space-y-6">
              {/* Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="font-medium text-gray-700">Type</label>
                      <div>{REMINDER_TYPE_LABELS[selectedReminder.type as ReminderType]}</div>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">Status</label>
                      <div>
                        <Badge className={cn('text-xs', REMINDER_STATUS_COLORS[selectedReminder.status])}>
                          {REMINDER_STATUS_LABELS[selectedReminder.status]}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">Scheduled Date</label>
                      <div>{format(new Date(selectedReminder.scheduled_date), 'PPP')}</div>
                    </div>
                    <div>
                      <label className="font-medium text-gray-700">Assigned To</label>
                      <div>{selectedReminder.assigned_to_name || 'Unassigned'}</div>
                    </div>
                    {selectedReminder.customer_name && (
                      <div>
                        <label className="font-medium text-gray-700">Customer</label>
                        <div>
                          {selectedReminder.customer_name}
                          {selectedReminder.customer_phone && (
                            <div className="text-gray-500">
                              {formatForDisplay(selectedReminder.customer_phone)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedReminder.origin && (
                      <div>
                        <label className="font-medium text-gray-700">Origin</label>
                        <div>{selectedReminder.origin}</div>
                      </div>
                    )}
                  </div>

                  {selectedReminder.body && (
                    <div>
                      <label className="font-medium text-gray-700">Description</label>
                      <div className="mt-1 p-3 bg-gray-50 rounded text-sm">
                        {selectedReminder.body}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => toast.info('Complete action not yet implemented')}
                  disabled={selectedReminder.status === 'complete'}
                >
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toast.info('Snooze action not yet implemented')}
                  disabled={selectedReminder.status === 'complete'}
                >
                  Snooze
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toast.info('Reassign action not yet implemented')}
                >
                  Reassign
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => toast.info('Cancel action not yet implemented')}
                  disabled={selectedReminder.status === 'complete' || selectedReminder.status === 'canceled'}
                >
                  Cancel
                </Button>
              </div>

              {/* Comments Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Comments</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedReminder.comments.length === 0 ? (
                    <p className="text-gray-500 text-sm">No comments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedReminder.comments.map((comment) => (
                        <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                            <span>{comment.author_name}</span>
                            <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                          </div>
                          <p className="text-sm">{comment.body}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Comment */}
                  <div className="mt-4 pt-4 border-t">
                    <textarea
                      className="w-full p-2 border rounded text-sm"
                      placeholder="Add a comment..."
                      rows={3}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          toast.info('Comment functionality not yet implemented')
                        }
                      }}
                    />
                    <Button size="sm" className="mt-2">
                      Add Comment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}