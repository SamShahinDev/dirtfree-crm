'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PromotionCard } from '@/components/marketing/PromotionCard'
import { Plus, Search, Filter, RefreshCcw, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

/**
 * Promotions Management Dashboard
 *
 * Features:
 * - List all promotions with filtering
 * - Tabs for different statuses (All, Active, Scheduled, Expired, Draft)
 * - Filters for status, date range, promotion type
 * - Actions: View, Edit, Pause, Resume, Clone, Delete
 * - Real-time metrics and statistics
 */

interface Promotion {
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

interface PromotionWithStats extends Promotion {
  statistics?: {
    totalDelivered: number
    totalViewed: number
    totalClaimed: number
    totalRedeemed: number
    redemptionRate: number
    totalDiscountAmount: number
  }
}

export default function PromotionsPage() {
  const router = useRouter()
  const [promotions, setPromotions] = useState<PromotionWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')

  // Fetch promotions
  const fetchPromotions = async () => {
    try {
      const params = new URLSearchParams()

      // Apply filters based on active tab
      if (activeTab !== 'all') {
        params.append('status', activeTab)
      }

      if (typeFilter !== 'all') {
        params.append('type', typeFilter)
      }

      const response = await fetch(`/api/promotions?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setPromotions(data.data.promotions || [])
      } else {
        console.error('Failed to fetch promotions:', data.message)
      }
    } catch (error) {
      console.error('Error fetching promotions:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchPromotions()
  }, [activeTab, typeFilter])

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true)
    fetchPromotions()
  }

  // Filter promotions client-side
  const filteredPromotions = promotions.filter((promo) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !promo.title.toLowerCase().includes(query) &&
        !promo.description?.toLowerCase().includes(query) &&
        !promo.promoCode?.toLowerCase().includes(query)
      ) {
        return false
      }
    }

    // Date range filter
    if (startDateFilter) {
      const startDate = new Date(promo.startDate)
      const filterStart = new Date(startDateFilter)
      if (startDate < filterStart) return false
    }

    if (endDateFilter) {
      const endDate = new Date(promo.endDate)
      const filterEnd = new Date(endDateFilter)
      if (endDate > filterEnd) return false
    }

    return true
  })

  // Get counts for tabs
  const getCounts = () => {
    const counts = {
      all: promotions.length,
      active: 0,
      scheduled: 0,
      expired: 0,
      draft: 0,
      paused: 0,
    }

    promotions.forEach((promo) => {
      if (promo.status in counts) {
        counts[promo.status as keyof typeof counts]++
      }
    })

    return counts
  }

  const counts = getCounts()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Promotions</h1>
          <p className="text-muted-foreground mt-1">
            Manage promotional offers and campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => router.push('/dashboard/marketing/promotions/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Promotion
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search promotions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <Label>Promotion Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="percentage_off">Percentage Off</SelectItem>
                  <SelectItem value="dollar_off">Dollar Off</SelectItem>
                  <SelectItem value="free_addon">Free Add-on</SelectItem>
                  <SelectItem value="bogo">BOGO</SelectItem>
                  <SelectItem value="seasonal">Seasonal</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="loyalty">Loyalty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date Filter */}
            <div className="space-y-2">
              <Label>Start Date (After)</Label>
              <Input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />
            </div>

            {/* End Date Filter */}
            <div className="space-y-2">
              <Label>End Date (Before)</Label>
              <Input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Active Filters Summary */}
          {(searchQuery || typeFilter !== 'all' || startDateFilter || endDateFilter) && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">Active Filters:</span>
              {searchQuery && (
                <Badge variant="secondary">
                  Search: {searchQuery}
                </Badge>
              )}
              {typeFilter !== 'all' && (
                <Badge variant="secondary">
                  Type: {typeFilter}
                </Badge>
              )}
              {startDateFilter && (
                <Badge variant="secondary">
                  Start: {new Date(startDateFilter).toLocaleDateString()}
                </Badge>
              )}
              {endDateFilter && (
                <Badge variant="secondary">
                  End: {new Date(endDateFilter).toLocaleDateString()}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setTypeFilter('all')
                  setStartDateFilter('')
                  setEndDateFilter('')
                }}
              >
                Clear All
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs and Promotions List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-2">
              {counts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="active">
            Active
            <Badge variant="secondary" className="ml-2">
              {counts.active}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            Scheduled
            <Badge variant="secondary" className="ml-2">
              {counts.scheduled}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="draft">
            Draft
            <Badge variant="secondary" className="ml-2">
              {counts.draft}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused
            <Badge variant="secondary" className="ml-2">
              {counts.paused}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired
            <Badge variant="secondary" className="ml-2">
              {counts.expired}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">Loading promotions...</p>
            </div>
          ) : filteredPromotions.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="text-lg font-semibold mt-4">No promotions found</h3>
                  <p className="text-muted-foreground mt-2">
                    {searchQuery || typeFilter !== 'all' || startDateFilter || endDateFilter
                      ? 'Try adjusting your filters'
                      : 'Create your first promotion to get started'}
                  </p>
                  {!(searchQuery || typeFilter !== 'all' || startDateFilter || endDateFilter) && (
                    <Button
                      className="mt-4"
                      onClick={() => router.push('/dashboard/marketing/promotions/new')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Promotion
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPromotions.map((promotion) => (
                <PromotionCard
                  key={promotion.id}
                  promotion={promotion}
                  statistics={promotion.statistics}
                  onUpdate={handleRefresh}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
