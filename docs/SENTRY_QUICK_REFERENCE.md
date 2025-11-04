# Sentry Error Tracking - Quick Reference

Quick snippets for common error tracking and performance monitoring tasks.

## Error Tracking

### Capture Error with Context
```typescript
import { captureError } from '@/lib/errors/tracking'

try {
  await riskyOperation()
} catch (error) {
  captureError(error as Error, {
    userId: user.id,
    customerId: customer.id,
    action: 'risky_operation',
    severity: 'high',
    extra: { additionalContext: 'value' },
  })
  throw error
}
```

### Create Custom Error
```typescript
import { AppError, ErrorCodes } from '@/lib/errors/tracking'

throw new AppError(
  'Customer not found',
  ErrorCodes.DB_NOT_FOUND,
  404,
  { customerId }
)
```

### Capture Message
```typescript
import { captureMessage } from '@/lib/errors/tracking'

captureMessage('Important event occurred', 'info', {
  userId: user.id,
  extra: { eventType: 'conversion' },
})
```

### Add Breadcrumb
```typescript
import { addBreadcrumb } from '@/lib/errors/tracking'

addBreadcrumb('User clicked submit', 'user.action', 'info', {
  formId: 'customer-form',
})
```

### Set User Context
```typescript
import { setUser, clearUser } from '@/lib/errors/tracking'

// On login
setUser({ id: user.id, email: user.email })

// On logout
clearUser()
```

## Performance Monitoring

### Measure Async Function
```typescript
import { measureAsync } from '@/lib/monitoring/performance'

const result = await measureAsync(
  'fetch-customers',
  'db.query',
  async () => await supabase.from('customers').select('*'),
  { table: 'customers' }
)
```

### Measure Database Query
```typescript
import { measureQuery } from '@/lib/monitoring/performance'

const customers = await measureQuery(
  'get-active-customers',
  () => db.customers.where('status', 'active').fetch(),
  { table: 'customers', operation: 'select' }
)
```

### Measure API Request
```typescript
import { measureApiRequest } from '@/lib/monitoring/performance'

const data = await measureApiRequest(
  '/api/customers',
  () => fetch('/api/customers').then(r => r.json()),
  'GET'
)
```

### Measure API Route
```typescript
import { measureApiRoute } from '@/lib/monitoring/performance'

export async function GET(req: Request) {
  return measureApiRoute('customers', 'GET', async () => {
    const data = await fetchCustomers()
    return NextResponse.json(data)
  })
}
```

### Track Custom Metric
```typescript
import { trackMetric } from '@/lib/monitoring/performance'

trackMetric('conversion_time', 3.5, 'second', {
  type: 'opportunity',
})
```

## Error Boundary

### Basic Usage
```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary'

<ErrorBoundary context="opportunities">
  <OpportunitiesSection />
</ErrorBoundary>
```

### Simple Error Boundary
```typescript
import { SimpleErrorBoundary } from '@/components/ErrorBoundary'

<SimpleErrorBoundary context="stats">
  <DashboardStats />
</SimpleErrorBoundary>
```

### Custom Fallback
```typescript
<ErrorBoundary
  context="customers"
  fallback={<div>Failed to load</div>}
>
  <CustomerList />
</ErrorBoundary>
```

## Error Codes

```typescript
import { ErrorCodes } from '@/lib/errors/tracking'

// Authentication
ErrorCodes.AUTH_INVALID_CREDENTIALS
ErrorCodes.AUTH_SESSION_EXPIRED
ErrorCodes.AUTH_UNAUTHORIZED

// Validation
ErrorCodes.VALIDATION_FAILED
ErrorCodes.VALIDATION_INVALID_INPUT

// Database
ErrorCodes.DB_QUERY_FAILED
ErrorCodes.DB_NOT_FOUND

// Business
ErrorCodes.BUSINESS_INVALID_STATE
ErrorCodes.BUSINESS_DUPLICATE

// External
ErrorCodes.EXTERNAL_SERVICE_ERROR
ErrorCodes.EXTERNAL_TIMEOUT
```

