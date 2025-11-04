'use client'

import { useState } from 'react'
import Link from 'next/link'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import {
  MoreHorizontal,
  Edit,
  UserPlus,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Send
} from 'lucide-react'

import { formatForDisplay } from '@/lib/utils/phone'
import { getStatusColor, canTransition, type JobStatus } from '@/types/job'
import { OnTheWayButton } from '@/components/shared/OnTheWayButton'
import { AssignTechnicianDialog } from './AssignTechnicianDialog'
import { StatusMenu } from './StatusMenu'
import { CompleteJobDialog } from './CompleteJobDialog'

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
  invoiceUrl?: string | null
  createdAt: string
  updatedAt: string
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

interface JobsTableProps {
  jobs: JobData[]
  technicians: Technician[]
  loading: boolean
  onRefresh: () => void
  page: number
  pageSize: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function JobsTable({
  jobs,
  technicians,
  loading,
  onRefresh,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange
}: JobsTableProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<JobData | null>(null)

  const handleAssignTechnician = (job: JobData) => {
    setSelectedJob(job)
    setAssignDialogOpen(true)
  }

  const handleChangeStatus = (job: JobData) => {
    setSelectedJob(job)
    setStatusMenuOpen(true)
  }

  const handleCompleteJob = (job: JobData) => {
    setSelectedJob(job)
    setCompleteDialogOpen(true)
  }

  const handleSuccess = () => {
    onRefresh()
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—'
    return new Date(dateString).toLocaleDateString()
  }

  const formatTime = (timeString: string | null) => {
    if (!timeString) return ''
    return timeString
  }

  const formatTimeWindow = (start: string | null, end: string | null) => {
    if (!start && !end) return '—'
    if (start && end) return `${formatTime(start)} - ${formatTime(end)}`
    if (start) return `From ${formatTime(start)}`
    if (end) return `Until ${formatTime(end)}`
    return '—'
  }

  const getStatusBadgeVariant = (status: string) => {
    const color = getStatusColor(status as JobStatus)
    switch (color) {
      case 'blue': return 'default'
      case 'yellow': return 'secondary'
      case 'green': return 'default'
      case 'red': return 'destructive'
      default: return 'outline'
    }
  }

  const getStatusDisplay = (status: string) => {
    return status.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  const getZoneDisplay = (zone: string | null) => {
    if (!zone) return '—'
    return zone === 'Central' ? 'Central' : `Zone ${zone}`
  }

  const isOverdue = (job: JobData) => {
    if (!job.scheduledDate || job.status === 'completed' || job.status === 'cancelled') {
      return false
    }

    const today = new Date()
    const scheduledDate = new Date(job.scheduledDate)
    today.setHours(0, 0, 0, 0)
    scheduledDate.setHours(0, 0, 0, 0)

    return scheduledDate < today
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <ClipboardList className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No jobs found</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Try adjusting your search or filters
        </p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Zone</TableHead>
            <TableHead>Technician</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time Window</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[50px]">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id} className={isOverdue(job) ? 'bg-red-50' : ''}>
              <TableCell>
                <div>
                  <div className="font-medium">{job.customer?.name || 'Unknown Customer'}</div>
                  {job.customer?.phone_e164 && (
                    <div className="text-sm text-muted-foreground font-mono">
                      {formatForDisplay(job.customer.phone_e164)}
                    </div>
                  )}
                  {job.customer?.city && job.customer?.state && (
                    <div className="text-sm text-muted-foreground">
                      {job.customer.city}, {job.customer.state}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(job.status)}>
                    {getStatusDisplay(job.status)}
                  </Badge>
                  {isOverdue(job) && (
                    <Badge variant="destructive" className="text-xs">
                      Overdue
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {job.zone ? (
                  <Badge variant="outline">
                    {getZoneDisplay(job.zone)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {job.technician ? (
                  <div className="flex items-center gap-2">
                    <span>{job.technician.display_name || 'Unknown'}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {formatDate(job.scheduledDate)}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {formatTimeWindow(job.scheduledTimeStart, job.scheduledTimeEnd)}
                </span>
              </TableCell>
              <TableCell>
                <div className="max-w-[200px]">
                  {job.description ? (
                    <span className="text-sm truncate block" title={job.description}>
                      {job.description}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {job.invoiceUrl && (
                    <a
                      href={job.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                    >
                      Invoice <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={`Actions for ${job.customer?.name || 'job'}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleAssignTechnician(job)}
                      disabled={job.status === 'completed' || job.status === 'cancelled'}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Assign Technician
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Job
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <div className="w-full">
                        <OnTheWayButton
                          jobId={job.id}
                          customerName={job.customer?.name}
                          customerPhone={job.customer?.phone_e164}
                          jobStatus={job.status}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start p-0 h-auto font-normal text-sm"
                        />
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleChangeStatus(job)}
                      disabled={job.status === 'completed' || job.status === 'cancelled'}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Change Status
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleCompleteJob(job)}
                      disabled={
                        job.status === 'completed' ||
                        job.status === 'cancelled' ||
                        !canTransition(job.status as JobStatus, 'completed')
                      }
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Complete Job
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/customers/${job.customerId}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Customer
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {((page - 1) * pageSize) + 1} to{' '}
            {Math.min(page * pageSize, total)} of{' '}
            {total} jobs
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="text-sm">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || loading}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AssignTechnicianDialog
        job={selectedJob}
        technicians={technicians}
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        onSuccess={handleSuccess}
      />

      <StatusMenu
        job={selectedJob}
        open={statusMenuOpen}
        onOpenChange={setStatusMenuOpen}
        onSuccess={handleSuccess}
      />

      <CompleteJobDialog
        job={selectedJob}
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        onSuccess={handleSuccess}
      />
    </>
  )
}