'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Star, Send, ExternalLink, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

/**
 * Customer Portal Reviews Page
 *
 * Features:
 * - View pending review requests
 * - Submit portal reviews (1-5 stars + text)
 * - Option to leave Google review
 * - Shows service details for each review request
 */

interface ReviewRequest {
  id: string
  job_id: string
  requested_at: string
  request_method: string
  portal_review_completed: boolean
  google_review_requested: boolean
  google_review_link_clicked: boolean
  status: string
  daysSinceRequest: number
  jobs: {
    id: string
    service_type: string
    completed_at: string
    total_amount: number
    service_address: string
  }
}

export default function CustomerReviewsPage() {
  const [pendingReviews, setPendingReviews] = useState<ReviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const { toast } = useToast()

  // Review form state
  const [selectedReview, setSelectedReview] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [hoveredRating, setHoveredRating] = useState(0)

  useEffect(() => {
    fetchPendingReviews()
  }, [])

  const fetchPendingReviews = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/portal/reviews/pending')
      const data = await response.json()

      if (data.success) {
        setPendingReviews(data.data.pendingReviews)
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to load pending reviews',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching pending reviews:', error)
      toast({
        title: 'Error',
        description: 'Failed to load pending reviews',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReview = async (reviewRequestId: string) => {
    if (rating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please select a star rating',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(reviewRequestId)

      const response = await fetch('/api/portal/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewRequestId,
          rating,
          reviewText,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Thank You!',
          description: 'Your review has been submitted successfully',
        })

        // Reset form
        setSelectedReview(null)
        setRating(0)
        setReviewText('')

        // Refresh pending reviews
        fetchPendingReviews()

        // Show Google review option if requested
        if (data.data.googleReviewRequested) {
          const review = pendingReviews.find((r) => r.id === reviewRequestId)
          if (review) {
            showGoogleReviewPrompt(review)
          }
        }
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to submit review',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit review',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(null)
    }
  }

  const showGoogleReviewPrompt = (review: ReviewRequest) => {
    const googleUrl = `/api/reviews/google/redirect/${review.id}`

    toast({
      title: 'Leave a Google Review?',
      description: 'Would you also like to leave a review on Google?',
      action: (
        <Button
          size="sm"
          onClick={() => window.open(googleUrl, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Google Review
        </Button>
      ),
    })
  }

  const StarRating = ({
    value,
    onChange,
    disabled
  }: {
    value: number
    onChange: (rating: number) => void
    disabled?: boolean
  }) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => !disabled && onChange(star)}
            onMouseEnter={() => !disabled && setHoveredRating(star)}
            onMouseLeave={() => !disabled && setHoveredRating(0)}
            disabled={disabled}
            className="transition-transform hover:scale-110 disabled:cursor-not-allowed"
          >
            <Star
              className={`h-8 w-8 ${
                star <= (hoveredRating || value)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading pending reviews...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (pendingReviews.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Your Reviews</CardTitle>
            <CardDescription>No pending reviews at this time</CardDescription>
          </CardHeader>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              You&apos;re all caught up! We&apos;ll notify you when there&apos;s a new service to review.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Reviews</h1>
        <p className="text-muted-foreground mt-2">
          Share your feedback on recent services
        </p>
      </div>

      <div className="grid gap-6">
        {pendingReviews.map((review) => (
          <Card key={review.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{review.jobs.service_type}</CardTitle>
                  <CardDescription>
                    {review.jobs.service_address}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {review.daysSinceRequest} {review.daysSinceRequest === 1 ? 'day' : 'days'} ago
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Service completed on {new Date(review.jobs.completed_at).toLocaleDateString()}
              </div>

              {selectedReview === review.id ? (
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <label className="text-sm font-medium">How would you rate this service?</label>
                    <div className="mt-2">
                      <StarRating
                        value={rating}
                        onChange={setRating}
                        disabled={submitting !== null}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      Tell us more (optional)
                    </label>
                    <Textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Share your experience with us..."
                      className="mt-2"
                      rows={4}
                      disabled={submitting !== null}
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {reviewText.length}/2000 characters
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSubmitReview(review.id)}
                      disabled={submitting !== null || rating === 0}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {submitting === review.id ? 'Submitting...' : 'Submit Review'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedReview(null)
                        setRating(0)
                        setReviewText('')
                      }}
                      disabled={submitting !== null}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setSelectedReview(review.id)}
                  className="w-full"
                >
                  Leave Review
                </Button>
              )}

              {review.google_review_requested && !review.google_review_link_clicked && (
                <Button
                  variant="outline"
                  onClick={() => showGoogleReviewPrompt(review)}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Also Leave a Google Review
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
