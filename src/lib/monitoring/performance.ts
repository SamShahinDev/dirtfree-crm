/**
 * Performance Monitoring
 *
 * Utilities for tracking performance with Sentry.
 *
 * @module lib/monitoring/performance
 */

import * as Sentry from '@sentry/nextjs'

/**
 * Start a Sentry transaction
 *
 * @param name - Transaction name
 * @param operation - Operation type (e.g., 'http.request', 'db.query')
 * @returns Transaction instance
 *
 * @example
 * ```typescript
 * const transaction = startTransaction('fetch-opportunities', 'db.query')
 * try {
 *   const data = await fetchData()
 *   transaction.setStatus('ok')
 *   return data
 * } catch (error) {
 *   transaction.setStatus('internal_error')
 *   throw error
 * } finally {
 *   transaction.finish()
 * }
 * ```
 */
export function startTransaction(name: string, operation: string) {
  return Sentry.startTransaction({
    name,
    op: operation,
    trimEnd: true,
  })
}

/**
 * Start a span within the current transaction
 *
 * @param operation - Operation type
 * @param description - Span description
 * @returns Span instance or undefined if no active transaction
 *
 * @example
 * ```typescript
 * const span = startSpan('db.query', 'SELECT * FROM customers')
 * try {
 *   const result = await query()
 *   span?.setStatus('ok')
 *   return result
 * } finally {
 *   span?.finish()
 * }
 * ```
 */
export function startSpan(operation: string, description?: string) {
  const currentTransaction = Sentry.getCurrentHub().getScope()?.getTransaction()
  if (!currentTransaction) {
    return undefined
  }

  return currentTransaction.startChild({
    op: operation,
    description,
  })
}

/**
 * Measure the execution time of an async function
 *
 * @param name - Transaction name
 * @param operation - Operation type
 * @param fn - Function to measure
 * @param tags - Additional tags
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const opportunities = await measureAsync(
 *   'fetch-opportunities',
 *   'db.query',
 *   async () => {
 *     return await supabase
 *       .from('missed_opportunities')
 *       .select('*')
 *       .eq('status', 'pending')
 *   },
 *   { customer_id: customerId }
 * )
 * ```
 */
export async function measureAsync<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const transaction = startTransaction(name, operation)

  // Add tags
  if (tags) {
    Object.entries(tags).forEach(([key, value]) => {
      transaction.setTag(key, value)
    })
  }

  try {
    const result = await fn()
    transaction.setStatus('ok')
    return result
  } catch (error) {
    transaction.setStatus('internal_error')
    transaction.setTag('error', 'true')
    throw error
  } finally {
    transaction.finish()
  }
}

/**
 * Measure the execution time of a synchronous function
 *
 * @param name - Transaction name
 * @param operation - Operation type
 * @param fn - Function to measure
 * @param tags - Additional tags
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = measureSync(
 *   'calculate-revenue',
 *   'calculation',
 *   () => calculateTotalRevenue(data)
 * )
 * ```
 */
export function measureSync<T>(
  name: string,
  operation: string,
  fn: () => T,
  tags?: Record<string, string>
): T {
  const transaction = startTransaction(name, operation)

  // Add tags
  if (tags) {
    Object.entries(tags).forEach(([key, value]) => {
      transaction.setTag(key, value)
    })
  }

  try {
    const result = fn()
    transaction.setStatus('ok')
    return result
  } catch (error) {
    transaction.setStatus('internal_error')
    transaction.setTag('error', 'true')
    throw error
  } finally {
    transaction.finish()
  }
}

/**
 * Measure a database query
 *
 * @param queryName - Name of the query
 * @param fn - Query function
 * @param metadata - Additional metadata
 * @returns Query result
 *
 * @example
 * ```typescript
 * const customers = await measureQuery(
 *   'fetch-active-customers',
 *   async () => {
 *     return await supabase
 *       .from('customers')
 *       .select('*')
 *       .eq('status', 'active')
 *   },
 *   { table: 'customers', operation: 'select' }
 * )
 * ```
 */
export async function measureQuery<T>(
  queryName: string,
  fn: () => Promise<T>,
  metadata?: {
    table?: string
    operation?: 'select' | 'insert' | 'update' | 'delete'
    [key: string]: any
  }
): Promise<T> {
  const tags: Record<string, string> = {}

  if (metadata?.table) {
    tags.table = metadata.table
  }

  if (metadata?.operation) {
    tags.db_operation = metadata.operation
  }

  return measureAsync(`db.query.${queryName}`, 'db.query', fn, tags)
}

/**
 * Measure an API request
 *
 * @param endpoint - API endpoint
 * @param fn - Request function
 * @param method - HTTP method
 * @returns Request result
 *
 * @example
 * ```typescript
 * const data = await measureApiRequest(
 *   '/api/customers',
 *   async () => {
 *     return await fetch('/api/customers').then(r => r.json())
 *   },
 *   'GET'
 * )
 * ```
 */
