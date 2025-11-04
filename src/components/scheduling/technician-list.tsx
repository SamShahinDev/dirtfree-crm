'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { User, Clock, MapPin, Calendar, TrendingUp } from 'lucide-react'
import { getTechniciansWithStatsAction } from '@/app/actions/scheduling'
import { format } from 'date-fns'

interface TechnicianListProps {
  selectedTechnician: string | null
  onSelectTechnician: (id: string | null) => void
  selectedDate: Date
}

interface TechnicianWithStats {
  id: string
  name: string
  email: string
  phone?: string
  color?: string
  is_active: boolean
  stats?: {
    jobsToday: number
    completedToday: number
    totalHours: number
    efficiency: number
    nextAvailable?: string
  }
}

export function TechnicianList({
  selectedTechnician,
  onSelectTechnician,
  selectedDate
}: TechnicianListProps) {
  const [technicians, setTechnicians] = useState<TechnicianWithStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTechnicians()
  }, [selectedDate])

  const loadTechnicians = async () => {
    setLoading(true)
    try {
      const data = await getTechniciansWithStatsAction(format(selectedDate, 'yyyy-MM-dd'))
      setTechnicians(data)
    } catch (error) {
      console.error('Failed to load technicians:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading technicians...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Technicians</h3>
          <Button
            variant={selectedTechnician === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelectTechnician(null)}
          >
            All
          </Button>
        </div>
        <div className="text-sm text-gray-600">
          {format(selectedDate, 'EEEE, MMMM d')}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {technicians.map((tech) => (
            <div
              key={tech.id}
              className={cn(
                'p-3 rounded-lg border cursor-pointer transition-all',
                selectedTechnician === tech.id
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-white hover:bg-gray-50'
              )}
              onClick={() => onSelectTechnician(tech.id === selectedTechnician ? null : tech.id)}
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback
                    style={{ backgroundColor: tech.color || '#3B82F6' }}
                    className="text-white"
                  >
                    {tech.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{tech.name}</div>
                    {tech.is_active ? (
                      <Badge variant="success" className="text-xs">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Offline
                      </Badge>
                    )}
                  </div>

                  {tech.stats && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Jobs today
                        </span>
                        <span className="font-medium">
                          {tech.stats.completedToday}/{tech.stats.jobsToday}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Hours scheduled
                        </span>
                        <span className="font-medium">
                          {tech.stats.totalHours.toFixed(1)}h
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Efficiency
                        </span>
                        <span className={cn(
                          'font-medium',
                          tech.stats.efficiency >= 90 ? 'text-green-600' :
                          tech.stats.efficiency >= 75 ? 'text-yellow-600' :
                          'text-red-600'
                        )}>
                          {tech.stats.efficiency}%
                        </span>
                      </div>

                      {tech.stats.nextAvailable && (
                        <div className="pt-1 mt-1 border-t">
                          <div className="text-xs text-gray-500">
                            Next available: {tech.stats.nextAvailable}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-gray-50">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-gray-500">Total Jobs</div>
            <div className="text-lg font-semibold">
              {technicians.reduce((sum, t) => sum + (t.stats?.jobsToday || 0), 0)}
            </div>
          </div>
          <div>
            <div className="text-gray-500">Total Hours</div>
            <div className="text-lg font-semibold">
              {technicians.reduce((sum, t) => sum + (t.stats?.totalHours || 0), 0).toFixed(1)}h
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}