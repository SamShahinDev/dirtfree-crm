"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, RefreshCw, Copy } from "lucide-react"

export default function ScheduleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Report to Sentry with context
    Sentry.captureException(error, {
      tags: {
        component: 'ScheduleError',
        errorBoundary: true,
        feature: 'schedule',
      },
      extra: {
        digest: error.digest,
        userAgent: navigator.userAgent,
        url: window.location.href,
      }
    })
  }, [error])

  const copyErrorDetails = () => {
    const errorDetails = `Schedule Error: ${error.message}\nDigest: ${error.digest || 'N/A'}\nURL: ${window.location.href}\nTimestamp: ${new Date().toISOString()}`
    navigator.clipboard.writeText(errorDetails)
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="rounded-lg p-4 md:p-5 lg:p-6 w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Calendar className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="mt-4">Schedule Error</CardTitle>
          <CardDescription>
            There was an error loading the schedule. Your appointments are safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Calendar className="h-4 w-4" />
            <AlertDescription className="font-medium">
              {error.message || "Failed to load schedule data"}
            </AlertDescription>
          </Alert>

          {process.env.NODE_ENV === 'development' && (
            <Alert>
              <AlertDescription className="text-xs font-mono break-all">
                <strong>Debug Info:</strong><br />
                Digest: {error.digest || 'N/A'}<br />
                Stack: {error.stack?.split('\n').slice(0, 3).join('\n')}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={reset} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Schedule
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={copyErrorDetails}
              title="Copy error details"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Error ID: {error.digest || 'Unknown'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}