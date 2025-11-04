'use client'

import React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

import {
  MapPin,
  Users,
  Briefcase,
  AlertTriangle,
  Compass,
  Target,
  Inbox
} from 'lucide-react'

import { getZoneConfig, type BucketKey } from '@/lib/schedule/board'
import type { ZoneColumnData } from '../actions'
import { Bucket } from './Bucket'

export interface ZoneColumnProps {
  column: ZoneColumnData
  onAssignTech?: (jobId: string) => void
  onMoveToRule?: (jobId: string, bucket: BucketKey) => void
  onMarkInProgress?: (jobId: string) => void
  onMarkComplete?: (jobId: string) => void
  onMarkCancelled?: (jobId: string) => void
  onUnassignTech?: (jobId: string) => void
  onQuickCreate?: (zone: string | null, bucket: BucketKey) => void
}

export function ZoneColumn({
  column,
  onAssignTech,
  onMoveToRule,
  onMarkInProgress,
  onMarkComplete,
  onMarkCancelled,
  onUnassignTech,
  onQuickCreate
}: ZoneColumnProps) {
  const isUnassigned = column.zone === null
  const zoneConfig = column.zone
    ? getZoneConfig(column.zone as 'N' | 'S' | 'E' | 'W' | 'Central')
    : getZoneConfig('unassigned')

  // Get appropriate icon
  const ZoneIcon = zoneConfig.icon === 'compass' ? Compass :
                   zoneConfig.icon === 'target' ? Target : Inbox

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  const calculateCapacityUsage = () => {
    // Assuming 8-hour workday (480 minutes) per technician
    const maxCapacityPerTech = 480
    const totalTechs = column.techCapacity.length || 1
    const totalCapacity = maxCapacityPerTech * totalTechs
    const usedCapacity = column.totalMinutes

    return {
      percentage: Math.min((usedCapacity / totalCapacity) * 100, 100),
      overCapacity: usedCapacity > totalCapacity,
      totalCapacity,
      usedCapacity
    }
  }

  const capacity = calculateCapacityUsage()

  return (
    <Card className="h-fit shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Enhanced Zone Header with gradient */}
      <CardHeader className={`bg-gradient-to-br ${zoneConfig.gradient} border-l-4 ${zoneConfig.borderColor} p-4 shadow-sm`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-white shadow-sm ${zoneConfig.borderColor.replace('border', 'ring-1 ring')}`}>
              <ZoneIcon className="h-5 w-5 text-gray-700" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{column.label}</h3>
          </div>

          {/* Enhanced job count badge */}
          <div className="px-3 py-1.5 bg-white rounded-full shadow-sm border">
            <span className="text-sm font-semibold text-gray-900">
              {column.totalJobs} {column.totalJobs === 1 ? 'job' : 'jobs'}
            </span>
          </div>
        </div>

        {/* Zone stats */}
        {!isUnassigned && (
          <div className="space-y-2">
            {/* Enhanced capacity indicator */}
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 space-y-2 border">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Capacity</span>
                <span className={capacity.overCapacity ? 'text-red-600 font-semibold' : 'text-gray-600 font-medium'}>
                  {formatMinutes(capacity.usedCapacity)} / {formatMinutes(capacity.totalCapacity)}
                </span>
              </div>

              <Progress
                value={capacity.percentage}
                className={`h-2.5 ${capacity.overCapacity ? '[&>div]:bg-red-500' : '[&>div]:bg-gradient-to-r [&>div]:from-blue-500 [&>div]:to-blue-600'}`}
              />

              {capacity.overCapacity && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Over capacity</span>
                </div>
              )}
            </div>

            {/* Technician breakdown */}
            {column.techCapacity.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>Technicians ({column.techCapacity.length})</span>
                </div>

                <div className="space-y-1">
                  {column.techCapacity.slice(0, 3).map((tech) => (
                    <div key={tech.technicianId} className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium" title={tech.technicianName}>
                        {tech.technicianName}
                      </span>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{tech.assignedJobs} jobs</span>
                        <span>•</span>
                        <span>{formatMinutes(tech.estimatedMinutes)}</span>
                      </div>
                    </div>
                  ))}

                  {column.techCapacity.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{column.techCapacity.length - 3} more technicians
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No technicians message */}
            {column.techCapacity.length === 0 && column.totalJobs > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3" />
                <span>No technicians assigned</span>
              </div>
            )}
          </div>
        )}

        {/* Unassigned zone info */}
        {isUnassigned && column.totalJobs > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Briefcase className="h-3 w-3" />
              <span>Jobs awaiting assignment</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Estimated time: {formatMinutes(column.totalMinutes)}
            </div>
          </div>
        )}
      </CardHeader>

      <Separator />

      <CardContent className="p-0">
        <div className="space-y-4 p-4">
          {/* Render buckets */}
          {column.buckets.map((bucket) => (
            <Bucket
              key={bucket.key}
              bucket={bucket}
              zone={column.zone}
              onAssignTech={onAssignTech}
              onMoveToRule={onMoveToRule}
              onMarkInProgress={onMarkInProgress}
              onMarkComplete={onMarkComplete}
              onMarkCancelled={onMarkCancelled}
              onUnassignTech={onUnassignTech}
              onQuickCreate={onQuickCreate}
              isUnassigned={isUnassigned}
            />
          ))}

          {/* Enhanced empty zone message */}
          {column.totalJobs === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${zoneConfig.gradient} border-2 ${zoneConfig.borderColor} flex items-center justify-center mb-4 shadow-sm`}>
                <ZoneIcon className="h-8 w-8 text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">No jobs in this zone</p>
              {!isUnassigned && (
                <button
                  onClick={() => onQuickCreate?.(column.zone, 'any')}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                >
                  + Create job to get started
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}