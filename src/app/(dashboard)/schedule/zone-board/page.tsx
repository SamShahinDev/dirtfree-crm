'use client'

import { useState, useEffect, useCallback } from 'react'
import { listZoneBoard } from './actions'
import { toast } from 'sonner'
import { Calendar, MapPin, Loader2, RefreshCw, Grid3x3, AlertCircle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ZoneMap } from '@/components/maps/ZoneMap'
import { TimelineSidebar } from '@/components/zone-board/TimelineSidebar'
import { ZoneBoardJob } from '@/types/zone-board'
import { JobDialog } from '../../jobs/_components/JobDialog'

// Mock geocoding function - replace with real geocoding later
function geocodeAddress(address: string, city: string, zone: string): { latitude: number; longitude: number } {
  // Houston approximate coordinates with zone offsets
  const HOUSTON_BASE = { lat: 29.7604, lng: -95.3698 }

  // Zone offsets (approximate)
  const ZONE_OFFSETS = {
    N: { lat: 0.15, lng: 0 },
    S: { lat: -0.15, lng: 0 },
    E: { lat: 0, lng: 0.15 },
    W: { lat: 0, lng: -0.15 },
  }

  const offset = ZONE_OFFSETS[zone as keyof typeof ZONE_OFFSETS] || { lat: 0, lng: 0 }

  // Add some random variation for demo
  const randomLat = (Math.random() - 0.5) * 0.1
  const randomLng = (Math.random() - 0.5) * 0.1

  return {
    latitude: HOUSTON_BASE.lat + offset.lat + randomLat,
    longitude: HOUSTON_BASE.lng + offset.lng + randomLng,
  }
}

