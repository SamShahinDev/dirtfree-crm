'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Mail,
  MessageSquare,
  Phone,
  Bell,
  BellOff,
  Clock,
  Globe,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Save,
  RefreshCw,
} from 'lucide-react'

/**
 * Customer Communication Preferences Page
 *
 * Allows customers and staff to view and manage communication preferences:
 * - Channel preferences (email, SMS, phone, portal)
 * - Message type preferences (marketing, reminders, etc.)
 * - Contact preferences (method, time, language)
 * - Opt-out status
 * - Communication history
 * - Compliance tracking
 */

interface CommunicationPreferences {
  id: string
  customerId: string
  emailEnabled: boolean
  smsEnabled: boolean
  portalNotificationsEnabled: boolean
  phoneCallsEnabled: boolean
  marketingEmails: boolean
  appointmentReminders: boolean
  serviceUpdates: boolean
  promotionalMessages: boolean
  billingNotifications: boolean
  surveyRequests: boolean
  preferredContactMethod: string | null
  preferredContactTime: string | null
  languagePreference: string
  timezone: string | null
  doNotContact: boolean
  optedOutAt: string | null
  optOutReason: string | null
  maxMessagesPerWeek: number
  quietHoursStart: string | null
  quietHoursEnd: string | null
  createdAt: string
  updatedAt: string
}

interface CommunicationHistoryItem {
  id: string
  communicationType: string
  channel: string
  subject: string
  sentAt: string
  delivered: boolean
  read: boolean
}

interface ViolationStats {
  totalViolations: number
  blockedViolations: number
  byType: Record<string, number>
  byChannel: Record<string, number>
}

