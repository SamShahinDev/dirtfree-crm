'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Star,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  TrendingUp,
  Users,
  Target
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Review Management Dashboard
 *
 * Staff-facing dashboard for managing customer reviews.
 *
 * Features:
 * - Metrics overview (requests, portal reviews, Google conversion, avg rating)
 * - Pending reviews list with reminder capability
 * - Recent portal reviews with filtering
 * - Low-rating follow-ups with assignment and resolution tracking
 * - Google review tracker
 */

interface Metrics {
  totalRequestsThisMonth: number
  portalReviewsReceived: number
  googleConversionRate: number
  averageRating: number
  reviewsRequiringFollowup: number
}

interface ReviewRequest {
  id: string
  customer_id: string
  requested_at: string
  status: string
  reminder_sent: boolean
  reminder_sent_at: string | null
  portal_review_rating: number | null
  portal_review_text: string | null
  google_review_link_clicked: boolean
  google_review_clicked_at: string | null
  customers: {
    full_name: string
    email: string
    phone: string
  }
  jobs: {
    service_type: string
    completed_at: string
  }
}

export default function ReviewManagementPage() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [pendingReviews, setPendingReviews] = useState<ReviewRequest[]>([])
  const [recentReviews, setRecentReviews] = useState<ReviewRequest[]>([])
  const [lowRatingReviews, setLowRatingReviews] = useState<ReviewRequest[]>([])
  const [googleTracking, setGoogleTracking] = useState<ReviewRequest[]>([])
  const [ratingFilter, setRatingFilter] = useState<string>('all')
  const [sendingReminder, setSendingReminder] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch metrics
      const metricsResponse = await fetch('/api/reviews/metrics')
      const metricsData = await metricsResponse.json()
      if (metricsData.success) {
        setMetrics(metricsData.data)
      }

      // Fetch pending reviews
      const pendingResponse = await fetch('/api/reviews/requests?status=pending')
      const pendingData = await pendingResponse.json()
      if (pendingData.success) {
        setPendingReviews(pendingData.data.requests)
      }

      // Fetch recent reviews
      const recentResponse = await fetch('/api/reviews/requests?status=portal_completed&limit=20')
      const recentData = await recentResponse.json()
      if (recentData.success) {
        setRecentReviews(recentData.data.requests)
      }

      // Fetch low rating reviews
      const lowRatingResponse = await fetch('/api/reviews/low-ratings')
      const lowRatingData = await lowRatingResponse.json()
      if (lowRatingData.success) {
        setLowRatingReviews(lowRatingData.data.reviews)
      }

      // Fetch Google tracking
      const googleResponse = await fetch('/api/reviews/google-tracking')
      const googleData = await googleResponse.json()
      if (googleData.success) {
        setGoogleTracking(googleData.data.reviews)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendReminder = async (reviewId: string) => {
    try {
      setSendingReminder(reviewId)

      const response = await fetch(`/api/reviews/${reviewId}/reminder`, {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        // Refresh pending reviews
        fetchDashboardData()
      }
    } catch (error) {
      console.error('Error sending reminder:', error)
    } finally {
      setSendingReminder(null)
    }
  }

  const getDaysSince = (date: string) => {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  const StarDisplay = ({ rating }: { rating: number | null }) => {
    if (!rating) return <span className="text-muted-foreground text-sm">No rating</span>

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading dashboard...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filteredRecentReviews = ratingFilter === 'all'
    ? recentReviews
    : recentReviews.filter((r) => {
        if (ratingFilter === '5') return r.portal_review_rating === 5
        if (ratingFilter === '4') return r.portal_review_rating === 4
        if (ratingFilter === '1-3') return r.portal_review_rating && r.portal_review_rating <= 3
        return true
      })

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Management</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage customer feedback
          </p>
        </div>
        <Button onClick={fetchDashboardData}>
          Refresh Data
        </Button>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests Sent</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalRequestsThisMonth}</div>
              <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portal Reviews</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.portalReviewsReceived}</div>
              <p className="text-xs text-muted-foreground">Received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Google Conversion</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.googleConversionRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Click-through rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.averageRating.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Out of 5.0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Need Follow-up</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.reviewsRequiringFollowup}</div>
              <p className="text-xs text-muted-foreground">Low ratings</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingReviews.length})
          </TabsTrigger>
          <TabsTrigger value="recent">
            Recent Reviews ({recentReviews.length})
          </TabsTrigger>
          <TabsTrigger value="low-ratings">
            Low Ratings ({lowRatingReviews.length})
          </TabsTrigger>
          <TabsTrigger value="google">
            Google Tracker ({googleTracking.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Reviews Tab */}
        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Review Requests</CardTitle>
              <CardDescription>
                Customers who have been sent review requests but haven&apos;t responded yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingReviews.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No pending review requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingReviews.map((review) => {
                    const daysSince = getDaysSince(review.requested_at)
                    return (
                      <div
                        key={review.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{review.customers.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {review.jobs.service_type} • {review.customers.email}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {daysSince} days ago
                            </span>
                            {review.reminder_sent && (
                              <Badge variant="outline">
                                Reminder sent {getDaysSince(review.reminder_sent_at || '')} days ago
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleSendReminder(review.id)}
                          disabled={sendingReminder === review.id}
                          size="sm"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {sendingReminder === review.id ? 'Sending...' : 'Send Reminder'}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Reviews Tab */}
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Portal Reviews</CardTitle>
                  <CardDescription>
                    Customer feedback submitted through the portal
                  </CardDescription>
                </div>
                <Select value={ratingFilter} onValueChange={setRatingFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Ratings</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="1-3">1-3 Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredRecentReviews.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recent reviews</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecentReviews.map((review) => (
                    <div key={review.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{review.customers.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {review.jobs.service_type}
                          </p>
                        </div>
                        <StarDisplay rating={review.portal_review_rating} />
                      </div>
                      {review.portal_review_text && (
                        <p className="text-sm italic text-muted-foreground">
                          &quot;{review.portal_review_text}&quot;
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {new Date(review.requested_at).toLocaleDateString()}
                        </span>
                        {review.google_review_link_clicked && (
                          <Badge variant="outline" className="text-xs">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Clicked Google link
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Low Ratings Tab */}
        <TabsContent value="low-ratings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Low-Rating Follow-ups</CardTitle>
              <CardDescription>
                Reviews with 1-3 stars requiring attention and resolution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowRatingReviews.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No low-rating reviews requiring follow-up</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {lowRatingReviews.map((review) => {
                    const daysSince = getDaysSince(review.requested_at)
                    const priority = review.portal_review_rating === 1 ? 'high' : 'medium'
                    return (
                      <div
                        key={review.id}
                        className={`border-2 rounded-lg p-4 space-y-3 ${
                          priority === 'high'
                            ? 'border-red-200 bg-red-50'
                            : 'border-yellow-200 bg-yellow-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{review.customers.full_name}</p>
                              <Badge variant={priority === 'high' ? 'destructive' : 'default'}>
                                {priority === 'high' ? 'High Priority' : 'Medium Priority'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {review.customers.email} • {review.customers.phone}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {review.jobs.service_type} • {daysSince} days ago
                            </p>
                          </div>
                          <StarDisplay rating={review.portal_review_rating} />
                        </div>
                        <div className="bg-white rounded p-3">
                          <p className="text-sm font-medium mb-1">Customer Feedback:</p>
                          <p className="text-sm text-muted-foreground italic">
                            &quot;{review.portal_review_text || 'No feedback provided'}&quot;
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            View Support Ticket
                          </Button>
                          <Button size="sm" variant="outline">
                            Contact Customer
                          </Button>
                          <Button size="sm">
                            Mark as Resolved
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Tracking Tab */}
        <TabsContent value="google" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Google Review Tracker</CardTitle>
              <CardDescription>
                Customers who clicked the Google review link
              </CardDescription>
            </CardHeader>
            <CardContent>
              {googleTracking.length === 0 ? (
                <div className="text-center py-12">
                  <ExternalLink className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No Google review link clicks yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {googleTracking.map((review) => {
                    const daysSinceClick = review.google_review_clicked_at
                      ? getDaysSince(review.google_review_clicked_at)
                      : 0
                    return (
                      <div
                        key={review.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{review.customers.full_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {review.jobs.service_type}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <StarDisplay rating={review.portal_review_rating} />
                            <span className="text-sm text-muted-foreground">
                              Clicked {daysSinceClick} days ago
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Link Clicked
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
