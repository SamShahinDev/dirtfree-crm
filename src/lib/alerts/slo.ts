/**
 * SLO evaluation and monitoring utilities
 * Provides helpers for tracking and evaluating service level objectives
 */

import { log, createComponentContext } from '@/lib/obs/log'

const logger = log.child(createComponentContext('SLOEvaluation'))

export interface SloTargets {
  reminderDelivery: number
  inboundVerifyErrorRate: number
  apiP95Ms: number
}

export interface SloMetrics {
  reminderDelivery: number
  inboundVerifyErrorRate: number
  apiP95Ms: number
}

export interface SloEvaluation {
  slo: string
  target: number
  actual: number
  healthy: boolean
  breach: boolean
}

export interface RollingWindow<T> {
  values: Array<{ timestamp: Date; value: T }>
  maxAge: number // milliseconds
}

/**
 * Check if a ratio is under the target threshold
 */
export function isUnderTarget(ratio: number, target: number): boolean {
  return ratio < target
}

/**
 * Check if a metric exceeds the maximum allowed value
 */
export function isOverLimit(value: number, limit: number): boolean {
  return value > limit
}

/**
 * Check if API p95 latency exceeded the limit
 */
export function p95Exceeded(p95: number, limit: number): boolean {
  return isOverLimit(p95, limit)
}

/**
 * Get SLO targets from environment variables
 */
export function getSloTargets(): SloTargets {
  return {
    reminderDelivery: parseFloat(process.env.SLO_REMINDER_DELIVERY_TARGET || '0.97'),
    inboundVerifyErrorRate: parseFloat(process.env.SLO_SMS_INBOUND_VERIFY_ERROR_RATE_MAX || '0.02'),
    apiP95Ms: parseInt(process.env.SLO_API_P95_MS || '800')
  }
}

/**
 * Evaluate all SLOs against current metrics
 */
export function evaluateSlos(metrics: SloMetrics, targets: SloTargets): SloEvaluation[] {
  const evaluations: SloEvaluation[] = [
    {
      slo: 'reminderDelivery',
      target: targets.reminderDelivery,
      actual: metrics.reminderDelivery,
      healthy: !isUnderTarget(metrics.reminderDelivery, targets.reminderDelivery),
      breach: isUnderTarget(metrics.reminderDelivery, targets.reminderDelivery)
    },
    {
      slo: 'inboundVerifyErrorRate',
      target: targets.inboundVerifyErrorRate,
      actual: metrics.inboundVerifyErrorRate,
      healthy: !isOverLimit(metrics.inboundVerifyErrorRate, targets.inboundVerifyErrorRate),
      breach: isOverLimit(metrics.inboundVerifyErrorRate, targets.inboundVerifyErrorRate)
    },
    {
      slo: 'apiP95Ms',
      target: targets.apiP95Ms,
      actual: metrics.apiP95Ms,
      healthy: !p95Exceeded(metrics.apiP95Ms, targets.apiP95Ms),
      breach: p95Exceeded(metrics.apiP95Ms, targets.apiP95Ms)
    }
  ]

  logger.debug('SLO evaluation completed', {
    totalSlos: evaluations.length,
    healthySlos: evaluations.filter(e => e.healthy).length,
    breachedSlos: evaluations.filter(e => e.breach).map(e => e.slo)
  })

  return evaluations
}

/**
 * Get breached SLOs from evaluations
 */
export function getBreachedSlos(evaluations: SloEvaluation[]): string[] {
  return evaluations.filter(e => e.breach).map(e => e.slo)
}

/**
 * Get healthy SLOs from evaluations
 */
export function getHealthySlos(evaluations: SloEvaluation[]): string[] {
  return evaluations.filter(e => e.healthy).map(e => e.slo)
}

/**
 * Create a rolling window data structure
 */
export function createRollingWindow<T>(maxAgeMs: number): RollingWindow<T> {
  return {
    values: [],
    maxAge: maxAgeMs
  }
}

/**
 * Add a value to a rolling window
 */
export function addToWindow<T>(window: RollingWindow<T>, value: T, timestamp: Date = new Date()): void {
  // Add new value
  window.values.push({ timestamp, value })

  // Remove old values
  cleanWindow(window, timestamp)
}

/**
 * Clean old values from a rolling window
 */
export function cleanWindow<T>(window: RollingWindow<T>, now: Date = new Date()): void {
  const cutoff = new Date(now.getTime() - window.maxAge)
  window.values = window.values.filter(entry => entry.timestamp >= cutoff)
}

/**
 * Get all values from a rolling window
 */
export function getWindowValues<T>(window: RollingWindow<T>): T[] {
  cleanWindow(window)
  return window.values.map(entry => entry.value)
}