export default function CustomerPreferencesPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string

  const [preferences, setPreferences] = useState<CommunicationPreferences | null>(null)
  const [communicationHistory, setCommunicationHistory] = useState<CommunicationHistoryItem[]>([])
  const [violationStats, setViolationStats] = useState<ViolationStats | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showOptOutDialog, setShowOptOutDialog] = useState(false)
  const [optOutReason, setOptOutReason] = useState('')

  // Track changes
  const [hasChanges, setHasChanges] = useState(false)
  const [editedPreferences, setEditedPreferences] = useState<Partial<CommunicationPreferences>>({})

  // Fetch preferences
  const fetchPreferences = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/customers/${customerId}/preferences`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch preferences')
      }

      setPreferences(data.data.preferences)
      setCommunicationHistory(data.data.communicationHistory || [])
      setViolationStats(data.data.violationStats)
      setEditedPreferences({})
      setHasChanges(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPreferences()
  }, [customerId])

  // Update preference value
  const updatePreference = (key: keyof CommunicationPreferences, value: any) => {
    setEditedPreferences({
      ...editedPreferences,
      [key]: value,
    })
    setHasChanges(true)
  }

  // Get current value (edited or original)
  const getCurrentValue = (key: keyof CommunicationPreferences) => {
    if (key in editedPreferences) {
      return editedPreferences[key]
    }
    return preferences?.[key]
  }

  // Save changes
  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/customers/${customerId}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedPreferences),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Failed to update preferences')
      }

      // Refresh preferences
      await fetchPreferences()

      alert('Preferences updated successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  // Handle opt-out
  const handleOptOut = async () => {
    updatePreference('doNotContact', true)
    updatePreference('optOutReason', optOutReason)
    setShowOptOutDialog(false)
    setHasChanges(true)
  }

  // Handle opt-in
  const handleOptIn = () => {
    updatePreference('doNotContact', false)
    updatePreference('optOutReason', null)
    setHasChanges(true)
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Get channel icon
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'sms':
        return <MessageSquare className="h-4 w-4" />
      case 'phone':
        return <Phone className="h-4 w-4" />
      case 'portal':
        return <Bell className="h-4 w-4" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Communication Preferences</h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !preferences) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Communication Preferences</h1>
            <p className="text-destructive">{error}</p>
          </div>
        </div>
        <Button onClick={fetchPreferences}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  const currentDoNotContact = getCurrentValue('doNotContact') as boolean

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Communication Preferences</h1>
            <p className="text-muted-foreground">
              Manage how you receive communications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline">Unsaved changes</Badge>
          )}
          <Button onClick={fetchPreferences} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Opt-out Status Banner */}
      {currentDoNotContact && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <BellOff className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive">
                  All Communications Disabled
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You have opted out of all communications.
                  {preferences?.optedOutAt && (
                    <> Opted out on {formatDate(preferences.optedOutAt)}.</>
                  )}
                </p>
                {preferences?.optOutReason && (
                  <p className="text-sm mt-2">
                    <strong>Reason:</strong> {preferences.optOutReason}
                  </p>
                )}
              </div>
              <Button onClick={handleOptIn} variant="outline" size="sm">
                Re-enable Communications
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="channels" className="space-y-4">
        <TabsList>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="messages">Message Types</TabsTrigger>
          <TabsTrigger value="contact">Contact Preferences</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Channels Tab */}
        <TabsContent value="channels" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Communication Channels</CardTitle>
              <CardDescription>
                Choose which channels you want to receive communications through
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="email-enabled" className="text-base">Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive communications via email
                    </p>
                  </div>
                </div>
                <Switch
                  id="email-enabled"
                  checked={getCurrentValue('emailEnabled') as boolean}
                  onCheckedChange={(checked) => updatePreference('emailEnabled', checked)}
                  disabled={currentDoNotContact}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="sms-enabled" className="text-base">SMS / Text Messages</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive communications via text message
                    </p>
                  </div>
                </div>
                <Switch
                  id="sms-enabled"
                  checked={getCurrentValue('smsEnabled') as boolean}
                  onCheckedChange={(checked) => updatePreference('smsEnabled', checked)}
                  disabled={currentDoNotContact}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="phone-enabled" className="text-base">Phone Calls</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive phone calls from our team
                    </p>
                  </div>
                </div>
                <Switch
                  id="phone-enabled"
                  checked={getCurrentValue('phoneCallsEnabled') as boolean}
                  onCheckedChange={(checked) => updatePreference('phoneCallsEnabled', checked)}
                  disabled={currentDoNotContact}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label htmlFor="portal-enabled" className="text-base">Portal Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications in the customer portal
                    </p>
                  </div>
                </div>
                <Switch
                  id="portal-enabled"
                  checked={getCurrentValue('portalNotificationsEnabled') as boolean}
                  onCheckedChange={(checked) => updatePreference('portalNotificationsEnabled', checked)}
                  disabled={currentDoNotContact}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellOff className="h-5 w-5" />
                Opt Out of All Communications
              </CardTitle>
              <CardDescription>
                Stop all communications from us (except critical service notices)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentDoNotContact ? (
                <Button onClick={handleOptIn} variant="outline">
                  Re-enable All Communications
                </Button>
              ) : (
                <Button
                  onClick={() => setShowOptOutDialog(true)}
                  variant="destructive"
                >
                  Opt Out
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Message Types Tab */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Message Types</CardTitle>
              <CardDescription>
                Choose which types of messages you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="appointment-reminders" className="text-base">
                    Appointment Reminders
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Reminders about upcoming appointments
                  </p>
                </div>
                <Switch
                  id="appointment-reminders"
                  checked={getCurrentValue('appointmentReminders') as boolean}
                  onCheckedChange={(checked) => updatePreference('appointmentReminders', checked)}
                  disabled={currentDoNotContact}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="service-updates" className="text-base">
                    Service Updates
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Updates about your service requests
                  </p>
                </div>
                <Switch
                  id="service-updates"
                  checked={getCurrentValue('serviceUpdates') as boolean}
                  onCheckedChange={(checked) => updatePreference('serviceUpdates', checked)}
                  disabled={currentDoNotContact}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="billing-notifications" className="text-base">
                    Billing Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Invoices, payment confirmations, and billing updates
                  </p>
                </div>
                <Switch
                  id="billing-notifications"
                  checked={getCurrentValue('billingNotifications') as boolean}
                  onCheckedChange={(checked) => updatePreference('billingNotifications', checked)}
                  disabled={currentDoNotContact}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="marketing-emails" className="text-base">
                    Marketing Emails
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Tips, news, and updates about our services
                  </p>
                </div>
                <Switch
                  id="marketing-emails"
                  checked={getCurrentValue('marketingEmails') as boolean}
                  onCheckedChange={(checked) => updatePreference('marketingEmails', checked)}
                  disabled={currentDoNotContact}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="promotional-messages" className="text-base">
                    Promotional Messages
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Special offers and promotions
                  </p>
                </div>
                <Switch
                  id="promotional-messages"
                  checked={getCurrentValue('promotionalMessages') as boolean}
                  onCheckedChange={(checked) => updatePreference('promotionalMessages', checked)}
                  disabled={currentDoNotContact}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="survey-requests" className="text-base">
                    Survey Requests
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Requests to provide feedback on our services
                  </p>
                </div>
                <Switch
                  id="survey-requests"
                  checked={getCurrentValue('surveyRequests') as boolean}
                  onCheckedChange={(checked) => updatePreference('surveyRequests', checked)}
                  disabled={currentDoNotContact}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Preferences Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact Preferences</CardTitle>
              <CardDescription>
                Tell us how and when you prefer to be contacted
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preferred-method">Preferred Contact Method</Label>
                <Select
                  value={getCurrentValue('preferredContactMethod') as string || 'none'}
                  onValueChange={(value) => updatePreference('preferredContactMethod', value === 'none' ? null : value)}
                  disabled={currentDoNotContact}
                >
                  <SelectTrigger id="preferred-method">
                    <SelectValue placeholder="No preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preference</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferred-time">Best Time to Contact</Label>
                <Select
                  value={getCurrentValue('preferredContactTime') as string || 'anytime'}
                  onValueChange={(value) => updatePreference('preferredContactTime', value === 'anytime' ? null : value)}
                  disabled={currentDoNotContact}
                >
                  <SelectTrigger id="preferred-time">
                    <SelectValue placeholder="Anytime" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anytime">Anytime</SelectItem>
                    <SelectItem value="morning">Morning (8am - 12pm)</SelectItem>
                    <SelectItem value="afternoon">Afternoon (12pm - 5pm)</SelectItem>
                    <SelectItem value="evening">Evening (5pm - 8pm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language Preference</Label>
                <Select
                  value={getCurrentValue('languagePreference') as string}
                  onValueChange={(value) => updatePreference('languagePreference', value)}
                  disabled={currentDoNotContact}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="quiet-hours">Quiet Hours</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Set times when you don't want to receive non-urgent communications
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quiet-start" className="text-xs">Start Time</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={getCurrentValue('quietHoursStart') as string || ''}
                      onChange={(e) => updatePreference('quietHoursStart', e.target.value || null)}
                      disabled={currentDoNotContact}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quiet-end" className="text-xs">End Time</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={getCurrentValue('quietHoursEnd') as string || ''}
                      onChange={(e) => updatePreference('quietHoursEnd', e.target.value || null)}
                      disabled={currentDoNotContact}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-messages">Maximum Messages Per Week</Label>
                <Input
                  id="max-messages"
                  type="number"
                  min="0"
                  max="100"
                  value={getCurrentValue('maxMessagesPerWeek') as number}
                  onChange={(e) => updatePreference('maxMessagesPerWeek', parseInt(e.target.value) || 10)}
                  disabled={currentDoNotContact}
                />
                <p className="text-xs text-muted-foreground">
                  Limit the number of non-critical messages you receive
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Communication History</CardTitle>
              <CardDescription>
                Recent communications sent to you
              </CardDescription>
            </CardHeader>
            <CardContent>
              {communicationHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No communication history found
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {communicationHistory.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        {getChannelIcon(item.channel)}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{item.subject}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(item.sentAt)}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Badge variant="outline" className="text-xs">
                                {item.channel}
                              </Badge>
                              {item.delivered && (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Delivered
                                </Badge>
                              )}
                              {item.read && (
                                <Badge variant="outline" className="text-xs">
                                  Read
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Compliance & Privacy
              </CardTitle>
              <CardDescription>
                Information about how we handle your communication preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Your Rights</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>You can opt out of any communication type at any time</li>
                  <li>We honor all opt-out requests immediately</li>
                  <li>Critical service communications may still be sent even if opted out</li>
                  <li>Your preferences are stored securely and never shared</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">Compliance</h3>
                <p className="text-sm text-muted-foreground">
                  We comply with CAN-SPAM Act, TCPA, and GDPR regulations for all communications.
                </p>
              </div>

              {violationStats && violationStats.totalViolations > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      Preference Violations (Last 30 Days)
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Attempts to communicate that were blocked due to your preferences
                    </p>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">Total Violations</span>
                        <Badge>{violationStats.totalViolations}</Badge>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">Blocked</span>
                        <Badge variant="destructive">{violationStats.blockedViolations}</Badge>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <h3 className="font-semibold mb-2">Last Updated</h3>
                <p className="text-sm text-muted-foreground">
                  {preferences?.updatedAt && formatDate(preferences.updatedAt)}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Opt-out Dialog */}
      <AlertDialog open={showOptOutDialog} onOpenChange={setShowOptOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opt Out of All Communications?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop all communications from us except critical service notices.
              You can re-enable communications at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label htmlFor="opt-out-reason">Reason (optional)</Label>
            <Textarea
              id="opt-out-reason"
              value={optOutReason}
              onChange={(e) => setOptOutReason(e.target.value)}
              placeholder="Let us know why you're opting out..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOptOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Opt Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
