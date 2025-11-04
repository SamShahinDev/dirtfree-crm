'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  Calendar,
  Tag,
  Users,
  Eye,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Edit,
  Copy,
  Pause,
  Play,
  Trash2,
  MoreVertical,
  RefreshCcw,
  Download,
} from 'lucide-react'

/**
 * Promotion Detail Page
 *
 * Features:
 * - Detailed promotion information
 * - Performance metrics and statistics
 * - Delivery tracking
 * - Redemption history
 * - Actions: Edit, Pause/Resume, Clone, Delete
 */

interface Promotion {
  id: string
  title: string
  description?: string
  promotionType: string
  discountValue?: number
  discountPercentage?: number
  freeAddonService?: string
  targetAudience: string
  targetZones?: string[]
  targetServiceTypes?: string[]
  minJobValue?: number
  maxJobValue?: number
  startDate: string
  endDate: string
  maxRedemptions?: number
  redemptionsPerCustomer: number
  currentRedemptions: number
  deliveryChannels: string[]
  autoDeliver: boolean
  promoCode?: string
  status: string
  termsAndConditions?: string
  createdAt: string
  updatedAt: string
}

interface Statistics {
  totalDelivered: number
  totalViewed: number
  totalClaimed: number
  totalRedeemed: number
  totalDiscountAmount: number
  viewRate: number
  claimRate: number
  redemptionRate: number
  avgDiscount: number
}

interface Delivery {
  id: string
  customerId: string
  customerName?: string
  customerEmail?: string
  deliveredAt: string
  viewedAt?: string
  claimedAt?: string
  redeemedAt?: string
  discountAmount?: number
}

