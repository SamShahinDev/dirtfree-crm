'use client'

import { useRef, useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import type {
  EventDropInfo,
  EventResizeInfo,
  DateSelectInfo,
  EventClickInfo,
  EventContentArg,
  ResourceLabelContentArg
} from '@fullcalendar/core'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { User } from 'lucide-react'

// FullCalendar v6+ includes styles automatically with components

import { getStatusColor, type JobStatus } from '@/types/job'
import type { JobEvent, TechnicianResource } from '../../actions'
import { updateEventTime, assignEventTechnician, checkConflicts } from '../../actions'
import { ConflictConfirmDialog, type ConflictJob } from './ConflictConfirmDialog'

export interface CalendarViewProps {
  view: 'timeGridWeek' | 'timeGridDay' | 'resourceTimeGridWeek' | 'resourceTimeGridDay'
  events: JobEvent[]
  resources: TechnicianResource[]
  onEventClick?: (event: JobEvent) => void
  onDateSelect?: (selectInfo: DateSelectInfo) => void
  onEventsChange?: () => void
  initialDate?: Date
  businessHours?: {
    startTime: string
    endTime: string
  }
}

// Helper function to get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Helper function to extract zone from resource title
function extractZoneFromTitle(title: string): string | null {
  const match = title.match(/\((.*?)\)/)
  return match ? match[1] : null
}

export function CalendarView({
  view,
  events,
  resources,
  onEventClick,
  onDateSelect,
  onEventsChange,
  initialDate = new Date(),
  businessHours = { startTime: '07:00', endTime: '18:00' }
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null)

  // Custom resource label renderer with avatars
  const renderResourceLabel = (info: ResourceLabelContentArg) => {
    const isUnassigned = info.resource.id === 'unassigned'
    const displayName = info.resource.title.split(' (')[0] // Remove zone from title
    const zone = extractZoneFromTitle(info.resource.title)
    const initials = getInitials(displayName)

    return (
      <div className="flex items-center gap-2 py-1">
        <Avatar className="h-7 w-7 border border-border">
          {isUnassigned ? (
            <AvatarFallback className="bg-muted text-muted-foreground">
              <User className="h-4 w-4" />
            </AvatarFallback>
          ) : (
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-400 text-white text-xs font-semibold">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{displayName}</div>
          {zone && (
            <div className="text-xs text-muted-foreground truncate">{zone}</div>
          )}
        </div>
      </div>
    )
  }

  // Conflict dialog state
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean
    conflicts: ConflictJob[]
    message?: string
    onConfirm: () => void
    onCancel: () => void
  }>({
    open: false,
    conflicts: [],
    onConfirm: () => {},
    onCancel: () => {}
  })

  // Custom event content renderer
  const renderEventContent = (eventInfo: EventContentArg) => {
    const { event } = eventInfo
    // const status = event.extendedProps.status as JobStatus
    const customerName = event.extendedProps.customerName
    const zone = event.extendedProps.zone

    return (
      <div className="fc-event-content-wrapper">
        <div className="fc-event-title-container">
          <div className="fc-event-title font-medium text-xs">
            {customerName}
          </div>
          {zone && (
            <div className="fc-event-zone text-xs opacity-75">
              {zone === 'Central' ? 'Central' : `Zone ${zone}`}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Handle event drop (drag and drop)
  const handleEventDrop = async (info: EventDropInfo) => {
    const { event, revert } = info

    try {
      // Check if this is a terminal job
      const status = event.extendedProps.status as JobStatus
      if (status === 'completed' || status === 'cancelled') {
        toast.error('Cannot move completed or cancelled jobs')
        revert()
        return
      }

      const newStart = event.start!.toISOString()
      const newEnd = event.end!.toISOString()
      const newResourceId = event.getResources()[0]?.id

      // If resource changed, assign new technician
      if (newResourceId && newResourceId !== info.oldResource?.id) {
        // Check for conflicts with new technician
        const conflictResult = await checkConflicts({
          technicianId: newResourceId,
          start: newStart,
          end: newEnd,
          excludeJobId: event.id
        })

        if (!conflictResult.ok) {
          // Show conflict confirmation dialog
          setConflictDialog({
            open: true,
            conflicts: conflictResult.data?.conflicts || [],
            message: conflictResult.error,
            onConfirm: async () => {
              // Proceed with the assignment despite conflicts
              const assignResult = await assignEventTechnician({
                jobId: event.id,
                technicianId: newResourceId
              })

              if (!assignResult.ok) {
                toast.error(assignResult.error || 'Failed to assign technician')
                revert()
                return
              }

              // Update event time
              const timeResult = await updateEventTime({
                jobId: event.id,
                start: newStart,
                end: newEnd
              })

              if (!timeResult.ok) {
                toast.error(timeResult.error || 'Failed to update event time')
                revert()
                return
              }

              toast.success('Event updated successfully')
              onEventsChange?.()
            },
            onCancel: () => {
              revert()
            }
          })
          return
        }

        // Assign new technician
        const assignResult = await assignEventTechnician({
          jobId: event.id,
          technicianId: newResourceId
        })

        if (!assignResult.ok) {
          toast.error(assignResult.error || 'Failed to assign technician')
          revert()
          return
        }
      }

      // Update event time
      const timeResult = await updateEventTime({
        jobId: event.id,
        start: newStart,
        end: newEnd
      })

      if (!timeResult.ok) {
        toast.error(timeResult.error || 'Failed to update event time')
        revert()
        return
      }

      toast.success('Event updated successfully')
      onEventsChange?.()
    } catch (error) {
      console.error('Event drop error:', error)
      toast.error('Failed to update event')
      revert()
    }
  }

  // Handle event resize
  const handleEventResize = async (info: EventResizeInfo) => {
    const { event, revert } = info

    try {
      // Check if this is a terminal job
      const status = event.extendedProps.status as JobStatus
      if (status === 'completed' || status === 'cancelled') {
        toast.error('Cannot resize completed or cancelled jobs')
        revert()
        return
      }

      const newStart = event.start!.toISOString()
      const newEnd = event.end!.toISOString()
      const resourceId = event.getResources()[0]?.id

      // Check for conflicts if job has a technician
      if (resourceId) {
        const conflictResult = await checkConflicts({
          technicianId: resourceId,
          start: newStart,
          end: newEnd,
          excludeJobId: event.id
        })

        if (!conflictResult.ok) {
          // Show conflict confirmation dialog
          setConflictDialog({
            open: true,
            conflicts: conflictResult.data?.conflicts || [],
            message: conflictResult.error,
            onConfirm: async () => {
              // Proceed with the resize despite conflicts
              const result = await updateEventTime({
                jobId: event.id,
                start: newStart,
                end: newEnd
              })

              if (!result.ok) {
                toast.error(result.error || 'Failed to resize event')
                revert()
                return
              }

              toast.success('Event resized successfully')
              onEventsChange?.()
            },
            onCancel: () => {
              revert()
            }
          })
          return
        }
      }

      // Update event time
      const result = await updateEventTime({
        jobId: event.id,
        start: newStart,
        end: newEnd
      })

      if (!result.ok) {
        toast.error(result.error || 'Failed to resize event')
        revert()
        return
      }

      toast.success('Event resized successfully')
      onEventsChange?.()
    } catch (error) {
      console.error('Event resize error:', error)
      toast.error('Failed to resize event')
      revert()
    }
  }

  // Handle event click
  const handleEventClick = (info: EventClickInfo) => {
    const eventData: JobEvent = {
      id: info.event.id,
      resourceId: info.event.getResources()[0]?.id || null,
      start: info.event.start!.toISOString(),
      end: info.event.end!.toISOString(),
      title: info.event.title,
      extendedProps: info.event.extendedProps
    }

    onEventClick?.(eventData)
  }

  // Get event styling based on status
  const getEventClassNames = (info: { event: { extendedProps: { status: JobStatus } } }) => {
    const status = info.event.extendedProps.status as JobStatus
    const isTerminal = status === 'completed' || status === 'cancelled'

    return [
      'fc-custom-event',
      `fc-event-${status}`,
      isTerminal ? 'fc-event-terminal' : 'fc-event-active'
    ]
  }

  // Format calendar resources
  const formattedResources = [
    // Add unassigned pseudo-resource
    {
      id: 'unassigned',
      title: 'Unassigned',
      eventColor: 'hsl(var(--muted))'
    },
    ...resources.map(tech => ({
      id: tech.id,
      title: tech.displayName + (tech.zone ? ` (${tech.zone === 'Central' ? 'Central' : `Zone ${tech.zone}`})` : ''),
      eventColor: 'hsl(var(--primary))'
    }))
  ]

  // Format calendar events
  const formattedEvents = events.map(event => {
    const status = event.extendedProps.status as JobStatus
    const statusColor = getStatusColor(status)

    let backgroundColor = 'hsl(var(--primary))'
    let borderColor = 'hsl(var(--primary))'
    let textColor = 'hsl(var(--primary-foreground))'

    switch (statusColor) {
      case 'blue':
        backgroundColor = 'hsl(217 91% 60%)'
        borderColor = 'hsl(217 91% 50%)'
        textColor = 'white'
        break
      case 'yellow':
        backgroundColor = 'hsl(48 96% 53%)'
        borderColor = 'hsl(48 96% 43%)'
        textColor = 'hsl(222.2 84% 4.9%)'
        break
      case 'green':
        backgroundColor = 'hsl(142 71% 45%)'
        borderColor = 'hsl(142 71% 35%)'
        textColor = 'white'
        break
      case 'red':
        backgroundColor = 'hsl(0 84% 60%)'
        borderColor = 'hsl(0 84% 50%)'
        textColor = 'white'
        break
    }

    return {
      id: event.id,
      resourceId: event.resourceId || 'unassigned',
      start: event.start,
      end: event.end,
      title: event.title,
      backgroundColor,
      borderColor,
      textColor,
      extendedProps: event.extendedProps,
      editable: status !== 'completed' && status !== 'cancelled'
    }
  })

  // Update calendar view when view prop changes
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi()
      calendarApi.changeView(view)
    }
  }, [view])

  return (
    <div className="calendar-container">
      <FullCalendar
        ref={calendarRef}
        plugins={[resourceTimeGridPlugin, interactionPlugin, timeGridPlugin, dayGridPlugin]}
        initialView={view}
        initialDate={initialDate}
        headerToolbar={false} // We'll handle toolbar externally
        height="auto"
        aspectRatio={1.8}
        slotMinTime={businessHours.startTime}
        slotMaxTime={businessHours.endTime}
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        snapDuration="00:15:00"
        allDaySlot={false}
        nowIndicator={true}
        scrollTime="08:00:00"

        // Resource configuration
        resources={view.includes('resource') ? formattedResources : undefined}
        resourceOrder="title"
        resourceLabelContent={renderResourceLabel}

        // Events
        events={formattedEvents}
        eventContent={renderEventContent}
        eventClassNames={getEventClassNames}

        // Interaction
        editable={true}
        droppable={true}
        selectable={true}
        selectMirror={true}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
        select={onDateSelect}

        // Styling
        dayMaxEvents={false}
        eventDisplay="block"
        eventMinHeight={25}

        // Business hours
        businessHours={{
          startTime: businessHours.startTime,
          endTime: businessHours.endTime,
          daysOfWeek: [1, 2, 3, 4, 5, 6] // Monday to Saturday
        }}

        // Accessibility
        eventDidMount={(info) => {
          const { event, el } = info
          const status = event.extendedProps.status
          const customerName = event.extendedProps.customerName
          const zone = event.extendedProps.zone

          // Add ARIA labels
          el.setAttribute('role', 'button')
          el.setAttribute('tabindex', '0')
          el.setAttribute('aria-label',
            `${customerName} job, ${status} status${zone ? `, ${zone} zone` : ''}`
          )

          // Add keyboard navigation
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleEventClick({ event } as EventClickInfo)
            }
          })
        }}
      />

      <style jsx global>{`
        .calendar-container .fc {
          font-family: var(--font-sans);
        }

        /* Softer grid borders */
        .calendar-container .fc-theme-standard td,
        .calendar-container .fc-theme-standard th {
          border-color: rgb(229 231 235); /* gray-200 */
        }

        /* Polished column headers */
        .calendar-container .fc-col-header {
          background: linear-gradient(to bottom right, rgb(239 246 255), white); /* blue-50 to white */
          border-bottom: 2px solid rgb(219 234 254); /* blue-100 */
        }

        .calendar-container .fc-col-header-cell {
          font-weight: 600;
          color: hsl(var(--foreground));
          padding: 12px 8px;
        }

        /* Today column styling - subtle blue with left border */
        .calendar-container .fc-day-today {
          background-color: rgb(239 246 255 / 0.3) !important; /* blue-50 with opacity */
          border-left: 2px solid rgb(59 130 246) !important; /* blue-500 */
        }

        .calendar-container .fc-timegrid-slot-label {
          color: hsl(var(--muted-foreground));
          font-size: 0.875rem;
          font-weight: 500;
        }

        .calendar-container .fc-resource-timeline-divider {
          background-color: rgb(229 231 235); /* gray-200 */
        }

        /* Resource columns */
        .calendar-container .fc-resource {
          border-color: rgb(229 231 235); /* gray-200 */
        }

        /* Enhanced resource column headers with gradient */
        .calendar-container .fc-resource .fc-resource-title {
          font-weight: 600;
          color: hsl(var(--foreground));
          padding: 12px;
          background: linear-gradient(to bottom right, rgb(239 246 255), white);
          border-bottom: 1px solid rgb(219 234 254);
        }

        /* Resource label content wrapper */
        .calendar-container .fc-resource .fc-datagrid-cell-main {
          padding: 0;
        }

        /* Time slot hover effects - more pronounced */
        .calendar-container .fc-timegrid-slot {
          transition: background-color 0.15s ease;
        }

        .calendar-container .fc-timegrid-slot:hover {
          background-color: rgb(243 244 246); /* gray-100 - more visible */
          cursor: pointer;
        }

        /* Empty time slot hover - make it interactive */
        .calendar-container .fc-timegrid-col:hover .fc-timegrid-slot {
          cursor: pointer;
        }

        /* Event styling */
        .calendar-container .fc-event {
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        }

        .calendar-container .fc-event:hover {
          opacity: 0.9;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        }

        .calendar-container .fc-event:focus-visible {
          outline: 2px solid hsl(var(--ring));
          outline-offset: 2px;
          z-index: 10;
        }

        .calendar-container .fc-event-terminal {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .calendar-container .fc-event-terminal:hover {
          transform: none;
          box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        }

        .calendar-container .fc-event-active {
          cursor: grab;
        }

        .calendar-container .fc-event-active:active {
          cursor: grabbing;
        }

        .calendar-container .fc-event-title {
          font-weight: 600;
          line-height: 1.3;
        }

        .calendar-container .fc-event-zone {
          margin-top: 2px;
          opacity: 0.85;
        }

        /* Refined business hours */
        .calendar-container .fc-business-hours {
          background-color: transparent;
        }

        .calendar-container .fc-non-business {
          background-color: rgb(249 250 251 / 0.5); /* gray-50 with opacity */
        }

        /* Elegant current time indicator with dot */
        .calendar-container .fc-timegrid-now-indicator-line {
          border-color: rgb(59 130 246); /* blue-500 */
          border-width: 1.5px;
          box-shadow: 0 0 8px rgb(59 130 246 / 0.3);
          position: relative;
        }

        .calendar-container .fc-timegrid-now-indicator-line::before {
          content: '';
          position: absolute;
          left: -4px;
          top: -3px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgb(59 130 246);
          border: 2px solid white;
          box-shadow: 0 0 6px rgb(59 130 246 / 0.5);
          z-index: 1;
        }

        .calendar-container .fc-timegrid-now-indicator-arrow {
          border-color: rgb(59 130 246); /* blue-500 */
          border-width: 5px;
        }

        /* Selection highlight */
        .calendar-container .fc-highlight {
          background-color: rgb(219 234 254 / 0.4); /* blue-100 with opacity */
        }

        .calendar-container .fc-select-mirror {
          background-color: rgb(191 219 254 / 0.3); /* blue-200 with opacity */
          border: 2px dashed rgb(59 130 246); /* blue-500 */
          border-radius: 4px;
        }

        @media (max-width: 768px) {
          .calendar-container .fc-event-title {
            font-size: 0.625rem;
          }

          .calendar-container .fc-resource .fc-resource-title {
            padding: 4px 8px;
            font-size: 0.875rem;
          }
        }
      `}</style>

      {/* Conflict Confirmation Dialog */}
      <ConflictConfirmDialog
        open={conflictDialog.open}
        onOpenChange={(open) => setConflictDialog(prev => ({ ...prev, open }))}
        conflictMessage={conflictDialog.message}
        conflicts={conflictDialog.conflicts}
        onConfirm={conflictDialog.onConfirm}
        onCancel={conflictDialog.onCancel}
      />
    </div>
  )
}