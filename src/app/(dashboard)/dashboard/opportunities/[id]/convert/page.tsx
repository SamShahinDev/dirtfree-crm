'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Loader2, TrendingUp, DollarSign } from 'lucide-react'
import Link from 'next/link'

interface Opportunity {
  id: string
  customer_id: string
  customer: {
    full_name: string
  }
  opportunity_type: string
  estimated_value: number | null
  reason: string | null
  created_at: string
}

interface Job {
  id: string
  job_number: string
  service_date: string
  total_amount: number
  status: string
}

export default function ConvertOpportunityPage() {
  const router = useRouter()
  const params = useParams()
  const opportunityId = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])

  const [formData, setFormData] = useState({
    jobId: '',
    conversionValue: '',
    notes: '',
    successFactors: '',
  })

  useEffect(() => {
    loadData()
  }, [opportunityId])

  async function loadData() {
    try {
      setLoading(true)

      // Load opportunity
      const oppRes = await fetch(`/api/opportunities`)
      if (oppRes.ok) {
        const oppData = await oppRes.json()
        const opps = oppData.data?.opportunities || []
        const opp = opps.find((o: any) => o.id === opportunityId)

        if (opp) {
          setOpportunity(opp)

          // Load customer's jobs
          const jobsRes = await fetch(`/api/jobs?customerId=${opp.customer_id}&limit=50`)
          if (jobsRes.ok) {
            const jobsData = await jobsRes.json()
            setJobs(jobsData.data?.jobs || [])
          }

          // Pre-fill conversion value with estimated value
          if (opp.estimated_value) {
            setFormData((prev) => ({
              ...prev,
              conversionValue: opp.estimated_value.toString(),
            }))
          }
        }
      }
    } catch (error) {
      console.error('Load error:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  function handleJobSelect(jobId: string) {
    setFormData({ ...formData, jobId })

    // Auto-fill conversion value with job total
    const selectedJob = jobs.find((j) => j.id === jobId)
    if (selectedJob) {
      setFormData((prev) => ({
        ...prev,
        conversionValue: selectedJob.total_amount.toString(),
      }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.jobId) {
      toast.error('Please select a job')
      return
    }

    if (!formData.conversionValue || parseFloat(formData.conversionValue) <= 0) {
      toast.error('Please enter a valid conversion value')
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        jobId: formData.jobId,
        conversionValue: parseFloat(formData.conversionValue),
        notes: formData.notes || undefined,
        successFactors: formData.successFactors || undefined,
      }

      const res = await fetch(`/api/opportunities/${opportunityId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to convert opportunity')
      }

      toast.success('Opportunity converted successfully! 🎉')
      router.push(`/dashboard/opportunities`)
    } catch (error) {
      console.error('Submit error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to convert opportunity')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!opportunity) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Opportunity Not Found</CardTitle>
            <CardDescription>The opportunity you are looking for does not exist.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const selectedJob = jobs.find((j) => j.id === formData.jobId)
  const daysSinceCreated = Math.floor(
    (new Date().getTime() - new Date(opportunity.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/opportunities"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Opportunities
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Convert Opportunity</h1>
            <p className="text-muted-foreground mt-1">
              Mark this opportunity as successfully converted
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Success Message */}
          <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-900">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900 dark:text-green-100">
                    Great job!
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    You're about to mark this opportunity as converted. This will update revenue
                    metrics and may award you points.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Job Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Link to Job</CardTitle>
                <CardDescription>
                  Select the job that resulted from this opportunity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="job">Job *</Label>
                  <Select value={formData.jobId} onValueChange={handleJobSelect}>
                    <SelectTrigger id="job">
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No jobs found for this customer
                        </div>
                      ) : (
                        jobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.job_number} - {new Date(job.service_date).toLocaleDateString()} -
                            ${job.total_amount.toFixed(2)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedJob && (
                    <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                      <div className="flex justify-between items-center">
                        <span>Job Total:</span>
                        <span className="font-semibold">
                          ${selectedJob.total_amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span>Service Date:</span>
                        <span>
                          {new Date(selectedJob.service_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span>Status:</span>
                        <Badge variant="outline">{selectedJob.status}</Badge>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">Actual Conversion Value ($) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="value"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-9"
                      value={formData.conversionValue}
                      onChange={(e) =>
                        setFormData({ ...formData, conversionValue: e.target.value })
                      }
                      required
                    />
                  </div>
                  {opportunity.estimated_value && (
                    <p className="text-xs text-muted-foreground">
                      Estimated value was ${opportunity.estimated_value.toFixed(2)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Success Factors */}
            <Card>
              <CardHeader>
                <CardTitle>What Worked?</CardTitle>
                <CardDescription>
                  Help your team learn from your success
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="successFactors">Success Factors</Label>
                  <Textarea
                    id="successFactors"
                    placeholder="What convinced the customer? What approach worked best? Any lessons learned?"
                    rows={4}
                    value={formData.successFactors}
                    onChange={(e) =>
                      setFormData({ ...formData, successFactors: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any other details about the conversion..."
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/opportunities')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || jobs.length === 0}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm Conversion
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* Sidebar - Opportunity Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Opportunity Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium">{opportunity.customer.full_name}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <Badge variant="secondary" className="mt-1">
                  {opportunity.opportunity_type.replace('_', ' ')}
                </Badge>
              </div>

              {opportunity.estimated_value && (
                <div>
                  <p className="text-xs text-muted-foreground">Estimated Value</p>
                  <p className="text-lg font-semibold text-green-600">
                    ${opportunity.estimated_value.toFixed(2)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">
                  {new Date(opportunity.created_at).toLocaleDateString()}
                  <span className="text-muted-foreground ml-2">
                    ({daysSinceCreated} days ago)
                  </span>
                </p>
              </div>

              {opportunity.reason && (
                <div>
                  <p className="text-xs text-muted-foreground">Original Reason</p>
                  <p className="text-sm">{opportunity.reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversion Impact */}
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200 dark:border-green-900">
            <CardHeader>
              <CardTitle className="text-base text-green-900 dark:text-green-100">
                Conversion Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Opportunity marked as won</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Revenue metrics updated</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Points awarded to you</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Success notification sent</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