export default function PromotionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const promotionId = params.id as string

  const [promotion, setPromotion] = useState<Promotion | null>(null)
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Fetch promotion details
  const fetchPromotion = async () => {
    try {
      const response = await fetch(`/api/promotions/${promotionId}`)
      const data = await response.json()

      if (data.success) {
        setPromotion(data.data.promotion)
        setStatistics(data.data.statistics)
        setDeliveries(data.data.deliveries || [])
      } else {
        console.error('Failed to fetch promotion:', data.message)
      }
    } catch (error) {
      console.error('Error fetching promotion:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPromotion()
  }, [promotionId])

  // Handle pause/resume
  const handleTogglePause = async () => {
    if (!promotion) return

    try {
      setActionLoading(true)
      const endpoint = promotion.status === 'active' ? 'pause' : 'resume'

      const response = await fetch(`/api/promotions/${promotionId}/${endpoint}`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || `Failed to ${endpoint} promotion`)
      }

      await fetchPromotion()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update promotion')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    try {
      setActionLoading(true)

      const response = await fetch(`/api/promotions/${promotionId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to delete promotion')
      }

      router.push('/dashboard/marketing/promotions')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete promotion')
      setActionLoading(false)
    }
  }

  // Handle clone
  const handleClone = () => {
    router.push(`/dashboard/marketing/promotions/new?clone=${promotionId}`)
  }

  // Format helpers
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      scheduled: { variant: 'outline', label: 'Scheduled' },
      active: { variant: 'default', label: 'Active' },
      paused: { variant: 'secondary', label: 'Paused' },
      expired: { variant: 'destructive', label: 'Expired' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
      completed: { variant: 'outline', label: 'Completed' },
    }
    const config = variants[status] || { variant: 'outline' as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!promotion) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Promotion not found</h2>
            <p className="text-muted-foreground mt-2">
              The promotion you're looking for doesn't exist or you don't have access to it.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{promotion.title}</h1>
              {getStatusBadge(promotion.status)}
            </div>
            <p className="text-muted-foreground mt-1">
              {getPromotionTypeLabel(promotion.promotionType)} • Created {formatDate(promotion.createdAt)}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreVertical className="h-4 w-4 mr-2" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/dashboard/marketing/promotions/${promotionId}/edit`)}>
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

      {/* Promotion Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Promotion Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description */}
            {promotion.description && (
              <div>
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-muted-foreground">{promotion.description}</p>
              </div>
            )}

            {/* Discount */}
            <div>
              <h3 className="font-medium mb-2">Discount</h3>
              <div className="bg-primary/10 text-primary px-4 py-3 rounded-lg font-bold text-xl inline-block">
                {promotion.promotionType === 'percentage_off' && promotion.discountPercentage
                  ? `${promotion.discountPercentage}% OFF`
                  : promotion.promotionType === 'dollar_off' && promotion.discountValue
                  ? `$${promotion.discountValue} OFF`
                  : getPromotionTypeLabel(promotion.promotionType).toUpperCase()}
              </div>
            </div>

            {/* Promo Code */}
            {promotion.promoCode && (
              <div>
                <h3 className="font-medium mb-2">Promo Code</h3>
                <code className="bg-muted px-3 py-2 rounded text-sm font-mono">
                  {promotion.promoCode}
                </code>
              </div>
            )}

            {/* Date Range */}
            <div>
              <h3 className="font-medium mb-2">Schedule</h3>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
                </span>
              </div>
            </div>

            {/* Targeting */}
            <div>
              <h3 className="font-medium mb-2">Targeting</h3>
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Audience:</span>{' '}
                  <span className="text-muted-foreground">{promotion.targetAudience}</span>
                </p>
                {promotion.targetZones && promotion.targetZones.length > 0 && (
                  <p className="text-sm">
                    <span className="font-medium">Zones:</span>{' '}
                    <span className="text-muted-foreground">{promotion.targetZones.join(', ')}</span>
                  </p>
                )}
                {promotion.minJobValue && (
                  <p className="text-sm">
                    <span className="font-medium">Min Job Value:</span>{' '}
                    <span className="text-muted-foreground">${promotion.minJobValue}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Delivery */}
            <div>
              <h3 className="font-medium mb-2">Delivery</h3>
              <div className="flex gap-2">
                {promotion.deliveryChannels.map((channel) => (
                  <Badge key={channel} variant="outline">
                    {channel}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Terms */}
            {promotion.termsAndConditions && (
              <div>
                <h3 className="font-medium mb-2">Terms & Conditions</h3>
                <p className="text-sm text-muted-foreground">{promotion.termsAndConditions}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="space-y-6">
          {statistics && (
            <>
              {/* Key Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Users className="h-4 w-4" />
                      <span>Delivered</span>
                    </div>
                    <p className="text-2xl font-bold">{statistics.totalDelivered.toLocaleString()}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Eye className="h-4 w-4" />
                      <span>Viewed</span>
                    </div>
                    <p className="text-2xl font-bold">{statistics.totalViewed.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{statistics.viewRate.toFixed(1)}% view rate</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <CheckCircle className="h-4 w-4" />
                      <span>Redeemed</span>
                    </div>
                    <p className="text-2xl font-bold">{statistics.totalRedeemed.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{statistics.redemptionRate.toFixed(1)}% redemption rate</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span>Total Discount</span>
                    </div>
                    <p className="text-2xl font-bold">${statistics.totalDiscountAmount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">
                      ${statistics.avgDiscount.toFixed(2)} avg discount
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Redemption Progress */}
              {promotion.maxRedemptions && (
                <Card>
                  <CardHeader>
                    <CardTitle>Redemption Limit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold">{promotion.currentRedemptions}</span>
                        <span className="text-muted-foreground">of {promotion.maxRedemptions}</span>
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
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Deliveries Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Deliveries</CardTitle>
              <CardDescription>
                Showing up to 50 most recent deliveries
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deliveries yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Viewed</TableHead>
                  <TableHead>Claimed</TableHead>
                  <TableHead>Redeemed</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{delivery.customerName || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{delivery.customerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(delivery.deliveredAt)}</TableCell>
                    <TableCell>
                      {delivery.viewedAt ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          <span className="text-xs">{formatDateTime(delivery.viewedAt)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {delivery.claimedAt ? (
                        <div className="flex items-center gap-1 text-blue-600">
                          <CheckCircle className="h-3 w-3" />
                          <span className="text-xs">{formatDateTime(delivery.claimedAt)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {delivery.redeemedAt ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          <span className="text-xs">{formatDateTime(delivery.redeemedAt)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {delivery.discountAmount ? (
                        <span className="font-medium">${delivery.discountAmount.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
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
    </div>
  )
}
