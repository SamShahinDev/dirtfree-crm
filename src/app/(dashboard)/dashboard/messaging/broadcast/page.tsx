'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Send,
  Calendar,
  Users,
  DollarSign,
  Mail,
  MessageSquare,
  Smartphone,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Upload,
  RefreshCw,
} from 'lucide-react'

/**
 * Broadcast Messaging Dashboard
 *
 * Enables staff to send targeted mass communications via:
 * - Portal notifications
 * - Email
 * - SMS
 *
 * Features:
 * - Compose message
 * - Filter recipients
 * - Schedule delivery
 * - Preview and cost estimation
 * - Track delivery status
 */

interface BroadcastMessage {
  id: string
  subject: string
  messageText: string
  deliveryMethods: string[]
  recipientCount: number
  scheduledFor: string | null
  status: string
  sentAt: string | null
  deliverySuccessCount: number
  deliveryFailedCount: number
  estimatedCostUsd: number
  createdAt: string
}

interface RecipientFilter {
  zones?: string[]
  serviceTypes?: string[]
  tags?: string[]
  lastVisitStart?: string
  lastVisitEnd?: string
  specificIds?: string[]
}

interface PreviewData {
  totalRecipients: number
  previewRecipients: Array<{
    customerId: string
    customerName: string
    email: string | null
    phone: string | null
    canReceiveEmail: boolean
    canReceiveSms: boolean
  }>
  deliveryCounts: {
    portal: number
    email: number
    sms: number
  }
  costEstimate: {
    sms: number
    total: number
  }
  warnings: string[]
}

