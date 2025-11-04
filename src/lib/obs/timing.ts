import * as Sentry from "@sentry/nextjs"
import { log, LogContext } from "./log"

export interface TimingOptions {
  name: string
  context?: LogContext
  logSuccess?: boolean
  logFailure?: boolean
  warnThreshold?: number // ms
  errorThreshold?: number // ms
}

export interface TimingResult<T> {
  result: T
  duration: number
  success: boolean
  error?: Error
}

export class Timer {
  private name: string
  private startTime: number
  private context?: LogContext
  private options: TimingOptions

  constructor(options: TimingOptions) {
    this.name = options.name
    this.context = options.context
    this.options = options
    this.startTime = performance.now()

    // Start Sentry transaction for significant operations
    if (this.shouldCreateSentryTransaction()) {
      Sentry.startTransaction({
        name: this.name,
        op: 'function',
        tags: this.context,
      })
    }
  }

  private shouldCreateSentryTransaction(): boolean {
    // Create Sentry transactions for operations that might be slow
    return this.options.warnThreshold !== undefined && this.options.warnThreshold > 1000
  }

  end<T>(result?: T, error?: Error): TimingResult<T> {
    const duration = performance.now() - this.startTime
    const success = !error

    const timingResult: TimingResult<T> = {
      result: result as T,
      duration,
      success,
      error
    }

    this.logTiming(timingResult)
    this.recordSentryTiming(timingResult)

    return timingResult
  }

  private logTiming<T>(result: TimingResult<T>) {
    const { duration, success, error } = result
    const { warnThreshold = 5000, errorThreshold = 10000 } = this.options

    const context: LogContext = {
      operation: this.name,
      duration,
      success,
      ...this.context
    }

    if (error && this.options.logFailure !== false) {
      log.error(`Operation failed: ${this.name} (${duration.toFixed(2)}ms)`, {
        ...context,
        error: error.message,
        stack: error.stack
      })
    } else if (success && this.options.logSuccess) {
      if (duration > errorThreshold) {
        log.error(`Operation very slow: ${this.name} (${duration.toFixed(2)}ms)`, context)
      } else if (duration > warnThreshold) {
        log.warn(`Operation slow: ${this.name} (${duration.toFixed(2)}ms)`, context)
      } else {
        log.info(`Operation completed: ${this.name} (${duration.toFixed(2)}ms)`, context)
      }
    }

    // Always log performance for monitoring
    log.performance(this.name, duration, this.context)
  }

  private recordSentryTiming<T>(result: TimingResult<T>) {
    const { duration, success, error } = result

    // Record timing as measurement
    Sentry.setMeasurement(this.name, duration, 'millisecond')

    // Add breadcrumb
    Sentry.addBreadcrumb({
      message: `${this.name}: ${duration.toFixed(2)}ms`,
      category: 'timing',
      level: success ? 'info' : 'error',
      data: {
        duration,
        success,
        ...this.context
      }
    })

    // Finish transaction if we started one
    const transaction = Sentry.getCurrentHub().getScope()?.getTransaction()
    if (transaction && transaction.name === this.name) {
      if (error) {
        transaction.setStatus('internal_error')
      } else {
        transaction.setStatus('ok')
      }
      transaction.finish()
    }
  }
}

// Async function wrapper
export async function timeAsync<T>(
  options: TimingOptions,
  fn: () => Promise<T>
): Promise<T> {
  const timer = new Timer(options)

  try {
    const result = await fn()
    timer.end(result)
    return result
  } catch (error) {
    timer.end(undefined, error as Error)
    throw error
  }
}

// Sync function wrapper
export function timeSync<T>(
  options: TimingOptions,
  fn: () => T
): T {
  const timer = new Timer(options)

  try {
    const result = fn()
    timer.end(result)
    return result
  } catch (error) {
    timer.end(undefined, error as Error)
    throw error
  }
}

// Decorator for class methods
export function timed(options: Partial<TimingOptions> = {}) {
  return function <T>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<T> | T>
  ) {
    const originalMethod = descriptor.value!

    descriptor.value = function (...args: any[]) {
      const timingOptions: TimingOptions = {
        name: `${target.constructor.name}.${propertyKey}`,
        logSuccess: true,
        warnThreshold: 1000,
        ...options
      }

      const result = originalMethod.apply(this, args)

      if (result instanceof Promise) {
        return timeAsync(timingOptions, () => result)
      } else {
        return timeSync(timingOptions, () => result)
      }
    } as any

    return descriptor
  }
}

// High-level wrappers for common use cases
export const timing = {
  // Database operations
  db: <T>(operation: string, fn: () => Promise<T>, context?: LogContext) =>
    timeAsync({
      name: `db.${operation}`,
      context: { ...context, type: 'database' },
      logSuccess: true,
      warnThreshold: 1000,
      errorThreshold: 5000
    }, fn),

  // API calls
  api: <T>(endpoint: string, fn: () => Promise<T>, context?: LogContext) =>
    timeAsync({
      name: `api.${endpoint}`,
      context: { ...context, type: 'api' },
      logSuccess: true,
      warnThreshold: 2000,
      errorThreshold: 10000
    }, fn),

  // External service calls
  external: <T>(service: string, fn: () => Promise<T>, context?: LogContext) =>
    timeAsync({
      name: `external.${service}`,
      context: { ...context, type: 'external' },
      logSuccess: true,
      warnThreshold: 3000,
      errorThreshold: 15000
    }, fn),

  // Business logic operations
  operation: <T>(name: string, fn: () => Promise<T> | T, context?: LogContext) => {
    const timingOptions: TimingOptions = {
      name: `operation.${name}`,
      context: { ...context, type: 'operation' },
      logSuccess: false, // Usually don't log success for business operations
      warnThreshold: 2000
    }

    if (typeof fn === 'function') {
      const result = fn()
      if (result instanceof Promise) {
        return timeAsync(timingOptions, fn as () => Promise<T>)
      } else {
        return timeSync(timingOptions, fn as () => T)
      }
    }
  }
}

// Performance measurement utilities
export const perf = {
  mark: (name: string) => {
    if (typeof window !== 'undefined' && window.performance?.mark) {
      performance.mark(name)
    }
  },

  measure: (name: string, startMark: string, endMark?: string) => {
    if (typeof window !== 'undefined' && window.performance?.measure) {
      try {
        performance.measure(name, startMark, endMark)
        const entries = performance.getEntriesByName(name, 'measure')
        const entry = entries[entries.length - 1]
        if (entry) {
          log.performance(name, entry.duration)
          return entry.duration
        }
      } catch (error) {
        log.debug('Performance measurement failed', { name, startMark, endMark, error })
      }
    }
    return null
  }
}