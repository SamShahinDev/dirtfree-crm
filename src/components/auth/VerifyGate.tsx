'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Mail, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { resendVerification } from '@/app/(auth)/actions'

interface VerifyGateProps {
  children: React.ReactNode
  showBanner?: boolean
  autoRedirect?: boolean
}

export function VerifyGate({
  children,
  showBanner = true,
  autoRedirect = false,
}: VerifyGateProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isResending, setIsResending] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    async function checkUser() {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
          console.error('Error getting user:', error)
          return
        }

        setUser(user)

        // Auto-redirect unverified users if enabled
        if (user && !user.email_confirmed_at && autoRedirect) {
          router.push('/auth/verify-pending')
        }
      } catch (error) {
        console.error('Unexpected error checking user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()

    // Listen for auth state changes
    const supabase = getSupabaseBrowserClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user || null)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [router, autoRedirect])

  async function handleResendVerification() {
    setIsResending(true)

    try {
      const result = await resendVerification()

      if (result.success) {
        toast.success('Verification email sent! Please check your inbox.')
      } else {
        toast.error(result.error || 'Failed to send verification email.')
      }
    } catch (error) {
      toast.error('An unexpected error occurred.')
    } finally {
      setIsResending(false)
    }
  }

  function handleGoToVerification() {
    router.push('/auth/verify-pending')
  }

  // Show loading state
  if (isLoading) {
    return <div className="animate-pulse h-32 bg-gray-200 rounded" />
  }

  // Only show banner for logged-in, unverified users
  const shouldShowBanner =
    showBanner &&
    !bannerDismissed &&
    user &&
    !user.email_confirmed_at

  return (
    <>
      {shouldShowBanner && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 mb-6">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-medium mb-1">Email verification required</div>
              <div className="text-sm">
                Please verify your email address to access all features.
                We've sent a verification link to{' '}
                <span className="font-medium">{user.email}</span>.
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResendVerification}
                disabled={isResending}
                className="bg-white hover:bg-amber-50 border-amber-300 text-amber-900"
              >
                {isResending ? (
                  <>
                    <Mail className="h-3 w-3 mr-1 animate-pulse" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-3 w-3 mr-1" />
                    Resend
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleGoToVerification}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Verify Now
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setBannerDismissed(true)}
                className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 p-1 h-auto"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Dismiss</span>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {children}
    </>
  )
}

// Wrapper component for pages that should auto-redirect unverified users
export function VerifyGateWithRedirect({ children }: { children: React.ReactNode }) {
  return (
    <VerifyGate showBanner={false} autoRedirect={true}>
      {children}
    </VerifyGate>
  )
}

// Hook to get verification status
export function useVerificationStatus() {
  const [isVerified, setIsVerified] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkVerification() {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
          console.error('Error getting user:', error)
          setIsVerified(false)
          return
        }

        setIsVerified(user ? !!user.email_confirmed_at : false)
      } catch (error) {
        console.error('Unexpected error checking verification:', error)
        setIsVerified(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkVerification()

    // Listen for auth state changes
    const supabase = getSupabaseBrowserClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user
      setIsVerified(user ? !!user.email_confirmed_at : false)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { isVerified, isLoading }
}