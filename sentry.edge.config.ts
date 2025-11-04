import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENV || 'development',

  // Lower sampling rate for edge runtime due to limitations
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.05,

  // Debug logging in development
  debug: process.env.NODE_ENV === 'development',

  // Minimal integrations for edge runtime
  integrations: [],

  // PII scrubbing for edge runtime
  beforeSend(event, hint) {
    // Remove sensitive headers from edge requests
    if (event.request?.headers) {
      delete event.request.headers['authorization']
      delete event.request.headers['cookie']
      delete event.request.headers['x-api-key']
    }

    // Filter request data
    if (event.request?.data) {
      event.request.data = '[Filtered - Edge Runtime]'
    }

    // Filter URLs for sensitive parameters
    if (event.request?.url) {
      event.request.url = event.request.url
        .replace(/([?&])(token|key|secret|password|auth)=[^&]*/gi, '$1$2=***')
    }

    // Basic PII filtering for edge
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

  // Skip most transactions in edge runtime
  beforeSendTransaction(event) {
    // Only send error transactions, skip regular page loads
    if (!event.contexts?.trace?.op?.includes('error')) {
      return null
    }
    return event
  },

  // Edge-specific error filtering
  ignoreErrors: [
    // Edge runtime specific errors
    'Dynamic Code Evaluation',
    'Edge Runtime',
    'fetch failed',

    // Common edge middleware errors
    'AbortError',
    'Request timeout',
  ],

  // Edge runtime has memory constraints
  maxBreadcrumbs: 10,
  sendDefaultPii: false,
})