'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Gift,
  Plus,
  Edit,
  Trash2,
  Star,
  TrendingUp,
  Package,
  Calendar,
  Users,
  Check,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Reward {
  id: string
  reward_name: string
  reward_description: string | null
  reward_type: string
  points_required: number
  reward_value: number | null
  quantity_available: number | null
  quantity_redeemed: number
  active: boolean
  terms_conditions: string | null
  expiry_days: number
  created_at: string
  redemption_stats: {
    total: number
    used: number
    pending: number
  }
  available: number | null
}

interface RewardFormData {
  reward_name: string
  reward_description: string
  reward_type: string
  points_required: number
  reward_value: number | null
  quantity_available: number | null
  terms_conditions: string
  expiry_days: number
  active: boolean
}

const REWARD_TYPES = [
  { value: 'discount', label: 'Discount', icon: '💰' },
  { value: 'free_service', label: 'Free Service', icon: '🎁' },
  { value: 'upgrade', label: 'Upgrade', icon: '⬆️' },
  { value: 'gift_card', label: 'Gift Card', icon: '💳' },
  { value: 'merchandise', label: 'Merchandise', icon: '📦' },
  { value: 'priority_access', label: 'Priority Access', icon: '⭐' },
]

export default function RewardsCatalogPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [formData, setFormData] = useState<RewardFormData>({
    reward_name: '',
    reward_description: '',
    reward_type: 'discount',
    points_required: 100,
    reward_value: null,
    quantity_available: null,
    terms_conditions: '',
    expiry_days: 90,
    active: true,
  })

  useEffect(() => {
    loadRewards()
  }, [])

  async function loadRewards() {
    try {
      setLoading(true)
      const res = await fetch('/api/loyalty/rewards')
      const result = await res.json()

      if (result.success) {
        setRewards(result.data.rewards)
        setStats(result.data.stats)
      } else {
        toast.error('Failed to load rewards')
      }
    } catch (error) {
      console.error('Load rewards error:', error)
      toast.error('Failed to load rewards')
    } finally {
      setLoading(false)
    }
  }

  function openCreateDialog() {
    setEditingReward(null)
    setFormData({
      reward_name: '',
      reward_description: '',
      reward_type: 'discount',
      points_required: 100,
      reward_value: null,
      quantity_available: null,
      terms_conditions: '',
      expiry_days: 90,
      active: true,
    })
    setShowDialog(true)
  }

  function openEditDialog(reward: Reward) {
    setEditingReward(reward)
    setFormData({
      reward_name: reward.reward_name,
      reward_description: reward.reward_description || '',
      reward_type: reward.reward_type,
      points_required: reward.points_required,
      reward_value: reward.reward_value,
      quantity_available: reward.quantity_available,
      terms_conditions: reward.terms_conditions || '',
      expiry_days: reward.expiry_days,
      active: reward.active,
    })
    setShowDialog(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingReward
        ? `/api/loyalty/rewards/${editingReward.id}`
        : '/api/loyalty/rewards'

      const method = editingReward ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await res.json()

      if (result.success) {
        toast.success(result.data.message)
        setShowDialog(false)
        loadRewards()
      } else {
        toast.error(result.message || 'Failed to save reward')
      }
    } catch (error) {
      console.error('Save reward error:', error)
      toast.error('Failed to save reward')
    }
  }

  async function handleDelete(reward: Reward) {
    if (!confirm(`Are you sure you want to delete "${reward.reward_name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/loyalty/rewards/${reward.id}`, {
        method: 'DELETE',
      })

      const result = await res.json()

      if (result.success) {
        toast.success('Reward deleted successfully')
        loadRewards()
      } else {
        toast.error(result.message || 'Failed to delete reward')
      }
    } catch (error) {
      console.error('Delete reward error:', error)
      toast.error('Failed to delete reward')
    }
  }

  async function toggleActive(reward: Reward) {
    try {
      const res = await fetch(`/api/loyalty/rewards/${reward.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !reward.active }),
      })

      const result = await res.json()

      if (result.success) {
        toast.success(`Reward ${!reward.active ? 'activated' : 'deactivated'}`)
        loadRewards()
      } else {
        toast.error('Failed to update reward')
      }
    } catch (error) {
      console.error('Toggle active error:', error)
      toast.error('Failed to update reward')
    }
  }

  const typeConfig = REWARD_TYPES.find((t) => t.value === formData.reward_type)

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900">
                <Gift className="h-6 w-6 text-green-600" />
              </div>
              Rewards Catalog
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage loyalty rewards and track redemptions
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Reward
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Gift className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Rewards</p>
                <div className="text-2xl font-bold">{stats?.total_rewards || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <div className="text-2xl font-bold">{stats?.active_rewards || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-full">
                <X className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <div className="text-2xl font-bold">{stats?.inactive_rewards || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Redemptions</p>
                <div className="text-2xl font-bold">{stats?.total_redemptions || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rewards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12">Loading rewards...</div>
        ) : rewards.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Gift className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>No rewards yet</p>
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create First Reward
            </Button>
          </div>
        ) : (
          rewards.map((reward) => {
            const typeInfo = REWARD_TYPES.find((t) => t.value === reward.reward_type)

            return (
              <Card
                key={reward.id}
                className={`${!reward.active ? 'opacity-60' : ''} relative`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="text-2xl">{typeInfo?.icon || '🎁'}</span>
                        {reward.reward_name}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {reward.reward_description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(reward)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(reward)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Points Required */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Points Required</span>
                      </div>
                      <span className="text-lg font-bold text-blue-600">
                        {reward.points_required.toLocaleString()}
                      </span>
                    </div>

                    {/* Value */}
                    {reward.reward_value && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Value</span>
                        <span className="font-semibold">${reward.reward_value}</span>
                      </div>
                    )}

                    {/* Availability */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Available</span>
                      <span className="font-semibold">
                        {reward.available === null ? (
                          <Badge variant="secondary">Unlimited</Badge>
                        ) : (
                          `${reward.available} / ${reward.quantity_available}`
                        )}
                      </span>
                    </div>

                    {/* Redemptions */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Redeemed</span>
                      <span className="font-semibold">
                        {reward.redemption_stats.total} times
                      </span>
                    </div>

                    {/* Expiry */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Expires in
                      </div>
                      <span className="text-sm">{reward.expiry_days} days</span>
                    </div>

                    {/* Type Badge */}
                    <div>
                      <Badge variant="outline">{typeInfo?.label || reward.reward_type}</Badge>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm font-medium">Active</span>
                      <Switch
                        checked={reward.active}
                        onCheckedChange={() => toggleActive(reward)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingReward ? 'Edit Reward' : 'Create New Reward'}
              </DialogTitle>
              <DialogDescription>
                {editingReward
                  ? 'Update reward details'
                  : 'Add a new reward to the loyalty catalog'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Reward Name */}
              <div className="space-y-2">
                <Label htmlFor="reward_name">
                  Reward Name <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="reward_name"
                  value={formData.reward_name}
                  onChange={(e) =>
                    setFormData({ ...formData, reward_name: e.target.value })
                  }
                  placeholder="e.g., $10 Off Any Service"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="reward_description">Description</Label>
                <Textarea
                  id="reward_description"
                  value={formData.reward_description}
                  onChange={(e) =>
                    setFormData({ ...formData, reward_description: e.target.value })
                  }
                  placeholder="Describe the reward..."
                  rows={3}
                />
              </div>

              {/* Reward Type */}
              <div className="space-y-2">
                <Label htmlFor="reward_type">
                  Reward Type <span className="text-red-600">*</span>
                </Label>
                <Select
                  value={formData.reward_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, reward_type: value })
                  }
                >
                  <SelectTrigger id="reward_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REWARD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span>
                          {type.icon} {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Points Required */}
              <div className="space-y-2">
                <Label htmlFor="points_required">
                  Points Required <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="points_required"
                  type="number"
                  value={formData.points_required}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      points_required: parseInt(e.target.value) || 0,
                    })
                  }
                  min="1"
                  required
                />
              </div>

              {/* Reward Value */}
              <div className="space-y-2">
                <Label htmlFor="reward_value">Reward Value ($)</Label>
                <Input
                  id="reward_value"
                  type="number"
                  step="0.01"
                  value={formData.reward_value || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reward_value: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="Optional - for discounts/gift cards"
                />
              </div>

              {/* Quantity Available */}
              <div className="space-y-2">
                <Label htmlFor="quantity_available">
                  Quantity Available (leave empty for unlimited)
                </Label>
                <Input
                  id="quantity_available"
                  type="number"
                  value={formData.quantity_available || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quantity_available: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  placeholder="Unlimited"
                  min="0"
                />
              </div>

              {/* Expiry Days */}
              <div className="space-y-2">
                <Label htmlFor="expiry_days">
                  Expiry Days <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="expiry_days"
                  type="number"
                  value={formData.expiry_days}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expiry_days: parseInt(e.target.value) || 90,
                    })
                  }
                  min="1"
                  required
                />
              </div>

              {/* Terms & Conditions */}
              <div className="space-y-2">
                <Label htmlFor="terms_conditions">Terms & Conditions</Label>
                <Textarea
                  id="terms_conditions"
                  value={formData.terms_conditions}
                  onChange={(e) =>
                    setFormData({ ...formData, terms_conditions: e.target.value })
                  }
                  placeholder="Enter any terms, conditions, or restrictions..."
                  rows={3}
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <Label htmlFor="active">Active</Label>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, active: checked })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingReward ? 'Update Reward' : 'Create Reward'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
