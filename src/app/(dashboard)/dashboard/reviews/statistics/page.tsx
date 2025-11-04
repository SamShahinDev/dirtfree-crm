'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, TrendingUp, MessageSquare, ExternalLink, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

/**
 * Review Statistics Page
 *
 * Features:
 * - Overall statistics (completion rate, average rating)
 * - Rating distribution chart
 * - Pending reviews requiring follow-up
 * - Google review click-through rate
 */

interface Statistics {
  overview: {
    totalRequests: number
    pendingRequests: number
    portalCompleted: number
    googleCompleted: number
    averageRating: number
    completionRate: number
    googleClickRate: number
  }
  ratingDistribution: Array<{
    rating: number
    count: number
  }>
  pendingReviews: Array<{
    request_id: string
    customer_name: string
    customer_email: string
    days_pending: number
  }>
}

export default function ReviewStatisticsPage() {
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchStatistics()
  }, [])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reviews/statistics')
      const data = await response.json()

      if (data.success) {
        setStatistics(data.data)
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to load statistics',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching statistics:', error)
      toast({
        title: 'Error',
        description: 'Failed to load statistics',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading statistics...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!statistics) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No statistics available</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { overview, ratingDistribution, pendingReviews } = statistics

  const StarDisplay = ({ rating }: { rating: number }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${
              star <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Statistics</h1>
          <p className="text-muted-foreground mt-2">
            Overview of customer feedback and review performance
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.href = '/dashboard/reviews'}>
          Back to Reviews
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              {overview.pendingRequests} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {overview.portalCompleted + overview.googleCompleted} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.averageRating.toFixed(1)}</div>
            <StarDisplay rating={overview.averageRating} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Google Click Rate</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.googleClickRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {overview.googleCompleted} Google reviews
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Rating Distribution</CardTitle>
          <CardDescription>
            Breakdown of portal review ratings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ratingDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="rating"
                tickFormatter={(value) => `${value} ⭐`}
              />
              <YAxis />
              <Tooltip
                formatter={(value: any) => [`${value} reviews`, 'Count']}
                labelFormatter={(label) => `${label} Star${label !== 1 ? 's' : ''}`}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {ratingDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.rating - 1]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pending Reviews Requiring Follow-up */}
      {pendingReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Pending Reviews Requiring Follow-up
            </CardTitle>
            <CardDescription>
              Reviews pending for 3+ days that may need a reminder
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingReviews.map((review) => (
                <div
                  key={review.request_id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{review.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{review.customer_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-yellow-600">
                      {review.days_pending} days pending
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        toast({
                          title: 'Feature Coming Soon',
                          description: 'Automated reminders will be sent by the cron job',
                        })
                      }}
                    >
                      Send Reminder
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Portal Reviews</p>
              <p className="text-2xl font-bold">{overview.portalCompleted}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Google Reviews</p>
              <p className="text-2xl font-bold">{overview.googleCompleted}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">Key Insights:</p>
            <ul className="space-y-2 text-sm">
              {overview.completionRate >= 50 ? (
                <li className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  Great completion rate! Customers are engaging well.
                </li>
              ) : (
                <li className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  Consider sending follow-up reminders to increase completion rate.
                </li>
              )}

              {overview.averageRating >= 4.0 ? (
                <li className="flex items-center gap-2 text-green-600">
                  <Star className="h-4 w-4" />
                  Excellent average rating! Keep up the great work.
                </li>
              ) : (
                <li className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  Focus on service quality to improve ratings.
                </li>
              )}

              {overview.googleClickRate >= 30 ? (
                <li className="flex items-center gap-2 text-green-600">
                  <ExternalLink className="h-4 w-4" />
                  Strong Google review engagement.
                </li>
              ) : (
                <li className="flex items-center gap-2 text-yellow-600">
                  <ExternalLink className="h-4 w-4" />
                  Consider incentivizing Google reviews.
                </li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
