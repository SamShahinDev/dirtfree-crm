import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENV || 'development',

  // Performance monitoring - lower rate for server to avoid quota issues
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.1,

  // Debug logging in development
  debug: process.env.NODE_ENV === 'development',

  // Integrations for server-side
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.OnUncaughtException({
      exitEvenIfOtherHandlersAreRegistered: false,
    }),
    new Sentry.Integrations.OnUnhandledRejection({
      mode: 'warn',
    }),
  ],

  // PII scrubbing for server-side
  beforeSend(event, hint) {
    // Add server-side context
    event.tags = {
      ...event.tags,
      server: 'crm',
      node_version: process.version,
      environment: process.env.NODE_ENV,
      deployment: process.env.VERCEL_ENV || 'local',
    }

    // Remove sensitive environment variables
    if (event.contexts?.runtime?.env) {
      const sensitiveKeys = [
        'SUPABASE_SERVICE_ROLE_KEY',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_WEBHOOK_SECRET',
        'SENTRY_DSN'
      ]

      sensitiveKeys.forEach(key => {
        if (event.contexts.runtime.env[key]) {
          event.contexts.runtime.env[key] = '[Filtered]'
        }
      })
    }

    // Remove sensitive request data
    if (event.request) {
      // Remove auth headers
      if (event.request.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
        delete event.request.headers['x-api-key']
        delete event.request.headers['x-supabase-auth']
      }

      // Remove request body that might contain PII
      if (event.request.data && typeof event.request.data === 'object') {
        // Filter out common PII fields
        const piiFields = ['password', 'email', 'phone', 'phone_e164', 'name', 'address', 'ssn', 'token']
        const filteredData: any = {}

        Object.keys(event.request.data).forEach(key => {
          if (piiFields.some(field => key.toLowerCase().includes(field))) {
            filteredData[key] = '[Filtered]'
          } else {
            filteredData[key] = event.request.data[key]
          }
        })

        event.request.data = filteredData
      }

      // Filter URL parameters
      if (event.request.url) {
        event.request.url = event.request.url
          .replace(/([?&])(token|key|secret|password|auth|email|phone)=[^&]*/gi, '$1$2=***')
      }
    }

    // Filter exception messages and stack traces for PII
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map(exception => {
        if (exception.value) {
          // Remove emails and phone numbers from error messages
          exception.value = exception.value
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
            .replace(/\b\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '***-***-****')
            .replace(/\b[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}\b/g, '***-***-***')
        }

        if (exception.stacktrace?.frames) {
          exception.stacktrace.frames = exception.stacktrace.frames.map(frame => {
            if (frame.vars) {
              // Filter sensitive variables in stack frames
              const filteredVars: any = {}
              Object.keys(frame.vars).forEach(key => {
                if (key.toLowerCase().includes('password') ||
                    key.toLowerCase().includes('token') ||
                    key.toLowerCase().includes('secret') ||
                    key.toLowerCase().includes('key')) {
                  filteredVars[key] = '[Filtered]'
                } else {
                  filteredVars[key] = frame.vars[key]
                }
              })
              frame.vars = filteredVars
            }
            return frame
          })
        }

        return exception
      })
    }

    // Filter breadcrumbs for PII
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.message) {
          breadcrumb.message = breadcrumb.message
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
            .replace(/\b\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '***-***-****')
        }

        if (breadcrumb.data) {
          // Filter breadcrumb data
          const filteredData: any = {}
          Object.keys(breadcrumb.data).forEach(key => {
            if (key.toLowerCase().includes('password') ||
                key.toLowerCase().includes('token') ||
                key.toLowerCase().includes('email') ||
                key.toLowerCase().includes('phone')) {
              filteredData[key] = '[Filtered]'
            } else {
              filteredData[key] = breadcrumb.data[key]
            }
          })
          breadcrumb.data = filteredData
        }

        return breadcrumb
      })
    }

    return event
  },

  // Filter out health check and non-critical transactions
  beforeSendTransaction(event) {
    if (event.transaction?.includes('/api/health') ||
        event.transaction?.includes('/api/ready') ||
        event.transaction?.includes('/_next/static')) {
      return null
    }
    return event
  },

  // Server-specific error filtering
  ignoreErrors: [
    // Database connection errors that are handled
    'connection terminated',
    'Connection terminated unexpectedly',

    // Expected API errors
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',

    // Supabase expected errors
    'JWT expired',
    'Invalid JWT',

    // Next.js specific
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
  ],

  // Server runtime configuration
  maxBreadcrumbs: 50,
  attachStacktrace: true,
  sendDefaultPii: false, // Explicitly disable PII sending
})