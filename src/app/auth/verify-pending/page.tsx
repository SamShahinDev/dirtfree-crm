'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

import { resendVerification, logout } from '@/app/(auth)/actions'

export default function VerifyPendingPage() {
  const router = useRouter()
  const [isResending, setIsResending] = useState(false)
  const [lastResent, setLastResent] = useState<number | null>(null)

  // Basic spam protection - 60 second cooldown
  const canResend = !lastResent || Date.now() - lastResent > 60000

  async function handleResend() {
    if (!canResend) {
      toast.error('Please wait before requesting another verification email.')
      return
    }

    setIsResending(true)

    try {
      const result = await resendVerification()

      if (result.success) {
        setLastResent(Date.now())
        toast.success('Verification email sent! Please check your inbox.')
      } else {
        toast.error(result.error || 'Failed to send verification email.')
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
      router.push('/login')
    } catch (error) {
      toast.error('Failed to log out. Please try again.')
    }
  }

  const cooldownRemaining = lastResent
    ? Math.max(0, 60 - Math.floor((Date.now() - lastResent) / 1000))
    : 0

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Verify your email
          </CardTitle>
          <CardDescription>
            We've sent a verification link to your email address.
            Please check your inbox and click the link to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>Didn't receive the email? Check your spam folder or</p>
          </div>

          <Button
            onClick={handleResend}
            variant="outline"
            className="w-full"
            disabled={isResending || !canResend}
          >
            {isResending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : !canResend ? (
              `Resend in ${cooldownRemaining}s`
            ) : (
              'Resend verification email'
            )}
          </Button>

          <div className="pt-4 border-t">
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full"
            >
              Sign out and return to login
            </Button>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <p>
              Having trouble? Contact your administrator for assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}