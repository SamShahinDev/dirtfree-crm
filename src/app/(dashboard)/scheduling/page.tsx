'use client'

import { useState } from 'react'
import { Calendar } from '@/components/scheduling/calendar'
import { TechnicianList } from '@/components/scheduling/technician-list'
import { RouteMap } from '@/components/scheduling/route-map'
import { SchedulingToolbar } from '@/components/scheduling/toolbar'
import { JobsList } from '@/components/scheduling/jobs-list'
import { SchedulingSidebar } from '@/components/scheduling/sidebar'

export default function SchedulingPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null)
  const [view, setView] = useState<'day' | 'week' | 'month'>('week')
  const [showRouteOptimization, setShowRouteOptimization] = useState(false)
  const [draggedJob, setDraggedJob] = useState<string | null>(null)

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Toolbar */}
      <SchedulingToolbar
        selectedDate={selectedDate}
        view={view}
        onDateChange={setSelectedDate}
        onViewChange={setView}
        showRouteOptimization={showRouteOptimization}
        onToggleRouteOptimization={setShowRouteOptimization}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Technicians and Unscheduled Jobs */}
        <SchedulingSidebar
          selectedTechnician={selectedTechnician}
          onSelectTechnician={setSelectedTechnician}
          selectedDate={selectedDate}
          onDragStart={setDraggedJob}
        />

        {/* Main Calendar Area */}
        <div className="flex-1 flex">
          <div className={showRouteOptimization ? 'w-2/3' : 'w-full'}>
            <Calendar
              date={selectedDate}
              view={view}
              technician={selectedTechnician}
              draggedJob={draggedJob}
              onDragEnd={() => setDraggedJob(null)}
            />
          </div>

          {/* Route Optimization Panel */}
          {showRouteOptimization && (
            <div className="w-1/3 border-l bg-white">
              <RouteMap
                date={selectedDate}
                technician={selectedTechnician}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}