'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tag,
  Calendar,
  Users,
  TrendingUp,
  DollarSign,
  Eye,
  MoreVertical,
  Edit,
  Copy,
  Pause,
  Play,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react'

/**
 * Promotion Card Component
 *
 * Reusable card displaying promotion summary with:
 * - Title and type
 * - Date range and status
 * - Key metrics (delivered, viewed, redeemed)
 * - Conversion rate
 * - Action buttons (view, edit, pause/resume, clone, delete)
 */

export interface PromotionCardProps {
  promotion: {
    id: string
    title: string
    description?: string
    promotionType: string
    discountValue?: number
    discountPercentage?: number
    promoCode?: string
    startDate: string
    endDate: string
    status: string
    currentRedemptions: number
    maxRedemptions?: number
  }
  statistics?: {
    totalDelivered: number
    totalViewed: number
    totalClaimed: number
    totalRedeemed: number
    redemptionRate: number
    totalDiscountAmount: number
  }
  onUpdate?: () => void
}

export function PromotionCard({ promotion, statistics, onUpdate }: PromotionCardProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Format promotion type for display
  const getPromotionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      percentage_off: 'Percentage Off',
      dollar_off: 'Dollar Off',
      free_addon: 'Free Add-on',
      bogo: 'BOGO',
      seasonal: 'Seasonal',
      referral: 'Referral',
      loyalty: 'Loyalty',
    }
    return labels[type] || type
  }

  // Format discount display
  const getDiscountDisplay = () => {
    if (promotion.promotionType === 'percentage_off' && promotion.discountPercentage) {
      return `${promotion.discountPercentage}% OFF`
    }
    if (promotion.promotionType === 'dollar_off' && promotion.discountValue) {
      return `$${promotion.discountValue} OFF`
    }
    return getPromotionTypeLabel(promotion.promotionType).toUpperCase()
  }

  // Get status badge variant
  const getStatusBadge = () => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      scheduled: { variant: 'outline', label: 'Scheduled' },
      active: { variant: 'default', label: 'Active' },
      paused: { variant: 'secondary', label: 'Paused' },
      expired: { variant: 'destructive', label: 'Expired' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
      completed: { variant: 'outline', label: 'Completed' },
    }
    const config = variants[promotion.status] || { variant: 'outline' as const, label: promotion.status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Handle pause/resume
  const handleTogglePause = async () => {
    try {
      setActionLoading(true)
      const endpoint = promotion.status === 'active' ? 'pause' : 'resume'

      const response = await fetch(`/api/promotions/${promotion.id}/${endpoint}`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || `Failed to ${endpoint} promotion`)
      }

      onUpdate?.()
    } catch (error) {
      alert(error instanceof Error ? error.message : `Failed to ${promotion.status === 'active' ? 'pause' : 'resume'} promotion`)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    try {
      setActionLoading(true)

      const response = await fetch(`/api/promotions/${promotion.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to delete promotion')
      }

      setShowDeleteDialog(false)
      onUpdate?.()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete promotion')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle clone (navigate to new with query params)
  const handleClone = () => {
    router.push(`/dashboard/marketing/promotions/new?clone=${promotion.id}`)
  }

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold">{promotion.title}</h3>
                {getStatusBadge()}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="h-3 w-3" />
                <span>{getPromotionTypeLabel(promotion.promotionType)}</span>
                {promotion.promoCode && (
                  <>
                    <span>•</span>
                    <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                      {promotion.promoCode}
                    </code>
                  </>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/dashboard/marketing/promotions/${promotion.id}`)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/dashboard/marketing/promotions/${promotion.id}/edit`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClone}>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone
                </DropdownMenuItem>
                {(promotion.status === 'active' || promotion.status === 'paused') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleTogglePause} disabled={actionLoading}>
                      {promotion.status === 'active' ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Resume
                        </>
                      )}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Discount Display */}
          <div className="bg-primary/10 text-primary px-3 py-2 rounded-lg text-center font-bold text-lg">
            {getDiscountDisplay()}
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
            </span>
          </div>

          {/* Metrics */}
          {statistics && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>Delivered</span>
                </div>
                <p className="text-lg font-semibold">{statistics.totalDelivered.toLocaleString()}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  <span>Viewed</span>
                </div>
                <p className="text-lg font-semibold">{statistics.totalViewed.toLocaleString()}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3" />
                  <span>Redeemed</span>
                </div>
                <p className="text-lg font-semibold">{statistics.totalRedeemed.toLocaleString()}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>Conversion</span>
                </div>
                <p className="text-lg font-semibold">{statistics.redemptionRate.toFixed(1)}%</p>
              </div>
            </div>
          )}

          {/* Redemption Progress */}
          {promotion.maxRedemptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Redemptions</span>
                <span className="font-medium">
                  {promotion.currentRedemptions} / {promotion.maxRedemptions}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.min((promotion.currentRedemptions / promotion.maxRedemptions) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Revenue */}
          {statistics && statistics.totalDiscountAmount > 0 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Total Discount</span>
              </div>
              <span className="text-sm font-semibold">
                ${statistics.totalDiscountAmount.toFixed(2)}
              </span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-3">
          <Button
            onClick={() => router.push(`/dashboard/marketing/promotions/${promotion.id}`)}
            variant="outline"
            className="w-full"
          >
            View Details
          </Button>
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the promotion "{promotion.title}". This action cannot be undone.
              Existing redemptions will remain valid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
