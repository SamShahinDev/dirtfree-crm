'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Award,
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  History,
  Trophy,
  Users,
  Star,
  Gift,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { PointAdjustmentModal } from '@/components/loyalty/PointAdjustmentModal'

interface LoyaltyData {
  customer: {
    id: string
    name: string
    email: string
  }
  points: {
    current_balance: number
    lifetime_earned: number
    lifetime_spent: number
    manual_adjustments: number
  }
  tier: {
    current_tier_level: number
    current_tier_id: string
  }
  history: any[]
  adjustments: any[]
}

export default function CustomerLoyaltyPage() {
  const params = useParams()
  const customerId = params.id as string

  const [data, setData] = useState<LoyaltyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdjustModal, setShowAdjustModal] = useState(false)

  useEffect(() => {
    if (customerId) {
      loadData()
    }
  }, [customerId])

  async function loadData() {
    try {
      setLoading(true)
      const res = await fetch(`/api/loyalty/points?customer_id=${customerId}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast.error('Failed to load loyalty data')
      }
    } catch (error) {
      console.error('Load loyalty data error:', error)
      toast.error('Failed to load loyalty data')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading loyalty data...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">No loyalty data available</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              Loyalty Profile
            </h1>
            <p className="text-muted-foreground mt-1">{data.customer.name}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAdjustModal(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Adjust Points
            </Button>
            <Link href={`/dashboard/customers/${customerId}/referrals`}>
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Referrals
              </Button>
            </Link>
            <Link href={`/dashboard/customers/${customerId}/achievements`}>
              <Button variant="outline">
                <Trophy className="h-4 w-4 mr-2" />
                Achievements
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Points Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <Star className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <div className="text-2xl font-bold">
                  {data.points.current_balance.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lifetime Earned</p>
                <div className="text-2xl font-bold">
                  {data.points.lifetime_earned.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lifetime Spent</p>
                <div className="text-2xl font-bold">
                  {data.points.lifetime_spent.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-full">
                <Settings className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Manual Adjustments</p>
                <div className="text-2xl font-bold">
                  {data.points.manual_adjustments > 0 ? '+' : ''}
                  {data.points.manual_adjustments.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Tier Status & Progress</CardTitle>
          <CardDescription>Current tier level and benefits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Tier</p>
              <div className="text-2xl font-bold">Level {data.tier.current_tier_level}</div>
            </div>
            <Link href={`/dashboard/customers/${customerId}/tier`}>
              <Button variant="outline">View Tier Details</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for History and Adjustments */}
      <Tabs defaultValue="history">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Points History
          </TabsTrigger>
          <TabsTrigger value="adjustments">
            <Settings className="h-4 w-4 mr-2" />
            Manual Adjustments
          </TabsTrigger>
        </TabsList>

        {/* Points History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Points History</CardTitle>
              <CardDescription>Recent point transactions and activities</CardDescription>
            </CardHeader>
            <CardContent>
              {data.history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No transaction history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.history.map((transaction: any) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            transaction.points_change > 0 ? 'bg-green-100' : 'bg-red-100'
                          }`}
                        >
                          {transaction.points_change > 0 ? (
                            <Plus className="h-4 w-4 text-green-600" />
                          ) : (
                            <Minus className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{transaction.reason}</p>
                          <Badge variant="secondary" className="mt-1">
                            {transaction.transaction_type}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(transaction.created_at)}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`text-lg font-bold ${
                          transaction.points_change > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {transaction.points_change > 0 ? '+' : ''}
                        {transaction.points_change.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Adjustments Tab */}
        <TabsContent value="adjustments">
          <Card>
            <CardHeader>
              <CardTitle>Manual Adjustments</CardTitle>
              <CardDescription>Staff-initiated point adjustments with audit trail</CardDescription>
            </CardHeader>
            <CardContent>
              {data.adjustments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No manual adjustments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.adjustments.map((adjustment: any) => (
                    <div
                      key={adjustment.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              adjustment.points_change > 0 ? 'bg-green-100' : 'bg-red-100'
                            }`}
                          >
                            {adjustment.points_change > 0 ? (
                              <Plus className="h-4 w-4 text-green-600" />
                            ) : (
                              <Minus className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <div>
                            <Badge variant="outline">{adjustment.adjustment_type}</Badge>
                          </div>
                        </div>
                        <div
                          className={`text-xl font-bold ${
                            adjustment.points_change > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {adjustment.points_change > 0 ? '+' : ''}
                          {adjustment.points_change.toLocaleString()}
                        </div>
                      </div>
                      <p className="font-medium mb-1">{adjustment.reason}</p>
                      {adjustment.notes && (
                        <p className="text-sm text-muted-foreground mb-2">{adjustment.notes}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Adjusted by: {adjustment.adjusted_by_name}</span>
                        <span>{formatDate(adjustment.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Point Adjustment Modal */}
      <PointAdjustmentModal
        open={showAdjustModal}
        onOpenChange={setShowAdjustModal}
        customerId={customerId}
        customerName={data.customer.name}
        currentBalance={data.points.current_balance}
        onSuccess={loadData}
      />
    </div>
  )
}
