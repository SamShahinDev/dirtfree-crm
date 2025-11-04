'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Award,
  TrendingUp,
  TrendingDown,
  Users,
  Search,
  Plus,
  Minus,
  Activity,
  Star,
  Gift,
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { PointAdjustmentModal } from '@/components/loyalty/PointAdjustmentModal'

interface LoyaltyStats {
  total_points_issued: number
  total_points_redeemed: number
  active_points: number
  total_customers: number
  tier_distribution: Record<string, number>
}

interface TopCustomer {
  customer_id: string
  customer_name: string
  total_points: number
  tier_level: number
  tier_name: string
  achievements_count: number
}

interface RecentTransaction {
  id: string
  customer_id: string
  customer_name: string
  points_change: number
  reason: string
  transaction_type: string
  created_at: string
}

export default function LoyaltyDashboardPage() {
  const [stats, setStats] = useState<LoyaltyStats | null>(null)
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([])
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdjustModal, setShowAdjustModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // In a real implementation, you'd have a dedicated endpoint for this
      // For now, we'll simulate the data
      // TODO: Create /api/loyalty/stats endpoint

      setStats({
        total_points_issued: 125000,
        total_points_redeemed: 32000,
        active_points: 93000,
        total_customers: 450,
        tier_distribution: {
          Bronze: 320,
          Silver: 85,
          Gold: 35,
          Platinum: 10,
        },
      })

      setTopCustomers([
        {
          customer_id: '1',
          customer_name: 'John Smith',
          total_points: 8500,
          tier_level: 4,
          tier_name: 'Platinum',
          achievements_count: 12,
        },
        {
          customer_id: '2',
          customer_name: 'Sarah Johnson',
          total_points: 6200,
          tier_level: 4,
          tier_name: 'Platinum',
          achievements_count: 10,
        },
        {
          customer_id: '3',
          customer_name: 'Mike Williams',
          total_points: 4800,
          tier_level: 3,
          tier_name: 'Gold',
          achievements_count: 8,
        },
      ])

      setRecentTransactions([])
    } catch (error) {
      console.error('Load loyalty data error:', error)
      toast.error('Failed to load loyalty data')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch() {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query')
      return
    }

    // Navigate to customer search or directly to customer loyalty page
    window.location.href = `/dashboard/customers?search=${encodeURIComponent(searchQuery)}`
  }

  const tierColors: Record<string, string> = {
    Bronze: 'bg-orange-100 text-orange-800',
    Silver: 'bg-gray-100 text-gray-800',
    Gold: 'bg-yellow-100 text-yellow-800',
    Platinum: 'bg-purple-100 text-purple-800',
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading loyalty dashboard...</div>
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
              Loyalty Program Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage customer loyalty points and rewards
            </p>
          </div>
        </div>
      </div>

      {/* Quick Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Quick Customer Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-full">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Issued</p>
                <div className="text-2xl font-bold">
                  {stats?.total_points_issued.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 rounded-full">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Redeemed</p>
                <div className="text-2xl font-bold">
                  {stats?.total_points_redeemed.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-full">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Points</p>
                <div className="text-2xl font-bold">
                  {stats?.active_points.toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-full">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <div className="text-2xl font-bold">{stats?.total_customers}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Tier Distribution</CardTitle>
          <CardDescription>Customer breakdown by loyalty tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats?.tier_distribution &&
              Object.entries(stats.tier_distribution).map(([tier, count]) => (
                <div key={tier} className="text-center p-4 border rounded-lg">
                  <Badge className={`mb-2 ${tierColors[tier] || 'bg-gray-100'}`}>{tier}</Badge>
                  <div className="text-2xl font-bold">{count}</div>
                  <p className="text-xs text-muted-foreground">customers</p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Most Active Loyalty Customers</CardTitle>
              <CardDescription>Top customers by points earned</CardDescription>
            </div>
            <Star className="h-5 w-5 text-yellow-600" />
          </div>
        </CardHeader>
        <CardContent>
          {topCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No loyalty customers yet
            </div>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <Link
                  key={customer.customer_id}
                  href={`/dashboard/customers/${customer.customer_id}/loyalty`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{customer.customer_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={tierColors[customer.tier_name]}>
                          {customer.tier_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {customer.achievements_count} achievements
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-600">
                      {customer.total_points.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">points</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Point Transactions</CardTitle>
              <CardDescription>Latest loyalty point activity</CardDescription>
            </div>
            <Gift className="h-5 w-5 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No recent transactions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => (
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
                      <p className="font-medium">{transaction.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{transaction.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(transaction.created_at).toLocaleString()}
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

      {/* Point Adjustment Modal */}
      <PointAdjustmentModal
        open={showAdjustModal}
        onOpenChange={setShowAdjustModal}
        onSuccess={loadData}
      />
    </div>
  )
}
