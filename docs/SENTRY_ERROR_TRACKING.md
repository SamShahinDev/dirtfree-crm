# Sentry Error Tracking & Monitoring

Comprehensive error tracking and performance monitoring with Sentry integration.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
- [Error Tracking](#error-tracking)
- [Performance Monitoring](#performance-monitoring)
- [Error Boundary](#error-boundary)
- [Dashboard](#dashboard)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Sentry integration provides:

- **Automatic Error Tracking**: Capture unhandled errors and promise rejections
- **Performance Monitoring**: Track API response times and slow queries
- **Session Replay**: Record user sessions when errors occur
- **Custom Error Tracking**: Track application-specific errors with context
- **Error Dashboard**: Admin interface for monitoring errors and trends
- **PII Scrubbing**: Automatic removal of sensitive data from error reports

---

## Features

### 1. Error Tracking

- Automatic capture of unhandled errors
- Custom error tracking with context
- Error grouping and fingerprinting
- User impact tracking
- Error trends and statistics

### 2. Performance Monitoring

- API endpoint monitoring
- Database query performance
- Component render times
- Custom transaction tracking
- Slowest endpoints identification

### 3. Session Replay

- Record user sessions on errors
- Privacy-first: mask all text and media
- Replay user interactions leading to errors
- Configurable sample rates

### 4. Error Boundary

- React Error Boundaries for component isolation
- Custom fallback UI
- User-friendly error messages
- Automatic error reporting to Sentry

### 5. Admin Dashboard

- Real-time error monitoring
- Error trends visualization
- Top errors by frequency
- Affected users tracking
- Performance metrics
- Platform/browser distribution

---

## Setup

### 1. Environment Variables

```bash
# .env.local

# Sentry DSN (required)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_DSN=https://...@sentry.io/...

# Environment
NEXT_PUBLIC_SENTRY_ENV=production
SENTRY_ENV=production

# Organization and Project (for API access)
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug

# Auth token (for API access - optional)
SENTRY_AUTH_TOKEN=your-auth-token

# Vercel deployment info (auto-populated on Vercel)
NEXT_PUBLIC_VERCEL_ENV=production
NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA=abc123
```

### 2. Sentry Project Setup

1. Create a Sentry account at https://sentry.io
2. Create a new project (Next.js)
3. Copy the DSN from project settings
4. Add to environment variables

### 3. Configuration Files

The Sentry configuration is already set up in:
- `sentry.client.config.ts` - Client-side configuration
- `sentry.server.config.ts` - Server-side configuration
- `sentry.edge.config.ts` - Edge runtime configuration

No additional setup needed!

---

## Error Tracking

### Basic Error Capture

```typescript
import { captureError } from '@/lib/errors/tracking'

try {
  await processOpportunity(opportunityId)
} catch (error) {
  captureError(error as Error, {
    userId: user.id,
    action: 'process_opportunity',
    severity: 'high',
  })
  throw error
}
```

### Create Custom Errors

```typescript
import { AppError, ErrorCodes, createError } from '@/lib/errors/tracking'

// Using AppError class
throw new AppError(
  'Customer not found',
  ErrorCodes.DB_NOT_FOUND,
  404,
  { customerId }
)

// Using createError helper
throw createError(
  ErrorCodes.VALIDATION_FAILED,
  'Invalid email format',
  400,
  { email: input.email }
)
```

### Capture Messages

```typescript
import { captureMessage } from '@/lib/errors/tracking'

captureMessage('User completed onboarding', 'info', {
  userId: user.id,
  extra: { source: 'web_app' },
})
```

### Add Breadcrumbs

```typescript
import { addBreadcrumb } from '@/lib/errors/tracking'

addBreadcrumb('User clicked submit button', 'user.action', 'info', {
  formId: 'customer-form',
  buttonText: 'Submit',
})
```

### Set User Context

```typescript
import { setUser, clearUser } from '@/lib/errors/tracking'

// Set user context
setUser({
  id: user.id,
  email: user.email,
  username: user.name,
})

// Clear on logout
clearUser()
```

### Wrap Functions with Error Tracking

```typescript
import { withErrorTracking } from '@/lib/errors/tracking'

const processWithTracking = withErrorTracking(
  processOpportunity,
  { action: 'process_opportunity', severity: 'high' }
)

await processWithTracking(opportunityId)
```

### Error Codes

Pre-defined error codes for consistency:

```typescript
import { ErrorCodes } from '@/lib/errors/tracking'

// Authentication
ErrorCodes.AUTH_INVALID_CREDENTIALS
ErrorCodes.AUTH_SESSION_EXPIRED
ErrorCodes.AUTH_UNAUTHORIZED
ErrorCodes.AUTH_FORBIDDEN

// Validation
ErrorCodes.VALIDATION_FAILED
ErrorCodes.VALIDATION_INVALID_INPUT
ErrorCodes.VALIDATION_MISSING_FIELD

// Database
ErrorCodes.DB_QUERY_FAILED
ErrorCodes.DB_CONNECTION_FAILED
ErrorCodes.DB_CONSTRAINT_VIOLATION
ErrorCodes.DB_NOT_FOUND

// Business Logic
ErrorCodes.BUSINESS_INVALID_STATE
ErrorCodes.BUSINESS_DUPLICATE
ErrorCodes.BUSINESS_CONFLICT

// External Services
ErrorCodes.EXTERNAL_SERVICE_ERROR
ErrorCodes.EXTERNAL_TIMEOUT
ErrorCodes.EXTERNAL_RATE_LIMIT

// System
ErrorCodes.SYSTEM_ERROR
ErrorCodes.SYSTEM_UNAVAILABLE
```

---

## Performance Monitoring

### Measure Async Functions

```typescript
import { measureAsync } from '@/lib/monitoring/performance'

const opportunities = await measureAsync(
  'fetch-opportunities',
  'db.query',
  async () => {
    return await supabase
      .from('missed_opportunities')
      .select('*')
      .eq('status', 'pending')
  },
  { customer_id: customerId } // Optional tags
)
```

### Measure Sync Functions

```typescript
import { measureSync } from '@/lib/monitoring/performance'

const result = measureSync(
  'calculate-revenue',
  'calculation',
  () => calculateTotalRevenue(data)
)
```

### Measure Database Queries

```typescript
import { measureQuery } from '@/lib/monitoring/performance'

const customers = await measureQuery(
  'fetch-active-customers',
  async () => {
    return await supabase
      .from('customers')
      .select('*')
      .eq('status', 'active')
  },
  { table: 'customers', operation: 'select' }
)
```

### Measure API Requests

```typescript
import { measureApiRequest } from '@/lib/monitoring/performance'

const data = await measureApiRequest(
  '/api/customers',
  async () => {
    return await fetch('/api/customers').then((r) => r.json())
  },
  'GET'
)
```

### Measure API Routes

```typescript
import { measureApiRoute } from '@/lib/monitoring/performance'

export async function GET(req: Request) {
  return measureApiRoute('customers', 'GET', async () => {
    const customers = await fetchCustomers()
    return NextResponse.json(customers)
  })
}
```

### Measure Server Components

```typescript
import { measureServerComponent } from '@/lib/monitoring/performance'

export default async function CustomersPage() {
  return measureServerComponent('CustomersPage', async () => {
    const customers = await fetchCustomers()
    return <CustomerList customers={customers} />
  })
}
```

### Manual Transactions

```typescript
import { startTransaction, startSpan } from '@/lib/monitoring/performance'

const transaction = startTransaction('complex-operation', 'task')

try {
  // First step
  const span1 = startSpan('db.query', 'Fetch customers')
  const customers = await fetchCustomers()
  span1?.finish()

  // Second step
  const span2 = startSpan('calculation', 'Process data')
  const result = processData(customers)
  span2?.finish()

  transaction.setStatus('ok')
  return result
} catch (error) {
  transaction.setStatus('internal_error')
  throw error
} finally {
  transaction.finish()
}
```

### Track Custom Metrics

```typescript
import { trackMetric } from '@/lib/monitoring/performance'

trackMetric('opportunity.conversion_time', 3.5, 'second', {
  opportunity_type: 'follow_up',
})
```

### Operation Types

Pre-defined operation types:

```typescript
import { OperationTypes } from '@/lib/monitoring/performance'

OperationTypes.HTTP_REQUEST    // 'http.server'
OperationTypes.HTTP_CLIENT      // 'http.client'
OperationTypes.DB_QUERY         // 'db.query'
OperationTypes.DB_TRANSACTION   // 'db.transaction'
OperationTypes.CACHE_GET        // 'cache.get'
OperationTypes.CACHE_SET        // 'cache.set'
OperationTypes.FILE_READ        // 'file.read'
OperationTypes.FILE_WRITE       // 'file.write'
OperationTypes.CALCULATION      // 'calculation'
OperationTypes.RENDER           // 'ui.render'
OperationTypes.NAVIGATION       // 'ui.navigation'
OperationTypes.BACKGROUND_JOB   // 'job'
OperationTypes.CRON             // 'cron'
```

---

## Error Boundary

### Basic Usage

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary'

function MyComponent() {
  return (
    <ErrorBoundary context="opportunities">
      <OpportunitiesSection />
    </ErrorBoundary>
  )
}
```

### With Custom Fallback

```typescript
<ErrorBoundary
  context="promotions"
  fallback={
    <div className="p-8 text-center">
      <p>Failed to load promotions</p>
      <Button onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  }
>
  <PromotionsSection />
</ErrorBoundary>
```

### Show Error Details (Development)

```typescript
<ErrorBoundary context="customers" showDetails={true}>
  <CustomerList />
</ErrorBoundary>
```

### Simple Error Boundary

```typescript
import { SimpleErrorBoundary } from '@/components/ErrorBoundary'

<SimpleErrorBoundary context="dashboard-stats">
  <DashboardStats />
</SimpleErrorBoundary>
```

### In Layout

```typescript
// app/layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ErrorBoundary context="app-root">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
```

---

## Dashboard

### Access

Navigate to:
```
/dashboard/admin/errors
```

Requires permission: `analytics:view_all`

### Features

**Overview Statistics:**
- Total errors
- Unique errors
- Affected users
- Error rate
- Trend indicators

**Error Timeline:**
- Error occurrences over time
- Unique errors trend
- Affected users trend

**Top Errors:**
- Most frequent errors
- Affected user count
- Component/page location
- Severity and status
- First and last seen timestamps

**Charts:**
- Errors by component
- Errors by platform (browser)
- Severity distribution
- Status distribution

**Performance Metrics:**
- Average response time
- 95th and 99th percentiles
- Slowest endpoints

**Critical Errors:**
- Unresolved critical issues
- User impact
- Timestamp

### Filters

- **Period**: 24h, 7d, 30d, 90d
- **Environment**: production, staging, development

### Actions

- **Refresh**: Reload latest data
- **Open Sentry**: Direct link to Sentry dashboard

---

## Best Practices

### 1. Always Provide Context

```typescript
// ❌ BAD
captureError(error)

// ✅ GOOD
captureError(error, {
  userId: user.id,
  customerId: customer.id,
  action: 'process_opportunity',
  severity: 'high',
  extra: {
    opportunityType: opportunity.type,
    stage: opportunity.stage,
  },
})
```

### 2. Use Appropriate Severity Levels

```typescript
// Low: Informational, no user impact
captureError(error, { severity: 'low' })

// Medium: Some functionality affected
captureError(error, { severity: 'medium' })

// High: Critical functionality broken
captureError(error, { severity: 'high' })

// Critical: System-wide impact
captureError(error, { severity: 'critical' })
```

### 3. Use Error Boundaries for UI Components

```typescript
// Wrap risky components
<ErrorBoundary context="customer-list">
  <CustomerList />
</ErrorBoundary>
```

### 4. Add Breadcrumbs for Debugging

```typescript
addBreadcrumb('User started checkout', 'user.action')
addBreadcrumb('Added payment method', 'payment')
addBreadcrumb('Submitted order', 'order')
// Error occurs here - breadcrumbs help debug
```

### 5. Use Custom Error Types

```typescript
// Define error types for your domain
throw new AppError(
  'Opportunity already converted',
  'opportunity.already_converted',
  409,
  { opportunityId, status: 'converted' }
)
```

### 6. Measure Performance-Critical Operations

```typescript
// Measure database queries
const data = await measureQuery('fetch-large-dataset', query, {
  table: 'customers',
  operation: 'select',
})

// Measure API calls
const result = await measureApiRequest('/api/process', request, 'POST')
```

### 7. Set User Context Early

```typescript
// In auth middleware or login handler
setUser({
  id: user.id,
  email: user.email,
  username: user.name,
  role: user.role,
})
```

### 8. Clear User Context on Logout

```typescript
// In logout handler
clearUser()
```

### 9. Use Error Fingerprinting for Grouping

```typescript
captureError(error, {
  fingerprint: ['opportunity', 'conversion', 'duplicate'],
})
```

### 10. Don't Capture Expected Errors

```typescript
// ❌ BAD - Don't capture validation errors
try {
  validateInput(data)
} catch (error) {
  captureError(error) // Too noisy!
  return { error: 'Validation failed' }
}

// ✅ GOOD - Only capture unexpected errors
try {
  const result = await processData(data)
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle gracefully, don't report
    return { error: error.message }
  }
  // Unexpected error - report it
  captureError(error, { severity: 'high' })
  throw error
}
```

---

## Troubleshooting

### Errors Not Appearing in Sentry

**Check:**
1. DSN is correctly set in environment variables
2. Sentry is initialized (check `sentry.client.config.ts`)
3. Error is not in `ignoreErrors` list
4. Error is actually being thrown

```bash
# Check if DSN is set
echo $NEXT_PUBLIC_SENTRY_DSN

# Check Sentry initialization in browser console
console.log(window.__SENTRY__)
```

### Too Many Errors

**Solutions:**
1. Add to `ignoreErrors` list in config
2. Increase error threshold for grouping
3. Resolve common errors
4. Add rate limiting

```typescript
// In sentry.client.config.ts
ignoreErrors: [
  'ResizeObserver loop limit exceeded',
  'Network request failed',
  // Add your patterns here
]
```

### Performance Impact

**Optimizations:**
1. Lower `tracesSampleRate` in production
2. Disable session replay for more users
3. Use conditional performance monitoring

```typescript
// Only monitor specific routes
if (shouldMonitorPerformance(route)) {
  await measureAsync('critical-operation', 'task', handler)
} else {
  await handler()
}
```

### PII Leaking into Sentry

**Check:**
1. `beforeSend` hook is scrubbing data
2. Sensitive fields are in scrubbing list
3. `sendDefaultPii` is set to `false`

```typescript
// In sentry config
sendDefaultPii: false, // Never send PII

beforeSend(event) {
  // Scrub sensitive data
  if (event.request?.data) {
    event.request.data = scrubSensitiveData(event.request.data)
  }
  return event
}
```

### Session Replay Not Working

**Check:**
1. Replay integration is enabled
2. Sample rates are set
3. User consented to recording (if required)

```typescript
// In sentry.client.config.ts
new Sentry.Replay({
  maskAllText: true,
  blockAllMedia: true,
  maskAllInputs: true,
})
```

### Dashboard Not Loading

**Check:**
1. User has `analytics:view_all` permission
2. API endpoint is accessible
3. Sentry API token is valid (if using real API)

```bash
# Test API endpoint
curl http://localhost:3000/api/admin/errors/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

## Sentry API Integration (Production)

To integrate with real Sentry API for the dashboard:

### 1. Get Auth Token

1. Go to Sentry > Settings > Account > API > Auth Tokens
2. Create new token with `event:read` and `project:read` scopes
3. Add to environment variables

```bash
SENTRY_AUTH_TOKEN=your-token-here
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

### 2. Update API Route

In `/src/app/api/admin/errors/stats/route.ts`:

```typescript
const sentryToken = process.env.SENTRY_AUTH_TOKEN
const sentryOrg = process.env.SENTRY_ORG
const sentryProject = process.env.SENTRY_PROJECT

const response = await fetch(
  `https://sentry.io/api/0/organizations/${sentryOrg}/issues/?statsPeriod=${period}&query=environment:${environment}`,
  {
    headers: {
      'Authorization': `Bearer ${sentryToken}`,
    },
  }
)

const issues = await response.json()
```

### 3. API Endpoints

Useful Sentry API endpoints:

```typescript
// Get issues
GET /api/0/organizations/{org}/issues/

// Get issue details
GET /api/0/issues/{issue_id}/

// Get events for issue
GET /api/0/issues/{issue_id}/events/

// Get stats
GET /api/0/organizations/{org}/stats_v2/

// Get projects
GET /api/0/organizations/{org}/projects/
```

See full API docs: https://docs.sentry.io/api/

---

## Related Documentation

- [Error Tracking Utilities](../src/lib/errors/tracking.ts)
- [Performance Monitoring](../src/lib/monitoring/performance.ts)
- [Error Boundary Component](../src/components/ErrorBoundary.tsx)
- [Sentry Official Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

**Last Updated:** 2025-01-24
