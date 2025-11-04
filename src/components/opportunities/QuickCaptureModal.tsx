'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Zap } from 'lucide-react'

interface QuickCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId?: string
  customerName?: string
  onSuccess?: () => void
}

const OPPORTUNITY_TYPES = [
  { value: 'declined_service', label: 'Declined Service' },
  { value: 'partial_booking', label: 'Partial Booking' },
  { value: 'price_objection', label: 'Price Objection' },
  { value: 'postponed_booking', label: 'Postponed Booking' },
  { value: 'competitor_mention', label: 'Competitor Mentioned' },
  { value: 'service_upsell', label: 'Upsell Potential' },
]

interface Customer {
  id: string
  full_name: string
}

export function QuickCaptureModal({
  open,
  onOpenChange,
  customerId: prefilledCustomerId,
  customerName: prefilledCustomerName,
  onSuccess,
}: QuickCaptureModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const [formData, setFormData] = useState({
    customerId: prefilledCustomerId || '',
    opportunityType: '',
    estimatedValue: '',
    reason: '',
  })

  // Load customers for search when modal opens
  useEffect(() => {
    if (open && !prefilledCustomerId) {
      loadCustomers()
    }
  }, [open, prefilledCustomerId])

  // Update form when customer is prefilled
  useEffect(() => {
    if (prefilledCustomerId) {
      setFormData((prev) => ({ ...prev, customerId: prefilledCustomerId }))
    }
  }, [prefilledCustomerId])

  async function loadCustomers(search?: string) {
    try {
      setLoadingCustomers(true)
      const url = search
        ? `/api/customers?search=${encodeURIComponent(search)}&limit=20`
        : '/api/customers?limit=20'

      const res = await fetch(url)
      if (!res.ok) return

      const data = await res.json()
      setCustomers(data.data?.customers || [])
    } catch (error) {
      console.error('Load customers error:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }

  function handleSearchCustomer(value: string) {
    setSearchTerm(value)
    if (value.length >= 2) {
      loadCustomers(value)
    }
  }

  function resetForm() {
    setFormData({
      customerId: prefilledCustomerId || '',
      opportunityType: '',
      estimatedValue: '',
      reason: '',
    })
    setSearchTerm('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.customerId) {
      toast.error('Please select a customer')
      return
    }

    if (!formData.opportunityType) {
      toast.error('Please select an opportunity type')
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        customerId: formData.customerId,
        opportunityType: formData.opportunityType,
        estimatedValue: formData.estimatedValue ? parseFloat(formData.estimatedValue) : null,
        reason: formData.reason || null,
        declinedServices: [],
        originalJobId: null,
        followUpScheduledDate: null,
        followUpMethod: null,
        followUpAssignedTo: null,
        autoOfferEnabled: false,
        offerDiscountPercentage: null,
        notes: null,
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

      toast.success('Opportunity captured successfully')
      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to capture opportunity')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Capture Opportunity
          </DialogTitle>
          <DialogDescription>
            Quickly log a missed sales opportunity. You can add more details later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Selection */}
          {prefilledCustomerId ? (
            <div className="space-y-2">
              <Label>Customer</Label>
              <div className="p-2 bg-muted rounded-md text-sm">
                {prefilledCustomerName || 'Selected Customer'}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select
                value={formData.customerId}
                onValueChange={(value) => setFormData({ ...formData, customerId: value })}
              >
                <SelectTrigger id="customer">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {loadingCustomers ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : customers.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      No customers found
                    </div>
                  ) : (
                    customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.full_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Start typing to search for a customer
              </p>
            </div>
          )}

          {/* Opportunity Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Opportunity Type *</Label>
            <Select
              value={formData.opportunityType}
              onValueChange={(value) => setFormData({ ...formData, opportunityType: value })}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label htmlFor="reason">Quick Notes</Label>
            <Textarea
              id="reason"
              placeholder="Why did they decline? Key concerns?"
              rows={3}
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
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
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Save
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
