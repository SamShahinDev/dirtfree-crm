'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
  Star,
  ExternalLink,
  Plus,
  RefreshCw,
  Link as LinkIcon,
  TrendingUp,
  TrendingDown,
  Users,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'

/**
 * Google Reviews Dashboard
 *
 * Display and manage Google My Business reviews.
 *
 * Features:
 * - Display recent Google reviews
 * - Show rating, text, customer (if matched), date
 * - Link to respond on Google (opens GMB dashboard)
 * - Statistics: total reviews, average rating, recent trend
 * - Manual import reviews
 * - Match reviews to customers
 */

interface GoogleReview {
  id: string
  googleReviewId?: string
  reviewerName: string
  rating: number
  reviewText: string
  postedAt: string
  customerId?: string
  customerName?: string
  customerEmail?: string
  matched?: boolean
}

interface GoogleReviewStats {
  totalReviews: number
  averageRating: number
  rating5Count: number
  rating4Count: number
  rating3Count: number
  rating2Count: number
  rating1Count: number
  matchedCount: number
  unmatchedCount: number
}

interface CustomerMatch {
  customerId: string
  customerName: string
  matchScore: number
}

export default function GoogleReviewsPage() {
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<GoogleReview[]>([])
  const [stats, setStats] = useState<GoogleReviewStats | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<GoogleReview | null>(null)
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([])
  const [importing, setImporting] = useState(false)
  const [linking, setLinking] = useState(false)

  // Import form state
  const [reviewerName, setReviewerName] = useState('')
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [postedAt, setPostedAt] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch reviews
      const reviewsResponse = await fetch('/api/reviews/google')
      const reviewsData = await reviewsResponse.json()

      if (reviewsData.success) {
        setReviews(reviewsData.data.reviews || [])
      }

      // Fetch stats
      const statsResponse = await fetch('/api/reviews/google/stats')
      const statsData = await statsResponse.json()

      if (statsData.success) {
        setStats(statsData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImportReview = async () => {
    try {
      setImporting(true)

      const response = await fetch('/api/reviews/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerName,
          rating,
          reviewText,
          postedAt: new Date(postedAt).toISOString(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Reset form
        setReviewerName('')
        setRating(5)
        setReviewText('')
        setPostedAt(new Date().toISOString().split('T')[0])
        setImportDialogOpen(false)

        // Refresh data
        fetchData()
      } else {
        alert(`Failed to import review: ${data.message}`)
      }
    } catch (error) {
      console.error('Error importing review:', error)
      alert('Failed to import review')
    } finally {
      setImporting(false)
    }
  }

  const handleLinkReview = async (customerId: string) => {
    if (!selectedReview) return

    try {
      setLinking(true)

      const response = await fetch(
        `/api/reviews/google/${selectedReview.id}/mark-complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId }),
        }
      )

      const data = await response.json()

      if (data.success) {
        setLinkDialogOpen(false)
        setSelectedReview(null)
        setCustomerMatches([])

        // Refresh data
        fetchData()
      } else {
        alert(`Failed to link review: ${data.message}`)
      }
    } catch (error) {
      console.error('Error linking review:', error)
      alert('Failed to link review')
    } finally {
      setLinking(false)
    }
  }

  const handleSearchCustomers = async (reviewerName: string) => {
    try {
      const response = await fetch(
        `/api/reviews/google/find-matches?name=${encodeURIComponent(reviewerName)}`
      )
      const data = await response.json()

      if (data.success) {
        setCustomerMatches(data.data.matches || [])
      }
    } catch (error) {
      console.error('Error finding customer matches:', error)
    }
  }

  const openLinkDialog = (review: GoogleReview) => {
    setSelectedReview(review)
    setLinkDialogOpen(true)
    handleSearchCustomers(review.reviewerName)
  }

  const StarDisplay = ({ rating }: { rating: number }) => {
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
            <p className="text-muted-foreground">Loading Google reviews...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Google Reviews</h1>
          <p className="text-muted-foreground mt-2">
            Track and manage your Google My Business reviews
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Import Review
          </Button>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" asChild>
            <a
              href="https://business.google.com/reviews"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open GMB Dashboard
            </a>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReviews}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Out of 5.0 stars</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">5-Star Reviews</CardTitle>
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rating5Count}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalReviews > 0
                  ? Math.round((stats.rating5Count / stats.totalReviews) * 100)
                  : 0}
                % of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Matched to Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.matchedCount}</div>
              <p className="text-xs text-muted-foreground">
                {stats.unmatchedCount} unmatched
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Ratings (1-3)</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.rating1Count + stats.rating2Count + stats.rating3Count}
              </div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Google Reviews</CardTitle>
          <CardDescription>
            Reviews from your Google My Business listing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No Google reviews found</p>
              <Button onClick={() => setImportDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Import Your First Review
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-medium">{review.reviewerName}</p>
                        <StarDisplay rating={review.rating} />
                        {review.matched ? (
                          <Badge variant="outline" className="bg-green-50">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Matched
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Unmatched
                          </Badge>
                        )}
                      </div>
                      {review.customerName && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Customer: {review.customerName}
                          {review.customerEmail && ` (${review.customerEmail})`}
                        </p>
                      )}
                      {review.reviewText && (
                        <p className="text-sm text-muted-foreground italic">
                          "{review.reviewText}"
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.postedAt).toLocaleDateString()}
                      </p>
                      {!review.matched && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openLinkDialog(review)}
                        >
                          <LinkIcon className="h-3 w-3 mr-1" />
                          Link to Customer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Review Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Google Review</DialogTitle>
            <DialogDescription>
              Manually import a review from your Google My Business account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reviewer-name">Reviewer Name</Label>
              <Input
                id="reviewer-name"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                placeholder="John Smith"
              />
            </div>
            <div>
              <Label htmlFor="rating">Rating</Label>
              <Select
                value={rating.toString()}
                onValueChange={(value) => setRating(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ 5 Stars</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ 4 Stars</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ 3 Stars</SelectItem>
                  <SelectItem value="2">⭐⭐ 2 Stars</SelectItem>
                  <SelectItem value="1">⭐ 1 Star</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="review-text">Review Text</Label>
              <Textarea
                id="review-text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Customer's review..."
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="posted-at">Posted Date</Label>
              <Input
                id="posted-at"
                type="date"
                value={postedAt}
                onChange={(e) => setPostedAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button onClick={handleImportReview} disabled={importing || !reviewerName}>
              {importing ? 'Importing...' : 'Import Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to Customer Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Link Review to Customer</DialogTitle>
            <DialogDescription>
              Match this Google review to a customer in your CRM.
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="border rounded-lg p-3 bg-muted">
                <p className="font-medium mb-1">{selectedReview.reviewerName}</p>
                <StarDisplay rating={selectedReview.rating} />
              </div>

              <div>
                <Label>Suggested Matches</Label>
                {customerMatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    No matching customers found. Try searching manually.
                  </p>
                ) : (
                  <div className="space-y-2 mt-2">
                    {customerMatches.map((match) => (
                      <div
                        key={match.customerId}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => handleLinkReview(match.customerId)}
                      >
                        <div>
                          <p className="font-medium">{match.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            Match score: {match.matchScore}%
                          </p>
                        </div>
                        <Button size="sm" disabled={linking}>
                          {linking ? 'Linking...' : 'Link'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
