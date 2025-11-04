'use client'

import { X, MapPin, Clock, ExternalLink, Edit } from 'lucide-react'
import { ZoneBoardJob } from '@/types/zone-board'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface JobPopupProps {
  job: ZoneBoardJob
  onClose: () => void
  onEdit?: (job: ZoneBoardJob) => void
}

const ZONE_COLORS = {
  N: '#3b82f6',
  S: '#10b981',
  E: '#f97316',
  W: '#a855f7',
}

export function JobPopup({ job, onClose, onEdit }: JobPopupProps) {
  const router = useRouter()

  const handleViewDetails = () => {
    // Navigate to calendar view with this job's date selected
    const dateParam = job.scheduledDate
    router.push(`/schedule/calendar?date=${dateParam}&jobId=${job.id}`)
  }

  const handleEditJob = () => {
    if (onEdit) {
      // Use the edit handler to open dialog in place
      onEdit(job)
    } else {
      // Fallback: navigate to jobs page
      router.push(`/jobs?edit=${job.id}`)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-2xl p-4 min-w-[280px] max-w-[320px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{job.customerName}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs px-2 py-1 rounded-full font-medium"
              style={{
                backgroundColor:
                  (ZONE_COLORS[job.zone as keyof typeof ZONE_COLORS] || '#6b7280') + '20',
                color: ZONE_COLORS[job.zone as keyof typeof ZONE_COLORS] || '#6b7280'
              }}
            >
              Zone {job.zone}
            </span>
            <span className="text-xs text-gray-600">{job.duration}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
          <div className="text-gray-700">
            <div>{job.address}</div>
            <div className="text-gray-500">{job.city}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="text-gray-700">
            {new Date(job.scheduledDate).toLocaleDateString()} at {job.scheduledTime}
          </span>
        </div>

        {job.description && (
          <div className="pt-2 border-t">
            <p className="text-gray-600 text-xs">{job.description}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleViewDetails}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          View Details
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleEditJob}
        >
          <Edit className="h-3.5 w-3.5 mr-1.5" />
          Edit Job
        </Button>
      </div>
    </div>
  )
}
