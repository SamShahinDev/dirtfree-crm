'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'

import {
  Card,
  CardContent
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

import {
  MoreHorizontal,
  GripVertical,
  ExternalLink,
  User,
  Clock,
  MapPin,
  Phone,
  CheckCircle,
  XCircle,
  PlayCircle,
  UserPlus
} from 'lucide-react'

import { getStatusColor, type JobStatus } from '@/types/job'
import { formatForDisplay } from '@/lib/utils/phone'
import { formatTimeWindow, type BucketKey } from '@/lib/schedule/board'
import type { JobListItem } from '../actions'

export interface JobCardProps {
  job: JobListItem
  isDragging?: boolean
  onAssignTech?: (jobId: string) => void
  onMoveToRule?: (jobId: string, bucket: BucketKey) => void
  onMarkInProgress?: (jobId: string) => void
  onMarkComplete?: (jobId: string) => void
  onMarkCancelled?: (jobId: string) => void
  onUnassignTech?: (jobId: string) => void
}

export function JobCard({
  job,
  isDragging = false,
  onAssignTech,
  onMoveToRule,
  onMarkInProgress,
  onMarkComplete,
  onMarkCancelled,
  onUnassignTech
}: JobCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableDragging
  } = useSortable({
    id: job.id,
    data: {
      type: 'job',
      job
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || sortableDragging ? 0.5 : 1
  }

  const isTerminal = job.status === 'completed' || job.status === 'cancelled'
  const canDrag = !isTerminal

  const getStatusBadgeVariant = (status: JobStatus) => {
    const color = getStatusColor(status)
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

  const getTechnicianInitials = (name?: string | null) => {
    if (!name) return 'UN'
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatAddress = () => {
    const parts = []
    if (job.customer.city) parts.push(job.customer.city)
    if (job.customer.state) parts.push(job.customer.state)
    return parts.join(', ')
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`
        cursor-pointer transition-all duration-300
        shadow-sm hover:shadow-lg hover:scale-[1.02]
        border-l-4
        ${isTerminal
          ? 'opacity-70 bg-muted/50 border-l-gray-300'
          : 'bg-white border-l-blue-500 hover:border-l-blue-600'
        }
        ${sortableDragging ? 'shadow-2xl ring-2 ring-primary/30 scale-105' : ''}
      `}
    >
      <CardContent className="p-3.5">
        <div className="space-y-2">
          {/* Header with drag handle and menu */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {canDrag && (
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing p-1.5 -m-1 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md transition-colors"
                  aria-label="Drag to move job"
                >
                  <GripVertical className="h-4 w-4" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-sm truncate text-gray-900" title={job.customer.name}>
                  {job.customer.name}
                </h4>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant={getStatusBadgeVariant(job.status as JobStatus)} className="text-xs font-semibold shadow-sm">
                    {getStatusDisplay(job.status)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  aria-label={`Actions for ${job.customer.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/jobs?jobId=${job.id}`} className="flex items-center">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Job
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/customers/${job.customerId}`} className="flex items-center">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Customer
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {/* Assignment actions */}
                {!isTerminal && (
                  <>
                    <DropdownMenuItem onClick={() => onAssignTech?.(job.id)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {job.technician ? 'Reassign Tech' : 'Assign Tech'}
                    </DropdownMenuItem>

                    {job.technician && (
                      <DropdownMenuItem onClick={() => onUnassignTech?.(job.id)}>
                        <User className="mr-2 h-4 w-4" />
                        Unassign Tech
                      </DropdownMenuItem>
                    )}

                    {/* Move to bucket submenu */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Clock className="mr-2 h-4 w-4" />
                        Move to Time
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem onClick={() => onMoveToRule?.(job.id, 'morning')}>
                          Morning (9-11 AM)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMoveToRule?.(job.id, 'afternoon')}>
                          Afternoon (1-3 PM)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMoveToRule?.(job.id, 'evening')}>
                          Evening (5-7 PM)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMoveToRule?.(job.id, 'any')}>
                          Anytime
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />

                    {/* Status actions */}
                    {job.status === 'scheduled' && (
                      <DropdownMenuItem onClick={() => onMarkInProgress?.(job.id)}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Mark In Progress
                      </DropdownMenuItem>
                    )}

                    {(job.status === 'scheduled' || job.status === 'in_progress') && (
                      <>
                        <DropdownMenuItem onClick={() => onMarkComplete?.(job.id)}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Mark Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onMarkCancelled?.(job.id)}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel Job
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Contact Info */}
          <div className="space-y-1.5">
            {job.customer.phone_e164 && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <Phone className="h-3.5 w-3.5 text-green-600" />
                <span className="font-mono font-medium">
                  {formatForDisplay(job.customer.phone_e164)}
                </span>
              </div>
            )}

            {formatAddress() && (
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <MapPin className="h-3.5 w-3.5 text-red-600" />
                <span className="truncate font-medium" title={formatAddress()}>
                  {formatAddress()}
                </span>
              </div>
            )}
          </div>

          {/* Technician Assignment */}
          {job.technician && (
            <div className="flex items-center gap-2 p-2 bg-gradient-to-r from-blue-50 to-transparent rounded-md border border-blue-100">
              <Avatar className="h-7 w-7 border-2 border-blue-200 shadow-sm">
                <AvatarFallback className="text-xs font-bold bg-blue-500 text-white">
                  {getTechnicianInitials(job.technician.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-semibold text-gray-900 truncate" title={job.technician.display_name || 'Unknown'}>
                {job.technician.display_name || 'Unknown'}
              </span>
            </div>
          )}

          {/* Time Window */}
          <div className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-md">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-medium text-gray-700">
              {formatTimeWindow(job.scheduledTimeStart, job.scheduledTimeEnd)}
            </span>
          </div>

          {/* Description */}
          {job.description && (
            <div className="text-xs text-muted-foreground">
              <p className="line-clamp-2" title={job.description}>
                {job.description}
              </p>
            </div>
          )}

          {/* Terminal job indicator */}
          {isTerminal && (
            <div className="pt-2 border-t border-gray-200">
              <Badge variant="outline" className="text-xs font-semibold bg-gray-100 shadow-sm">
                Read Only
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}