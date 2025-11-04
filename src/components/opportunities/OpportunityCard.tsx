'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  MoreVertical,
  CheckCircle2,
  XCircle,
  Edit,
  MessageSquare,
  DollarSign,
  Calendar,
  User,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface OpportunityCardProps {
  opportunity: {
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
  onStatusChange?: () => void
}

const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  declined_service: 'Declined Service',
  partial_booking: 'Partial Booking',
  price_objection: 'Price Objection',
  postponed_booking: 'Postponed',
  competitor_mention: 'Competitor',
  service_upsell: 'Upsell',
}

const OPPORTUNITY_TYPE_COLORS: Record<string, string> = {
  declined_service: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  partial_booking: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  price_objection: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  postponed_booking: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  competitor_mention: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  service_upsell: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

export function OpportunityCard({ opportunity, onStatusChange }: OpportunityCardProps) {
  const router = useRouter()
  const [converting, setConverting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  const [notes, setNotes] = useState('')

  // Calculate days since created
  const daysSinceCreated = Math.floor(
    (new Date().getTime() - new Date(opportunity.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  async function handleConvert() {
    try {
      setConverting(true)

      const res = await fetch(`/api/opportunities/${opportunity.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'converted',
          notes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to convert opportunity')
      }

      toast.success('Opportunity marked as converted!')
      setConvertDialogOpen(false)
      setNotes('')
      onStatusChange?.()
    } catch (error) {
      console.error('Convert error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to convert opportunity')
    } finally {
      setConverting(false)
    }
  }

  async function handleDecline() {
    try {
      setDeclining(true)

      const res = await fetch(`/api/opportunities/${opportunity.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'declined',
          notes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to decline opportunity')
      }

      toast.success('Opportunity marked as declined')
      setDeclineDialogOpen(false)
      setNotes('')
      onStatusChange?.()
    } catch (error) {
      console.error('Decline error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to decline opportunity')
    } finally {
      setDeclining(false)
    }
  }

  return (
    <>
      <Card className="p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs">
                  {getInitials(opportunity.customer.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{opportunity.customer.full_name}</p>
                <Badge
                  variant="secondary"
                  className={`text-xs ${
                    OPPORTUNITY_TYPE_COLORS[opportunity.opportunity_type] || ''
                  }`}
                >
                  {OPPORTUNITY_TYPE_LABELS[opportunity.opportunity_type] ||
                    opportunity.opportunity_type}
                </Badge>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/dashboard/customers/${opportunity.customer_id}`)
                  }
                >
                  <User className="h-4 w-4 mr-2" />
                  View Customer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConvertDialogOpen(true)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark Converted
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeclineDialogOpen(true)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Mark Declined
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Value */}
          {opportunity.estimated_value && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-green-600">
                ${opportunity.estimated_value.toFixed(2)}
              </span>
            </div>
          )}

          {/* Follow-up Date */}
          {opportunity.follow_up_scheduled_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {new Date(opportunity.follow_up_scheduled_date).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Assigned To */}
          {opportunity.assigned_user && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="truncate">{opportunity.assigned_user.full_name}</span>
            </div>
          )}

          {/* Days Since Created */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {daysSinceCreated === 0
                ? 'Today'
                : `${daysSinceCreated} day${daysSinceCreated > 1 ? 's' : ''} ago`}
            </span>
          </div>
        </div>
      </Card>

      {/* Convert Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Opportunity as Converted</DialogTitle>
            <DialogDescription>
              Great job! Mark this opportunity as successfully converted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="convert-notes">Notes (optional)</Label>
              <Textarea
                id="convert-notes"
                placeholder="Add any relevant details about the conversion..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvert} disabled={converting}>
              {converting ? 'Converting...' : 'Mark as Converted'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Opportunity as Declined</DialogTitle>
            <DialogDescription>
              Record why this opportunity was not converted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="decline-notes">Reason for decline</Label>
              <Textarea
                id="decline-notes"
                placeholder="Why didn't this opportunity convert?"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDecline} disabled={declining}>
              {declining ? 'Declining...' : 'Mark as Declined'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
