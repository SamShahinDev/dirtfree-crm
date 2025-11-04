'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Navigation,
  MapPin,
  Clock,
  Route,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react'
import { optimizeRoutesAction, getOptimizedRouteAction } from '@/app/actions/scheduling'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface RouteMapProps {
  date: Date
  technician: string | null
}

interface OptimizedRoute {
  technician: {
    id: string
    name: string
    color: string
  }
  jobs: Array<{
    id: string
    customer: {
      name: string
      address: string
      lat?: number
      lng?: number
    }
    scheduled_time: string
    duration: number
    distance_from_previous?: number
    travel_time?: number
    arrival_time?: string
  }>
  total_distance: number
  total_travel_time: number
  total_duration: number
  efficiency_score: number
  savings?: {
    distance: number
    time: number
  }
}

export function RouteMap({ date, technician }: RouteMapProps) {
  const [routes, setRoutes] = useState<OptimizedRoute[]>([])
  const [loading, setLoading] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [autoOptimize, setAutoOptimize] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)

  useEffect(() => {
    loadRoutes()
  }, [date, technician])

  const loadRoutes = async () => {
    setLoading(true)
    try {
      const data = await getOptimizedRouteAction(
        format(date, 'yyyy-MM-dd'),
        technician
      )
      setRoutes(data)
      if (data.length > 0 && !selectedRoute) {
        setSelectedRoute(data[0].technician.id)
      }
    } catch (error) {
      console.error('Failed to load routes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOptimize = async () => {
    setOptimizing(true)
    try {
      const optimized = await optimizeRoutesAction(
        format(date, 'yyyy-MM-dd'),
        technician
      )
      setRoutes(optimized)
    } catch (error) {
      console.error('Failed to optimize routes:', error)
    } finally {
      setOptimizing(false)
    }
  }

  const currentRoute = routes.find(r => r.technician.id === selectedRoute)

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Route className="h-4 w-4" />
            Route Optimization
          </h3>
          <Button
            size="sm"
            onClick={handleOptimize}
            disabled={optimizing}
          >
            {optimizing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <TrendingUp className="h-3 w-3 mr-1" />
                Optimize
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="auto-optimize" className="text-sm">
            Auto-optimize on changes
          </Label>
          <Switch
            id="auto-optimize"
            checked={autoOptimize}
            onCheckedChange={setAutoOptimize}
          />
        </div>
      </div>

      {/* Technician Tabs */}
      {routes.length > 1 && (
        <div className="flex gap-1 p-2 border-b bg-gray-50 overflow-x-auto">
          {routes.map(route => (
            <Button
              key={route.technician.id}
              variant={selectedRoute === route.technician.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRoute(route.technician.id)}
              className="whitespace-nowrap"
            >
              <div
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: route.technician.color }}
              />
              {route.technician.name}
            </Button>
          ))}
        </div>
      )}

      {/* Route Details */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            Loading routes...
          </div>
        ) : currentRoute ? (
          <div className="p-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Card className="p-3">
                <div className="text-xs text-gray-500">Total Distance</div>
                <div className="text-lg font-semibold">
                  {currentRoute.total_distance.toFixed(1)} mi
                </div>
                {currentRoute.savings && (
                  <div className="text-xs text-green-600">
                    Saved {currentRoute.savings.distance.toFixed(1)} mi
                  </div>
                )}
              </Card>

              <Card className="p-3">
                <div className="text-xs text-gray-500">Travel Time</div>
                <div className="text-lg font-semibold">
                  {Math.round(currentRoute.total_travel_time)} min
                </div>
                {currentRoute.savings && (
                  <div className="text-xs text-green-600">
                    Saved {Math.round(currentRoute.savings.time)} min
                  </div>
                )}
              </Card>

              <Card className="p-3">
                <div className="text-xs text-gray-500">Total Duration</div>
                <div className="text-lg font-semibold">
                  {Math.round(currentRoute.total_duration / 60)} hrs
                </div>
              </Card>

              <Card className="p-3">
                <div className="text-xs text-gray-500">Efficiency</div>
                <div className={cn(
                  'text-lg font-semibold',
                  currentRoute.efficiency_score >= 90 ? 'text-green-600' :
                  currentRoute.efficiency_score >= 75 ? 'text-yellow-600' :
                  'text-red-600'
                )}>
                  {currentRoute.efficiency_score}%
                </div>
              </Card>
            </div>

            <Separator className="mb-4" />

            {/* Route Steps */}
            <div className="space-y-2">
              <div className="text-sm font-medium mb-2">Route Schedule</div>

              {/* Starting Point */}
              <div className="flex items-start gap-3 p-2">
                <div className="mt-1">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <Navigation className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Start</div>
                  <div className="text-xs text-gray-500">Office/Home</div>
                  <div className="text-xs text-gray-500">8:00 AM</div>
                </div>
              </div>

              {/* Route Connection Line */}
              <div className="ml-3 h-4 border-l-2 border-dashed border-gray-300" />

              {/* Jobs */}
              {currentRoute.jobs.map((job, index) => (
                <div key={job.id}>
                  {index > 0 && (
                    <div className="flex items-center gap-2 ml-3 py-1">
                      <div className="flex-1 border-l-2 border-dashed border-gray-300 h-4" />
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {job.distance_from_previous?.toFixed(1)} mi • {job.travel_time} min
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 p-2 bg-white border rounded-lg">
                    <div className="mt-1">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {job.customer.name}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{job.customer.address}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {job.arrival_time || job.scheduled_time}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {job.duration} min
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}

              {/* End Point */}
              <div className="ml-3 h-4 border-l-2 border-dashed border-gray-300" />
              <div className="flex items-start gap-3 p-2">
                <div className="mt-1">
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <MapPin className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">End</div>
                  <div className="text-xs text-gray-500">Return to Office/Home</div>
                  <div className="text-xs text-gray-500">
                    ETA: {currentRoute.jobs.length > 0 ?
                      format(
                        new Date(`2024-01-01 ${currentRoute.jobs[currentRoute.jobs.length - 1].arrival_time}`).getTime() +
                        currentRoute.jobs[currentRoute.jobs.length - 1].duration * 60000,
                        'h:mm a'
                      ) : 'N/A'
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Optimization Tips */}
            {currentRoute.efficiency_score < 90 && (
              <Card className="mt-4 p-3 bg-yellow-50 border-yellow-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-yellow-900">
                      Optimization Suggestions
                    </div>
                    <ul className="mt-1 text-xs text-yellow-700 space-y-1">
                      <li>• Consider grouping jobs by zone</li>
                      <li>• Adjust time windows for better routing</li>
                      <li>• Balance workload across technicians</li>
                    </ul>
                  </div>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">
            No routes to display
          </div>
        )}
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <Button className="flex-1" size="sm">
            <Play className="h-3 w-3 mr-1" />
            Start Navigation
          </Button>
          <Button variant="outline" className="flex-1" size="sm">
            Apply Routes
          </Button>
        </div>
      </div>
    </div>
  )
}