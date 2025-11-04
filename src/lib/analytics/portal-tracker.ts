/**
 * Portal Analytics Tracker
 *
 * Client-side utilities for tracking portal events.
 * Provides convenient methods for common tracking scenarios.
 */

/**
 * Event types that can be tracked
 */
export type PortalEventType =
  | 'login'
  | 'logout'
  | 'page_view'
  | 'feature_usage'
  | 'booking_initiated'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'invoice_viewed'
  | 'invoice_downloaded'
  | 'message_sent'
  | 'message_viewed'
  | 'notification_clicked'
  | 'profile_updated'
  | 'preferences_updated'
  | 'search'
  | 'error'

/**
 * Track event options
 */
export interface TrackEventOptions {
  eventType: PortalEventType
  page?: string
  feature?: string
  metadata?: Record<string, any>
  valueAmount?: number
  referrer?: string
}

/**
 * Analytics client configuration
 */
export interface AnalyticsConfig {
  apiUrl?: string
  accessToken?: string
  debug?: boolean
  enabled?: boolean
}

/**
 * Portal Analytics Tracker Class
 */
export class PortalAnalyticsTracker {
  private config: Required<AnalyticsConfig>

  constructor(config: AnalyticsConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl || '/api/portal/analytics/track',
      accessToken: config.accessToken || '',
      debug: config.debug ?? false,
      enabled: config.enabled ?? true,
    }
  }

  /**
   * Update configuration
   */
  configure(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Set access token
   */
  setAccessToken(token: string): void {
    this.config.accessToken = token
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }

  /**
   * Track a custom event
   */
  async track(options: TrackEventOptions): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    try {
      const { eventType, page, feature, metadata, valueAmount, referrer } = options

      const body = {
        eventType,
        page,
        feature,
        metadata,
        valueAmount,
        referrer: referrer || (typeof window !== 'undefined' ? document.referrer : undefined),
      }

      if (this.config.debug) {
        console.log('[Portal Analytics] Tracking event:', body)
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (this.config.accessToken) {
        headers['X-Portal-Token'] = this.config.accessToken
      }

      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok && this.config.debug) {
        console.error('[Portal Analytics] Tracking failed:', response.statusText)
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('[Portal Analytics] Tracking error:', error)
      }
    }
  }

  /**
   * Track page view
   */
  async trackPageView(page: string, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'page_view',
      page,
      metadata,
    })
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(feature: string, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'feature_usage',
      feature,
      metadata,
    })
  }

  /**
   * Track login
   */
  async trackLogin(metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'login',
      metadata,
    })
  }

  /**
   * Track logout
   */
  async trackLogout(metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'logout',
      metadata,
    })
  }

  /**
   * Track booking initiated
   */
  async trackBookingInitiated(valueAmount?: number, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'booking_initiated',
      valueAmount,
      metadata,
    })
  }

  /**
   * Track booking completed
   */
  async trackBookingCompleted(valueAmount: number, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'booking_completed',
      valueAmount,
      metadata,
    })
  }

  /**
   * Track booking cancelled
   */
  async trackBookingCancelled(metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'booking_cancelled',
      metadata,
    })
  }

  /**
   * Track payment initiated
   */
  async trackPaymentInitiated(valueAmount: number, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'payment_initiated',
      valueAmount,
      metadata,
    })
  }

  /**
   * Track payment completed
   */
  async trackPaymentCompleted(valueAmount: number, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'payment_completed',
      valueAmount,
      metadata,
    })
  }

  /**
   * Track payment failed
   */
  async trackPaymentFailed(metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'payment_failed',
      metadata,
    })
  }

  /**
   * Track invoice viewed
   */
  async trackInvoiceViewed(invoiceId: string, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'invoice_viewed',
      metadata: { invoiceId, ...metadata },
    })
  }

  /**
   * Track invoice downloaded
   */
  async trackInvoiceDownloaded(invoiceId: string, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'invoice_downloaded',
      metadata: { invoiceId, ...metadata },
    })
  }

  /**
   * Track message sent
   */
  async trackMessageSent(threadId?: string, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'message_sent',
      metadata: { threadId, ...metadata },
    })
  }

  /**
   * Track message viewed
   */
  async trackMessageViewed(threadId: string, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'message_viewed',
      metadata: { threadId, ...metadata },
    })
  }

  /**
   * Track notification clicked
   */
  async trackNotificationClicked(notificationId: string, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'notification_clicked',
      metadata: { notificationId, ...metadata },
    })
  }

  /**
   * Track profile updated
   */
  async trackProfileUpdated(metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'profile_updated',
      metadata,
    })
  }

  /**
   * Track preferences updated
   */
  async trackPreferencesUpdated(metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'preferences_updated',
      metadata,
    })
  }

  /**
   * Track search
   */
  async trackSearch(query: string, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'search',
      metadata: { query, ...metadata },
    })
  }

  /**
   * Track error
   */
  async trackError(errorMessage: string, metadata?: Record<string, any>): Promise<void> {
    return this.track({
      eventType: 'error',
      metadata: { error: errorMessage, ...metadata },
    })
  }
}

/**
 * Create a new analytics tracker instance
 */
export function createPortalTracker(config?: AnalyticsConfig): PortalAnalyticsTracker {
  return new PortalAnalyticsTracker(config)
}

/**
 * Global tracker instance (singleton pattern)
 */
let globalTracker: PortalAnalyticsTracker | null = null

/**
 * Get global tracker instance
 */
export function getGlobalTracker(): PortalAnalyticsTracker {
  if (!globalTracker) {
    globalTracker = createPortalTracker()
  }
  return globalTracker
}

/**
 * Initialize global tracker with configuration
 */
export function initializeAnalytics(config: AnalyticsConfig): PortalAnalyticsTracker {
  globalTracker = createPortalTracker(config)
  return globalTracker
}

/**
 * Convenience method to track page view using global tracker
 */
export async function trackPageView(page: string, metadata?: Record<string, any>): Promise<void> {
  return getGlobalTracker().trackPageView(page, metadata)
}

/**
 * Convenience method to track feature usage using global tracker
 */
export async function trackFeature(feature: string, metadata?: Record<string, any>): Promise<void> {
  return getGlobalTracker().trackFeatureUsage(feature, metadata)
}
