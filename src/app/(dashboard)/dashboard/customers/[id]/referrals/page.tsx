'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Copy,
  Mail,
  MessageSquare,
  Share2,
  QrCode,
  CheckCircle2,
  Clock,
  Gift,
  TrendingUp,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'

interface Referral {
  id: string
  referral_code: string
  referred_email: string | null
  referred_phone: string | null
  referred_customer: {
    first_name: string
    last_name: string
    email: string
  } | null
  status: 'pending' | 'registered' | 'booked' | 'completed'
  clicks: number
  points_awarded: number
  discount_applied: number
  created_at: string
  completed_at: string | null
}

interface ReferralStats {
  total_sent: number
  pending: number
  registered: number
  booked: number
  completed: number
  total_points_earned: number
  total_clicks: number
}

interface ReferralData {
  customer: {
    id: string
    name: string
  }
  referral_code: string
  referral_link: string
  stats: ReferralStats
  referrals: Referral[]
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-gray-100 text-gray-800',
    icon: Clock,
  },
  registered: {
    label: 'Signed Up',
    color: 'bg-blue-100 text-blue-800',
    icon: Users,
  },
  booked: {
    label: 'Booked',
    color: 'bg-purple-100 text-purple-800',
    icon: TrendingUp,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle2,
  },
}

export default function CustomerReferralsPage() {
  const params = useParams()
  const customerId = params.id as string

  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    if (customerId) {
      loadReferrals()
    }
  }, [customerId])

  async function loadReferrals() {
    try {
      setLoading(true)
      const res = await fetch(`/api/referrals?customer_id=${customerId}`)
      const result = await res.json()

      if (result.success) {
        setData(result.data)
      } else {
        toast.error('Failed to load referrals')
      }
    } catch (error) {
      console.error('Load referrals error:', error)
      toast.error('Failed to load referrals')
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  function shareViaEmail() {
    if (!data) return

    const subject = encodeURIComponent('Get $20 off your first carpet cleaning!')
    const body = encodeURIComponent(
      `I wanted to share this great carpet cleaning service with you!\n\nUse my referral code ${data.referral_code} or click this link to get $20 off your first service:\n\n${data.referral_link}\n\nThey do amazing work!`
    )

    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  function shareViaSMS() {
    if (!data) return

    const message = encodeURIComponent(
      `Get $20 off your first carpet cleaning! Use code ${data.referral_code} or book here: ${data.referral_link}`
    )

    // For iOS
    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
      window.open(`sms:&body=${message}`)
    } else {
      // For Android
      window.open(`sms:?body=${message}`)
    }
  }

  function shareViaWhatsApp() {
    if (!data) return

    const message = encodeURIComponent(
      `Get $20 off your first carpet cleaning! Use my referral code ${data.referral_code} or book here: ${data.referral_link}`
    )

    window.open(`https://wa.me/?text=${message}`)
  }

  function shareViaFacebook() {
    if (!data) return

    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.referral_link)}`
    )
  }

  function generateQRCode() {
    if (!data) return null

    // Using QR code API service
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      data.referral_link
    )}`

    return qrUrl
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading referrals...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">No referral data available</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900">
            <Users className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Referral Program</h1>
            <p className="text-muted-foreground">Refer friends and earn rewards</p>
          </div>
        </div>
      </div>

      {/* Referral Code Card */}
      <Card className="mb-6 border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Your Unique Referral Code
          </CardTitle>
          <CardDescription>
            Share this code and earn 500 points when your friend completes their first service!
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Referral Code */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Referral Code</label>
            <div className="flex gap-2">
              <Input
                value={data.referral_code}
                readOnly
                className="text-xl font-mono font-bold text-center"
              />
              <Button
                onClick={() => copyToClipboard(data.referral_code, 'Referral code')}
                variant="outline"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Referral Link */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Referral Link</label>
            <div className="flex gap-2">
              <Input value={data.referral_link} readOnly className="font-mono text-sm" />
              <Button
                onClick={() => copyToClipboard(data.referral_link, 'Referral link')}
                variant="outline"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button onClick={() => setShowQR(!showQR)} variant="outline">
                <QrCode className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* QR Code */}
          {showQR && (
            <div className="mb-6 text-center p-4 bg-muted rounded-lg">
              <img
                src={generateQRCode() || ''}
                alt="QR Code"
                className="mx-auto border-4 border-white shadow-lg rounded-lg"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Scan to use referral link
              </p>
            </div>
          )}

          {/* Share Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button onClick={shareViaEmail} variant="outline" className="w-full">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button onClick={shareViaSMS} variant="outline" className="w-full">
              <MessageSquare className="h-4 w-4 mr-2" />
              SMS
            </Button>
            <Button onClick={shareViaWhatsApp} variant="outline" className="w-full">
              <Share2 className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button onClick={shareViaFacebook} variant="outline" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Facebook
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.stats.total_sent}</div>
            <p className="text-xs text-muted-foreground">Total Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{data.stats.completed}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {data.stats.total_points_earned}
            </div>
            <p className="text-xs text-muted-foreground">Points Earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{data.stats.total_clicks}</div>
            <p className="text-xs text-muted-foreground">Link Clicks</p>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Gift className="h-4 w-4 text-green-600" />
                You Get:
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 500 loyalty points when they complete first service</li>
                <li>• Points count toward tier upgrades</li>
                <li>• Unlimited referrals</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                They Get:
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• $20 off their first service</li>
                <li>• Professional carpet cleaning</li>
                <li>• Join the loyalty program</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referrals List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referrals ({data.referrals.length})</CardTitle>
          <CardDescription>Track the status of people you've referred</CardDescription>
        </CardHeader>
        <CardContent>
          {data.referrals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No referrals yet</p>
              <p className="text-sm">Start sharing your referral code to earn rewards!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.referrals.map((referral) => {
                const statusConfig = STATUS_CONFIG[referral.status]
                const StatusIcon = statusConfig.icon

                return (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {referral.referred_customer ? (
                          <p className="font-medium">
                            {referral.referred_customer.first_name}{' '}
                            {referral.referred_customer.last_name}
                          </p>
                        ) : (
                          <p className="text-muted-foreground italic">
                            {referral.referred_email || referral.referred_phone || 'Pending signup'}
                          </p>
                        )}
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Sent: {new Date(referral.created_at).toLocaleDateString()}
                        </span>
                        {referral.clicks > 0 && (
                          <span>{referral.clicks} clicks</span>
                        )}
                        {referral.completed_at && (
                          <span>
                            Completed: {new Date(referral.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {referral.points_awarded > 0 && (
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          +{referral.points_awarded}
                        </div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
