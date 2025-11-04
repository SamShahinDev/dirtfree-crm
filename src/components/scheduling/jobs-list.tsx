'use client'

import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Clock, MapPin, User, AlertCircle, Search, Filter } from 'lucide-react'
import { getUnscheduledJobsAction } from '@/app/actions/scheduling'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface JobsListProps {
  selectedDate: Date
  onDragStart: (jobId: string) => void
  onCountChange?: (count: number) => void
}

interface UnscheduledJob {
  id: string
  customer: {
    id: string
    name: string
    address?: string
    phone?: string
    zone_id?: string
  }
  services: Array<{
    service: {
      name: string
      duration_minutes: number
    }
  }>
  preferred_date?: string
  preferred_time?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  notes?: string
  created_at: string
  zone?: {
    name: string
    color: string
  }
}

export function JobsList({ selectedDate, onDragStart, onCountChange }: JobsListProps) {
  const [jobs, setJobs] = useState<UnscheduledJob[]>([])
  const [filteredJobs, setFilteredJobs] = useState<UnscheduledJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [zoneFilter, setZoneFilter] = useState<string>('all')

  useEffect(() => {
    loadJobs()
  }, [selectedDate])

  useEffect(() => {
    filterJobs()
  }, [jobs, searchTerm, priorityFilter, zoneFilter])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const data = await getUnscheduledJobsAction()
      setJobs(data)
      onCountChange?.(data.length)
    } catch (error) {
      console.error('Failed to load unscheduled jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterJobs = () => {
    let filtered = [...jobs]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(job =>
        job.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.customer.address?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(job => job.priority === priorityFilter)
    }

    // Zone filter
    if (zoneFilter !== 'all') {
      filtered = filtered.filter(job => job.zone?.name === zoneFilter)
    }

    setFilteredJobs(filtered)
  }

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData('jobId', jobId)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(jobId)
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'destructive'
      case 'high': return 'warning'
      case 'medium': return 'secondary'
      default: return 'outline'
    }
  }

  const getDaysOld = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Get unique zones for filter
  const zones = Array.from(new Set(jobs.map(j => j.zone?.name).filter(Boolean)))

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <h3 className="font-semibold">Unscheduled Jobs ({filteredJobs.length})</h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search customer or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {zones.length > 0 && (
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map(zone => (
                  <SelectItem key={zone} value={zone!}>
                    {zone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            Loading jobs...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchTerm || priorityFilter !== 'all' || zoneFilter !== 'all'
              ? 'No jobs match your filters'
              : 'No unscheduled jobs'}
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {filteredJobs.map(job => (
              <div
                key={job.id}
                draggable
                onDragStart={(e) => handleDragStart(e, job.id)}
                className={cn(
                  'p-3 bg-white border rounded-lg cursor-move hover:shadow-md transition-all',
                  job.priority === 'urgent' && 'border-red-300 bg-red-50',
                  job.priority === 'high' && 'border-orange-300 bg-orange-50'
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium truncate pr-2">{job.customer.name}</div>
                  <div className="flex items-center gap-1">
                    {job.priority && (
                      <Badge variant={getPriorityColor(job.priority)} className="text-xs">
                        {job.priority}
                      </Badge>
                    )}
                    {job.zone && (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: job.zone.color, color: job.zone.color }}
                      >
                        {job.zone.name}
                      </Badge>
                    )}
                  </div>
                </div>

                {job.customer.address && (
                  <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{job.customer.address}</span>
                  </div>
                )}

                <div className="space-y-1">
                  {job.services.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{s.service.name}</span>
                      <span className="text-gray-500">{s.service.duration_minutes} min</span>
                    </div>
                  ))}
                </div>

                {job.preferred_date && (
                  <div className="mt-2 pt-2 border-t flex items-center gap-1 text-xs text-blue-600">
                    <Calendar className="w-3 h-3" />
                    <span>Prefers: {format(new Date(job.preferred_date), 'MMM d')}</span>
                    {job.preferred_time && <span>at {job.preferred_time}</span>}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Created {getDaysOld(job.created_at)} days ago</span>
                  {getDaysOld(job.created_at) > 7 && (
                    <AlertCircle className="w-3 h-3 text-orange-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}