/**
 * Calculate p95 from a rolling window of numbers
 */
export function calculateP95(window: RollingWindow<number>): number {
  const values = getWindowValues(window)

  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(sorted.length * 0.95) - 1
  return sorted[Math.max(0, index)]
}

/**
 * Calculate average from a rolling window of numbers
 */
export function calculateAverage(window: RollingWindow<number>): number {
  const values = getWindowValues(window)

  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Calculate success rate from a rolling window of booleans
 */
export function calculateSuccessRate(window: RollingWindow<boolean>): number {
  const values = getWindowValues(window)

  if (values.length === 0) {
    return 1 // Assume success if no data
  }

  const successes = values.filter(v => v).length
  return successes / values.length
}

/**
 * Calculate error rate from a rolling window of booleans
 */
export function calculateErrorRate(window: RollingWindow<boolean>): number {
  return 1 - calculateSuccessRate(window)
}

/**
 * In-memory storage for rolling windows (resets on server restart)
 */
class WindowStorage {
  private windows: Map<string, RollingWindow<any>> = new Map()

  getWindow<T>(key: string, maxAgeMs: number): RollingWindow<T> {
    if (!this.windows.has(key)) {
      this.windows.set(key, createRollingWindow<T>(maxAgeMs))
    }
    return this.windows.get(key)!
  }

  addValue<T>(key: string, value: T, maxAgeMs: number, timestamp?: Date): void {
    const window = this.getWindow<T>(key, maxAgeMs)
    addToWindow(window, value, timestamp)
  }

  getValues<T>(key: string, maxAgeMs: number): T[] {
    const window = this.getWindow<T>(key, maxAgeMs)
    return getWindowValues(window)
  }

  calculateP95(key: string, maxAgeMs: number): number {
    const window = this.getWindow<number>(key, maxAgeMs)
    return calculateP95(window)
  }

  calculateSuccessRate(key: string, maxAgeMs: number): number {
    const window = this.getWindow<boolean>(key, maxAgeMs)
    return calculateSuccessRate(window)
  }

  calculateErrorRate(key: string, maxAgeMs: number): number {
    const window = this.getWindow<boolean>(key, maxAgeMs)
    return calculateErrorRate(window)
  }

  clear(): void {
    this.windows.clear()
  }

  getWindowCount(): number {
    return this.windows.size
  }
}

// Global instance for in-memory storage
export const windowStorage = new WindowStorage()

/**
 * Record API latency for P95 calculation
 */
export function recordApiLatency(endpoint: string, latencyMs: number): void {
  const maxAge = 5 * 60 * 1000 // 5 minutes
  windowStorage.addValue(`api_latency_${endpoint}`, latencyMs, maxAge)

  logger.debug('API latency recorded', {
    endpoint,
    latencyMs,
    currentP95: windowStorage.calculateP95(`api_latency_${endpoint}`, maxAge)
  })
}

/**
 * Record inbound verification outcome
 */
export function recordInboundVerification(success: boolean): void {
  const maxAge = 5 * 60 * 1000 // 5 minutes
  windowStorage.addValue('inbound_verification', success, maxAge)

  logger.debug('Inbound verification recorded', {
    success,
    currentErrorRate: windowStorage.calculateErrorRate('inbound_verification', maxAge)
  })
}

/**
 * Get current API P95 latency
 */
export function getCurrentApiP95(endpoint?: string): number {
  const maxAge = 5 * 60 * 1000 // 5 minutes
  const key = endpoint ? `api_latency_${endpoint}` : 'api_latency_global'
  return windowStorage.calculateP95(key, maxAge)
}

/**
 * Get current inbound verification error rate
 */
export function getCurrentInboundErrorRate(): number {
  const maxAge = 5 * 60 * 1000 // 5 minutes
  return windowStorage.calculateErrorRate('inbound_verification', maxAge)
}

/**
 * Format SLO metric for display
 */
export function formatSloMetric(slo: string, value: number): string {
  switch (slo) {
    case 'reminderDelivery':
      return `${(value * 100).toFixed(1)}%`
    case 'inboundVerifyErrorRate':
      return `${(value * 100).toFixed(2)}%`
    case 'apiP95Ms':
      return `${Math.round(value)}ms`
    default:
      return String(value)
  }
}

/**
 * Get SLO display name
 */
export function getSloDisplayName(slo: string): string {
  switch (slo) {
    case 'reminderDelivery':
      return 'Reminder Delivery Rate'
    case 'inboundVerifyErrorRate':
      return 'Inbound Verify Error Rate'
    case 'apiP95Ms':
      return 'API P95 Latency'
    default:
      return slo
  }
}