export default function BroadcastMessagingPage() {
  // Form state
  const [subject, setSubject] = useState('')
  const [messageText, setMessageText] = useState('')
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>(['portal'])
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>({})
  const [scheduledFor, setScheduledFor] = useState('')
  const [sendImmediately, setSendImmediately] = useState(false)

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploadedIds, setUploadedIds] = useState<string[]>([])

  // Preview
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Broadcasts list
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([])
  const [broadcastsLoading, setBroadcastsLoading] = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Available zones and service types (would normally come from API)
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([])
  const [serviceTypes] = useState([
    'carpet_cleaning',
    'tile_grout',
    'upholstery',
    'water_damage',
    'area_rug',
  ])

  // Fetch zones
  useEffect(() => {
    fetchZones()
    fetchBroadcasts()
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

  // Fetch broadcasts
  const fetchBroadcasts = async () => {
    try {
      setBroadcastsLoading(true)
      const response = await fetch('/api/messaging/broadcast')
      const data = await response.json()

      if (data.success) {
        setBroadcasts(data.data.broadcasts || [])
      }
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err)
    } finally {
      setBroadcastsLoading(false)
    }
  }

  // Handle CSV upload
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFile(file)

    // Parse CSV file (simple implementation - would need proper CSV parser)
    const text = await file.text()
    const lines = text.split('\n')
    const ids: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      // Check if line looks like a UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        ids.push(trimmed)
      }
    }

    setUploadedIds(ids)
    setRecipientFilter({ ...recipientFilter, specificIds: ids })
  }

  // Preview recipients
  const handlePreview = async () => {
    try {
      setPreviewLoading(true)
      setError(null)

      const response = await fetch('/api/messaging/broadcast/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientFilter,
          messageText,
          deliveryMethods,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to preview recipients')
      }

      setPreviewData(data.data)
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview recipients')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Send broadcast
  const handleSend = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/messaging/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          messageText,
          deliveryMethods,
          recipientFilter,
          scheduledFor: scheduledFor || undefined,
          sendImmediately,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to create broadcast')
      }

      // Reset form
      setSubject('')
      setMessageText('')
      setDeliveryMethods(['portal'])
      setRecipientFilter({})
      setScheduledFor('')
      setSendImmediately(false)
      setUploadedIds([])
      setCsvFile(null)
      setShowPreview(false)
      setShowConfirmDialog(false)

      // Refresh broadcasts list
      fetchBroadcasts()

      alert('Broadcast message created successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create broadcast')
    } finally {
      setLoading(false)
    }
  }

  // Toggle delivery method
  const toggleDeliveryMethod = (method: string) => {
    if (deliveryMethods.includes(method)) {
      setDeliveryMethods(deliveryMethods.filter((m) => m !== method))
    } else {
      setDeliveryMethods([...deliveryMethods, method])
    }
  }

  // Format status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'secondary',
      scheduled: 'outline',
      sending: 'default',
      sent: 'default',
      failed: 'destructive',
      cancelled: 'secondary',
    }

    return (
      <Badge variant={variants[status] || 'default'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Broadcast Messaging</h1>
        <p className="text-muted-foreground">
          Send targeted mass communications to customers
        </p>
      </div>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Message Composition */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Message</CardTitle>
                <CardDescription>Compose your broadcast message</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Important service update"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Enter your message here..."
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    {messageText.length} characters
                    {messageText.length > 160 && ` (${Math.ceil(messageText.length / 153)} SMS segments)`}
                  </p>
                </div>

                {/* Delivery Methods */}
                <div className="space-y-2">
                  <Label>Delivery Methods</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="portal"
                        checked={deliveryMethods.includes('portal')}
                        onCheckedChange={() => toggleDeliveryMethod('portal')}
                      />
                      <Label htmlFor="portal" className="flex items-center gap-2 cursor-pointer">
                        <MessageSquare className="h-4 w-4" />
                        Portal Notification (Free)
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="email"
                        checked={deliveryMethods.includes('email')}
                        onCheckedChange={() => toggleDeliveryMethod('email')}
                      />
                      <Label htmlFor="email" className="flex items-center gap-2 cursor-pointer">
                        <Mail className="h-4 w-4" />
                        Email (Free)
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sms"
                        checked={deliveryMethods.includes('sms')}
                        onCheckedChange={() => toggleDeliveryMethod('sms')}
                      />
                      <Label htmlFor="sms" className="flex items-center gap-2 cursor-pointer">
                        <Smartphone className="h-4 w-4" />
                        SMS (Paid - ~$0.01/message)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Scheduling */}
                <div className="space-y-2">
                  <Label>Send Time</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="sendNow"
                        checked={sendImmediately}
                        onCheckedChange={(checked) => {
                          setSendImmediately(checked as boolean)
                          if (checked) setScheduledFor('')
                        }}
                      />
                      <Label htmlFor="sendNow" className="cursor-pointer">
                        Send immediately
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="schedule"
                        checked={!!scheduledFor && !sendImmediately}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSendImmediately(false)
                            setScheduledFor(new Date(Date.now() + 3600000).toISOString().slice(0, 16))
                          } else {
                            setScheduledFor('')
                          }
                        }}
                      />
                      <Label htmlFor="schedule" className="cursor-pointer">
                        Schedule for later
                      </Label>
                    </div>

                    {scheduledFor && !sendImmediately && (
                      <Input
                        type="datetime-local"
                        value={scheduledFor.slice(0, 16)}
                        onChange={(e) => setScheduledFor(e.target.value ? new Date(e.target.value).toISOString() : '')}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recipient Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Recipients</CardTitle>
                <CardDescription>Select who will receive this message</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Zone Filter */}
                <div className="space-y-2">
                  <Label htmlFor="zones">Service Zones</Label>
                  <Select
                    value={recipientFilter.zones?.[0] || 'all'}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        const { zones, ...rest } = recipientFilter
                        setRecipientFilter(rest)
                      } else {
                        setRecipientFilter({ ...recipientFilter, zones: [value] })
                      }
                    }}
                  >
                    <SelectTrigger id="zones">
                      <SelectValue placeholder="All zones" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones</SelectItem>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service Type Filter */}
                <div className="space-y-2">
                  <Label htmlFor="serviceType">Service History</Label>
                  <Select
                    value={recipientFilter.serviceTypes?.[0] || 'all'}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        const { serviceTypes, ...rest } = recipientFilter
                        setRecipientFilter(rest)
                      } else {
                        setRecipientFilter({ ...recipientFilter, serviceTypes: [value] })
                      }
                    }}
                  >
                    <SelectTrigger id="serviceType">
                      <SelectValue placeholder="All services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      {serviceTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Last Visit Date Filter */}
                <div className="space-y-2">
                  <Label>Last Visit Date</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="visitStart" className="text-xs">From</Label>
                      <Input
                        id="visitStart"
                        type="date"
                        value={recipientFilter.lastVisitStart || ''}
                        onChange={(e) =>
                          setRecipientFilter({ ...recipientFilter, lastVisitStart: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="visitEnd" className="text-xs">To</Label>
                      <Input
                        id="visitEnd"
                        type="date"
                        value={recipientFilter.lastVisitEnd || ''}
                        onChange={(e) =>
                          setRecipientFilter({ ...recipientFilter, lastVisitEnd: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* CSV Upload */}
                <div className="space-y-2">
                  <Label htmlFor="csv">Upload CSV</Label>
                  <Input
                    id="csv"
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                  />
                  {uploadedIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {uploadedIds.length} customer IDs loaded
                    </p>
                  )}
                </div>

                <Separator />

                {/* Preview Button */}
                <Button
                  onClick={handlePreview}
                  disabled={previewLoading || deliveryMethods.length === 0}
                  className="w-full"
                  variant="outline"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {previewLoading ? 'Loading...' : 'Preview Recipients'}
                </Button>
              </CardContent>
            </Card>
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

          {/* Preview Results */}
          {showPreview && previewData && (
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  Review recipients and cost estimate before sending
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="text-sm">Total Recipients</span>
                    </div>
                    <p className="text-2xl font-bold">{previewData.totalRecipients}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span className="text-sm">Portal</span>
                    </div>
                    <p className="text-2xl font-bold">{previewData.deliveryCounts.portal}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="text-sm">Email</span>
                    </div>
                    <p className="text-2xl font-bold">{previewData.deliveryCounts.email}</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Smartphone className="h-4 w-4" />
                      <span className="text-sm">SMS</span>
                    </div>
                    <p className="text-2xl font-bold">{previewData.deliveryCounts.sms}</p>
                  </div>
                </div>

                {/* Cost Estimate */}
                {previewData.costEstimate.total > 0 && (
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        <span className="font-semibold">Estimated Cost</span>
                      </div>
                      <span className="text-2xl font-bold">
                        ${previewData.costEstimate.total.toFixed(2)}
                      </span>
                    </div>
                    {previewData.costEstimate.sms > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        SMS: ${previewData.costEstimate.sms.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {/* Warnings */}
                {previewData.warnings.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-yellow-600 dark:text-yellow-500">Warnings</p>
                        {previewData.warnings.map((warning, i) => (
                          <p key={i} className="text-sm text-yellow-700 dark:text-yellow-400">
                            {warning}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sample Recipients */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">
                    Sample Recipients (showing {Math.min(10, previewData.previewRecipients.length)} of {previewData.totalRecipients})
                  </Label>
                  <ScrollArea className="h-48 border rounded-lg">
                    <div className="p-2">
                      {previewData.previewRecipients.slice(0, 10).map((recipient) => (
                        <div
                          key={recipient.customerId}
                          className="flex items-center justify-between py-2 px-2 hover:bg-muted/50 rounded"
                        >
                          <span className="text-sm">{recipient.customerName}</span>
                          <div className="flex gap-1">
                            {recipient.canReceiveEmail && (
                              <Badge variant="outline" className="text-xs">
                                <Mail className="h-3 w-3" />
                              </Badge>
                            )}
                            {recipient.canReceiveSms && (
                              <Badge variant="outline" className="text-xs">
                                <Smartphone className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Send Button */}
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={loading || !subject || !messageText || deliveryMethods.length === 0}
                  className="w-full"
                  size="lg"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendImmediately ? 'Send Now' : scheduledFor ? 'Schedule Broadcast' : 'Save as Draft'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Broadcast History</CardTitle>
                <CardDescription>View past and scheduled broadcasts</CardDescription>
              </div>
              <Button variant="outline" size="icon" onClick={fetchBroadcasts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {broadcastsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading broadcasts...
                </div>
              ) : broadcasts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No broadcasts found
                </div>
              ) : (
                <div className="space-y-3">
                  {broadcasts.map((broadcast) => (
                    <div
                      key={broadcast.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold">{broadcast.subject}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {broadcast.messageText}
                          </p>
                        </div>
                        {getStatusBadge(broadcast.status)}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Recipients:</span>{' '}
                          <span className="font-medium">{broadcast.recipientCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Delivered:</span>{' '}
                          <span className="font-medium text-green-600">
                            {broadcast.deliverySuccessCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Failed:</span>{' '}
                          <span className="font-medium text-red-600">
                            {broadcast.deliveryFailedCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cost:</span>{' '}
                          <span className="font-medium">
                            ${broadcast.estimatedCostUsd?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                        {broadcast.deliveryMethods.map((method) => (
                          <Badge key={method} variant="outline" className="text-xs">
                            {method === 'portal' && <MessageSquare className="h-3 w-3 mr-1" />}
                            {method === 'email' && <Mail className="h-3 w-3 mr-1" />}
                            {method === 'sms' && <Smartphone className="h-3 w-3 mr-1" />}
                            {method}
                          </Badge>
                        ))}
                        <span className="ml-auto">
                          {broadcast.scheduledFor
                            ? `Scheduled: ${new Date(broadcast.scheduledFor).toLocaleString()}`
                            : broadcast.sentAt
                            ? `Sent: ${new Date(broadcast.sentAt).toLocaleString()}`
                            : `Created: ${new Date(broadcast.createdAt).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Broadcast</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send this message to {previewData?.totalRecipients || 0} recipients
              via {deliveryMethods.join(', ')}.
              {previewData && previewData.costEstimate.total > 0 && (
                <>
                  <br />
                  <br />
                  <strong>Estimated cost: ${previewData.costEstimate.total.toFixed(2)}</strong>
                </>
              )}
              {sendImmediately ? (
                <>
                  <br />
                  <br />
                  The message will be sent immediately.
                </>
              ) : scheduledFor ? (
                <>
                  <br />
                  <br />
                  The message will be scheduled for {new Date(scheduledFor).toLocaleString()}.
                </>
              ) : (
                <>
                  <br />
                  <br />
                  The message will be saved as a draft.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={loading}>
              {loading ? 'Sending...' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
