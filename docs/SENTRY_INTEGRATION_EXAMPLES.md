# Sentry Integration Examples

Real-world examples showing how to integrate Sentry error tracking and performance monitoring throughout the application.

## Table of Contents

- [API Routes](#api-routes)
- [Server Components](#server-components)
- [Client Components](#client-components)
- [Database Operations](#database-operations)
- [External API Calls](#external-api-calls)
- [Background Jobs](#background-jobs)
- [Complete Feature Example](#complete-feature-example)

---

## API Routes

### Basic API Route with Full Monitoring

```typescript
// src/app/api/customers/route.ts
import { NextResponse } from 'next/server'
import { measureApiRoute } from '@/lib/monitoring/performance'
import { captureError, AppError, ErrorCodes } from '@/lib/errors/tracking'
import { addBreadcrumb } from '@/lib/errors/tracking'
import { withAuth } from '@/middleware/api-auth'

export const GET = withAuth(
  async (req, { user }) => {
    return measureApiRoute('get-customers', 'GET', async () => {
      try {
        addBreadcrumb('Fetching customers', 'api', 'info', {
          userId: user.id,
          endpoint: '/api/customers',
        })

        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('status', 'active')

        if (error) {
          throw new AppError(
            'Failed to fetch customers',
            ErrorCodes.DB_QUERY_FAILED,
            500,
            { originalError: error }
          )
        }

        return NextResponse.json({
          success: true,
          customers: data,
        })
      } catch (error) {
        captureError(error as Error, {
          userId: user.id,
          action: 'get_customers',
          severity: 'high',
          extra: {
            endpoint: '/api/customers',
            method: 'GET',
          },
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
  },
  {
    requirePermission: 'customers:read',
    enableAuditLog: true,
  }
)
```

### POST Route with Validation

```typescript
// src/app/api/opportunities/route.ts
import { NextResponse } from 'next/server'
import { measureApiRoute } from '@/lib/monitoring/performance'
import { captureError, createError, ErrorCodes } from '@/lib/errors/tracking'
import { withAuth } from '@/middleware/api-auth'
import { z } from 'zod'

const opportunitySchema = z.object({
  customerId: z.string().uuid(),
  type: z.enum(['follow_up', 'service_upgrade', 'renewal']),
  value: z.number().positive(),
  notes: z.string().optional(),
})

export const POST = withAuth(
  async (req, { user }) => {
    return measureApiRoute('create-opportunity', 'POST', async () => {
      try {
        const body = await req.json()

        // Validate input
        const validated = opportunitySchema.safeParse(body)
        if (!validated.success) {
          throw createError(
            ErrorCodes.VALIDATION_FAILED,
            'Invalid opportunity data',
            400,
            { errors: validated.error.errors }
          )
        }

        // Create opportunity
        const opportunity = await createOpportunity({
          ...validated.data,
          createdBy: user.id,
        })

        return NextResponse.json({
          success: true,
          opportunity,
        })
      } catch (error) {
        captureError(error as Error, {
          userId: user.id,
          action: 'create_opportunity',
          severity: error instanceof AppError ? 'medium' : 'high',
        })

        if (error instanceof AppError) {
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.statusCode }
          )
        }

        return NextResponse.json(
          { error: 'Failed to create opportunity' },
          { status: 500 }
        )
      }
    })
  },
  {
    requirePermission: 'opportunities:create',
    enableAuditLog: true,
  }
)
```

---

## Server Components

### Page with Error Boundary and Monitoring

```typescript
// src/app/(dashboard)/dashboard/customers/page.tsx
import { measureServerComponent } from '@/lib/monitoring/performance'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { captureError } from '@/lib/errors/tracking'

export default async function CustomersPage() {
  return measureServerComponent('CustomersPage', async () => {
    try {
      const customers = await fetchCustomers()
      const stats = await fetchCustomerStats()

      return (
        <div className="container mx-auto py-8">
          <ErrorBoundary context="customer-stats">
            <CustomerStats stats={stats} />
          </ErrorBoundary>

          <ErrorBoundary context="customer-list">
            <CustomerList customers={customers} />
          </ErrorBoundary>
        </div>
      )
    } catch (error) {
      captureError(error as Error, {
        action: 'load_customers_page',
        severity: 'high',
        extra: { page: 'customers' },
      })

      return (
        <div className="p-8 text-center">
          <h2>Failed to load customers</h2>
          <p>Please try again later</p>
        </div>
      )
    }
  })
}

async function fetchCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw createError(
      ErrorCodes.DB_QUERY_FAILED,
      'Failed to fetch customers',
      500,
      { originalError: error }
    )
  }

  return data
}
```

---

## Client Components

### Form with Error Handling

```typescript
'use client'

import { useState } from 'react'
import { captureError, addBreadcrumb } from '@/lib/errors/tracking'
import { measureAsync } from '@/lib/monitoring/performance'
import { toast } from 'sonner'

export function CustomerForm() {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    addBreadcrumb('Customer form submission started', 'form', 'info', {
      formName: 'customer-form',
    })

    try {
      const formData = new FormData(e.currentTarget)
      const data = Object.fromEntries(formData)

      const result = await measureAsync(
        'submit-customer-form',
        'http.client',
        async () => {
          const res = await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })

          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Failed to create customer')
          }

          return res.json()
        }
      )

      addBreadcrumb('Customer created successfully', 'success', 'info', {
        customerId: result.customer.id,
      })

      toast.success('Customer created successfully')
      // Handle success (redirect, reset form, etc.)
    } catch (error) {
      captureError(error as Error, {
        action: 'submit_customer_form',
        severity: 'medium',
        extra: {
          formName: 'customer-form',
        },
      })

      toast.error('Failed to create customer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Customer'}
      </button>
    </form>
  )
}
```

### Component with Error Boundary

```typescript
'use client'

import { useState, useEffect } from 'react'
import { SimpleErrorBoundary } from '@/components/ErrorBoundary'
import { captureError, addBreadcrumb } from '@/lib/errors/tracking'

export function CustomerDashboard() {
  return (
    <div className="space-y-6">
      <SimpleErrorBoundary context="revenue-chart">
        <RevenueChart />
      </SimpleErrorBoundary>

      <SimpleErrorBoundary context="recent-customers">
        <RecentCustomers />
      </SimpleErrorBoundary>

      <SimpleErrorBoundary context="pending-opportunities">
        <PendingOpportunities />
      </SimpleErrorBoundary>
    </div>
  )
}

function RevenueChart() {
  const [data, setData] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        addBreadcrumb('Loading revenue data', 'data', 'info')

        const res = await fetch('/api/analytics/revenue')
        if (!res.ok) throw new Error('Failed to load revenue data')

        const result = await res.json()
        setData(result.data)
      } catch (error) {
        captureError(error as Error, {
          action: 'load_revenue_chart',
          severity: 'medium',
        })
        throw error // Will be caught by ErrorBoundary
      }
    }

    loadData()
  }, [])

  if (!data) return <div>Loading...</div>

  return <div>{/* Chart component */}</div>
}
```

---

## Database Operations

### Service Layer with Monitoring

```typescript
// src/services/customer-service.ts
import { measureQuery } from '@/lib/monitoring/performance'
import { createError, ErrorCodes } from '@/lib/errors/tracking'
import { createClient } from '@/lib/supabase/server'

export class CustomerService {
  async getCustomerById(id: string) {
    return measureQuery(
      'get-customer-by-id',
      async () => {
        const supabase = await createClient()

        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', id)
          .single()

        if (error) {
          throw createError(
            ErrorCodes.DB_NOT_FOUND,
            'Customer not found',
            404,
            { customerId: id, originalError: error }
          )
        }

        return data
      },
      { table: 'customers', operation: 'select' }
    )
  }

  async createCustomer(data: CustomerInput) {
    return measureQuery(
      'create-customer',
      async () => {
        const supabase = await createClient()

        const { data: customer, error } = await supabase
          .from('customers')
          .insert(data)
          .select()
          .single()

        if (error) {
          throw createError(
            ErrorCodes.DB_QUERY_FAILED,
            'Failed to create customer',
            500,
            { data, originalError: error }
          )
        }

        return customer
      },
      { table: 'customers', operation: 'insert' }
    )
  }

  async updateCustomer(id: string, updates: Partial<CustomerInput>) {
    return measureQuery(
      'update-customer',
      async () => {
        const supabase = await createClient()

        // Check if customer exists
        const existing = await this.getCustomerById(id)

        const { data: customer, error } = await supabase
          .from('customers')
          .update(updates)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          throw createError(
            ErrorCodes.DB_QUERY_FAILED,
            'Failed to update customer',
            500,
            { customerId: id, updates, originalError: error }
          )
        }

        return customer
      },
      { table: 'customers', operation: 'update' }
    )
  }
}
```

---

## External API Calls

### Third-Party Integration with Monitoring

```typescript
// src/lib/integrations/twilio.ts
import { measureApiRequest } from '@/lib/monitoring/performance'
import { captureError, createError, ErrorCodes } from '@/lib/errors/tracking'
import { addBreadcrumb } from '@/lib/errors/tracking'

export class TwilioService {
  private accountSid = process.env.TWILIO_ACCOUNT_SID
  private authToken = process.env.TWILIO_AUTH_TOKEN
  private phoneNumber = process.env.TWILIO_PHONE_NUMBER

  async sendSMS(to: string, message: string) {
    addBreadcrumb('Sending SMS via Twilio', 'external', 'info', {
      to,
      messageLength: message.length,
    })

    return measureApiRequest(
      'twilio.send_sms',
      async () => {
        try {
          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${Buffer.from(
                  `${this.accountSid}:${this.authToken}`
                ).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: to,
                From: this.phoneNumber!,
                Body: message,
              }),
            }
          )

          if (!response.ok) {
            const error = await response.json()
            throw createError(
              ErrorCodes.EXTERNAL_SERVICE_ERROR,
              `Twilio error: ${error.message}`,
              response.status,
              { to, twilioError: error }
            )
          }

          const result = await response.json()

          addBreadcrumb('SMS sent successfully', 'external', 'info', {
            messageSid: result.sid,
          })

          return result
        } catch (error) {
          captureError(error as Error, {
            action: 'send_sms',
            severity: 'high',
            extra: {
              service: 'twilio',
              to,
            },
          })
          throw error
        }
      },
      'POST'
    )
  }
}
```

---

## Background Jobs

### Scheduled Job with Monitoring

```typescript
// src/app/api/cron/send-followups/route.ts
import { NextResponse } from 'next/server'
import { measureAsync } from '@/lib/monitoring/performance'
import { captureError, captureMessage } from '@/lib/errors/tracking'
import { addBreadcrumb } from '@/lib/errors/tracking'

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return measureAsync('cron.send_followups', 'job', async () => {
    let processedCount = 0
    let errorCount = 0

    try {
      addBreadcrumb('Starting follow-up job', 'cron', 'info')

      // Get pending follow-ups
      const followups = await getPendingFollowups()

      addBreadcrumb('Processing follow-ups', 'cron', 'info', {
        count: followups.length,
      })

      for (const followup of followups) {
        try {
          await measureAsync(
            'process-single-followup',
            'task',
            async () => {
              await sendFollowupMessage(followup)
              await markFollowupAsSent(followup.id)
            },
            { followupId: followup.id }
          )

          processedCount++
        } catch (error) {
          errorCount++
          captureError(error as Error, {
            action: 'process_followup',
            severity: 'medium',
            extra: {
              followupId: followup.id,
              customerId: followup.customer_id,
            },
          })
        }
      }

      captureMessage(
        `Follow-up job completed: ${processedCount} sent, ${errorCount} errors`,
        'info',
        {
          extra: {
            processedCount,
            errorCount,
            totalCount: followups.length,
          },
        }
      )

      return NextResponse.json({
        success: true,
        processed: processedCount,
        errors: errorCount,
      })
    } catch (error) {
      captureError(error as Error, {
        action: 'cron_send_followups',
        severity: 'critical',
      })

      return NextResponse.json(
        { error: 'Job failed' },
        { status: 500 }
      )
    }
  })
}
```

---

## Complete Feature Example

### Opportunity Creation Flow

```typescript
// ============================================================================
// 1. API Route
// ============================================================================
// src/app/api/opportunities/route.ts

import { NextResponse } from 'next/server'
import { measureApiRoute } from '@/lib/monitoring/performance'
import { captureError, addBreadcrumb } from '@/lib/errors/tracking'
import { withAuth } from '@/middleware/api-auth'
import { OpportunityService } from '@/services/opportunity-service'

export const POST = withAuth(
  async (req, { user }) => {
    return measureApiRoute('create-opportunity', 'POST', async () => {
      try {
        const body = await req.json()

        addBreadcrumb('Creating opportunity', 'api', 'info', {
          userId: user.id,
          customerId: body.customerId,
        })

        const service = new OpportunityService()
        const opportunity = await service.createOpportunity({
          ...body,
          createdBy: user.id,
        })

        return NextResponse.json({
          success: true,
          opportunity,
        })
      } catch (error) {
        captureError(error as Error, {
          userId: user.id,
          action: 'create_opportunity_api',
          severity: 'high',
        })

        if (error instanceof AppError) {
          return NextResponse.json(
            { error: error.message },
            { status: error.statusCode }
          )
        }

        return NextResponse.json(
          { error: 'Failed to create opportunity' },
          { status: 500 }
        )
      }
    })
  },
  {
    requirePermission: 'opportunities:create',
    enableAuditLog: true,
  }
)

// ============================================================================
// 2. Service Layer
// ============================================================================
// src/services/opportunity-service.ts

import { measureQuery, measureAsync } from '@/lib/monitoring/performance'
import { createError, ErrorCodes } from '@/lib/errors/tracking'

export class OpportunityService {
  async createOpportunity(data: OpportunityInput) {
    return measureAsync(
      'opportunity-service.create',
      'business-logic',
      async () => {
        // Validate customer exists
        const customer = await this.getCustomer(data.customerId)

        // Check for duplicates
        await this.checkDuplicates(data.customerId, data.type)

        // Create opportunity
        const opportunity = await measureQuery(
          'insert-opportunity',
          async () => {
            const { data: opp, error } = await supabase
              .from('opportunities')
              .insert(data)
              .select()
              .single()

            if (error) {
              throw createError(
                ErrorCodes.DB_QUERY_FAILED,
                'Failed to create opportunity',
                500,
                { data, originalError: error }
              )
            }

            return opp
          },
          { table: 'opportunities', operation: 'insert' }
        )

        // Send notification
        await this.sendNotification(opportunity)

        return opportunity
      }
    )
  }

  private async checkDuplicates(customerId: string, type: string) {
    return measureQuery(
      'check-duplicate-opportunities',
      async () => {
        const { data, error } = await supabase
          .from('opportunities')
          .select('id')
          .eq('customer_id', customerId)
          .eq('type', type)
          .eq('status', 'pending')

        if (error) throw error

        if (data && data.length > 0) {
          throw createError(
            ErrorCodes.BUSINESS_DUPLICATE,
            'Duplicate opportunity exists',
            409,
            { customerId, type }
          )
        }
      },
      { table: 'opportunities', operation: 'select' }
    )
  }
}

// ============================================================================
// 3. Client Component
// ============================================================================
// src/components/OpportunityForm.tsx

'use client'

import { useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { captureError, addBreadcrumb } from '@/lib/errors/tracking'
import { measureAsync } from '@/lib/monitoring/performance'

export function OpportunityForm({ customerId }: { customerId: string }) {
  return (
    <ErrorBoundary context="opportunity-form">
      <FormContent customerId={customerId} />
    </ErrorBoundary>
  )
}

function FormContent({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)

    addBreadcrumb('Opportunity form submitted', 'form', 'info', {
      customerId,
    })

    try {
      const data = Object.fromEntries(formData)

      const result = await measureAsync(
        'submit-opportunity-form',
        'http.client',
        async () => {
          const res = await fetch('/api/opportunities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, customerId }),
          })

          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error)
          }

          return res.json()
        }
      )

      addBreadcrumb('Opportunity created', 'success', 'info', {
        opportunityId: result.opportunity.id,
      })

      toast.success('Opportunity created successfully')
    } catch (error) {
      captureError(error as Error, {
        customerId,
        action: 'submit_opportunity_form',
        severity: 'medium',
      })

      toast.error('Failed to create opportunity')
    } finally {
      setLoading(false)
    }
  }

  return <form action={handleSubmit}>{/* Form fields */}</form>
}
```

---

**See Also:**
- [Full Error Tracking Guide](./SENTRY_ERROR_TRACKING.md)
- [Quick Reference](./SENTRY_QUICK_REFERENCE.md)
