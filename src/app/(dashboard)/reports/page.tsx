'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'

import PageShell from "@/components/shell/PageShell"
import { PageHeader } from "@/components/ui/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RoleGuard } from "@/components/auth/RoleGuard"

import {
  getJobsByStatus,
  getJobsByTechnician,
  getUpcomingReminders,
  getZones,
  getTechnicians,
  type JobsByStatusResult,
  type JobsByTechnicianResult,
  type UpcomingRemindersResult,
  type JobStatusRow,
  type TechnicianStatsRow,
  type UpcomingReminderRow
} from './actions'

import { TabsLayout, getDefaultTabs } from './_components/TabsLayout'
import { DateRangeFilter, getDefaultDateRange } from './_components/DateRangeFilter'
import { ZoneTechFilters, ServiceTypeFilter, HorizonFilter } from './_components/ZoneTechFilters'
import { DataTable, tableRenderers, type ColumnDef } from './_components/DataTable'
import { CsvButton } from './_components/CsvButton'

export default function ReportsPage() {
  return (
    <RoleGuard requiredRoles={["admin", "dispatcher"]}>
      <ReportsContent />
    </RoleGuard>
  )
}

function ReportsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // State for filters and data
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'jobs-by-status')
  const [dateRange, setDateRange] = useState(getDefaultDateRange())
  const [selectedZones, setSelectedZones] = useState<string[]>([])
  const [selectedTechnician, setSelectedTechnician] = useState<string | undefined>()
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([])
  const [horizonDays, setHorizonDays] = useState(7)

  // Data state
  const [jobsByStatusData, setJobsByStatusData] = useState<JobsByStatusResult | null>(null)
  const [jobsByTechnicianData, setJobsByTechnicianData] = useState<JobsByTechnicianResult | null>(null)
  const [upcomingRemindersData, setUpcomingRemindersData] = useState<UpcomingRemindersResult | null>(null)

  // Metadata state
  const [zones, setZones] = useState<string[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Service types for filtering (could be fetched from API)
  const serviceTypes = [
    'carpet cleaning',
    'upholstery cleaning',
    'tile cleaning',
    'area rug cleaning',
    'stain removal',
    'deep cleaning',
    'maintenance cleaning'
  ]

  // Load metadata on mount
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [zonesData, techniciansData] = await Promise.all([
          getZones({}),
          getTechnicians({})
        ])
        setZones(zonesData)
        setTechnicians(techniciansData)
      } catch (error) {
        console.error('Failed to load metadata:', error)
        toast.error('Failed to load filter options')
      }
    }

    loadMetadata()
  }, [])

  // Load data when filters change
  useEffect(() => {
    loadReportData()
  }, [activeTab, dateRange, selectedZones, selectedTechnician, selectedServiceTypes, horizonDays])

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    params.set('tab', activeTab)
    router.push(`/reports?${params.toString()}`)
  }, [activeTab, searchParams, router])

  const loadReportData = async () => {
    setLoading(true)

    try {
      switch (activeTab) {
        case 'jobs-by-status':
          const statusData = await getJobsByStatus({
            from: dateRange.from,
            to: dateRange.to,
            serviceTypes: selectedServiceTypes.length > 0 ? selectedServiceTypes : undefined
          })
          setJobsByStatusData(statusData)
          break

        case 'jobs-by-technician':
          const techData = await getJobsByTechnician({
            from: dateRange.from,
            to: dateRange.to,
            zones: selectedZones.length > 0 ? selectedZones : undefined
          })
          setJobsByTechnicianData(techData)
          break

        case 'upcoming-reminders':
          const remindersData = await getUpcomingReminders({
            horizonDays
          })
          setUpcomingRemindersData(remindersData)
          break
      }
    } catch (error) {
      console.error('Failed to load report data:', error)
      toast.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  // Column definitions for each report
  const jobsByStatusColumns: ColumnDef<JobStatusRow>[] = [
    { key: 'id', header: 'Job ID', sortable: true, width: '120px' },
    { key: 'status', header: 'Status', sortable: true, render: tableRenderers.status },
    { key: 'customerName', header: 'Customer', sortable: true },
    { key: 'customerPhone', header: 'Phone', render: tableRenderers.phone },
    { key: 'zone', header: 'Zone', sortable: true },
    { key: 'technicianName', header: 'Technician', sortable: true },
    { key: 'scheduledDate', header: 'Scheduled', sortable: true, render: tableRenderers.date },
    { key: 'completedDate', header: 'Completed', sortable: true, render: tableRenderers.date },
    { key: 'serviceType', header: 'Service Type', sortable: true }
  ]

  const jobsByTechnicianColumns: ColumnDef<TechnicianStatsRow>[] = [
    { key: 'technicianName', header: 'Technician', sortable: true },
    { key: 'zone', header: 'Zone', sortable: true },
    { key: 'jobsScheduled', header: 'Jobs Scheduled', sortable: true, render: tableRenderers.number },
    { key: 'jobsCompleted', header: 'Jobs Completed', sortable: true, render: tableRenderers.number },
    { key: 'avgRating', header: 'Avg Rating', sortable: true, render: (value) => value ? `${value.toFixed(1)}/5` : '-' },
    { key: 'cancellations', header: 'Cancellations', sortable: true, render: tableRenderers.number }
  ]

  const upcomingRemindersColumns: ColumnDef<UpcomingReminderRow>[] = [
    { key: 'scheduledDate', header: 'Scheduled', sortable: true, render: tableRenderers.date },
    { key: 'title', header: 'Title', sortable: true, render: (value) => tableRenderers.truncatedText(value, 40) },
    { key: 'type', header: 'Type', sortable: true },
    { key: 'customerName', header: 'Customer', sortable: true },
    { key: 'customerPhone', header: 'Phone', render: tableRenderers.phone },
    { key: 'assigneeName', header: 'Assignee', sortable: true },
    { key: 'status', header: 'Status', sortable: true, render: tableRenderers.status },
    { key: 'origin', header: 'Origin', sortable: true }
  ]

  // Get current filters for CSV export
  const getCurrentFilters = () => {
    switch (activeTab) {
      case 'jobs-by-status':
        return {
          from: dateRange.from,
          to: dateRange.to,
          serviceTypes: selectedServiceTypes
        }
      case 'jobs-by-technician':
        return {
          from: dateRange.from,
          to: dateRange.to,
          zones: selectedZones
        }
      case 'upcoming-reminders':
        return {
          horizonDays
        }
      default:
        return {}
    }
  }

  // Jobs by Status Tab Content
  const jobsByStatusContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <div className="space-y-4">
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
          />
          <ServiceTypeFilter
            serviceTypes={serviceTypes}
            selectedTypes={selectedServiceTypes}
            onTypesChange={setSelectedServiceTypes}
          />
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary Cards */}
          {jobsByStatusData?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Jobs</CardDescription>
                  <CardTitle className="text-2xl">{jobsByStatusData.summary.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Scheduled</CardDescription>
                  <CardTitle className="text-2xl text-blue-600">{jobsByStatusData.summary.scheduled}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>In Progress</CardDescription>
                  <CardTitle className="text-2xl text-yellow-600">{jobsByStatusData.summary.in_progress}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Completed</CardDescription>
                  <CardTitle className="text-2xl text-green-600">{jobsByStatusData.summary.completed}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Cancelled</CardDescription>
                  <CardTitle className="text-2xl text-red-600">{jobsByStatusData.summary.cancelled}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Export Button */}
          <div className="flex justify-end">
            <CsvButton
              reportType="jobs-by-status"
              filters={getCurrentFilters()}
              disabled={loading || !jobsByStatusData}
            />
          </div>

          {/* Data Table */}
          <DataTable
            data={jobsByStatusData?.rows || []}
            columns={jobsByStatusColumns}
            loading={loading}
            emptyMessage="No jobs found for the selected criteria"
            showRowNumbers
          />
        </div>
      </div>
    </div>
  )

  // Jobs by Technician Tab Content
  const jobsByTechnicianContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <div className="space-y-4">
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
          />
          <ZoneTechFilters
            zones={zones}
            technicians={technicians}
            selectedZones={selectedZones}
            selectedTechnician={selectedTechnician}
            onZonesChange={setSelectedZones}
            onTechnicianChange={setSelectedTechnician}
            showTechnicianFilter
          />
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary Cards */}
          {jobsByTechnicianData?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Technicians</CardDescription>
                  <CardTitle className="text-2xl">{jobsByTechnicianData.summary.totalTechnicians}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Jobs Scheduled</CardDescription>
                  <CardTitle className="text-2xl text-blue-600">{jobsByTechnicianData.summary.totalJobsScheduled}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Jobs Completed</CardDescription>
                  <CardTitle className="text-2xl text-green-600">{jobsByTechnicianData.summary.totalJobsCompleted}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Cancellations</CardDescription>
                  <CardTitle className="text-2xl text-red-600">{jobsByTechnicianData.summary.totalCancellations}</CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Export Button */}
          <div className="flex justify-end">
            <CsvButton
              reportType="jobs-by-technician"
              filters={getCurrentFilters()}
              disabled={loading || !jobsByTechnicianData}
            />
          </div>

          {/* Data Table */}
          <DataTable
            data={jobsByTechnicianData?.rows || []}
            columns={jobsByTechnicianColumns}
            loading={loading}
            emptyMessage="No technician data found for the selected criteria"
            showRowNumbers
          />
        </div>
      </div>
    </div>
  )

  // Upcoming Reminders Tab Content
  const upcomingRemindersContent = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <div className="space-y-4">
          <HorizonFilter
            value={horizonDays}
            onChange={setHorizonDays}
          />
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Summary Cards */}
          {upcomingRemindersData?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Reminders</CardDescription>
                  <CardTitle className="text-2xl">{upcomingRemindersData.summary.totalReminders}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>By Type</CardDescription>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {Object.entries(upcomingRemindersData.summary.byType).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-sm">
                          <span className="capitalize">{type}:</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>By Status</CardDescription>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {Object.entries(upcomingRemindersData.summary.byStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between text-sm">
                          <span className="capitalize">{status}:</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CardHeader>
              </Card>
            </div>
          )}

          {/* Export Button */}
          <div className="flex justify-end">
            <CsvButton
              reportType="upcoming-reminders"
              filters={getCurrentFilters()}
              disabled={loading || !upcomingRemindersData}
            />
          </div>

          {/* Data Table */}
          <DataTable
            data={upcomingRemindersData?.rows || []}
            columns={upcomingRemindersColumns}
            loading={loading}
            emptyMessage="No upcoming reminders found"
            showRowNumbers
          />
        </div>
      </div>
    </div>
  )

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHeader
          title="Reports"
          description="Business analytics and operational insights"
        />

        <TabsLayout
          defaultTab={activeTab}
          tabs={getDefaultTabs(
            jobsByStatusContent,
            jobsByTechnicianContent,
            upcomingRemindersContent
          )}
        />
      </div>
    </PageShell>
  )
}