'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Tag,
  Calendar,
  CheckCircle,
  Clock,
  Gift,
  RefreshCcw,
  AlertCircle,
  Percent,
  DollarSign,
} from 'lucide-react'

/**
 * Customer Promotions View
 *
 * Support staff interface for managing customer promotions:
 * - View available promotions
 * - Manually claim promotions for customer
 * - Redeem claimed promotions
 * - View redemption history
 * - Track expired promotions
 */

interface Promotion {
  deliveryId: string | null
  promotionId: string
  title: string
  description?: string
  promotionType: string
  discountValue?: number
  discountPercentage?: number
  promoCode?: string
  claimCode?: string
  startDate: string
  endDate: string
  status: string
  termsAndConditions?: string
  deliveredAt?: string
  viewedAt?: string
  claimedAt?: string
  redeemedAt?: string
  discountAmount?: number
  deliveryChannel?: string
  isEligible?: boolean
}

interface PromotionsData {
  customer: {
    id: string
    fullName: string
    email: string
  }
  promotions: {
    available: Promotion[]
    claimed: Promotion[]
    redeemed: Promotion[]
    expired: Promotion[]
  }
  counts: {
    available: number
    claimed: number
    redeemed: number
    expired: number
    total: number
  }
}

export default function CustomerPromotionsPage() {
  const router = useRouter()
  const params = useParams()
  const customerId = params.id as string

  const [data, setData] = useState<PromotionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('available')
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null)
  const [showClaimDialog, setShowClaimDialog] = useState(false)
  const [showRedeemDialog, setShowRedeemDialog] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [redeemJobId, setRedeemJobId] = useState('')
  const [redeemDiscountAmount, setRedeemDiscountAmount] = useState('')

  // Fetch promotions
  const fetchPromotions = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}/promotions`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        console.error('Failed to fetch promotions:', result.message)
      }
    } catch (error) {
      console.error('Error fetching promotions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPromotions()
  }, [customerId])

  // Handle claim
  const handleClaim = async () => {
    if (!selectedPromotion) return

    try {
      setActionLoading(true)

      const response = await fetch(
        `/api/customers/${customerId}/promotions/${selectedPromotion.promotionId}/claim`,
        { method: 'POST' }
      )

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to claim promotion')
      }

      setShowClaimDialog(false)
      setSelectedPromotion(null)
      await fetchPromotions()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to claim promotion')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle redeem
  const handleRedeem = async () => {
    if (!selectedPromotion) return

    try {
      setActionLoading(true)

      const body: any = {}
      if (redeemJobId) body.jobId = redeemJobId
      if (redeemDiscountAmount) body.discountAmount = parseFloat(redeemDiscountAmount)

      const response = await fetch(
        `/api/customers/${customerId}/promotions/${selectedPromotion.promotionId}/redeem`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to redeem promotion')
      }

      setShowRedeemDialog(false)
      setSelectedPromotion(null)
      setRedeemJobId('')
      setRedeemDiscountAmount('')
      await fetchPromotions()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to redeem promotion')
    } finally {
      setActionLoading(false)
    }
  }

  // Format helpers
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

  const getDiscountDisplay = (promotion: Promotion) => {
    if (promotion.promotionType === 'percentage_off' && promotion.discountPercentage) {
      return `${promotion.discountPercentage}% OFF`
    }
    if (promotion.promotionType === 'dollar_off' && promotion.discountValue) {
      return `$${promotion.discountValue} OFF`
    }
    return getPromotionTypeLabel(promotion.promotionType)
  }

  // Render promotion card
  const renderPromotionCard = (promotion: Promotion, showActions: boolean = true) => {
    const isAvailable = !promotion.claimedAt && !promotion.redeemedAt
    const isClaimed = promotion.claimedAt && !promotion.redeemedAt
    const isRedeemed = !!promotion.redeemedAt

    return (
      <Card key={promotion.promotionId} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold">{promotion.title}</h3>
                {promotion.isEligible && (
                  <Badge variant="outline" className="text-xs">
                    Eligible
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{getPromotionTypeLabel(promotion.promotionType)}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Discount Display */}
          <div className="bg-primary/10 text-primary px-3 py-2 rounded-lg text-center font-bold text-xl">
            {getDiscountDisplay(promotion)}
          </div>

          {/* Description */}
          {promotion.description && (
            <p className="text-sm text-muted-foreground">{promotion.description}</p>
          )}

          {/* Date Range */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Valid: {formatDate(promotion.startDate)} - {formatDate(promotion.endDate)}
            </span>
          </div>

          {/* Promo Code */}
          {promotion.promoCode && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Promo Code:</p>
              <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
                {promotion.promoCode}
              </code>
            </div>
          )}

          {/* Claim Code */}
          {promotion.claimCode && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Claim Code:</p>
              <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
                {promotion.claimCode}
              </code>
            </div>
          )}

          {/* Status Info */}
          {isClaimed && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Claimed {promotion.claimedAt && `on ${formatDate(promotion.claimedAt)}`}</span>
            </div>
          )}

          {isRedeemed && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Gift className="h-4 w-4" />
                <span>Redeemed {promotion.redeemedAt && `on ${formatDate(promotion.redeemedAt)}`}</span>
              </div>
              {promotion.discountAmount && (
                <p className="text-sm text-muted-foreground">
                  Discount applied: ${promotion.discountAmount.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <div className="flex gap-2 pt-2">
              {isAvailable && (
                <Button
                  onClick={() => {
                    setSelectedPromotion(promotion)
                    setShowClaimDialog(true)
                  }}
                  className="w-full"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  Claim for Customer
                </Button>
              )}

              {isClaimed && (
                <Button
                  onClick={() => {
                    setSelectedPromotion(promotion)
                    setShowRedeemDialog(true)
                  }}
                  className="w-full"
                  variant="default"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Redeem
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold">Unable to load promotions</h2>
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
            <h1 className="text-3xl font-bold">Promotions</h1>
            <p className="text-muted-foreground mt-1">{data.customer.fullName}</p>
          </div>
        </div>
        <Button variant="outline" size="icon" onClick={fetchPromotions}>
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.available}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Claimed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.claimed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Redeemed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.redeemed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.counts.expired}</div>
          </CardContent>
        </Card>
      </div>

      {/* Promotions Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="available">
            Available
            <Badge variant="secondary" className="ml-2">
              {data.counts.available}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="claimed">
            Claimed
            <Badge variant="secondary" className="ml-2">
              {data.counts.claimed}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="redeemed">
            Redeemed
            <Badge variant="secondary" className="ml-2">
              {data.counts.redeemed}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired
            <Badge variant="secondary" className="ml-2">
              {data.counts.expired}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-6">
          {data.promotions.available.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No available promotions</h3>
                <p className="text-muted-foreground mt-2">
                  There are no active promotions for this customer at this time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.promotions.available.map((promo) => renderPromotionCard(promo))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="claimed" className="mt-6">
          {data.promotions.claimed.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No claimed promotions</h3>
                <p className="text-muted-foreground mt-2">
                  This customer has not claimed any promotions yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.promotions.claimed.map((promo) => renderPromotionCard(promo))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="redeemed" className="mt-6">
          {data.promotions.redeemed.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No redeemed promotions</h3>
                <p className="text-muted-foreground mt-2">
                  This customer has not redeemed any promotions yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.promotions.redeemed.map((promo) => renderPromotionCard(promo, false))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expired" className="mt-6">
          {data.promotions.expired.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No expired promotions</h3>
                <p className="text-muted-foreground mt-2">
                  This customer has no expired promotions.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.promotions.expired.map((promo) => renderPromotionCard(promo, false))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Claim Dialog */}
      <AlertDialog open={showClaimDialog} onOpenChange={setShowClaimDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Claim Promotion for Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will claim the promotion "{selectedPromotion?.title}" for {data.customer.fullName}.
              A unique claim code will be generated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClaim} disabled={actionLoading}>
              {actionLoading ? 'Claiming...' : 'Claim Promotion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Redeem Dialog */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem Promotion</DialogTitle>
            <DialogDescription>
              Redeem "{selectedPromotion?.title}" for {data.customer.fullName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="jobId">Job ID (Optional)</Label>
              <Input
                id="jobId"
                placeholder="Associate with a job"
                value={redeemJobId}
                onChange={(e) => setRedeemJobId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty if not associated with a specific job
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountAmount">Discount Amount (Optional)</Label>
              <Input
                id="discountAmount"
                type="number"
                step="0.01"
                placeholder="Override discount amount"
                value={redeemDiscountAmount}
                onChange={(e) => setRedeemDiscountAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use promotion's default discount
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedeemDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRedeem} disabled={actionLoading}>
              {actionLoading ? 'Redeeming...' : 'Redeem Promotion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
