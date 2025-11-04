'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import {
  Calendar,
  Phone,
  MapPin,
  User,
  Clock,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff
} from 'lucide-react'

import { useDebouncedValue } from '@/lib/hooks/use-debounced-value'
import { getWeekBounds, formatDateForCalendar } from '@/lib/schedule/time'
import { getStatusColor, getServiceTypeDisplay } from '@/types/job'

import {
  listTechWeeklyJobs,
  type TechWeeklyData
} from './actions'

import { TechWeeklyView } from './_components/TechWeeklyView'

export default function TechWeeklyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [weeklyData, setWeeklyData] = useState<TechWeeklyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  // Filters
  const [selectedDate, setSelectedDate] = useState(() => {
    const dateParam = searchParams.get('date')
    return dateParam || new Date().toISOString().split('T')[0]
  })
  const [technicianId, setTechnicianId] = useState<string | null>(null)

  // Initialize from URL params
  useEffect(() => {
    const dateParam = searchParams.get('date')
    const techParam = searchParams.get('technicianId')

    if (dateParam) {
      setSelectedDate(dateParam)
    }

    if (techParam) {
      setTechnicianId(techParam)
    }
  }, [searchParams])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Update URL when filters change
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams()

    if (selectedDate !== new Date().toISOString().split('T')[0]) {
      params.set('date', selectedDate)
    }

    if (technicianId) {
      params.set('technicianId', technicianId)
    }

    const newUrl = params.toString() ? `?${params.toString()}` : '/schedule/tech-weekly'
    router.replace(newUrl, { scroll: false })
  }, [selectedDate, technicianId, router])

  // Debounced URL update
  const debouncedUpdateUrl = useDebouncedValue(updateUrlParams, 500)
  useEffect(() => {
    debouncedUpdateUrl()
  }, [debouncedUpdateUrl])

  // Load weekly data
  const loadWeeklyData = useCallback(async () => {
    try {
      const isRefresh = !loading
      if (isRefresh) {
        setRefreshing(true)
      }

      // Calculate week bounds
      const weekBounds = getWeekBounds(new Date(selectedDate))

      const response = await listTechWeeklyJobs({
        from: weekBounds.start.toISOString(),
        to: weekBounds.end.toISOString(),
        technicianId
      })

      if (response.ok && response.data) {
        setWeeklyData(response.data)

        // Cache data for offline use
        if ('caches' in window && isOnline) {
          const cache = await caches.open('tech-weekly-v1')
          const cacheKey = `/tech-weekly/${selectedDate}${technicianId ? `/${technicianId}` : ''}`
          const cacheData = new Response(JSON.stringify(response.data))
          await cache.put(cacheKey, cacheData)
        }
      } else {
        // Try to load from cache if offline
        if (!isOnline && 'caches' in window) {
          const cache = await caches.open('tech-weekly-v1')
          const cacheKey = `/tech-weekly/${selectedDate}${technicianId ? `/${technicianId}` : ''}`
          const cachedResponse = await cache.match(cacheKey)

          if (cachedResponse) {
            const cachedData = await cachedResponse.json()
            setWeeklyData(cachedData)
            toast.info('Loaded cached data (offline mode)')
          } else {
            toast.error('No cached data available offline')
            setWeeklyData(null)
          }
        } else {
          toast.error(response.error || 'Failed to load weekly schedule')
          setWeeklyData(null)
        }
      }
    } catch (error) {
      console.error('Failed to load weekly data:', error)

      // Try to load from cache on error
      if ('caches' in window) {
        try {
          const cache = await caches.open('tech-weekly-v1')
          const cacheKey = `/tech-weekly/${selectedDate}${technicianId ? `/${technicianId}` : ''}`
          const cachedResponse = await cache.match(cacheKey)

          if (cachedResponse) {
            const cachedData = await cachedResponse.json()
            setWeeklyData(cachedData)
            toast.info('Loaded cached data due to connection error')
          } else {
            toast.error('Failed to load weekly schedule')
            setWeeklyData(null)
          }
        } catch (cacheError) {
          toast.error('Failed to load weekly schedule')
          setWeeklyData(null)
        }
      } else {
        toast.error('Failed to load weekly schedule')
        setWeeklyData(null)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedDate, technicianId, loading, isOnline])

  // Load data when filters change
  useEffect(() => {
    loadWeeklyData()
  }, [loadWeeklyData])

  // Navigation
  const navigateWeek = (direction: 'prev' | 'next' | 'today') => {
    let newDate = new Date(selectedDate)

    if (direction === 'today') {
      newDate = new Date()
    } else if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else if (direction === 'next') {
      newDate.setDate(newDate.getDate() + 7)
    }

    setSelectedDate(newDate.toISOString().split('T')[0])
  }

  const handleRefresh = () => {
    if (!isOnline) {
      toast.error('Cannot refresh while offline')
      return
    }
    loadWeeklyData()
  }

  const getWeekDisplay = () => {
    const weekBounds = getWeekBounds(new Date(selectedDate))
    return `${formatDateForCalendar(weekBounds.start)} - ${formatDateForCalendar(weekBounds.end)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tech Weekly</h1>
              <p className="text-muted-foreground text-sm">Mobile schedule view</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-first header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Tech Weekly</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isOnline ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || !isOnline}
              className="gap-1"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Week navigation */}
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <div className="text-sm font-medium">{getWeekDisplay()}</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateWeek('today')}
                className="text-xs text-muted-foreground"
              >
                Today
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick stats */}
          {weeklyData && (
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{weeklyData.totalJobs} jobs</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>{weeklyData.zoneGroups.length} zones</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-md mx-auto p-4">
        {weeklyData ? (
          <TechWeeklyView data={weeklyData} currentUserId={weeklyData.currentUserId} />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No jobs scheduled</h3>
              <p className="text-sm text-muted-foreground text-center">
                There are no jobs scheduled for this week.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}