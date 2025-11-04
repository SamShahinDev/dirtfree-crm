'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Star, ThumbsUp, AlertCircle, ExternalLink, Send, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

/**
 * Smart Review Submission Portal
 *
 * Features:
 * - Star rating selector (1-5)
 * - Conditional UI based on rating:
 *   - 4-5 stars: Optional feedback + Google review option
 *   - 1-3 stars: Required feedback + resolution request
 * - Automatic support ticket creation for low ratings
 * - Google review link tracking
 */

interface ReviewRequest {
  id: string
  customer_id: string
  job_id: string
  requested_at: string
  portal_review_completed: boolean
  status: string
  jobs: {
    service_type: string
    completed_at: string
    service_address: string
    total_amount: number
  }
}

export default function ReviewSubmissionPage() {
  const params = useParams()
  const router = useRouter()
  const requestId = params.requestId as string
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(null)

  // Form state
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [resolutionRequest, setResolutionRequest] = useState('')

  useEffect(() => {
    fetchReviewRequest()
  }, [requestId])

  const fetchReviewRequest = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/portal/reviews/${requestId}`)
      const data = await response.json()

      if (data.success) {
        setReviewRequest(data.data.reviewRequest)

        // Check if already completed
        if (data.data.reviewRequest.portal_review_completed) {
          toast({
            title: 'Already Submitted',
            description: 'You have already submitted a review for this service.',
          })
        }
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to load review request',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching review request:', error)
      toast({
        title: 'Error',
        description: 'Failed to load review request',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitReview = async () => {
    if (rating === 0) {
      toast({
        title: 'Rating Required',
        description: 'Please select a star rating',
        variant: 'destructive',
      })
      return
    }

    // For low ratings (1-3), require feedback
    if (rating <= 3 && !feedback.trim()) {
      toast({
        title: 'Feedback Required',
        description: 'Please provide feedback about your experience',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch(`/api/portal/reviews/${requestId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          feedback: feedback.trim(),
          resolutionRequest: resolutionRequest.trim(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSubmitted(true)

        toast({
          title: 'Thank You!',
          description: 'Your review has been submitted successfully',
        })

        // If high rating and Google review requested, show Google option
        if (rating >= 4 && data.data.googleReviewRequested) {
          // Will show in the submitted state UI
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
      setSubmitting(false)
    }
  }

  const handleGoogleReviewClick = async () => {
    try {
      // Track the click
      await fetch(`/api/portal/reviews/${requestId}/google-click`, {
        method: 'POST',
      })

      // Open Google review page
      window.open(`/api/reviews/google/redirect/${requestId}`, '_blank')
    } catch (error) {
      console.error('Error tracking Google click:', error)
      // Still open the link even if tracking fails
      window.open(`/api/reviews/google/redirect/${requestId}`, '_blank')
    }
  }

  const StarRating = () => {
    return (
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            disabled={submitting || submitted}
            className="transition-all hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Star
              className={`h-12 w-12 ${
                star <= (hoveredRating || rating)
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
      <div className="container mx-auto p-6 max-w-3xl">
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Loading review request...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!reviewRequest) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Review request not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (reviewRequest.portal_review_completed && !submitted) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Already Submitted</h2>
            <p className="text-muted-foreground">
              You have already submitted a review for this service. Thank you for your feedback!
            </p>
            <Button
              onClick={() => router.push('/portal/reviews')}
              className="mt-6"
            >
              View All Reviews
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Card>
          <CardContent className="p-12 text-center space-y-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />

            <div>
              <h2 className="text-3xl font-bold mb-2">Thank You!</h2>
              <p className="text-lg text-muted-foreground">
                We appreciate you taking the time to share your feedback.
              </p>
            </div>

            {rating >= 4 && (
              <div className="border-t pt-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-3">
                    Love what we did? Share it with others!
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Your positive review on Google helps neighbors in our community find quality
                    carpet cleaning service.
                  </p>
                  <Button
                    onClick={handleGoogleReviewClick}
                    size="lg"
                    className="w-full"
                  >
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Leave a Google Review
                  </Button>
                  <p className="text-xs text-muted-foreground mt-3">
                    Opens in a new tab • Takes less than 1 minute
                  </p>
                </div>
              </div>
            )}

            {rating <= 3 && (
              <div className="border-t pt-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    We&apos;re committed to making this right. Our team will review your feedback and
                    reach out to you within 24 hours.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <Button
              onClick={() => router.push('/portal')}
              variant="outline"
              className="mt-4"
            >
              Back to Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">How was your experience?</CardTitle>
          <CardDescription>
            Your feedback helps us improve our service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Service Details */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Service Details</h3>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Service:</span>{' '}
                <span className="font-medium">{reviewRequest.jobs.service_type}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Date:</span>{' '}
                <span className="font-medium">
                  {new Date(reviewRequest.jobs.completed_at).toLocaleDateString()}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Location:</span>{' '}
                <span className="font-medium">{reviewRequest.jobs.service_address}</span>
              </p>
            </div>
          </div>

          {/* Star Rating */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-center block">
              Rate your experience
            </label>
            <StarRating />
            {rating > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {rating === 5 && '⭐ Excellent!'}
                {rating === 4 && '⭐ Good'}
                {rating === 3 && '⭐ Average'}
                {rating === 2 && '⭐ Below Expectations'}
                {rating === 1 && '⭐ Poor'}
              </p>
            )}
          </div>

          {/* Conditional Content Based on Rating */}
          {rating > 0 && (
            <div className="border-t pt-6 space-y-4">
              {rating >= 4 ? (
                // High Rating (4-5 stars)
                <>
                  <Alert className="bg-green-50 border-green-200">
                    <ThumbsUp className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      We&apos;re thrilled you&apos;re satisfied with our service!
                    </AlertDescription>
                  </Alert>

                  <div>
                    <label className="text-sm font-medium">
                      Tell us what we did well (optional)
                    </label>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Share what you loved about our service..."
                      className="mt-2"
                      rows={4}
                      disabled={submitting}
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {feedback.length}/2000 characters
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900 mb-2">
                      <strong>After submitting,</strong> you&apos;ll have the option to share your
                      positive experience on Google to help others in the community!
                    </p>
                  </div>
                </>
              ) : (
                // Low Rating (1-3 stars)
                <>
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-red-800">
                      We&apos;re sorry we didn&apos;t meet your expectations. Your feedback will help us
                      improve.
                    </AlertDescription>
                  </Alert>

                  <div>
                    <label className="text-sm font-medium">
                      What went wrong? <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Please provide detailed feedback about your experience..."
                      className="mt-2"
                      rows={5}
                      disabled={submitting}
                      maxLength={2000}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {feedback.length}/2000 characters • Required
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      What can we do to make this right?
                    </label>
                    <Input
                      value={resolutionRequest}
                      onChange={(e) => setResolutionRequest(e.target.value)}
                      placeholder="e.g., Re-clean specific area, refund, discount on next service..."
                      className="mt-2"
                      disabled={submitting}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Optional</p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-900">
                      <strong>We&apos;ll contact you within 24 hours</strong> to resolve this issue and
                      make things right. A support ticket will be created for our team.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Submit Button */}
          {rating > 0 && (
            <Button
              onClick={handleSubmitReview}
              disabled={submitting || (rating <= 3 && !feedback.trim())}
              className="w-full"
              size="lg"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
