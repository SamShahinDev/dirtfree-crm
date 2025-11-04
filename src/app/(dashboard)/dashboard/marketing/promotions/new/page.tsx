'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertCircle,
  ArrowLeft,
  Save,
  Eye,
  Users,
  DollarSign,
  Calendar,
  Tag,
  Send,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'

/**
 * Promotion Creation Form
 *
 * Comprehensive form for creating new promotions with:
 * - Basic info (title, description, type, discount)
 * - Targeting (audience, zones, job value requirements)
 * - Schedule (dates, redemption limits)
 * - Delivery (channels, auto-deliver, promo code)
 * - Preview (estimated reach, cost estimate)
 */

const formSchema = z.object({
  // Basic Info
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  promotionType: z.enum([
    'percentage_off',
    'dollar_off',
    'free_addon',
    'bogo',
    'seasonal',
    'referral',
    'loyalty',
  ]),
  discountValue: z.number().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),

  // Targeting
  targetAudience: z.enum([
    'all_customers',
    'inactive',
    'vip',
    'new',
    'zone_specific',
    'service_specific',
    'custom',
  ]),
  targetZones: z.array(z.string()).optional(),
  targetServiceTypes: z.array(z.string()).optional(),
  minJobValue: z.number().optional(),
  maxJobValue: z.number().optional(),

  // Schedule
  startDate: z.string(),
  endDate: z.string(),
  maxRedemptions: z.number().int().min(1).optional(),
  redemptionsPerCustomer: z.number().int().min(1),

  // Delivery
  deliveryChannels: z.array(z.string()).min(1, 'Select at least one delivery channel'),
  autoDeliver: z.boolean(),
  promoCode: z.string().max(50).optional(),

  // Terms
  termsAndConditions: z.string().optional(),

  // Status
  status: z.enum(['draft', 'scheduled', 'active']),
})

type FormData = z.infer<typeof formSchema>

export default function NewPromotionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([])

  // Preview state
  const [estimatedReach, setEstimatedReach] = useState(0)
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      promotionType: 'percentage_off',
      targetAudience: 'all_customers',
      redemptionsPerCustomer: 1,
      deliveryChannels: ['portal'],
      autoDeliver: true,
      status: 'draft',
    },
  })

  const promotionType = form.watch('promotionType')
  const targetAudience = form.watch('targetAudience')
  const deliveryChannels = form.watch('deliveryChannels')

  // Fetch zones
  useEffect(() => {
    fetchZones()
  }, [])

  const fetchZones = async () => {
    try {
      const response = await fetch('/api/zones')
      const data = await response.json()
      if (data.success) {
        setZones(data.data.zones || [])
      }
    } catch (err) {
      console.error('Failed to fetch zones:', err)
    }
  }

  // Calculate preview
  const handlePreview = async () => {
    // TODO: Call API to calculate estimated reach and cost
    setShowPreview(true)
    setEstimatedReach(150) // Mock data
    setEstimatedCost(12.50) // Mock data
  }

  // Submit form
  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.message || 'Failed to create promotion')
      }

      router.push('/dashboard/marketing/promotions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create promotion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Promotion</h1>
          <p className="text-muted-foreground">
            Create a new promotional campaign
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Define the promotion details and discount
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Spring Cleaning Special" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Get 20% off all carpet cleaning services this spring..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="promotionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promotion Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentage_off">Percentage Off</SelectItem>
                        <SelectItem value="dollar_off">Dollar Amount Off</SelectItem>
                        <SelectItem value="free_addon">Free Add-on Service</SelectItem>
                        <SelectItem value="bogo">Buy One Get One</SelectItem>
                        <SelectItem value="seasonal">Seasonal Special</SelectItem>
                        <SelectItem value="referral">Referral Bonus</SelectItem>
                        <SelectItem value="loyalty">Loyalty Reward</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {promotionType === 'percentage_off' && (
                <FormField
                  control={form.control}
                  name="discountPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Percentage</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="20"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {promotionType === 'dollar_off' && (
                <FormField
                  control={form.control}
                  name="discountValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Amount</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="50.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          {/* Targeting */}
          <Card>
            <CardHeader>
              <CardTitle>Targeting</CardTitle>
              <CardDescription>
                Choose who will receive this promotion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="targetAudience"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Audience</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all_customers">All Customers</SelectItem>
                        <SelectItem value="inactive">Inactive Customers (90+ days)</SelectItem>
                        <SelectItem value="vip">VIP Customers</SelectItem>
                        <SelectItem value="new">New Customers (Last 30 days)</SelectItem>
                        <SelectItem value="zone_specific">Specific Zones</SelectItem>
                        <SelectItem value="service_specific">Specific Services</SelectItem>
                        <SelectItem value="custom">Custom Filters</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(targetAudience === 'zone_specific' || targetAudience === 'custom') && (
                <FormField
                  control={form.control}
                  name="targetZones"
                  render={() => (
                    <FormItem>
                      <FormLabel>Target Zones</FormLabel>
                      <div className="space-y-2">
                        {zones.map((zone) => (
                          <FormField
                            key={zone.id}
                            control={form.control}
                            name="targetZones"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={zone.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(zone.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), zone.id])
                                          : field.onChange(
                                              field.value?.filter((value) => value !== zone.id)
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {zone.name}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="minJobValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Job Value (Optional)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="100.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Minimum order amount required
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxJobValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Job Value (Optional)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="500.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Maximum order amount allowed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>
                Set the promotion validity period and limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="maxRedemptions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Total Redemptions (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="100"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Leave empty for unlimited
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="redemptionsPerCustomer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Redemptions Per Customer</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormDescription>
                        How many times each customer can use this
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Delivery */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Settings</CardTitle>
              <CardDescription>
                Configure how this promotion will be delivered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="deliveryChannels"
                render={() => (
                  <FormItem>
                    <FormLabel>Delivery Channels</FormLabel>
                    <div className="space-y-2">
                      {[
                        { value: 'portal', label: 'Portal Notification' },
                        { value: 'email', label: 'Email' },
                        { value: 'sms', label: 'SMS' },
                      ].map((channel) => (
                        <FormField
                          key={channel.value}
                          control={form.control}
                          name="deliveryChannels"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={channel.value}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(channel.value)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), channel.value])
                                        : field.onChange(
                                            field.value?.filter((value) => value !== channel.value)
                                          )
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {channel.label}
                                </FormLabel>
                              </FormItem>
                            )
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoDeliver"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Auto-Deliver</FormLabel>
                      <FormDescription>
                        Automatically send to eligible customers when promotion starts
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="promoCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promo Code (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="SPRING20"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Leave empty to auto-generate a code
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="termsAndConditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Terms and Conditions (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Offer valid for new customers only. Cannot be combined with other offers..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Preview */}
          {showPreview && (
            <Card>
              <CardHeader>
                <CardTitle>Preview & Estimates</CardTitle>
                <CardDescription>
                  See how this promotion will appear and estimated metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">Estimated Reach</span>
                    </div>
                    <p className="text-2xl font-bold">{estimatedReach}</p>
                    <p className="text-xs text-muted-foreground">customers</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Estimated Cost</span>
                    </div>
                    <p className="text-2xl font-bold">${estimatedCost.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">delivery cost</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm">Duration</span>
                    </div>
                    <p className="text-2xl font-bold">30</p>
                    <p className="text-xs text-muted-foreground">days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>
                Choose the initial status for this promotion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft (not visible)</SelectItem>
                        <SelectItem value="scheduled">Scheduled (will activate on start date)</SelectItem>
                        <SelectItem value="active">Active (live immediately)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>

            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Creating...' : 'Create Promotion'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
