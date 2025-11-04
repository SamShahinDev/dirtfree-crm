'use client'

import { useState } from 'react'
import { OpportunityCard } from './OpportunityCard'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

interface Opportunity {
  id: string
  customer_id: string
  customer: {
    full_name: string
  }
  opportunity_type: string
  estimated_value: number | null
  created_at: string
  follow_up_scheduled_date: string | null
  assigned_user: {
    full_name: string
  } | null
  status: string
}

interface OpportunityBoardProps {
  opportunities: Opportunity[]
  onUpdate?: () => void
}

const PIPELINE_COLUMNS = [
  {
    id: 'pending',
    title: 'Pending',
    description: 'New opportunities',
    color: 'bg-slate-100 dark:bg-slate-800',
  },
  {
    id: 'offer_scheduled',
    title: 'Offer Scheduled',
    description: 'Auto-offer queued',
    color: 'bg-blue-100 dark:bg-blue-900',
  },
  {
    id: 'offer_sent',
    title: 'Offer Sent',
    description: 'Waiting for response',
    color: 'bg-purple-100 dark:bg-purple-900',
  },
  {
    id: 'follow_up_scheduled',
    title: 'Follow-up Scheduled',
    description: 'Staff follow-up planned',
    color: 'bg-yellow-100 dark:bg-yellow-900',
  },
  {
    id: 'contacted',
    title: 'In Progress',
    description: 'Actively working',
    color: 'bg-orange-100 dark:bg-orange-900',
  },
  {
    id: 'converted',
    title: 'Converted',
    description: 'Won!',
    color: 'bg-green-100 dark:bg-green-900',
  },
  {
    id: 'declined',
    title: 'Declined',
    description: 'Lost',
    color: 'bg-red-100 dark:bg-red-900',
  },
  {
    id: 'expired',
    title: 'Expired',
    description: 'No response',
    color: 'bg-gray-100 dark:bg-gray-800',
  },
]

export function OpportunityBoard({ opportunities, onUpdate }: OpportunityBoardProps) {
  const [draggedOpportunity, setDraggedOpportunity] = useState<Opportunity | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  // Group opportunities by status
  const opportunitiesByStatus = PIPELINE_COLUMNS.reduce((acc, column) => {
    acc[column.id] = opportunities.filter((opp) => opp.status === column.id)
    return acc
  }, {} as Record<string, Opportunity[]>)

  function handleDragStart(opportunity: Opportunity) {
    setDraggedOpportunity(opportunity)
  }

  function handleDragEnd() {
    setDraggedOpportunity(null)
    setDragOverColumn(null)
  }

  function handleDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault()
    setDragOverColumn(columnId)
  }

  function handleDragLeave() {
    setDragOverColumn(null)
  }

  async function handleDrop(e: React.DragEvent, newStatus: string) {
    e.preventDefault()
    setDragOverColumn(null)

    if (!draggedOpportunity || draggedOpportunity.status === newStatus) {
      setDraggedOpportunity(null)
      return
    }

    try {
      setUpdating(true)

      const res = await fetch(`/api/opportunities/${draggedOpportunity.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notes: `Moved from ${draggedOpportunity.status} to ${newStatus}`,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to update status')
      }

      toast.success('Opportunity status updated')
      onUpdate?.()
    } catch (error) {
      console.error('Update error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setUpdating(false)
      setDraggedOpportunity(null)
    }
  }

  function calculateColumnValue(opportunities: Opportunity[]): number {
    return opportunities.reduce((sum, opp) => sum + (opp.estimated_value || 0), 0)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PIPELINE_COLUMNS.map((column) => {
        const columnOpportunities = opportunitiesByStatus[column.id] || []
        const columnValue = calculateColumnValue(columnOpportunities)
        const isDragOver = dragOverColumn === column.id

        return (
          <div
            key={column.id}
            className="flex-shrink-0 w-80"
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <Card
              className={`h-full ${
                isDragOver ? 'ring-2 ring-primary ring-offset-2' : ''
              } transition-all`}
            >
              <CardHeader className={`pb-3 ${column.color}`}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    {column.title}
                  </CardTitle>
                  <Badge variant="secondary">{columnOpportunities.length}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{column.description}</p>
                {columnValue > 0 && (
                  <p className="text-sm font-semibold text-green-600">
                    ${columnValue.toFixed(2)}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-3">
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <div className="space-y-3">
                    {columnOpportunities.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No opportunities
                      </div>
                    ) : (
                      columnOpportunities.map((opportunity) => (
                        <div
                          key={opportunity.id}
                          draggable={!updating}
                          onDragStart={() => handleDragStart(opportunity)}
                          onDragEnd={handleDragEnd}
                          className={
                            draggedOpportunity?.id === opportunity.id ? 'opacity-50' : ''
                          }
                        >
                          <OpportunityCard
                            opportunity={opportunity}
                            onStatusChange={onUpdate}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
