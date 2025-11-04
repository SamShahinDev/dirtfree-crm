'use client'

import * as Sentry from '@sentry/nextjs'
import { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  context?: string
  showDetails?: boolean
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: any
  eventId?: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log to Sentry with context
    Sentry.withScope((scope) => {
      scope.setContext('errorBoundary', {
        componentContext: this.props.context || 'unknown',
        componentStack: errorInfo.componentStack,
      })
      scope.setLevel('error')
      scope.setTag('error_boundary', this.props.context || 'unknown')

      const eventId = Sentry.captureException(error)
      this.setState({ eventId, errorInfo })
    })

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  handleReportFeedback = () => {
    if (this.state.eventId) {
      Sentry.showReportDialog({
        eventId: this.state.eventId,
        title: 'It looks like we're having issues.',
        subtitle: 'Our team has been notified.',
        subtitle2: 'If you'd like to help, tell us what happened below.',
        labelName: 'Name',
        labelEmail: 'Email',
        labelComments: 'What happened?',
        labelClose: 'Close',
        labelSubmit: 'Submit',
        errorGeneric:
          'An unknown error occurred while submitting your report. Please try again.',
        errorFormEntry: 'Some fields were invalid. Please correct the errors and try again.',
        successMessage: 'Your feedback has been sent. Thank you!',
      })
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 rounded-full bg-destructive/10">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Something went wrong</CardTitle>
                  <CardDescription>
                    {this.props.context
                      ? `An error occurred in ${this.props.context}`
                      : 'An unexpected error occurred'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                We've been notified and are looking into it. You can try one of the options below:
              </p>

              {/* Error Details (Development Only) */}
              {this.props.showDetails && process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold mb-2">Error Details (Development Only)</h3>
                  <pre className="text-xs overflow-auto max-h-48 text-red-600">
                    {this.state.error.toString()}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                  {this.state.eventId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Event ID: {this.state.eventId}
                    </p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-4">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button onClick={this.handleReload} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Page
                </Button>
                <Button onClick={this.handleGoHome} variant="outline">
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
                {this.state.eventId && (
                  <Button onClick={this.handleReportFeedback} variant="ghost">
                    Report Issue
                  </Button>
                )}
              </div>

              {/* Additional Help */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  If this problem persists, please contact support with error ID:{' '}
                  <code className="bg-background px-1 py-0.5 rounded">
                    {this.state.eventId || 'Unknown'}
                  </code>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Simple inline error boundary for smaller sections
 */
export function SimpleErrorBoundary({
  children,
  context,
}: {
  children: ReactNode
  context?: string
}) {
  return (
    <ErrorBoundary
      context={context}
      fallback={
        <div className="flex items-center justify-center p-8 border border-destructive/20 rounded-lg bg-destructive/5">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm font-medium">Failed to load {context || 'content'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              An error occurred. Please refresh the page.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  )
}
