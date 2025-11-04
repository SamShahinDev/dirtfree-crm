'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  Clock,
  DollarSign,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface FollowUpCardProps {
  opportunity: {
    id: string
    customer_id: string
    customer: {
      full_name: string
      email: string | null
      phone: string | null
    }
    opportunity_type: string
    estimated_value: number | null
    reason: string | null
    follow_up_scheduled_date: string | null
    assigned_user: {
      full_name: string
    } | null
    created_at: string
    status: string
  }
  variant?: 'today' | 'overdue' | 'upcoming'
  onComplete?: () => void
}

const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  declined_service: 'Declined Service',
  partial_booking: 'Partial Booking',
  price_objection: 'Price Objection',
  postponed_booking: 'Postponed',
  competitor_mention: 'Competitor',
  service_upsell: 'Upsell',
}

export function FollowUpCard({ opportunity, variant = 'today', onComplete }: FollowUpCardProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [completing, setCompleting] = useState(false)

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  function calculateDaysOverdue(): number {
    if (!opportunity.follow_up_scheduled_date) return 0
    const dueDate = new Date(opportunity.follow_up_scheduled_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffTime = today.getTime() - dueDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  function handleCall() {
    if (opportunity.customer.phone) {
      window.location.href = `tel:${opportunity.customer.phone}`
    } else {
      toast.error('No phone number available')
    }
  }

  function handleEmail() {
    if (opportunity.customer.email) {
      window.location.href = `mailto:${opportunity.customer.email}`
    } else {
      toast.error('No email address available')
    }
  }

  async function handleComplete() {
    try {
      setCompleting(true)
      router.push(`/dashboard/opportunities/${opportunity.id}/follow-up`)
    } finally {
      setCompleting(false)
    }
  }

  function handleSnooze() {
    router.push(`/dashboard/opportunities/${opportunity.id}/follow-up?action=snooze`)
  }

  const daysOverdue = variant === 'overdue' ? calculateDaysOverdue() : 0
  const borderColor =
    variant === 'overdue' ? 'border-l-4 border-l-red-500' : variant === 'today' ? 'border-l-4 border-l-blue-500' : ''

  return (
    <Card className={`hover:shadow-md transition-shadow ${borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback className="text-sm">
                {getInitials(opportunity.customer.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-base truncate">
                  {opportunity.customer.full_name}
                </h3>
                {variant === 'overdue' && (
                  <Badge variant="destructive" className="text-xs">
                    {daysOverdue} day{daysOverdue > 1 ? 's' : ''} overdue
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {OPPORTUNITY_TYPE_LABELS[opportunity.opportunity_type] ||
                    opportunity.opportunity_type}
                </Badge>
                {opportunity.estimated_value && (
                  <span className="text-sm font-semibold text-green-600">
                    ${opportunity.estimated_value.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Quick Info */}
        <div className="space-y-2 mb-4">
          {opportunity.follow_up_scheduled_date && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Due: {new Date(opportunity.follow_up_scheduled_date).toLocaleDateString()}
              </span>
            </div>
          )}

          {opportunity.assigned_user && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{opportunity.assigned_user.full_name}</span>
            </div>
          )}

          {opportunity.customer.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <a
                href={`tel:${opportunity.customer.phone}`}
                className="hover:text-foreground hover:underline"
              >
                {opportunity.customer.phone}
              </a>
            </div>
          )}

          {opportunity.customer.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a
                href={`mailto:${opportunity.customer.email}`}
                className="hover:text-foreground hover:underline truncate"
              >
                {opportunity.customer.email}
              </a>
            </div>
          )}
        </div>

        {/* Expanded Details */}
        {expanded && opportunity.reason && (
          <div className="mb-4 p-3 bg-muted rounded-md">
            <p className="text-sm font-medium mb-1">Original Reason:</p>
            <p className="text-sm text-muted-foreground">{opportunity.reason}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleCall} disabled={!opportunity.customer.phone}>
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>
          <Button size="sm" variant="outline" onClick={handleEmail} disabled={!opportunity.customer.email}>
            <Mail className="h-4 w-4 mr-2" />
            Email
          </Button>
          <Button size="sm" onClick={handleComplete} disabled={completing}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Complete
          </Button>
          <Button size="sm" variant="outline" onClick={handleSnooze}>
            <Clock className="h-4 w-4 mr-2" />
            Snooze
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/dashboard/customers/${opportunity.customer_id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Customer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
