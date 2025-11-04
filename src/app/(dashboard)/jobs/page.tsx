'use client'

import { useState, useEffect, useTransition } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

import PageShell from "@/components/shell/PageShell"
import { PageHeader } from "@/components/ui/PageHeader"
import {
  Card,
  CardContent,
  CardDescription,
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'

import {
  Plus,
  Search,
  Filter,
  ClipboardList
} from 'lucide-react'

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { JOB_STATUSES, ZONES } from '@/types/job'
import { listJobs, getTechnicians } from './actions'
import { JobDialog } from './_components/JobDialog'
import { JobsTable } from './_components/JobsTable'

interface JobsPageData {
  rows: Array<{
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
  }>
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface Technician {
  user_id: string
  display_name?: string | null
  zone?: string | null
}

export default function JobsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [jobs, setJobs] = useState<JobsPageData | null>(null)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Form state
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'all')
  const [selectedZone, setSelectedZone] = useState(searchParams.get('zone') || 'all')
  const [selectedTechnician, setSelectedTechnician] = useState(searchParams.get('technicianId') || 'all')
  const [fromDate, setFromDate] = useState(searchParams.get('fromDate') || '')
  const [toDate, setToDate] = useState(searchParams.get('toDate') || '')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [pageSize] = useState(Number(searchParams.get('pageSize')) || 25)

  // Dialog state
  const [jobDialogOpen, setJobDialogOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<any | null>(null)

  // Debounced search
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300)

  // Update URL params
  const updateUrlParams = (updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value.toString())
      }
    })

    // Reset page to 1 when search/filter changes
    if ('q' in updates || 'status' in updates || 'zone' in updates || 'technicianId' in updates || 'fromDate' in updates || 'toDate' in updates) {
      params.delete('page')
    }

    router.push(`/jobs?${params.toString()}`, { scroll: false })
  }

  // Load jobs
  const loadJobs = async () => {
    setLoading(true)
    startTransition(async () => {
      try {
        const response = await listJobs({
          q: debouncedSearchTerm || undefined,
          status: selectedStatus === 'all' ? undefined : selectedStatus,
          zone: selectedZone === 'all' ? undefined : selectedZone,
          technicianId: selectedTechnician === 'all' ? undefined : selectedTechnician,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          page,
          pageSize
        })

        if (response.success) {
          setJobs(response.data)
        } else {
          throw new Error(response.error || 'Failed to load jobs')
        }
      } catch (error) {
        console.error('Failed to load jobs:', error)
        toast.error('Failed to load jobs')
        setJobs({ rows: [], total: 0, page: 1, pageSize, totalPages: 0 })
      } finally {
        setLoading(false)
      }
    })
  }

  // Load technicians
  const loadTechnicians = async () => {
    try {
      const response = await getTechnicians({})

      if (response.success) {
        setTechnicians(response.data)
      }
    } catch (error) {
      console.error('Failed to load technicians:', error)
    }
  }

  // Effects
  useEffect(() => {
    loadJobs()
  }, [debouncedSearchTerm, selectedStatus, selectedZone, selectedTechnician, fromDate, toDate, page])

  useEffect(() => {
    updateUrlParams({
      q: debouncedSearchTerm,
      status: selectedStatus,
      zone: selectedZone,
      technicianId: selectedTechnician,
      fromDate,
      toDate,
      page: page > 1 ? page : null
    })
  }, [debouncedSearchTerm, selectedStatus, selectedZone, selectedTechnician, fromDate, toDate, page])

  useEffect(() => {
    loadTechnicians()
  }, [])

  // Auto-open edit dialog if edit parameter is present in URL
  useEffect(() => {
    const editJobId = searchParams.get('edit')

    if (editJobId && jobs?.rows && jobs.rows.length > 0) {
      const jobToEdit = jobs.rows.find(job => job.id === editJobId)
      if (jobToEdit) {
        console.log('🔍 Auto-opening edit dialog for job:', editJobId)

        // Set editing job and open dialog
        setEditingJob({
          id: jobToEdit.id,
          customer_id: jobToEdit.customerId,
          technician_id: jobToEdit.technicianId,
          zone: jobToEdit.zone,
          status: jobToEdit.status,
          scheduled_date: jobToEdit.scheduledDate,
          scheduled_time_start: jobToEdit.scheduledTimeStart,
          scheduled_time_end: jobToEdit.scheduledTimeEnd,
          description: jobToEdit.description,
          invoice_url: jobToEdit.invoiceUrl
        })
        setJobDialogOpen(true)

        // Clear the URL parameter after opening
        const params = new URLSearchParams(searchParams.toString())
        params.delete('edit')
        router.replace(`/jobs?${params.toString()}`, { scroll: false })
      }
    }
  }, [searchParams, jobs, router])

  // Handlers
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setPage(1)
  }

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value)
    setPage(1)
  }

  const handleZoneChange = (value: string) => {
    setSelectedZone(value)
    setPage(1)
  }

  const handleTechnicianChange = (value: string) => {
    setSelectedTechnician(value)
    setPage(1)
  }

  const handleFromDateChange = (value: string) => {
    setFromDate(value)
    setPage(1)
  }

  const handleToDateChange = (value: string) => {
    setToDate(value)
    setPage(1)
  }

  const handleCreateJob = () => {
    setJobDialogOpen(true)
  }

  const handleDialogSuccess = () => {
    loadJobs()
    setEditingJob(null)
  }

  const handleRefresh = () => {
    loadJobs()
  }


  const clearFilters = () => {
    setSearchTerm('')
    setSelectedStatus('all')
    setSelectedZone('all')
    setSelectedTechnician('all')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <PageHeader
          title="Jobs"
          description="Manage service appointments and job scheduling"
          actions={
            <Button onClick={handleCreateJob} className="gap-2">
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          }
        />

        {/* Filters */}
        <div className="section-card">
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, phone, or address..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
              aria-label="Search jobs"
            />
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {JOB_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.split('_').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Zone Filter */}
            <div className="space-y-2">
              <Label htmlFor="zone-filter">Zone</Label>
              <Select value={selectedZone} onValueChange={handleZoneChange}>
                <SelectTrigger id="zone-filter">
                  <SelectValue placeholder="All zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Zones</SelectItem>
                  {ZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone === 'Central' ? 'Central' : `Zone ${zone}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Technician Filter */}
            <div className="space-y-2">
              <Label htmlFor="technician-filter">Technician</Label>
              <Select value={selectedTechnician} onValueChange={handleTechnicianChange}>
                <SelectTrigger id="technician-filter">
                  <SelectValue placeholder="All technicians" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Technicians</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.user_id} value={tech.user_id}>
                      {tech.display_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="space-y-2">
              <Label htmlFor="from-date">From Date</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => handleFromDateChange(e.target.value)}
              />
            </div>

            {/* To Date */}
            <div className="space-y-2">
              <Label htmlFor="to-date">To Date</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => handleToDateChange(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Clear Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isPending}
            >
              Refresh
            </Button>
          </div>
        </div>
        </div>

        {/* Results */}
        <div className="section-card">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Jobs</CardTitle>
                <CardDescription>
                  {loading ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    `${jobs?.total || 0} jobs found`
                  )}
                </CardDescription>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="table-row w-full" />
              ))}
            </div>
          ) : (
            <JobsTable
              jobs={jobs?.rows || []}
              technicians={technicians}
              loading={isPending}
              onRefresh={handleRefresh}
              page={jobs?.page || 1}
              pageSize={jobs?.pageSize || 25}
              total={jobs?.total || 0}
              totalPages={jobs?.totalPages || 0}
              onPageChange={setPage}
            />
          )}
        </div>

        {/* Job Dialog */}
        <JobDialog
          mode={editingJob ? 'edit' : 'create'}
          initialData={editingJob}
          open={jobDialogOpen}
          onOpenChange={(open) => {
            setJobDialogOpen(open)
            if (!open) {
              setEditingJob(null)
            }
          }}
          onSuccess={handleDialogSuccess}
        />
      </div>
    </PageShell>
  )
}