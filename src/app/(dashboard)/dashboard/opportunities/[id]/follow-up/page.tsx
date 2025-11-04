'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, Save, Loader2, Phone, Mail, MessageSquare, User, DollarSign } from 'lucide-react'
import Link from 'next/link'

interface Opportunity {
  id: string
  customer_id: string
  customer: {
    full_name: string
    email: string
    phone: string
  }
  opportunity_type: string
  estimated_value: number | null
  reason: string | null
  declined_services: string[]
  follow_up_scheduled_date: string | null
  assigned_user: {
    full_name: string
  } | null
  created_at: string
  status: string
}

interface Interaction {
  id: string
  interaction_type: string
  interaction_method: string
  notes: string
  created_at: string
  performed_by: {
    full_name: string
  }
}

const OUTCOME_OPTIONS = [
  { value: 'interested', label: 'Customer Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'callback_requested', label: 'Callback Requested' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'converted', label: 'Converted to Booking' },
  { value: 'declined', label: 'Permanently Declined' },
]

const INTERACTION_TYPES = [
  { value: 'call', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'sms', label: 'SMS', icon: MessageSquare },
  { value: 'meeting', label: 'Meeting', icon: User },
  { value: 'note', label: 'Note', icon: MessageSquare },
]

export default function FollowUpDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const opportunityId = params.id as string
  const action = searchParams.get('action')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [interactions, setInteractions] = useState<Interaction[]>([])

  // Form state
  const [formData, setFormData] = useState({
    interactionType: 'call',
    notes: '',
    outcome: '',
    nextFollowUpDate: '',
    nextFollowUpMethod: 'call',
    updateStatus: false,
  })

  useEffect(() => {
    loadOpportunity()
    loadInteractions()

    // Pre-fill snooze action
    if (action === 'snooze') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setFormData((prev) => ({
        ...prev,
        nextFollowUpDate: tomorrow.toISOString().split('T')[0],
      }))
    }
  }, [opportunityId, action])

  async function loadOpportunity() {
    try {
      setLoading(true)

      const res = await fetch(`/api/opportunities?customerId=${opportunityId}`)
      if (!res.ok) throw new Error('Failed to load opportunity')

      const data = await res.json()
      const opps = data.data?.opportunities || []

      if (opps.length > 0) {
        setOpportunity(opps[0])
      }
    } catch (error) {
      console.error('Load opportunity error:', error)
      toast.error('Failed to load opportunity')
    } finally {
      setLoading(false)
    }
  }

  async function loadInteractions() {
    try {
      // TODO: Create API endpoint to fetch interactions
      // For now, using placeholder
      setInteractions([])
    } catch (error) {
      console.error('Load interactions error:', error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.notes.trim()) {
      toast.error('Please add notes about this interaction')
      return
    }

    if (!formData.outcome) {
      toast.error('Please select an outcome')
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        interactionType: formData.interactionType,
        notes: formData.notes,
        outcome: formData.outcome,
        nextFollowUpDate: formData.nextFollowUpDate || null,
        nextFollowUpMethod: formData.nextFollowUpMethod,
        updateStatus: formData.updateStatus,
        newStatus: formData.outcome === 'converted' ? 'converted' : formData.outcome === 'declined' ? 'declined' : undefined,
      }

      const res = await fetch(`/api/opportunities/${opportunityId}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to log follow-up')
      }

      toast.success('Follow-up logged successfully')

      // Redirect based on outcome
      if (formData.outcome === 'converted') {
        router.push(`/dashboard/customers/${opportunity?.customer_id}`)
      } else {
        router.push('/dashboard/opportunities/follow-ups')
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to log follow-up')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!opportunity) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Opportunity Not Found</CardTitle>
            <CardDescription>The opportunity you are looking for does not exist.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/opportunities/follow-ups"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Follow-ups
        </Link>
        <h1 className="text-3xl font-bold">Log Follow-up</h1>
        <p className="text-muted-foreground mt-1">
          Record your interaction with {opportunity.customer.full_name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Interaction Type */}
            <Card>
              <CardHeader>
                <CardTitle>Interaction Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Interaction Type *</Label>
                  <Select
                    value={formData.interactionType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, interactionType: value })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERACTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes *</Label>
                  <Textarea
                    id="notes"
                    placeholder="What did you discuss? What was the customer's response?"
                    rows={5}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outcome">Outcome *</Label>
                  <Select
                    value={formData.outcome}
                    onValueChange={(value) => setFormData({ ...formData, outcome: value })}
                  >
                    <SelectTrigger id="outcome">
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTCOME_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Next Follow-up */}
            <Card>
              <CardHeader>
                <CardTitle>Schedule Next Follow-up</CardTitle>
                <CardDescription>When should we follow up again?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nextDate">Next Follow-up Date</Label>
                  <Input
                    id="nextDate"
                    type="date"
                    value={formData.nextFollowUpDate}
                    onChange={(e) =>
                      setFormData({ ...formData, nextFollowUpDate: e.target.value })
                    }
                  />
                </div>

                {formData.nextFollowUpDate && (
                  <div className="space-y-2">
                    <Label htmlFor="nextMethod">Follow-up Method</Label>
                    <Select
                      value={formData.nextFollowUpMethod}
                      onValueChange={(value) =>
                        setFormData({ ...formData, nextFollowUpMethod: value })
                      }
                    >
                      <SelectTrigger id="nextMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Phone Call</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="portal_offer">Portal Offer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/opportunities/follow-ups')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Log Follow-up
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Sidebar - Customer & Opportunity Info */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">{opportunity.customer.full_name}</p>
              </div>
              {opportunity.customer.phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <a
                    href={`tel:${opportunity.customer.phone}`}
                    className="text-sm hover:underline"
                  >
                    {opportunity.customer.phone}
                  </a>
                </div>
              )}
              {opportunity.customer.email && (
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <a
                    href={`mailto:${opportunity.customer.email}`}
                    className="text-sm hover:underline truncate block"
                  >
                    {opportunity.customer.email}
                  </a>
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/dashboard/customers/${opportunity.customer_id}`)}
              >
                View Customer Profile
              </Button>
            </CardContent>
          </Card>

          {/* Opportunity Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opportunity Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <Badge variant="secondary" className="mt-1">
                  {opportunity.opportunity_type.replace('_', ' ')}
                </Badge>
              </div>
              {opportunity.estimated_value && (
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Value</p>
                  <p className="text-sm font-semibold text-green-600">
                    ${opportunity.estimated_value.toFixed(2)}
                  </p>
                </div>
              )}
              {opportunity.reason && (
                <div>
                  <p className="text-xs text-muted-foreground">Original Reason</p>
                  <p className="text-sm">{opportunity.reason}</p>
                </div>
              )}
              {opportunity.declined_services.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Declined Services</p>
                  <div className="space-y-1">
                    {opportunity.declined_services.map((service, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs mr-1">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Interactions */}
          {interactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {interactions.map((interaction) => (
                    <div key={interaction.id} className="text-sm">
                      <p className="font-medium">{interaction.interaction_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(interaction.created_at).toLocaleDateString()} by{' '}
                        {interaction.performed_by.full_name}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
