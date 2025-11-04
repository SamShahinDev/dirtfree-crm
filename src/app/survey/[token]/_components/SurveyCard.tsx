'use client'

import { useState } from 'react'
import { Star, Send, ExternalLink, CheckCircle, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { cn } from '@/lib/utils'
import { submitSurvey, type SurveySubmissionResult } from '../actions'
import type { SurveyData } from '@/lib/surveys/token'

interface SurveyCardProps {
  survey: SurveyData
  token: string
}

interface SubmissionState {
  submitted: boolean
  result: SurveySubmissionResult | null
}

export function SurveyCard({ survey, token }: SurveyCardProps) {
  const [score, setScore] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submission, setSubmission] = useState<SubmissionState>({
    submitted: false,
    result: null
  })

  // Handle star rating click
  const handleStarClick = (rating: number) => {
    setScore(rating)
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!score) {
      toast.error('Please select a rating before submitting')
      return
    }

    try {
      setIsSubmitting(true)

      const result = await submitSurvey({
        token,
        score,
        feedback: feedback.trim() || undefined
      })

      if (result.success) {
        setSubmission({
          submitted: true,
          result
        })

        if (result.positive) {
          toast.success('Thank you for your feedback!')
        } else {
          toast.success('Thank you for your feedback. We\'ll be in touch soon.')
        }
      } else {
        toast.error(result.error || 'Failed to submit survey')
      }

    } catch (error) {
      console.error('Error submitting survey:', error)
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show success screen after submission
  if (submission.submitted && submission.result) {
    return (
      <SuccessCard
        survey={survey}
        result={submission.result}
        score={score!}
      />
    )
  }

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <Card className="w-full shadow-lg border-0 bg-white">
      <CardHeader className="text-center pb-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-8 h-8 text-blue-600" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">
          How was your service today?
        </CardTitle>
        <div className="text-sm text-gray-600 space-y-1">
          <p className="font-medium">{survey.customerName}</p>
          {survey.jobDate && (
            <p>{formatDate(survey.jobDate)}</p>
          )}
          {survey.technicianName && (
            <p>Technician: {survey.technicianName}</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Star Rating */}
        <div className="space-y-3">
          <Label className="text-base font-medium text-gray-900">
            Rate your experience
          </Label>

          {/* Star Rating with Radio Group for accessibility */}
          <RadioGroup
            value={score?.toString()}
            onValueChange={(value) => setScore(parseInt(value))}
            className="flex justify-center space-x-2"
          >
            {[1, 2, 3, 4, 5].map((rating) => (
              <div key={rating} className="flex flex-col items-center">
                <RadioGroupItem
                  value={rating.toString()}
                  id={`rating-${rating}`}
                  className="sr-only"
                />
                <Label
                  htmlFor={`rating-${rating}`}
                  className="cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                  onClick={() => handleStarClick(rating)}
                >
                  <Star
                    className={cn(
                      'w-8 h-8 transition-colors',
                      score && rating <= score
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300 hover:text-yellow-400'
                    )}
                  />
                </Label>
              </div>
            ))}
          </RadioGroup>

          {/* Rating labels */}
          <div className="flex justify-between text-xs text-gray-500 px-1">
            <span>Poor</span>
            <span>Excellent</span>
          </div>
        </div>

        {/* Feedback Textarea */}
        <div className="space-y-2">
          <Label htmlFor="feedback" className="text-base font-medium text-gray-900">
            Additional feedback (optional)
          </Label>
          <Textarea
            id="feedback"
            placeholder="Tell us more about your experience..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            maxLength={2000}
            className="resize-none border-gray-200 focus:border-blue-500 focus:ring-blue-500"
          />
          <div className="text-xs text-gray-500 text-right">
            {feedback.length}/2000 characters
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!score || isSubmitting}
          className="w-full py-3 text-base font-medium bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Submit Feedback
            </>
          )}
        </Button>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 pt-2 border-t">
          Your feedback helps us improve our service
        </div>
      </CardContent>
    </Card>
  )
}

interface SuccessCardProps {
  survey: SurveyData
  result: SurveySubmissionResult
  score: number
}

function SuccessCard({ survey, result, score }: SuccessCardProps) {
  const isPositive = result.positive

  return (
    <Card className="w-full shadow-lg border-0 bg-white">
      <CardContent className="text-center p-8">
        <div className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6',
          isPositive ? 'bg-green-100' : 'bg-blue-100'
        )}>
          <CheckCircle className={cn(
            'w-8 h-8',
            isPositive ? 'text-green-600' : 'text-blue-600'
          )} />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          {isPositive ? 'Thank you for your feedback!' : 'Thank you for your feedback'}
        </h2>

        {isPositive ? (
          <div className="space-y-6">
            <p className="text-gray-600 mb-6">
              We're thrilled you had a great experience with Dirt Free Carpet!
              Would you mind sharing your experience with others by leaving a review?
            </p>

            {/* Review Buttons */}
            <div className="space-y-3">
              {result.links?.google && (
                <a
                  href={result.links.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Leave a Google Review
                </a>
              )}

              {result.links?.yelp && (
                <a
                  href={result.links.yelp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Leave a Yelp Review
                </a>
              )}

              {!result.links?.google && !result.links?.yelp && (
                <p className="text-sm text-gray-500">
                  Review links are not available at this time.
                </p>
              )}
            </div>

            <div className="text-xs text-gray-500 pt-4 border-t">
              Reviews help other customers find quality service
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              We appreciate you taking the time to share your experience with Dirt Free Carpet.
              We'll be in touch soon to make things right.
            </p>

            <div className="text-xs text-gray-500 pt-4 border-t">
              We take all feedback seriously and strive to improve
            </div>
          </div>
        )}

        {/* Show the rating they gave */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm text-gray-500 mb-2">Your rating:</p>
          <div className="flex justify-center space-x-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <Star
                key={rating}
                className={cn(
                  'w-5 h-5',
                  rating <= score
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                )}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}