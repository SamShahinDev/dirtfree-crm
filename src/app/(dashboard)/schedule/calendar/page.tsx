'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import PageShell from "@/components/shell/PageShell"
import { PageHeader } from "@/components/ui/PageHeader"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react'

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { getWeekBounds, getDayBounds, formatDateForCalendar } from '@/lib/schedule/time'
import { JOB_STATUSES, ZONES, SERVICE_TYPES, getServiceTypeDisplay } from '@/types/job'

import {
  listTechnicians,
  type TechnicianResource,
  type JobEvent
} from '../actions'

import { getCalendarEvents } from './actions'

import { CalendarView } from './_components/CalendarView'
import { TechFilter } from './_components/TechFilter'
import { AssignTechDialog } from './_components/AssignTechDialog'
import { Legend } from './_components/Legend'
import { ScheduleJobModal } from '@/components/dashboard/schedule-job-modal'

type CalendarViewType = 'resourceTimeGridWeek' | 'resourceTimeGridDay' | 'timeGridWeek' | 'timeGridDay'

export default function CalendarPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<CalendarViewType>('resourceTimeGridWeek')
  const [technicians, setTechnicians] = useState<TechnicianResource[]>([])
  const [events, setEvents] = useState<JobEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Render counter for debugging
  const renderCount = useRef(0)
  renderCount.current++

  console.log('═══════════════════════════════════════════════════════')
  console.log(`🎯 CalendarPage RENDER #${renderCount.current}`)
  console.log('📊 Current State:', {
    loading,
    refreshing,
    techniciansCount: technicians.length,
    eventsCount: events.length,
    view,
    currentDate: currentDate.toISOString().split('T')[0],
    timestamp: new Date().toISOString()
  })
  console.log('═══════════════════════════════════════════════════════')

  // Filters
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['scheduled', 'in_progress'])
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([])

  // Dialogs
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<JobEvent | null>(null)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [newJobData, setNewJobData] = useState<{
    date?: string
    startTime?: string
    endTime?: string
    technicianId?: string
  }>({})

  // Initialize from URL params
  useEffect(() => {
    const viewParam = searchParams.get('view')
    const dateParam = searchParams.get('date')
    const techsParam = searchParams.get('technicians')
    const statusesParam = searchParams.get('statuses')
    const zonesParam = searchParams.get('zones')
    const serviceTypesParam = searchParams.get('serviceTypes')

    if (viewParam && ['resourceTimeGridWeek', 'resourceTimeGridDay', 'timeGridWeek', 'timeGridDay'].includes(viewParam)) {
      setView(viewParam as CalendarViewType)
    }

    if (dateParam) {
      const date = new Date(dateParam)
      if (!isNaN(date.getTime())) {
        setCurrentDate(date)
      }
    }

    if (techsParam) {
      setSelectedTechIds(techsParam.split(','))
    }

    if (statusesParam) {
      setSelectedStatuses(statusesParam.split(','))
    }

    if (zonesParam) {
      setSelectedZones(zonesParam.split(','))
    }

    if (serviceTypesParam) {
      setSelectedServiceTypes(serviceTypesParam.split(','))
    }
  }, [searchParams])

  // Create a trigger value for debouncing URL updates
  const urlUpdateTrigger = JSON.stringify({
    view,
    date: currentDate.toISOString().split('T')[0],
    techIds: selectedTechIds,
    statuses: selectedStatuses,
    zones: selectedZones,
    serviceTypes: selectedServiceTypes
  })

  const debouncedTrigger = useDebouncedValue(urlUpdateTrigger, 500)

  // Update URL when debounced trigger changes
  useEffect(() => {
    const params = new URLSearchParams()

    if (view !== 'resourceTimeGridWeek') {
      params.set('view', view)
    }

    params.set('date', currentDate.toISOString().split('T')[0])

    if (selectedTechIds.length > 0) {
      params.set('technicians', selectedTechIds.join(','))
    }

    if (selectedStatuses.length > 0 && selectedStatuses.join(',') !== 'scheduled,in_progress') {
      params.set('statuses', selectedStatuses.join(','))
    }

    if (selectedZones.length > 0) {
      params.set('zones', selectedZones.join(','))
    }

    if (selectedServiceTypes.length > 0) {
      params.set('serviceTypes', selectedServiceTypes.join(','))
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '/schedule/calendar'
    router.replace(newUrl, { scroll: false })
  }, [debouncedTrigger, view, currentDate, selectedTechIds, selectedStatuses, selectedZones, selectedServiceTypes, router])

  // Load technicians
  const loadTechnicians = useCallback(async () => {
    console.log('👷 loadTechnicians: Starting...')
    try {
      const response = await listTechnicians({ includeInactive: false })

      // Log the raw response structure
      console.log('👷 loadTechnicians: Raw response:', response)
      console.log('👷 loadTechnicians: Response type:', typeof response)
      console.log('👷 loadTechnicians: Response keys:', response ? Object.keys(response) : 'null')
      console.log('👷 loadTechnicians: response.success =', response?.success)
      console.log('👷 loadTechnicians: response.data =', response?.data)
      console.log('👷 loadTechnicians: response.error =', response?.error)

      if (response.success && response.data) {
        console.log('👷 loadTechnicians: SUCCESS - Setting technicians', response.data.length)
        setTechnicians(response.data)
        // Auto-select all technicians if none selected
        if (selectedTechIds.length === 0) {
          console.log('👷 loadTechnicians: Auto-selecting all technicians:', response.data.map(t => t.id))
          setSelectedTechIds(response.data.map(t => t.id))
        }
      } else {
        console.error('👷 loadTechnicians: FAILED')
        console.error('👷 loadTechnicians: response.success =', response?.success)
        console.error('👷 loadTechnicians: response.error =', response?.error)
        console.error('👷 loadTechnicians: Full response:', JSON.stringify(response, null, 2))
        toast.error(response.error || 'Failed to load technicians')
      }
    } catch (error) {
      console.error('👷 loadTechnicians: EXCEPTION thrown:', error)
      console.error('👷 loadTechnicians: Exception type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('👷 loadTechnicians: Exception message:', error instanceof Error ? error.message : String(error))
      toast.error('Error loading technicians: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    console.log('👷 loadTechnicians: Complete')
  }, [selectedTechIds.length])

  // Load events
  const loadEvents = useCallback(async () => {
    console.log('📅 loadEvents: Starting...', {
      currentLoading: loading,
      view,
      date: currentDate.toISOString().split('T')[0]
    })

    try {
      const isRefresh = !loading
      console.log('📅 loadEvents: isRefresh =', isRefresh)

      if (isRefresh) {
        setRefreshing(true)
      }

      // Calculate date range based on current view
      const bounds = view.includes('Week')
        ? getWeekBounds(currentDate)
        : getDayBounds(currentDate)

      const startDate = bounds.start.toISOString().split('T')[0]
      const endDate = bounds.end.toISOString().split('T')[0]

      console.log('📅 loadEvents: Date bounds', {
        startDate,
        endDate
      })

      // For single technician/zone params, use first selected or 'all'
      const technicianId = selectedTechIds.length > 0 ? selectedTechIds[0] : 'all'
      const zone = selectedZones.length > 0 ? selectedZones[0] : 'all-zones'

      console.log('📅 loadEvents: Calling getCalendarEvents with filters', {
        startDate,
        endDate,
        technicianId,
        zone,
        status: selectedStatuses
      })

      const response = await getCalendarEvents({
        startDate,
        endDate,
        technicianId,
        zone,
        status: selectedStatuses.length > 0 ? selectedStatuses : undefined
      })

      console.log('📅 loadEvents: Response:', response)
      console.log('📅 loadEvents: Response type:', typeof response)
      console.log('📅 loadEvents: Response keys:', response ? Object.keys(response) : 'null')
      console.log('📅 loadEvents: response.success =', response?.success)
      console.log('📅 loadEvents: response.data =', response?.data)
      console.log('📅 loadEvents: response.error =', response?.error)

      if (response.success && response.data) {
        console.log('📅 loadEvents: SUCCESS - Setting events', response.data.length)
        setEvents(response.data)
      } else {
        console.error('📅 loadEvents: Failed', response.error)
        console.error('📅 Full response:', JSON.stringify(response, null, 2))
        toast.error(response.error || 'Failed to load events')
        setEvents([])
      }
    } catch (error) {
      console.error('📅 loadEvents: Exception', error)
      toast.error('Failed to load calendar events')
      setEvents([])
    } finally {
      console.log('📅 loadEvents: Finally - setting loading=false, refreshing=false')
      setLoading(false)
      setRefreshing(false)
      console.log('📅 loadEvents: Complete')
    }
  }, [currentDate, view, selectedTechIds, selectedStatuses, selectedZones, selectedServiceTypes, loading])

  // Safety timeout - force calendar to show after 5 seconds
  useEffect(() => {
    console.log('⏰ Setting up 5-second safety timeout')
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('⏰ TIMEOUT: Forcing calendar to show even if loading not complete')
        console.log('⏰ TIMEOUT State:', {
          loading,
          techniciansCount: technicians.length,
          eventsCount: events.length
        })
        setLoading(false)
      }
    }, 5000)

    return () => {
      console.log('⏰ Clearing timeout')
      clearTimeout(timeout)
    }
  }, [loading, technicians.length, events.length])

  // Initial load
  useEffect(() => {
    console.log('🔄 useEffect[loadTechnicians]: Triggered')
    loadTechnicians()
  }, [loadTechnicians])

  // Reload events when filters change
  useEffect(() => {
    console.log('🔄 useEffect[loadEvents]: Triggered', {
      techniciansCount: technicians.length,
      shouldLoad: technicians.length > 0
    })

    if (technicians.length > 0) {
      console.log('🔄 useEffect[loadEvents]: Calling loadEvents()')
      loadEvents()
    } else {
      console.log('🔄 useEffect[loadEvents]: Skipping - no technicians yet')
    }
  }, [technicians.length, loadEvents])

  // Navigation
  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    let newDate = new Date(currentDate)

    if (direction === 'today') {
      newDate = new Date()
    } else if (direction === 'prev') {
      if (view.includes('Week')) {
        newDate.setDate(newDate.getDate() - 7)
      } else {
        newDate.setDate(newDate.getDate() - 1)
      }
    } else if (direction === 'next') {
      if (view.includes('Week')) {
        newDate.setDate(newDate.getDate() + 7)
      } else {
        newDate.setDate(newDate.getDate() + 1)
      }
    }

    setCurrentDate(newDate)
  }

  // Event handlers
  const handleEventClick = (event: JobEvent) => {
    setSelectedEvent(event)
    setAssignDialogOpen(true)
  }

  const handleDateSelect = (selectInfo: any) => {
    console.log('📍 Date range selected:', {
      start: selectInfo.start,
      end: selectInfo.end,
      resourceId: selectInfo.resource?.id,
      fullSelectInfo: selectInfo
    })

    // Calculate duration in hours
    const durationMs = selectInfo.end.getTime() - selectInfo.start.getTime()
    const durationHours = Math.round(durationMs / (1000 * 60 * 60))

    // Format times
    const startTime = selectInfo.start.toTimeString().slice(0, 5)
    const endTime = selectInfo.end.toTimeString().slice(0, 5)

    setNewJobData({
      date: selectInfo.start.toISOString().split('T')[0],
      startTime,
      endTime,
      technicianId: selectInfo.resource?.id || undefined
    })

    setScheduleModalOpen(true)
  }

  const handleEventsChange = () => {
    loadEvents()
  }

  const handleRefresh = () => {
    loadEvents()
  }

  const handleScheduleSuccess = () => {
    setScheduleModalOpen(false)
    setNewJobData({})
    loadEvents()
    toast.success('Job scheduled successfully!')
  }

  const getDateRangeDisplay = () => {
    if (view.includes('Week')) {
      const bounds = getWeekBounds(currentDate)
      return `${formatDateForCalendar(bounds.start)} - ${formatDateForCalendar(bounds.end)}`
    } else {
      return formatDateForCalendar(currentDate)
    }
  }

  console.log('🎨 Render decision:', {
    loading,
    techniciansCount: technicians.length,
    showingSkeleton: loading && technicians.length === 0,
    showingMainPage: !(loading && technicians.length === 0)
  })

  if (loading && technicians.length === 0) {
    console.log('🎨 Rendering: Initial skeleton (no technicians yet)')
    return (
      <PageShell>
        <div className="space-y-6">
          <PageHeader
            title="Schedule — Calendar"
            description="Manage and schedule technician appointments"
          />

          <div className="section-card">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
              <Skeleton className="h-[600px] w-full" />
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  console.log('🎨 Rendering: Main page', {
    willShowCalendarSpinner: loading,
    willShowCalendar: !loading
  })

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHeader
          title="Schedule — Calendar"
          description="Manage and schedule technician appointments"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/jobs')}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Jobs Table
              </Button>
            </div>
          }
        />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Calendar */}
          <div className="flex-1 space-y-4">
            {/* Calendar Controls */}
            <div className="section-card">
              <div className="mb-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* View and Navigation */}
                <div className="flex items-center gap-3">
                  <Select value={view} onValueChange={(value: CalendarViewType) => setView(value)}>
                    <SelectTrigger className="w-[200px] font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resourceTimeGridWeek">Week (Resources)</SelectItem>
                      <SelectItem value="resourceTimeGridDay">Day (Resources)</SelectItem>
                      <SelectItem value="timeGridWeek">Week</SelectItem>
                      <SelectItem value="timeGridDay">Day</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateDate('prev')}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateDate('today')}
                      className="px-4 h-9 font-medium"
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateDate('next')}
                      className="h-9 w-9 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Date Range Display */}
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground bg-muted/30 px-4 py-2 rounded-md">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{getDateRangeDisplay()}</span>
                </div>
              </div>
              </div>
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                {/* Technician Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground block">
                    Technicians
                  </label>
                  <TechFilter
                    technicians={technicians}
                    selectedIds={selectedTechIds}
                    onSelectionChange={setSelectedTechIds}
                    placeholder="Select technicians..."
                    maxDisplayed={2}
                  />
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground block">
                    Status
                  </label>
                  <Select
                    value={selectedStatuses.join(',')}
                    onValueChange={(value) => setSelectedStatuses(value ? value.split(',') : [])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select statuses..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled,in_progress">Active Jobs</SelectItem>
                      <SelectItem value="scheduled">Scheduled Only</SelectItem>
                      <SelectItem value="in_progress">In Progress Only</SelectItem>
                      <SelectItem value="scheduled,in_progress,completed">Include Completed</SelectItem>
                      <SelectItem value="scheduled,in_progress,completed,cancelled">All Statuses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Zone Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground block">
                    Zones
                  </label>
                  <Select
                    value={selectedZones.join(',')}
                    onValueChange={(value) => setSelectedZones(value && value !== '__all__' ? value.split(',') : [])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Zones</SelectItem>
                      {ZONES.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone === 'Central' ? 'Central' : `Zone ${zone}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service Type Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground block">
                    Service Type
                  </label>
                  <Select
                    value={selectedServiceTypes.join(',')}
                    onValueChange={(value) => setSelectedServiceTypes(value && value !== '__all__' ? value.split(',') : [])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Service Types</SelectItem>
                      {SERVICE_TYPES.map((serviceType) => (
                        <SelectItem key={serviceType} value={serviceType}>
                          {getServiceTypeDisplay(serviceType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

                {/* Status Legend */}
                <div className="pt-4 mt-4 border-t">
                  <Legend compact />
                </div>
            </div>

            {/* Calendar */}
            <div className="section-card">
              {(() => {
                console.log('🔍 Calendar Render Decision:', {
                  loading,
                  eventsCount: events.length,
                  techniciansCount: technicians.length,
                  selectedTechIdsCount: selectedTechIds.length,
                  filteredResourcesCount: technicians.filter(tech => selectedTechIds.includes(tech.id)).length,
                  view,
                  currentDate: currentDate.toISOString().split('T')[0],
                  selectedStatuses,
                  selectedZones,
                  selectedServiceTypes
                })
                return null
              })()}

              {loading ? (
                <>
                  {console.log('🌀 Rendering: Calendar loading spinner')}
                  <div className="h-[600px] flex items-center justify-center">
                    <div className="text-center space-y-3">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">Loading calendar...</p>
                      <p className="text-xs text-muted-foreground">
                        Technicians: {technicians.length} | Events: {events.length}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {console.log('📆 Rendering: CalendarView component', {
                    eventsCount: events.length,
                    resourcesCount: technicians.filter(tech => selectedTechIds.includes(tech.id)).length,
                    events: events.slice(0, 3) // Log first 3 events for inspection
                  })}
                  {(() => {
                    try {
                      console.log('📆 Attempting to render CalendarView...')
                      const filteredResources = technicians.filter(tech => selectedTechIds.includes(tech.id))
                      console.log('📆 Filtered resources:', filteredResources)

                      return (
                        <CalendarView
                          view={view}
                          events={events}
                          resources={filteredResources}
                          onEventClick={handleEventClick}
                          onDateSelect={handleDateSelect}
                          onEventsChange={handleEventsChange}
                          initialDate={currentDate}
                        />
                      )
                    } catch (error) {
                      console.error('❌ CalendarView render error:', error)
                      return (
                        <div className="h-[600px] flex items-center justify-center">
                          <div className="text-center space-y-3">
                            <p className="text-red-500">Error rendering calendar</p>
                            <p className="text-sm text-muted-foreground">
                              {error instanceof Error ? error.message : 'Unknown error'}
                            </p>
                            <p className="text-xs text-muted-foreground">Check console for details</p>
                          </div>
                        </div>
                      )
                    }
                  })()}
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-80 space-y-4">
            {/* Stats */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium text-muted-foreground">Total Jobs</span>
                  <Badge variant="outline" className="font-semibold">{events.length}</Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium text-muted-foreground">Technicians</span>
                  <Badge variant="outline" className="font-semibold">{selectedTechIds.length}</Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-medium text-muted-foreground">Unassigned</span>
                  <Badge variant="secondary" className="font-semibold">
                    {events.filter(e => !e.resourceId || e.resourceId === 'unassigned').length}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Status Breakdown */}
            <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {JOB_STATUSES.map(status => {
                  const count = events.filter(e => e.extendedProps.status === status).length
                  if (count === 0) return null

                  return (
                    <div key={status} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                      <span className="text-sm font-medium capitalize">{status.replace('_', ' ')}</span>
                      <Badge variant="outline" className="font-semibold">{count}</Badge>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Full Legend */}
            <Legend />
          </div>
        </div>

        {/* Dialogs */}
        <AssignTechDialog
          event={selectedEvent}
          technicians={technicians}
          open={assignDialogOpen}
          onOpenChange={setAssignDialogOpen}
          onSuccess={handleEventsChange}
        />

        <ScheduleJobModal
          open={scheduleModalOpen}
          onOpenChange={setScheduleModalOpen}
          initialData={newJobData}
          onSuccess={handleScheduleSuccess}
        />
      </div>
    </PageShell>
  )
}