export default function ZoneBoardPage() {
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<ZoneBoardJob[]>([])
  const [selectedJob, setSelectedJob] = useState<ZoneBoardJob | null>(null)
  const [editingJob, setEditingJob] = useState<ZoneBoardJob | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [includeTerminal, setIncludeTerminal] = useState(false)

  const loadBoardData = useCallback(async () => {
    try {
      setLoading(true)

      console.log('📅 [BOARD] Loading data for date:', selectedDate)
      console.log('📅 [BOARD] Type of selectedDate:', typeof selectedDate)
      console.log('🔄 [CLIENT] Loading zone board:', { selectedDate, includeTerminal })

      const response = await listZoneBoard({
        date: selectedDate,  // Pass as-is, no conversion
        includeTerminal
      })

      console.log('📥 [CLIENT] Response:', response)

      if (response.success && response.data) {
        // Transform the columns/buckets data into a flat job list
        const allJobs: ZoneBoardJob[] = []

        if (response.data.columns) {
          response.data.columns.forEach((column: any) => {
            column.buckets.forEach((bucket: any) => {
              bucket.jobs.forEach((job: any) => {
                // Geocode the address
                const coords = geocodeAddress(
                  job.customer?.address_line1 || '',
                  job.customer?.city || '',
                  column.zone
                )

                allJobs.push({
                  id: job.id,
                  customerId: job.customer_id || '',
                  customerName: job.customer?.name || 'Unknown Customer',
                  address: job.customer?.address_line1 || 'No address',
                  city: job.customer?.city || '',
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  zone: column.zone,
                  scheduledDate: job.scheduled_date,
                  scheduledTime: job.scheduled_time_start || '09:00',
                  scheduledTimeEnd: job.scheduled_time_end || undefined,
                  duration: job.duration ? `${job.duration}h` : '2.5h',
                  status: job.status,
                  description: job.description,
                  technicianId: job.technician_id || null,
                  invoiceUrl: job.invoice_url || null
                })
              })
            })
          })
        }

        console.log('✅ [CLIENT] Processed jobs:', allJobs.length)
        setJobs(allJobs)

        if (allJobs.length > 0) {
          toast.success(`Loaded ${allJobs.length} jobs`)
        }
      } else {
        console.error('❌ [CLIENT] Failed:', response.error)
        toast.error(response.error || 'Failed to load zone board')
        setJobs([])
      }
    } catch (error) {
      console.error('❌ [CLIENT] Exception:', error)
      toast.error('Failed to load zone board data')
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate, includeTerminal])

  useEffect(() => {
    loadBoardData()
  }, [loadBoardData])

  const handleEditJob = useCallback(async (job: ZoneBoardJob) => {
    console.log('🔧 Opening edit dialog for job:', job.customerName)

    try {
      // Fetch complete job data to ensure customer_id is populated
      const { getJob } = await import('../../jobs/actions')
      const result = await getJob({ id: job.id })

      if (result.success && result.data) {
        console.log('✅ Full job data loaded:', result.data)
        console.log('📦 Customer data:', result.data.customer)
        console.log('🆔 Customer ID:', result.data.customer_id)
        console.log('👤 Customer Name:', result.data.customer?.name)

        // Merge zone board data with full job data INCLUDING customer info
        const completeJobData = {
          ...job,
          id: result.data.id,
          customer_id: result.data.customer_id,
          customerName: result.data.customer?.name || job.customerName,
          customer: result.data.customer,
          technician_id: result.data.technician_id,
          invoice_url: result.data.invoice_url,
          scheduled_time_end: result.data.scheduled_time_end,
          _fullJobData: result.data, // Store full data for debugging
        }

        console.log('💾 Setting editingJob with data:', completeJobData)
        setEditingJob(completeJobData as any)
        setShowEditDialog(true)
        setSelectedJob(null) // Close the map popup
      } else {
        throw new Error(result.error || 'Failed to fetch job')
      }
    } catch (error) {
      console.error('Failed to load job for editing:', error)
      toast.error('Failed to load job details')
    }
  }, [])

  const handleEditDialogClose = useCallback(() => {
    setShowEditDialog(false)
    setEditingJob(null)
    // Refresh the board data after edit
    loadBoardData()
  }, [loadBoardData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Schedule — Zone Board</h1>
            <p className="text-sm text-muted-foreground">
              Geographic view of jobs by zone and time
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Grid3x3 className="h-4 w-4 mr-2" />
              Grid View
            </Button>
            <Button variant="default" size="sm">
              <MapPin className="h-4 w-4 mr-2" />
              Map View
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Date */}
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <span className="font-medium text-sm">
                {(() => {
                  // Parse date as local, not UTC
                  const [year, month, day] = selectedDate.split('-')
                  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                  return date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })
                })()}
              </span>
            </div>

            <div className="border-l h-6" />

            {/* Date Picker */}
            <div className="flex items-center gap-2 relative z-10">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  const newDate = e.target.value
                  console.log('📅 Date picker changed to:', newDate)

                  // Ensure date stays in local timezone
                  if (newDate) {
                    setSelectedDate(newDate)
                  }
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 cursor-pointer transition-colors relative z-10"
                style={{ minWidth: '150px' }}
              />
            </div>

            <div className="border-l h-6" />

            {/* Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="include-terminal"
                checked={includeTerminal}
                onCheckedChange={setIncludeTerminal}
              />
              <Label htmlFor="include-terminal" className="text-sm cursor-pointer">
                Include completed/cancelled
              </Label>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="font-medium">{jobs.length} jobs</span>
            </div>

            <Button variant="outline" size="sm" onClick={loadBoardData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {jobs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No jobs found</h2>
            <p className="text-muted-foreground mb-4">
              There are no jobs scheduled for {(() => {
                const [year, month, day] = selectedDate.split('-')
                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
                return date.toLocaleDateString()
              })()}
            </p>
            <Button>
              + Create First Job
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
          {/* Map */}
          <div className="flex-1 min-h-[500px] md:min-h-0 relative">
            <ZoneMap
              jobs={jobs}
              selectedJob={selectedJob}
              onJobSelect={setSelectedJob}
              onEdit={handleEditJob}
            />
          </div>

          {/* Timeline Sidebar */}
          <div
            className="w-full md:w-[400px] border-l h-[400px] md:h-full overflow-auto"
            onWheel={(e) => {
              // Prevent scroll from bubbling to parent (map)
              e.stopPropagation()
            }}
            onScroll={(e) => {
              // Prevent scroll propagation
              e.stopPropagation()
            }}
            style={{
              overscrollBehavior: 'contain'
            }}
          >
            <TimelineSidebar
              jobs={jobs}
              selectedJob={selectedJob}
              onJobSelect={setSelectedJob}
              selectedDate={selectedDate}
            />
          </div>
        </div>
      )}

      {/* Edit Job Dialog */}
      {showEditDialog && editingJob && (
        <div className="relative z-50">
          <JobDialog
            open={showEditDialog}
            onOpenChange={(open) => {
              if (!open) {
                handleEditDialogClose()
              }
            }}
            mode="edit"
            initialData={{
              id: editingJob.id,
              customer_id: (editingJob as any).customer_id || '',
              technician_id: (editingJob as any).technician_id || null,
              zone: editingJob.zone || null,
              status: editingJob.status,
              scheduled_date: editingJob.scheduledDate || null,
              scheduled_time_start: editingJob.scheduledTime || null,
              scheduled_time_end: (editingJob as any).scheduled_time_end || null,
              description: editingJob.description || null,
              invoice_url: (editingJob as any).invoice_url || null,
              serviceItems: [],
              customer: (editingJob as any).customer || (editingJob as any)._fullJobData?.customer,
              customerName: (editingJob as any).customerName || editingJob.customerName
            }}
            onSuccess={handleEditDialogClose}
          />
        </div>
      )}
    </div>
  )
}
