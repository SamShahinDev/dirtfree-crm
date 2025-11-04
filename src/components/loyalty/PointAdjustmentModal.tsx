'use client'

import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'

interface PointAdjustmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId?: string
  customerName?: string
  currentBalance?: number
  onSuccess?: () => void
}

const ADJUSTMENT_TYPES = [
  { value: 'bonus', label: 'Bonus', description: 'Reward or incentive points' },
  { value: 'correction', label: 'Correction', description: 'Fix an error' },
  { value: 'promotion', label: 'Promotion', description: 'Marketing campaign points' },
  { value: 'compensation', label: 'Compensation', description: 'Issue resolution' },
  { value: 'tier_override', label: 'Tier Override', description: 'Manual tier adjustment' },
  { value: 'other', label: 'Other', description: 'Other reason' },
]

export function PointAdjustmentModal({
  open,
  onOpenChange,
  customerId,
  customerName,
  currentBalance = 0,
  onSuccess,
}: PointAdjustmentModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    points_change: 0,
    adjustment_type: 'bonus',
    reason: '',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!customerId) {
      toast.error('Customer ID is required')
      return
    }

    if (formData.points_change === 0) {
      toast.error('Points change cannot be zero')
      return
    }

    if (!formData.reason.trim()) {
      toast.error('Reason is required')
      return
    }

    // Check if adjustment would result in negative balance
    const newBalance = currentBalance + formData.points_change
    if (newBalance < 0) {
      toast.error(
        `Cannot remove ${Math.abs(formData.points_change)} points. Current balance is ${currentBalance}.`
      )
      return
    }

    try {
      setLoading(true)

      const res = await fetch('/api/loyalty/points/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          ...formData,
        }),
      })

      const result = await res.json()

      if (result.success) {
        toast.success(result.data.message)
        setFormData({
          points_change: 0,
          adjustment_type: 'bonus',
          reason: '',
          notes: '',
        })
        onOpenChange(false)
        onSuccess?.()
      } else {
        toast.error(result.message || 'Failed to adjust points')
      }
    } catch (error) {
      console.error('Point adjustment error:', error)
      toast.error('Failed to adjust points')
    } finally {
      setLoading(false)
    }
  }

  const newBalance = currentBalance + formData.points_change
  const isNegativeBalance = newBalance < 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adjust Loyalty Points</DialogTitle>
            <DialogDescription>
              {customerName
                ? `Adjust points for ${customerName}`
                : 'Manually add or remove loyalty points'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Balance Display */}
            {currentBalance !== undefined && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Current Balance</span>
                  <span className="text-2xl font-bold">{currentBalance.toLocaleString()}</span>
                </div>
                {formData.points_change !== 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">New Balance</span>
                    <div className="flex items-center gap-2">
                      {formData.points_change > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span
                        className={`text-2xl font-bold ${
                          isNegativeBalance
                            ? 'text-red-600'
                            : formData.points_change > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {newBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
                {isNegativeBalance && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>Balance cannot be negative</span>
                  </div>
                )}
              </div>
            )}

            {/* Points Change */}
            <div className="space-y-2">
              <Label htmlFor="points_change">
                Points Change <span className="text-red-600">*</span>
              </Label>
              <Input
                id="points_change"
                type="number"
                value={formData.points_change}
                onChange={(e) =>
                  setFormData({ ...formData, points_change: parseInt(e.target.value) || 0 })
                }
                placeholder="Enter positive or negative number"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use positive numbers to add points, negative to remove
              </p>
            </div>

            {/* Adjustment Type */}
            <div className="space-y-2">
              <Label htmlFor="adjustment_type">
                Adjustment Type <span className="text-red-600">*</span>
              </Label>
              <Select
                value={formData.adjustment_type}
                onValueChange={(value) => setFormData({ ...formData, adjustment_type: value })}
              >
                <SelectTrigger id="adjustment_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason <span className="text-red-600">*</span>
              </Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Brief explanation for this adjustment"
                required
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                This will be visible in the audit trail
              </p>
            </div>

            {/* Notes (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional context or details..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || isNegativeBalance}>
              {loading ? 'Adjusting...' : 'Confirm Adjustment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
