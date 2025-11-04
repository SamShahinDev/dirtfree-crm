'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Customer {
  id: string
  full_name: string
  email: string
  phone: string
}

interface Job {
  id: string
  job_number: string
  service_date: string
  status: string
}

interface User {
  id: string
  full_name: string
  email: string
}

const OPPORTUNITY_TYPES = [
  { value: 'declined_service', label: 'Declined Service' },
  { value: 'partial_booking', label: 'Partial Booking (booked some, declined others)' },
  { value: 'price_objection', label: 'Price Objection' },
  { value: 'postponed_booking', label: 'Postponed Booking' },
  { value: 'competitor_mention', label: 'Mentioned Competitor' },
  { value: 'service_upsell', label: 'Service Upsell Potential' },
]

const FOLLOW_UP_METHODS = [
  { value: 'call', label: 'Phone Call' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'portal_offer', label: 'Portal Offer' },
]

const SERVICES = [
  'Carpet Cleaning',
  'Tile & Grout Cleaning',
  'Upholstery Cleaning',
  'Area Rug Cleaning',
  'Pet Odor Removal',
  'Stain Protection',
  'Water Damage Restoration',
  'Air Duct Cleaning',
]

export default function NewOpportunityPage() {
  const router = useRouter()
  const params = useParams()
  const customerId = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [users, setUsers] = useState<User[]>([])

  // Form state
  const [formData, setFormData] = useState({
    opportunityType: '',
    originalJobId: '',
    declinedServices: [] as string[],
    estimatedValue: '',
    reason: '',
    followUpScheduledDate: '',
    followUpMethod: '',
    followUpAssignedTo: '',
    autoOfferEnabled: false,
    offerDiscountPercentage: '',
    notes: '',
  })

  useEffect(() => {
    loadData()
  }, [customerId])

  async function loadData() {
    try {
      setLoading(true)

      // Load customer
      const customerRes = await fetch(`/api/customers/${customerId}`)
      if (!customerRes.ok) throw new Error('Failed to load customer')
      const customerData = await customerRes.json()
      setCustomer(customerData.data)

      // Load customer's jobs
      const jobsRes = await fetch(`/api/jobs?customerId=${customerId}&limit=20`)
      if (jobsRes.ok) {
        const jobsData = await jobsRes.json()
        setJobs(jobsData.data?.jobs || [])
      }

      // Load users for assignment
      const usersRes = await fetch('/api/users')
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.data?.users || [])
      }
    } catch (error) {
      console.error('Load error:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function handleServiceToggle(service: string) {
    setFormData((prev) => ({
      ...prev,
      declinedServices: prev.declinedServices.includes(service)
        ? prev.declinedServices.filter((s) => s !== service)
        : [...prev.declinedServices, service],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.opportunityType) {
      toast.error('Please select an opportunity type')
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        customerId,
        opportunityType: formData.opportunityType,
        originalJobId: formData.originalJobId || null,
        declinedServices: formData.declinedServices,
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : null,
        reason: formData.reason || null,
        followUpScheduledDate: formData.followUpScheduledDate || null,
        followUpMethod: formData.followUpMethod || null,
        followUpAssignedTo: formData.followUpAssignedTo || null,
        autoOfferEnabled: formData.autoOfferEnabled,
        offerDiscountPercentage: formData.offerDiscountPercentage
          ? parseFloat(formData.offerDiscountPercentage)
          : null,
        notes: formData.notes || null,
      }

      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create opportunity')
      }

      toast.success('Opportunity created successfully')
      router.push(`/dashboard/customers/${customerId}`)
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create opportunity')
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

  if (!customer) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Customer Not Found</CardTitle>
            <CardDescription>The customer you are looking for does not exist.</CardDescription>
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
          href={`/dashboard/customers/${customerId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customer
        </Link>
        <h1 className="text-3xl font-bold">New Opportunity</h1>
        <p className="text-muted-foreground mt-1">
          Capture missed sales opportunity for {customer.full_name}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="font-semibold">Name:</span> {customer.full_name}
            </div>
            <div>
              <span className="font-semibold">Email:</span> {customer.email || 'N/A'}
            </div>
            <div>
              <span className="font-semibold">Phone:</span> {customer.phone || 'N/A'}
            </div>
          </CardContent>
        </Card>

        {/* Opportunity Type */}
        <Card>
          <CardHeader>
            <CardTitle>Opportunity Type</CardTitle>
            <CardDescription>Select the type of missed opportunity</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={formData.opportunityType}
              onValueChange={(value) => setFormData({ ...formData, opportunityType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select opportunity type" />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Context */}
        <Card>
          <CardHeader>
            <CardTitle>Context</CardTitle>
            <CardDescription>Details about the opportunity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Related Job */}
            {jobs.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="job">Related Job (Optional)</Label>
                <Select
                  value={formData.originalJobId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, originalJobId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger id="job">
                    <SelectValue placeholder="Select related job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.job_number} - {new Date(job.service_date).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Declined Services */}
            <div className="space-y-2">
              <Label>Declined Services</Label>
              <div className="grid grid-cols-2 gap-2">
                {SERVICES.map((service) => (
                  <div key={service} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`service-${service}`}
                      checked={formData.declinedServices.includes(service)}
                      onChange={() => handleServiceToggle(service)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor={`service-${service}`} className="text-sm">
                      {service}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimated Value */}
            <div className="space-y-2">
              <Label htmlFor="value">Estimated Value ($)</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.estimatedValue}
                onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Decline</Label>
              <Textarea
                id="reason"
                placeholder="Why did the customer decline? What were their concerns?"
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Follow-up Plan */}
        <Card>
          <CardHeader>
            <CardTitle>Follow-up Plan</CardTitle>
            <CardDescription>Schedule follow-up actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Follow-up Date */}
            <div className="space-y-2">
              <Label htmlFor="followUpDate">Follow-up Date</Label>
              <Input
                id="followUpDate"
                type="date"
                value={formData.followUpScheduledDate}
                onChange={(e) =>
                  setFormData({ ...formData, followUpScheduledDate: e.target.value })
                }
              />
            </div>

            {/* Follow-up Method */}
            <div className="space-y-2">
              <Label htmlFor="method">Follow-up Method</Label>
              <Select
                value={formData.followUpMethod}
                onValueChange={(value) => setFormData({ ...formData, followUpMethod: value })}
              >
                <SelectTrigger id="method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOW_UP_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assign To */}
            <div className="space-y-2">
              <Label htmlFor="assignTo">Assign To</Label>
              <Select
                value={formData.followUpAssignedTo}
                onValueChange={(value) => setFormData({ ...formData, followUpAssignedTo: value })}
              >
                <SelectTrigger id="assignTo">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Offer */}
        <Card>
          <CardHeader>
            <CardTitle>Automated Offer</CardTitle>
            <CardDescription>Automatically send a discount offer to the customer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auto-offer Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoOffer">Enable Auto-Offer</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically send a promotional offer to the customer
                </p>
              </div>
              <Switch
                id="autoOffer"
                checked={formData.autoOfferEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, autoOfferEnabled: checked })
                }
              />
            </div>

            {/* Discount Percentage */}
            {formData.autoOfferEnabled && (
              <div className="space-y-2">
                <Label htmlFor="discount">Discount Percentage (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="15"
                  value={formData.offerDiscountPercentage}
                  onChange={(e) =>
                    setFormData({ ...formData, offerDiscountPercentage: e.target.value })
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
            <CardDescription>Any other relevant information</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Additional context, customer concerns, competitive information, etc."
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/dashboard/customers/${customerId}`)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Opportunity
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