export async function measureApiRequest<T>(
  endpoint: string,
  fn: () => Promise<T>,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET'
): Promise<T> {
  return measureAsync(
    `api.${method}.${endpoint}`,
    'http.client',
    fn,
    {
      http_method: method,
      http_endpoint: endpoint,
    }
  )
}

/**
 * Measure a component render time (client-side only)
 *
 * @param componentName - Name of the component
 * @param fn - Render function
 * @returns Render result
 *
 * @example
 * ```typescript
 * const element = measureRender('CustomerList', () => {
 *   return <CustomerList customers={data} />
 * })
 * ```
 */
export function measureRender<T>(componentName: string, fn: () => T): T {
  if (typeof window === 'undefined') {
    return fn()
  }

  return measureSync(`render.${componentName}`, 'ui.render', fn, {
    component: componentName,
  })
}

/**
 * Decorator for measuring async method execution
 *
 * @param name - Measurement name
 * @param operation - Operation type
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * class CustomerService {
 *   @Measure('CustomerService.getCustomers', 'db.query')
 *   async getCustomers() {
 *     return await supabase.from('customers').select('*')
 *   }
 * }
 * ```
 */
export function Measure(name: string, operation: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      return await measureAsync(name, operation, () => originalMethod.apply(this, args))
    }

    return descriptor
  }
}

/**
 * Track a custom metric
 *
 * @param name - Metric name
 * @param value - Metric value
 * @param unit - Unit of measurement
 * @param tags - Additional tags
 *
 * @example
 * ```typescript
 * trackMetric('opportunity.conversion_time', 3.5, 'second', {
 *   opportunity_type: 'follow_up'
 * })
 * ```
 */
export function trackMetric(
  name: string,
  value: number,
  unit: 'second' | 'millisecond' | 'count' | 'byte' = 'count',
  tags?: Record<string, string>
): void {
  const transaction = Sentry.getCurrentHub().getScope()?.getTransaction()

  if (transaction) {
    transaction.setMeasurement(name, value, unit)

    if (tags) {
      Object.entries(tags).forEach(([key, val]) => {
        transaction.setTag(key, val)
      })
    }
  }

  // Also log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Metric] ${name}: ${value} ${unit}`, tags)
  }
}

/**
 * Common operation types
 */
export const OperationTypes = {
  HTTP_REQUEST: 'http.server',
  HTTP_CLIENT: 'http.client',
  DB_QUERY: 'db.query',
  DB_TRANSACTION: 'db.transaction',
  CACHE_GET: 'cache.get',
  CACHE_SET: 'cache.set',
  FILE_READ: 'file.read',
  FILE_WRITE: 'file.write',
  CALCULATION: 'calculation',
  RENDER: 'ui.render',
  NAVIGATION: 'ui.navigation',
  BACKGROUND_JOB: 'job',
  CRON: 'cron',
} as const

/**
 * Performance helper for React Server Components
 *
 * @param name - Component name
 * @param fn - Component function
 * @returns Component result
 *
 * @example
 * ```typescript
 * export default async function CustomersPage() {
 *   return measureServerComponent('CustomersPage', async () => {
 *     const customers = await fetchCustomers()
 *     return <CustomerList customers={customers} />
 *   })
 * }
 * ```
 */
export async function measureServerComponent<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  return measureAsync(`component.${name}`, OperationTypes.RENDER, fn)
}

/**
 * Performance helper for API routes
 *
 * @param routeName - Route name
 * @param method - HTTP method
 * @param fn - Route handler
 * @returns Handler result
 *
 * @example
 * ```typescript
 * export async function GET(req: Request) {
 *   return measureApiRoute('customers', 'GET', async () => {
 *     const customers = await fetchCustomers()
 *     return NextResponse.json(customers)
 *   })
 * }
 * ```
 */
export async function measureApiRoute<T>(
  routeName: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  fn: () => Promise<T>
): Promise<T> {
  return measureAsync(
    `api.${method}.${routeName}`,
    OperationTypes.HTTP_REQUEST,
    fn,
    {
      http_method: method,
      route: routeName,
    }
  )
}

/**
 * Mark a point in time for performance tracking
 *
 * @param name - Mark name
 *
 * @example
 * ```typescript
 * performanceMark('data-fetch-start')
 * const data = await fetchData()
 * performanceMark('data-fetch-end')
 * performanceMeasure('data-fetch', 'data-fetch-start', 'data-fetch-end')
 * ```
 */
export function performanceMark(name: string): void {
  if (typeof window !== 'undefined' && window.performance) {
    window.performance.mark(name)
  }
}

/**
 * Measure time between two marks
 *
 * @param name - Measurement name
 * @param startMark - Start mark name
 * @param endMark - End mark name
 * @returns Duration in milliseconds
 */
export function performanceMeasure(
  name: string,
  startMark: string,
  endMark: string
): number | undefined {
  if (typeof window !== 'undefined' && window.performance) {
    try {
      const measure = window.performance.measure(name, startMark, endMark)
      trackMetric(name, measure.duration, 'millisecond')
      return measure.duration
    } catch (error) {
      console.warn('Performance measurement failed:', error)
    }
  }
  return undefined
}
