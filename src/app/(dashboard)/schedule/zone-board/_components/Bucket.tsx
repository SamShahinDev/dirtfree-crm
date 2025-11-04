'use client'

import React from 'react'
import {
  SortableContext,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Plus } from 'lucide-react'

import { getBucketConfig, type BucketKey } from '@/lib/schedule/board'
import type { BucketData } from '../actions'
import { JobCard } from './JobCard'

export interface BucketProps {
  bucket: BucketData
  zone: string | null
  onAssignTech?: (jobId: string) => void
  onMoveToRule?: (jobId: string, bucket: BucketKey) => void
  onMarkInProgress?: (jobId: string) => void
  onMarkComplete?: (jobId: string) => void
  onMarkCancelled?: (jobId: string) => void
  onUnassignTech?: (jobId: string) => void
  onQuickCreate?: (zone: string | null, bucket: BucketKey) => void
  isUnassigned?: boolean
}

export function Bucket({
  bucket,
  zone,
  onAssignTech,
  onMoveToRule,
  onMarkInProgress,
  onMarkComplete,
  onMarkCancelled,
  onUnassignTech,
  onQuickCreate,
  isUnassigned = false
}: BucketProps) {
  const bucketConfig = getBucketConfig(bucket.key)
  const dropId = `${zone || 'unassigned'}-${bucket.key}`

  const {
    setNodeRef,
    isOver,
    active
  } = useDroppable({
    id: dropId,
    data: {
      type: 'bucket',
      zone,
      bucket: bucket.key
    }
  })

  const isDragOver = isOver && active?.data.current?.type === 'job'

  const formatEstimatedTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  // Determine gradient and border color based on bucket type
  const getBucketStyles = () => {
    switch (bucket.key) {
      case 'morning':
        return {
          gradient: 'from-blue-50/80 to-blue-100/40',
          border: 'border-blue-300',
          hoverBorder: 'hover:border-blue-400',
          icon: 'text-blue-600'
        }
      case 'afternoon':
        return {
          gradient: 'from-yellow-50/80 to-yellow-100/40',
          border: 'border-yellow-300',
          hoverBorder: 'hover:border-yellow-400',
          icon: 'text-yellow-600'
        }
      case 'evening':
        return {
          gradient: 'from-purple-50/80 to-purple-100/40',
          border: 'border-purple-300',
          hoverBorder: 'hover:border-purple-400',
          icon: 'text-purple-600'
        }
      default:
        return {
          gradient: 'from-gray-50/80 to-gray-100/40',
          border: 'border-gray-300',
          hoverBorder: 'hover:border-gray-400',
          icon: 'text-gray-600'
        }
    }
  }

  const bucketStyles = getBucketStyles()

  return (
    <div className="space-y-2">
      {/* Enhanced Bucket Header with gradient */}
      <div className={`flex items-center justify-between px-3 py-2.5 bg-gradient-to-r ${bucketStyles.gradient} rounded-lg border ${bucketStyles.border} shadow-sm`}>
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-white/80 shadow-sm">
            <Clock className={`h-4 w-4 ${bucketStyles.icon}`} />
          </div>
          <h4 className="font-bold text-sm text-gray-900">{bucket.label}</h4>
          {bucket.count > 0 && (
            <Badge variant="secondary" className="text-xs font-semibold shadow-sm">
              {bucket.count}
            </Badge>
          )}
        </div>

        {/* Estimated time indicator */}
        {bucket.estimatedMinutes > 0 && (
          <div className="text-xs font-semibold text-gray-700 bg-white/80 px-2.5 py-1 rounded-md border shadow-sm">
            ~{formatEstimatedTime(bucket.estimatedMinutes)}
          </div>
        )}
      </div>

      {/* Drop Zone with enhanced styling */}
      <Card
        ref={setNodeRef}
        className={`
          min-h-[120px] p-3 transition-all duration-300
          shadow-sm hover:shadow-md
          ${bucketStyles.border} ${bucketStyles.hoverBorder}
          ${isDragOver ? 'bg-primary/10 border-primary ring-2 ring-primary/20 shadow-lg transform scale-[1.02]' : 'bg-white'}
          ${bucket.jobs.length === 0 ? 'border-dashed border-2' : ''}
        `}
      >
        {/* Enhanced quick create button for empty buckets */}
        {bucket.jobs.length === 0 && !isUnassigned && !isDragOver && (
          <div className="flex flex-col items-center justify-center h-24">
            <button
              onClick={() => onQuickCreate?.(zone, bucket.key)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg
                bg-gradient-to-r ${bucketStyles.gradient}
                border-2 ${bucketStyles.border}
                hover:shadow-md hover:scale-105
                transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary
                group
              `}
              aria-label={`Create new job in ${bucket.label}`}
            >
              <Plus className={`h-4 w-4 ${bucketStyles.icon} group-hover:rotate-90 transition-transform duration-200`} />
              <span className="text-sm font-semibold text-gray-700">Add Job</span>
            </button>
          </div>
        )}

        {/* Enhanced empty state for unassigned */}
        {bucket.jobs.length === 0 && isUnassigned && !isDragOver && (
          <div className="flex flex-col items-center justify-center h-24">
            <div className="p-3 rounded-full bg-gray-100 mb-2">
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <span className="text-sm font-medium text-gray-500">No unassigned jobs</span>
          </div>
        )}

        {/* Enhanced drop zone indicator when dragging */}
        {bucket.jobs.length === 0 && isDragOver && (
          <div className="flex flex-col items-center justify-center h-24">
            <div className={`p-3 rounded-full ${bucketStyles.gradient} bg-gradient-to-br mb-2 border-2 ${bucketStyles.border} shadow-lg animate-pulse`}>
              <Clock className={`h-5 w-5 ${bucketStyles.icon}`} />
            </div>
            <div className="text-sm font-bold text-primary">Drop job here</div>
            <div className="text-xs text-primary/80 font-medium">
              {zone ? `Move to ${zone} ${bucket.label}` : 'Unassign job'}
            </div>
          </div>
        )}

        {/* Job Cards */}
        {bucket.jobs.length > 0 && (
          <SortableContext
            items={bucket.jobs.map(job => job.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {bucket.jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onAssignTech={onAssignTech}
                  onMoveToRule={onMoveToRule}
                  onMarkInProgress={onMarkInProgress}
                  onMarkComplete={onMarkComplete}
                  onMarkCancelled={onMarkCancelled}
                  onUnassignTech={onUnassignTech}
                />
              ))}
            </div>
          </SortableContext>
        )}

        {/* Enhanced drop indicator overlay */}
        {isDragOver && bucket.jobs.length > 0 && (
          <div className="absolute inset-0 border-2 border-primary border-dashed rounded-md bg-primary/10 backdrop-blur-sm flex items-center justify-center z-10 animate-pulse">
            <div className="bg-white/95 px-4 py-2 rounded-lg shadow-lg border-2 border-primary">
              <div className="text-primary font-bold text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Drop to move here
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Enhanced bucket stats */}
      {bucket.jobs.length > 0 && (
        <div className={`px-3 py-1.5 rounded-md bg-gradient-to-r ${bucketStyles.gradient} border ${bucketStyles.border}`}>
          <div className="flex justify-between items-center text-xs font-medium text-gray-700">
            <span>{bucket.count} job{bucket.count === 1 ? '' : 's'}</span>
            {bucket.estimatedMinutes > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>~{formatEstimatedTime(bucket.estimatedMinutes)} total</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}