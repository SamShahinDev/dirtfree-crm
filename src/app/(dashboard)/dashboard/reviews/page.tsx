'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Star, Send, MessageSquare, AlertCircle, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/**
 * Staff Review Dashboard
 *
 * Features:
 * - View all review requests
 * - Filter by status (pending, completed, expired)
 * - Respond to reviews
 * - Send follow-up reminders
 * - View customer details
 */

interface ReviewRequest {
  id: string
  customer_id: string
  job_id: string
  requested_at: string
  request_method: string
  portal_review_completed: boolean
  portal_review_rating: number | null
  portal_review_text: string | null
  portal_review_submitted_at: string | null
  google_review_requested: boolean
  google_review_link_clicked: boolean
  google_review_clicked_at: string | null
  google_review_completed: boolean
  google_review_completed_at: string | null
  reminder_sent: boolean
  reminder_sent_at: string | null
  status: string
  created_at: string
  customers: {
    id: string
    full_name: string
    email: string
    phone: string
  }
  jobs: {
    id: string
    service_type: string
    completed_at: string
    total_amount: number
  }
}

export default function StaffReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const { toast } = useToast()

  // Response dialog state
  const [responseDialog, setResponseDialog] = useState(false)
  const [selectedReview, setSelectedReview] = useState<ReviewRequest | null>(null)
  const [responseType, setResponseType] = useState<'thank_you' | 'issue_follow_up' | 'general'>('thank_you')
  const [responseText, setResponseText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchReviews()
  }, [activeTab])

  const fetchReviews = async () => {
    try {
      setLoading(true)
      const statusParam = activeTab === 'all' ? '' : `?status=${activeTab}`
      const response = await fetch(`/api/reviews/requests${statusParam}`)
      const data = await response.json()

      if (data.success) {
        setReviews(data.data.requests)
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to load reviews',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
      toast({
        title: 'Error',
        description: 'Failed to load reviews',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendResponse = async () => {
    if (!selectedReview || !responseText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a response message',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch(`/api/reviews/${selectedReview.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseType,
          responseText,
          deliveryMethod: 'portal',
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Response sent successfully',
        })

        setResponseDialog(false)
        setSelectedReview(null)
        setResponseText('')
        fetchReviews()
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Failed to send response',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error sending response:', error)
      toast({
        title: 'Error',
        description: 'Failed to send response',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', icon: any }> = {
      pending: { variant: 'outline', icon: Clock },
      portal_completed: { variant: 'default', icon: CheckCircle },
      google_completed: { variant: 'default', icon: CheckCircle },
      expired: { variant: 'secondary', icon: AlertCircle },
      opted_out: { variant: 'destructive', icon: AlertCircle },
    }

    const config = variants[status] || variants.pending
    const Icon = config.icon

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    )
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

  const filteredReviews = activeTab === 'all'
    ? reviews
    : reviews.filter((r) => r.status === activeTab)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Review Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage customer reviews and feedback
          </p>
        </div>
        <Button onClick={() => window.location.href = '/dashboard/reviews/statistics'}>
          View Statistics
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="portal_completed">Portal Completed</TabsTrigger>
          <TabsTrigger value="google_completed">Google Completed</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Loading reviews...</p>
              </CardContent>
            </Card>
          ) : filteredReviews.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No reviews found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredReviews.map((review) => (
                <Card key={review.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {review.customers.full_name}
                        </CardTitle>
                        <CardDescription>
                          {review.jobs.service_type} • Completed {new Date(review.jobs.completed_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      {getStatusBadge(review.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Customer:</span>
                        <p className="font-medium">{review.customers.email}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Requested:</span>
                        <p className="font-medium">
                          {new Date(review.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {review.portal_review_completed && (
                      <div className="border-t pt-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Portal Review:</span>
                          <StarDisplay rating={review.portal_review_rating} />
                        </div>
                        {review.portal_review_text && (
                          <p className="text-sm text-muted-foreground italic">
                            &quot;{review.portal_review_text}&quot;
                          </p>
                        )}
                      </div>
                    )}

                    {review.google_review_requested && (
                      <div className="flex items-center gap-2 text-sm">
                        <ExternalLink className="h-4 w-4" />
                        <span className="text-muted-foreground">
                          Google Review: {review.google_review_link_clicked ? 'Link clicked' : 'Not clicked yet'}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {review.portal_review_completed && (
                        <Dialog open={responseDialog && selectedReview?.id === review.id} onOpenChange={(open) => {
                          setResponseDialog(open)
                          if (!open) setSelectedReview(null)
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedReview(review)}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Respond
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Respond to Review</DialogTitle>
                              <DialogDescription>
                                Send a response to {review.customers.full_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Response Type</label>
                                <Select value={responseType} onValueChange={(value: any) => setResponseType(value)}>
                                  <SelectTrigger className="mt-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="thank_you">Thank You</SelectItem>
                                    <SelectItem value="issue_follow_up">Issue Follow-up</SelectItem>
                                    <SelectItem value="general">General</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Message</label>
                                <Textarea
                                  value={responseText}
                                  onChange={(e) => setResponseText(e.target.value)}
                                  placeholder="Type your response..."
                                  className="mt-2"
                                  rows={5}
                                  maxLength={2000}
                                />
                              </div>
                              <Button
                                onClick={handleSendResponse}
                                disabled={submitting || !responseText.trim()}
                                className="w-full"
                              >
                                <Send className="h-4 w-4 mr-2" />
                                {submitting ? 'Sending...' : 'Send Response'}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
