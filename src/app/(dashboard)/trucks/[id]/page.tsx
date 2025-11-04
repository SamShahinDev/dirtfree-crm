import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Upload, Calendar, Truck } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { requireAuth } from '@/lib/auth/guards'
import { getUserRole } from '@/lib/auth/roles'
import { getTruck, listTruckTools } from '../actions'
import { formatVehicleLabel, formatMaintenanceDate, getMaintenanceUrgency } from '@/lib/trucks/format'
import { VehicleBoard } from './_components/VehicleBoard'
import { ToolsTable } from './_components/ToolsTable'
import { MaintenanceTab } from './_components/MaintenanceTab'

interface TruckPageProps {
  params: Promise<{
    id: string
  }>
}

async function TruckHeader({ truckId }: { truckId: string }) {
  const user = await requireAuth()
  const role = await getUserRole(user.id)
  const canManage = role === 'admin' || role === 'dispatcher'

  const result = await getTruck({ id: truckId })

  if (!result.success || !result.data) {
    return notFound()
  }

  const truck = result.data
  const vehicleLabel = formatVehicleLabel(truck.vehicleNumber, truck.nickname)
  const maintenanceUrgency = getMaintenanceUrgency(truck.nextMaintenanceAt)

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{vehicleLabel}</h1>
          </div>
          {truck.nickname && (
            <p className="text-gray-600 ml-13">Vehicle #{truck.vehicleNumber}</p>
          )}
        </div>

        {canManage && (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="text-gray-600 relative z-20 cursor-pointer"
            aria-label="Upload truck photo (coming soon)"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Photo
          </Button>
        )}
      </div>

      {/* Maintenance status */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600">Next maintenance:</span>
          <span
            className={
              maintenanceUrgency === 'overdue'
                ? 'font-medium text-red-600'
                : maintenanceUrgency === 'urgent'
                ? 'font-medium text-orange-600'
                : maintenanceUrgency === 'soon'
                ? 'font-medium text-yellow-600'
                : 'font-medium text-gray-900'
            }
          >
            {formatMaintenanceDate(truck.nextMaintenanceAt)}
          </span>
        </div>

        {maintenanceUrgency === 'overdue' && (
          <Badge variant="destructive" className="text-xs">
            Overdue
          </Badge>
        )}
      </div>
    </div>
  )
}

async function TruckTools({ truckId }: { truckId: string }) {
  const user = await requireAuth()
  const role = await getUserRole(user.id)
  const canEdit = role === 'admin' || role === 'dispatcher'

  const result = await listTruckTools({ id: truckId })

  if (!result.success) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-red-700">Failed to load tools. Please try again.</p>
      </div>
    )
  }

  return <ToolsTable tools={result.data} truckId={truckId} canEdit={canEdit} />
}

export default async function TruckPage({ params }: TruckPageProps) {
  const resolvedParams = await params
  const truckId = resolvedParams.id

  console.log('[TruckDetailPage] Truck ID from params:', {
    truckId,
    truckIdType: typeof truckId,
    truckIdLength: truckId ? truckId.length : 0,
    isValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(truckId || '')
  })

  // Verify the truck exists
  const truckResult = await getTruck({ id: truckId })
  if (!truckResult.success || !truckResult.data) {
    return notFound()
  }

  const user = await requireAuth()
  const role = await getUserRole(user.id)
  const canManage = role === 'admin' || role === 'dispatcher'

  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="bg-white rounded-lg border p-6 space-y-4 animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded" />
            <div className="h-6 w-32 bg-gray-100 rounded" />
          </div>
        }
      >
        <TruckHeader truckId={truckId} />
      </Suspense>

      <Tabs defaultValue="tools" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3 relative z-10">
          <TabsTrigger value="board" className="relative z-10 cursor-pointer">Vehicle Board</TabsTrigger>
          <TabsTrigger value="tools" className="relative z-10 cursor-pointer">Tools</TabsTrigger>
          <TabsTrigger value="maintenance" className="relative z-10 cursor-pointer">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="space-y-4 relative z-0">
          <VehicleBoard truckId={truckId} />
        </TabsContent>

        <TabsContent value="tools" className="space-y-4 relative z-0">
          <Suspense
            fallback={
              <div className="rounded-lg border p-6">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            }
          >
            <TruckTools truckId={truckId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4 relative z-0">
          <MaintenanceTab truckId={truckId} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  )
}