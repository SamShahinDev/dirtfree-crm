'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  DollarSign,
  Target,
  Clock,
  Users,
  Award,
  BarChart3,
  Calendar,
  Percent,
} from 'lucide-react'
import { toast } from 'sonner'

interface OverviewAnalytics {
  totalOpportunities: number
  totalConverted: number
  totalRevenue: number
  averageConversionValue: number
  conversionRate: number
  averageDaysToConvert: number
}

interface TypeAnalytics {
  opportunity_type: string
  total_opportunities: number
  conversions: number
  conversion_rate: number
  avg_conversion_value: number
  total_revenue: number
  avg_days_to_convert: number
}

interface StaffPerformance {
  staff_id: string
  staff_name: string
  total_opportunities: number
  conversions: number
  conversion_rate: number
  total_revenue: number
  avg_conversion_value: number
}

interface ConversionFunnel {
  total_created: number
  offers_sent: number
  offers_claimed: number
  conversions: number
  offer_rate: number
  claim_rate: number
  overall_conversion_rate: number
}

interface OfferEffectiveness {
  discount_range: string
  total_offers: number
  claimed_offers: number
  redeemed_offers: number
  claim_rate: number
  redemption_rate: number
  avg_discount: number
  total_revenue: number
}

const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  declined_service: 'Declined Service',
  partial_booking: 'Partial Booking',
  price_objection: 'Price Objection',
  postponed_booking: 'Postponed',
  competitor_mention: 'Competitor',
  service_upsell: 'Upsell',
}

export default function OpportunitiesAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewAnalytics | null>(null)
  const [byType, setByType] = useState<TypeAnalytics[]>([])
  const [byStaff, setByStaff] = useState<StaffPerformance[]>([])
  const [funnel, setFunnel] = useState<ConversionFunnel | null>(null)
  const [offers, setOffers] = useState<OfferEffectiveness[]>([])

  useEffect(() => {
    loadAnalytics()
  }, [])

  async function loadAnalytics() {
    try {
      setLoading(true)

      // Load all analytics in parallel
      const [overviewRes, typeRes, staffRes, funnelRes, offersRes] = await Promise.all([
        fetch('/api/opportunities/analytics?type=overview'),
        fetch('/api/opportunities/analytics?type=by_type'),
        fetch('/api/opportunities/analytics?type=by_staff'),
        fetch('/api/opportunities/analytics?type=funnel'),
        fetch('/api/opportunities/analytics?type=offers'),
      ])

      if (overviewRes.ok) {
        const data = await overviewRes.json()
        setOverview(data.data)
      }

      if (typeRes.ok) {
        const data = await typeRes.json()
        setByType(data.data || [])
      }

      if (staffRes.ok) {
        const data = await staffRes.json()
        setByStaff(data.data || [])
      }

      if (funnelRes.ok) {
        const data = await funnelRes.json()
        setFunnel(data.data)
      }

      if (offersRes.ok) {
        const data = await offersRes.json()
        setOffers(data.data || [])
      }
    } catch (error) {
      console.error('Load analytics error:', error)
      toast.error('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Opportunity Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive insights into opportunity conversion performance
        </p>
      </div>

      {/* Overview Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Opportunities
                </CardTitle>
                <Target className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalOpportunities}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Conversions
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {overview.totalConverted}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Successfully converted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Conversion Rate
                </CardTitle>
                <Percent className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {overview.conversionRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Overall success rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                ${overview.totalRevenue.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">From conversions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Conversion Value
                </CardTitle>
                <DollarSign className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                ${overview.averageConversionValue.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Per conversion</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Time to Convert
                </CardTitle>
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {overview.averageDaysToConvert}
              </div>
              <p className="text-xs text-muted-foreground mt-1">days</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Conversion Funnel */}
      {funnel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>Track opportunities through each stage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div>
                  <p className="font-semibold">Opportunities Created</p>
                  <p className="text-2xl font-bold text-blue-600">{funnel.total_created}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Starting point</p>
                  <p className="text-sm font-semibold">100%</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div>
                  <p className="font-semibold">Offers Sent</p>
                  <p className="text-2xl font-bold text-purple-600">{funnel.offers_sent}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Conversion rate</p>
                  <p className="text-sm font-semibold text-purple-600">
                    {funnel.offer_rate}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div>
                  <p className="font-semibold">Offers Claimed</p>
                  <p className="text-2xl font-bold text-yellow-600">{funnel.offers_claimed}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Claim rate</p>
                  <p className="text-sm font-semibold text-yellow-600">
                    {funnel.claim_rate}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div>
                  <p className="font-semibold">Conversions</p>
                  <p className="text-2xl font-bold text-green-600">{funnel.conversions}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Overall rate</p>
                  <p className="text-sm font-semibold text-green-600">
                    {funnel.overall_conversion_rate}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance by Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance by Opportunity Type
          </CardTitle>
          <CardDescription>Conversion metrics for each opportunity type</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : byType.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No data available</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Converted</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Avg Value</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Avg Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byType.map((type) => (
                  <TableRow key={type.opportunity_type}>
                    <TableCell>
                      <Badge variant="secondary">
                        {OPPORTUNITY_TYPE_LABELS[type.opportunity_type] || type.opportunity_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{type.total_opportunities}</TableCell>
                    <TableCell className="text-right font-medium">{type.conversions}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-semibold">
                        {type.conversion_rate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      ${type.avg_conversion_value?.toFixed(0) || '0'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${type.total_revenue?.toFixed(0) || '0'}
                    </TableCell>
                    <TableCell className="text-right">
                      {type.avg_days_to_convert?.toFixed(0) || '-'} days
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Staff Performance Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Performance Leaderboard
          </CardTitle>
          <CardDescription>Top performers by revenue generated</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : byStaff.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No data available</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Staff Member</TableHead>
                  <TableHead className="text-right">Opportunities</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Avg Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byStaff.slice(0, 10).map((staff, index) => (
                  <TableRow key={staff.staff_id}>
                    <TableCell>
                      {index < 3 ? (
                        <Award
                          className={`h-5 w-5 ${
                            index === 0
                              ? 'text-yellow-500'
                              : index === 1
                              ? 'text-gray-400'
                              : 'text-orange-600'
                          }`}
                        />
                      ) : (
                        <span className="text-muted-foreground">{index + 1}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{staff.staff_name}</TableCell>
                    <TableCell className="text-right">{staff.total_opportunities}</TableCell>
                    <TableCell className="text-right">{staff.conversions}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-semibold">
                        {staff.conversion_rate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      ${staff.total_revenue?.toFixed(0) || '0'}
                    </TableCell>
                    <TableCell className="text-right">
                      ${staff.avg_conversion_value?.toFixed(0) || '0'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Offer Effectiveness */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Offer Effectiveness by Discount Level
          </CardTitle>
          <CardDescription>Analyze which discount levels convert best</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : offers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No offer data available</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Discount Range</TableHead>
                  <TableHead className="text-right">Total Offers</TableHead>
                  <TableHead className="text-right">Claimed</TableHead>
                  <TableHead className="text-right">Claim Rate</TableHead>
                  <TableHead className="text-right">Redeemed</TableHead>
                  <TableHead className="text-right">Redemption Rate</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offers.map((offer) => (
                  <TableRow key={offer.discount_range}>
                    <TableCell>
                      <Badge>{offer.discount_range}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{offer.total_offers}</TableCell>
                    <TableCell className="text-right">{offer.claimed_offers}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-blue-600 font-semibold">
                        {offer.claim_rate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{offer.redeemed_offers}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600 font-semibold">
                        {offer.redemption_rate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${offer.total_revenue.toFixed(0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
