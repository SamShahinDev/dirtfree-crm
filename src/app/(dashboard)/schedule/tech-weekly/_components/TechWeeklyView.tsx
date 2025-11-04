'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

import {
  Phone,
  MapPin,
  Clock,
  User,
  Briefcase,
  Navigation,
  MessageCircle,
  Mail
} from 'lucide-react'

import { getStatusColor, getServiceTypeDisplay } from '@/types/job'
import { OnTheWayButton } from '@/components/shared/OnTheWayButton'
import type { TechWeeklyData, TechWeeklyJob } from '../actions'

export interface TechWeeklyViewProps {
  data: TechWeeklyData
  currentUserId?: string
}

export function TechWeeklyView({ data, currentUserId }: TechWeeklyViewProps) {
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set(['N', 'S', 'E', 'W', 'Central']))

  const toggleZone = (zone: string) => {
    setExpandedZones(prev => {
      const newSet = new Set(prev)
      if (newSet.has(zone)) {
        newSet.delete(zone)
      } else {
        newSet.add(zone)
      }
      return newSet
    })
  }

  const handlePhoneCall = (phoneNumber: string) => {
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`
    }
  }

  const handleSendSms = (phoneNumber: string) => {
    if (phoneNumber) {
      window.location.href = `sms:${phoneNumber}`
    }
  }

  const handleOpenMaps = (job: TechWeeklyJob) => {
    const { customer } = job
    const address = [
      customer.address_line1,
      customer.city,
      customer.state,
      customer.zip
    ].filter(Boolean).join(', ')

    if (address) {
      // Use Google Maps for navigation
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
      window.open(mapsUrl, '_blank')
    }
  }

  const getStatusBadgeProps = (status: string) => {
    const color = getStatusColor(status as any)
    switch (color) {
      case 'blue':
        return { className: 'bg-blue-100 text-blue-800 border-blue-200' }
      case 'yellow':
        return { className: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
      case 'green':
        return { className: 'bg-green-100 text-green-800 border-green-200' }
      case 'red':
        return { className: 'bg-red-100 text-red-800 border-red-200' }
      default:
        return { variant: 'outline' as const }
    }
  }

  const formatTime = (timeStart?: string | null, timeEnd?: string | null) => {
    if (!timeStart) return 'No time set'

    const formatTimeString = (time: string) => {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      return `${displayHour}:${minutes} ${ampm}`
    }

    const start = formatTimeString(timeStart)
    const end = timeEnd ? formatTimeString(timeEnd) : null

    return end ? `${start} - ${end}` : start
  }

  const formatDate = (dateString: string, dayName: string) => {
    const date = new Date(dateString)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${dayName} ${month}/${day}`
  }

  return (
    <div className="space-y-4">
      {data.technicianName && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{data.technicianName}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {data.zoneGroups.map((zoneGroup) => {
        const isExpanded = expandedZones.has(zoneGroup.zone || 'unassigned')

        return (
          <Card key={zoneGroup.zone || 'unassigned'}>
            <CardHeader
              className="pb-3 cursor-pointer"
              onClick={() => toggleZone(zoneGroup.zone || 'unassigned')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {zoneGroup.zoneName}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {zoneGroup.totalJobs} jobs
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {isExpanded ? '−' : '+'}
                  </div>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {zoneGroup.days.map((day) => (
                    <div key={day.date}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-sm font-medium text-muted-foreground">
                          {formatDate(day.date, day.dayName)}
                        </div>
                        <Separator className="flex-1" />
                        <Badge variant="outline" className="text-xs">
                          {day.totalJobs}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        {day.jobs.map((job) => (
                          <Card key={job.id} className="border-l-4 border-l-blue-500">
                            <CardContent className="p-4">
                              {/* Customer info */}
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h4 className="font-medium text-base">
                                    {job.customer.name}
                                  </h4>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {[
                                      job.customer.address_line1,
                                      job.customer.city,
                                      job.customer.state
                                    ].filter(Boolean).join(', ')}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 ml-3">
                                  <Badge {...getStatusBadgeProps(job.status)} className="text-xs">
                                    {job.status.replace('_', ' ')}
                                  </Badge>
                                  {job.serviceType && (
                                    <Badge variant="outline" className="text-xs">
                                      {getServiceTypeDisplay(job.serviceType as any)}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Time */}
                              <div className="flex items-center gap-2 mb-3 text-sm">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>{formatTime(job.scheduledTimeStart, job.scheduledTimeEnd)}</span>
                              </div>

                              {/* Description */}
                              {job.description && (
                                <div className="mb-3 text-sm text-muted-foreground bg-gray-50 p-2 rounded">
                                  {job.description}
                                </div>
                              )}

                              {/* Action buttons */}
                              <div className="flex flex-wrap gap-2">
                                {/* On The Way button - only show for technician's own jobs */}
                                {currentUserId && job.technicianId === currentUserId && (
                                  <OnTheWayButton
                                    jobId={job.id}
                                    customerName={job.customer.name}
                                    customerPhone={job.customer.phone_e164}
                                    jobStatus={job.status}
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 gap-1"
                                    showTooltip={true}
                                  />
                                )}

                                {job.customer.phone_e164 && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handlePhoneCall(job.customer.phone_e164!)}
                                      className="flex-1 gap-1"
                                    >
                                      <Phone className="h-4 w-4" />
                                      Call
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSendSms(job.customer.phone_e164!)}
                                      className="flex-1 gap-1"
                                    >
                                      <MessageCircle className="h-4 w-4" />
                                      Text
                                    </Button>
                                  </>
                                )}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenMaps(job)}
                                  className="flex-1 gap-1"
                                >
                                  <Navigation className="h-4 w-4" />
                                  Maps
                                </Button>

                                {job.customer.email && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.location.href = `mailto:${job.customer.email}`}
                                    className="flex-1 gap-1"
                                  >
                                    <Mail className="h-4 w-4" />
                                    Email
                                  </Button>
                                )}
                              </div>

                              {/* Technician info (if different from filtered technician) */}
                              {!data.technicianName && job.technician && (
                                <div className="mt-3 pt-3 border-t">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Briefcase className="h-4 w-4" />
                                    <span>{job.technician.display_name || 'Unknown Technician'}</span>
                                    {job.technician.phone_e164 && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handlePhoneCall(job.technician!.phone_e164!)}
                                        className="p-1 h-auto"
                                      >
                                        <Phone className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {data.zoneGroups.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No jobs this week</h3>
            <p className="text-sm text-muted-foreground text-center">
              There are no jobs scheduled for this week.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}