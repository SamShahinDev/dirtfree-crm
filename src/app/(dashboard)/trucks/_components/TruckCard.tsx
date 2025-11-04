'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Truck, AlertTriangle, Package, Calendar } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatVehicleLabel, formatMaintenanceDate, getMaintenanceUrgency } from '@/lib/trucks/format'
import type { TruckCard as TruckCardType } from '@/types/truck'
import { cn } from '@/lib/utils'

interface TruckCardProps {
  truck: TruckCardType
}

export function TruckCard({ truck }: TruckCardProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState(false)

  // Get signed URL for photo if available
  useEffect(() => {
    if (truck.photoKey && !photoError) {
      fetch(`/api/uploads/sign?key=${encodeURIComponent(truck.photoKey)}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.url) {
            setPhotoUrl(data.url)
          }
        })
        .catch(() => setPhotoError(true))
    }
  }, [truck.photoKey, photoError])

  const maintenanceUrgency = getMaintenanceUrgency(truck.nextMaintenanceAt)
  const vehicleLabel = formatVehicleLabel(truck.vehicleNumber, truck.nickname)

  return (
    <Link
      href={`/trucks/${truck.id}`}
      className="block transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
      aria-label={`View details for ${vehicleLabel}`}
    >
      <Card className="h-full rounded-lg border-2 hover:border-blue-200 transition-colors">
        <CardContent className="p-5 lg:p-6 space-y-4">
          {/* Header with photo and vehicle info */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              {/* Vehicle photo or icon */}
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {photoUrl && !photoError ? (
                  <Image
                    src={photoUrl}
                    alt={`${vehicleLabel} photo`}
                    fill
                    className="object-cover"
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Truck className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Vehicle number and nickname */}
              <div>
                <h3 className="font-semibold text-gray-900">
                  Truck #{truck.vehicleNumber}
                </h3>
                {truck.nickname && (
                  <p className="text-sm text-gray-600">{truck.nickname}</p>
                )}
              </div>
            </div>
          </div>

          {/* Maintenance date */}
          <div className="flex items-center space-x-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Next maintenance:</span>
            <span
              className={cn(
                'font-medium',
                maintenanceUrgency === 'overdue' && 'text-red-600',
                maintenanceUrgency === 'urgent' && 'text-orange-600',
                maintenanceUrgency === 'soon' && 'text-yellow-600',
                maintenanceUrgency === 'ok' && 'text-gray-900'
              )}
            >
              {formatMaintenanceDate(truck.nextMaintenanceAt)}
            </span>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {/* Open issues badge */}
            {truck.openIssuesCount > 0 && (
              <Badge
                variant="destructive"
                className="flex items-center space-x-1"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>
                  {truck.openIssuesCount} {truck.openIssuesCount === 1 ? 'issue' : 'issues'}
                </span>
              </Badge>
            )}

            {/* Low stock badge */}
            {truck.lowStockCount > 0 && (
              <Badge
                variant="outline"
                className="flex items-center space-x-1 border-orange-300 text-orange-700 bg-orange-50"
              >
                <Package className="w-3 h-3" />
                <span>
                  {truck.lowStockCount} low
                </span>
              </Badge>
            )}

            {/* Maintenance overdue badge */}
            {maintenanceUrgency === 'overdue' && (
              <Badge
                variant="destructive"
                className="flex items-center space-x-1"
              >
                <Calendar className="w-3 h-3" />
                <span>Maintenance overdue</span>
              </Badge>
            )}

            {/* No issues badge */}
            {truck.openIssuesCount === 0 && truck.lowStockCount === 0 && maintenanceUrgency !== 'overdue' && (
              <Badge
                variant="secondary"
                className="text-green-700 bg-green-50"
              >
                All good
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}