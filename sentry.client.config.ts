import * as Sentry from '@sentry/nextjs'

function scrubSensitiveData(data: any): any {
  const sensitiveFields = [
    'password',
    'token',
    'ssn',
    'credit_card',
    'creditCard',
    'api_key',
    'apiKey',
    'secret',
    'authorization',
  ]

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(scrubSensitiveData)
    }

    const scrubbed: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        scrubbed[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        scrubbed[key] = scrubSensitiveData(value)
      } else {
        scrubbed[key] = value
      }
    }
    return scrubbed
  }

  return data
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.SENTRY_ENV || 'development',

  // Performance monitoring - increased sample rate
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Session replay - capture on errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Debug logging in development
  debug: process.env.NODE_ENV === 'development',

  // Integrations
  integrations: [
    new Sentry.BrowserTracing({
      // Set up automatic route change tracking for Next.js App Router
      instrumentNavigation: true,
      instrumentPageLoad: true,
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/.*\.dirtfreecarpet\.com/,
        /^https:\/\/.*\.vercel\.app/,
      ],
    }),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
      maskAllInputs: true,
    }),
  ],

  // PII scrubbing
  beforeSend(event, hint) {
    // Add custom context
    event.tags = {
      ...event.tags,
      environment: process.env.NODE_ENV,
      deployment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'local',
      git_sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.substring(0, 7),
    }

    // Remove sensitive data from error events
    if (event.request) {
      // Remove auth headers
      if (event.request.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
        delete event.request.headers['x-api-key']
      }

      // Remove sensitive query params
      if (event.request.query_string) {
        event.request.query_string = event.request.query_string
          .replace(/([?&])(token|key|secret|password|auth)=[^&]*/gi, '$1$2=***')
      }

      // Scrub request body data that might contain PII
      if (event.request.data) {
        event.request.data = scrubSensitiveData(event.request.data)
      }
    }

    // Filter out customer phone numbers, emails, and names from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.message) {
          breadcrumb.message = breadcrumb.message
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
            .replace(/\b\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '***-***-****')
        }
        return breadcrumb
      })
    }

    // Filter exception messages for PII
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map(exception => {
        if (exception.value) {
          exception.value = exception.value
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
            .replace(/\b\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '***-***-****')
        }
        return exception
      })
    }

    return event
  },

  // Filter out known non-critical errors
  beforeSendTransaction(event) {
    // Skip health check transactions to reduce noise
    if (event.transaction?.includes('/api/health') || event.transaction?.includes('/api/ready')) {
      return null
    }
    return event
  },

  // Error filtering
  ignoreErrors: [
    // Browser-specific errors that we can't control
    'Non-Error promise rejection captured',
    'Script error.',
    'cancelled',
    'Network request failed',
    'Load failed',
    'Request aborted',
    'AbortError',

    // Ignore navigation cancellations
    'Navigation cancelled',
    'ChunkLoadError',

    // Ignore ResizeObserver errors (common in browsers)
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
  ],

  // Only capture unhandled rejections in production
  captureUnhandledRejections: process.env.NODE_ENV === 'production',
})