'use client'

import React, { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable'
import { toast } from 'sonner'

import { AssignTechInline } from './AssignTechInline'
import { ZoneColumn } from './ZoneColumn'
import { JobCard } from './JobCard'

import { moveCard, reorderInBucket } from '../actions'
import { bucketForTimes, type BucketKey } from '@/lib/schedule/board'
import type { ZoneBoardData, JobListItem } from '../actions'

export interface ZoneBoardProps {
  data: ZoneBoardData
  onRefresh: () => void
  onQuickCreate: (zone: string | null, bucket: BucketKey) => void
  onMarkInProgress?: (jobId: string) => void
  onMarkComplete?: (jobId: string) => void
  onMarkCancelled?: (jobId: string) => void
  onUnassignTech?: (jobId: string) => void
}

export function ZoneBoard({
  data,
  onRefresh,
  onQuickCreate,
  onMarkInProgress,
  onMarkComplete,
  onMarkCancelled,
  onUnassignTech
}: ZoneBoardProps) {
  const [activeJob, setActiveJob] = useState<JobListItem | null>(null)
  const [assignTechJobId, setAssignTechJobId] = useState<string | null>(null)

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event

    if (active.data.current?.type === 'job') {
      setActiveJob(active.data.current.job)
    }
  }

  const handleDragOver = (_event: DragOverEvent) => {
    // Optional: Handle drag over events for visual feedback
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    setActiveJob(null)

    if (!over || !active.data.current?.job) {
      return
    }

    const job = active.data.current.job as JobListItem
    // const overId = over.id as string

    // Don't allow moving terminal jobs
    if (job.status === 'completed' || job.status === 'cancelled') {
      toast.error('Cannot move completed or cancelled jobs')
      return
    }

    // Handle drop on bucket
    if (over.data.current?.type === 'bucket') {
      const targetZone = over.data.current.zone
      const targetBucket = over.data.current.bucket as BucketKey

      // Don't move if already in the same zone and bucket
      const currentBucket = bucketForTimes(job.scheduledTimeStart, job.scheduledTimeEnd)
      if (job.zone === targetZone && currentBucket === targetBucket) {
        return
      }

      try {
        const response = await moveCard({
          jobId: job.id,
          toZone: targetZone,
          toBucket: targetBucket
        })

        if (!response.ok) {
          if (response.error === 'conflict') {
            toast.error('Cannot move: scheduling conflict detected')
          } else {
            throw new Error(response.error || 'Failed to move job')
          }
          return
        }

        toast.success('Job moved successfully')
        onRefresh()
      } catch (error) {
        console.error('Move job error:', error)
        toast.error('Failed to move job')
      }

      return
    }

    // Handle drop on another job (reordering)
    if (over.data.current?.type === 'job') {
      const overJob = over.data.current.job as JobListItem

      // Only reorder if in the same zone and bucket
      const activeBucket = bucketForTimes(job.scheduledTimeStart, job.scheduledTimeEnd)
      const overBucket = bucketForTimes(overJob.scheduledTimeStart, overJob.scheduledTimeEnd)

      if (job.zone !== overJob.zone || activeBucket !== overBucket) {
        return
      }

      if (job.id === overJob.id) {
        return
      }

      try {
        // Determine if we're inserting before or after the target job
        const response = await reorderInBucket({
          jobId: job.id,
          prevId: job.position < overJob.position ? overJob.id : undefined,
          nextId: job.position > overJob.position ? overJob.id : undefined
        })

        if (!response.ok) {
          throw new Error(response.error || 'Failed to reorder job')
        }

        onRefresh()
      } catch (error) {
        console.error('Reorder job error:', error)
        toast.error('Failed to reorder job')
      }
    }
  }

  const handleAssignTech = (jobId: string) => {
    setAssignTechJobId(jobId)
  }

  const handleMoveToRule = async (jobId: string, bucket: BucketKey) => {
    const job = data.columns
      .flatMap(col => col.buckets)
      .flatMap(bucket => bucket.jobs)
      .find(j => j.id === jobId)

    if (!job) return

    const currentBucket = bucketForTimes(job.scheduledTimeStart, job.scheduledTimeEnd)

    if (currentBucket === bucket) {
      toast.info('Job is already in this time bucket')
      return
    }

    try {
      const response = await moveCard({
        jobId,
        toZone: job.zone,
        toBucket: bucket
      })

      if (!response.ok) {
        if (response.error === 'conflict') {
          toast.error('Cannot move: scheduling conflict detected')
        } else {
          throw new Error(response.error || 'Failed to move job')
        }
        return
      }

      toast.success(`Job moved to ${bucket} time slot`)
      onRefresh()
    } catch (error) {
      console.error('Move to bucket error:', error)
      toast.error('Failed to move job')
    }
  }

  const handleAssignTechSuccess = () => {
    setAssignTechJobId(null)
    onRefresh()
  }

  return (
    <div className="w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Zone Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {data.columns.map((column) => (
            <ZoneColumn
              key={column.zone || 'unassigned'}
              column={column}
              onAssignTech={handleAssignTech}
              onMoveToRule={handleMoveToRule}
              onMarkInProgress={onMarkInProgress}
              onMarkComplete={onMarkComplete}
              onMarkCancelled={onMarkCancelled}
              onUnassignTech={onUnassignTech}
              onQuickCreate={onQuickCreate}
            />
          ))}
        </div>

        {/* Enhanced Drag Overlay with shadow and animation */}
        <DragOverlay>
          {activeJob ? (
            <div className="rotate-3 scale-110 transition-transform duration-200 drop-shadow-2xl">
              <div className="ring-4 ring-primary/30 rounded-lg">
                <JobCard
                  job={activeJob}
                  isDragging={true}
                />
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Assign Tech Dialog */}
      {assignTechJobId && (
        <AssignTechInline
          jobId={assignTechJobId}
          currentTechId={
            data.columns
              .flatMap(col => col.buckets)
              .flatMap(bucket => bucket.jobs)
              .find(j => j.id === assignTechJobId)?.technicianId
          }
          jobZone={
            data.columns
              .flatMap(col => col.buckets)
              .flatMap(bucket => bucket.jobs)
              .find(j => j.id === assignTechJobId)?.zone
          }
          onSuccess={handleAssignTechSuccess}
        >
          <div />
        </AssignTechInline>
      )}

      {/* Accessibility announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {activeJob && (
          <span>
            Dragging {activeJob.customer.name}&apos;s job.
            Use arrow keys to move between zones and time buckets,
            then press Space to drop.
          </span>
        )}
      </div>

      {/* Reduced motion styles */}
      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          [data-dnd-context] * {
            transition: none !important;
            animation: none !important;
          }
        }

        /* Focus styles for drag handles */
        [data-dnd-sortable-handle]:focus-visible {
          outline: 2px solid hsl(var(--ring));
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Drop zone hover styles */
        [data-dnd-droppable]:hover {
          background-color: hsl(var(--muted) / 0.5);
        }

        [data-dnd-droppable][data-dnd-over="true"] {
          background-color: hsl(var(--primary) / 0.1);
          border-color: hsl(var(--primary));
        }

        /* Drag overlay styles */
        [data-dnd-drag-overlay] {
          transform-origin: center;
          z-index: 999;
        }
      `}</style>
    </div>
  )
}