## Operation Types

```typescript
import { OperationTypes } from '@/lib/monitoring/performance'

OperationTypes.HTTP_REQUEST    // API routes
OperationTypes.HTTP_CLIENT      // Fetch calls
OperationTypes.DB_QUERY         // Database
OperationTypes.CALCULATION      // Processing
OperationTypes.RENDER           // UI render
```

## Real-World Examples

### API Route with Error Handling
```typescript
import { measureApiRoute } from '@/lib/monitoring/performance'
import { captureError, AppError, ErrorCodes } from '@/lib/errors/tracking'

export async function POST(req: Request) {
  return measureApiRoute('create-customer', 'POST', async () => {
    try {
      const data = await req.json()
      const customer = await createCustomer(data)
      return NextResponse.json({ success: true, customer })
    } catch (error) {
      captureError(error as Error, {
        action: 'create_customer',
        severity: 'high',
        extra: { endpoint: '/api/customers' },
      })

      if (error instanceof AppError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        )
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}
```

### Server Component with Monitoring
```typescript
import { measureServerComponent } from '@/lib/monitoring/performance'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default async function CustomersPage() {
  return measureServerComponent('CustomersPage', async () => {
    const customers = await fetchCustomers()

    return (
      <ErrorBoundary context="customers-page">
        <CustomerList customers={customers} />
      </ErrorBoundary>
    )
  })
}
```

### Form Submission with Tracking
```typescript
async function handleSubmit(data: FormData) {
  addBreadcrumb('Form submission started', 'form', 'info', {
    formName: 'customer-form',
  })

  try {
    const result = await measureAsync(
      'submit-customer-form',
      'http.client',
      () => fetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    )

    captureMessage('Customer form submitted', 'info', {
      extra: { customerId: result.id },
    })

    return result
  } catch (error) {
    captureError(error as Error, {
      action: 'submit_customer_form',
      severity: 'medium',
      extra: { formData: data },
    })
    throw error
  }
}
```

### Database Operation with Monitoring
```typescript
import { measureQuery } from '@/lib/monitoring/performance'

async function getCustomerWithOpportunities(customerId: string) {
  return measureQuery(
    'get-customer-with-opportunities',
    async () => {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          opportunities (*)
        `)
        .eq('id', customerId)
        .single()

      if (error) throw error
      return data
    },
    { table: 'customers', operation: 'select' }
  )
}
```

## Testing

### Test Error Capture
```typescript
import { captureError } from '@/lib/errors/tracking'

// Trigger test error
try {
  throw new Error('Test error')
} catch (error) {
  captureError(error as Error, {
    action: 'test',
    severity: 'low',
    tags: { test: 'true' },
  })
}
```

### Test Performance Monitoring
```typescript
import { measureAsync } from '@/lib/monitoring/performance'

await measureAsync(
  'test-operation',
  'test',
  async () => {
    await new Promise(resolve => setTimeout(resolve, 100))
    return 'done'
  }
)
```

## Environment Setup

```bash
# .env.local
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_ENV=production
SENTRY_ENV=production
```

## Dashboard Access

```
/dashboard/admin/errors
```

Requires: `analytics:view_all` permission

## Useful Commands

```bash
# View Sentry in browser
open https://sentry.io/organizations/YOUR_ORG/issues/

# Check if Sentry is loaded (browser console)
console.log(window.__SENTRY__)

# Test error capture (browser console)
Sentry.captureException(new Error('Test error'))
```

---

**See Also:**
- [Full Error Tracking Guide](./SENTRY_ERROR_TRACKING.md)
- [Error Tracking Utilities](../src/lib/errors/tracking.ts)
- [Performance Monitoring](../src/lib/monitoring/performance.ts)
