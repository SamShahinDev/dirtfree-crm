import * as Sentry from "@sentry/nextjs"

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: any
}

export interface LogMeta {
  timestamp: string
  level: LogLevel
  service: string
  environment: string
  userId?: string
  requestId?: string
  component?: string
  action?: string
}

class Logger {
  private service = 'dirt-free-crm'
  private environment = process.env.NODE_ENV || 'development'

  private formatMessage(level: LogLevel, message: string, context?: LogContext): LogMeta & { message: string; context?: LogContext } {
    return {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      message,
      context,
      ...context // Spread context for easier access to fields like userId, requestId, etc.
    }
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, don't log debug messages
    if (this.environment === 'production' && level === 'debug') {
      return false
    }
    return true
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return

    const logEntry = this.formatMessage(level, message, context)

    // Console logging with structured format
    if (this.environment === 'development') {
      // Pretty logging for development
      const emoji = {
        debug: '🐛',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      }[level]

      console[level === 'debug' ? 'log' : level](
        `${emoji} [${logEntry.timestamp}] ${message}`,
        context || ''
      )
    } else {
      // JSON logging for production
      console.log(JSON.stringify(logEntry))
    }

    // Send to Sentry for warn/error levels
    if (level === 'error') {
      Sentry.captureException(new Error(message), {
        tags: {
          level,
          component: context?.component,
          action: context?.action,
        },
        extra: context,
        user: context?.userId ? { id: context.userId } : undefined,
      })
    } else if (level === 'warn') {
      Sentry.captureMessage(message, 'warning')
      Sentry.addBreadcrumb({
        message,
        level: 'warning',
        data: context,
      })
    } else if (level === 'info') {
      // Add breadcrumb for info level
      Sentry.addBreadcrumb({
        message,
        level: 'info',
        data: context,
      })
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context)
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context)
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context)
  }

  // Convenience method for API errors
  apiError(endpoint: string, error: Error, context?: LogContext) {
    this.error(`API Error: ${endpoint}`, {
      endpoint,
      error: error.message,
      stack: error.stack,
      ...context
    })
  }

  // Convenience method for database errors
  dbError(operation: string, error: Error, context?: LogContext) {
    this.error(`Database Error: ${operation}`, {
      operation,
      error: error.message,
      stack: error.stack,
      ...context
    })
  }

  // Convenience method for user actions
  userAction(action: string, context?: LogContext) {
    this.info(`User Action: ${action}`, {
      action,
      ...context
    })
  }

  // Performance logging
  performance(operation: string, duration: number, context?: LogContext) {
    const level = duration > 5000 ? 'warn' : 'info' // Warn for operations taking > 5 seconds
    this.log(level, `Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      ...context
    })
  }

  // Create a child logger with common context
  child(context: LogContext): Logger {
    const childLogger = new Logger()
    const originalLog = childLogger.log.bind(childLogger)

    childLogger.log = (level: LogLevel, message: string, additionalContext?: LogContext) => {
      originalLog(level, message, { ...context, ...additionalContext })
    }

    return childLogger
  }
}

// Export singleton instance
export const log = new Logger()

// Export for creating child loggers
export { Logger }

// Common context builders
export const createRequestContext = (req: Request): LogContext => ({
  requestId: crypto.randomUUID(),
  method: req.method,
  url: req.url,
  userAgent: req.headers.get('user-agent'),
})

export const createUserContext = (userId: string): LogContext => ({
  userId,
})

export const createComponentContext = (component: string): LogContext => ({
  component,
})