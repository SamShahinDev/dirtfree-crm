'use client'

import { useState, useEffect } from 'react'
import { TechnicianList } from './technician-list'
import { JobsList } from './jobs-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface SchedulingSidebarProps {
  selectedTechnician: string | null
  onSelectTechnician: (id: string | null) => void
  selectedDate: Date
  onDragStart: (jobId: string) => void
}

export function SchedulingSidebar({
  selectedTechnician,
  onSelectTechnician,
  selectedDate,
  onDragStart
}: SchedulingSidebarProps) {
  const [unscheduledCount, setUnscheduledCount] = useState(0)

  return (
    <div className="w-80 border-r bg-white flex flex-col">
      <Tabs defaultValue="technicians" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
          <TabsTrigger value="jobs" className="relative">
            Jobs
            {unscheduledCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1">
                {unscheduledCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="technicians" className="flex-1 mt-0">
          <TechnicianList
            selectedTechnician={selectedTechnician}
            onSelectTechnician={onSelectTechnician}
            selectedDate={selectedDate}
          />
        </TabsContent>

        <TabsContent value="jobs" className="flex-1 mt-0">
          <JobsList
            selectedDate={selectedDate}
            onDragStart={onDragStart}
            onCountChange={setUnscheduledCount}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}