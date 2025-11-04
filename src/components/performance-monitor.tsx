'use client'

import { useEffect, useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'

interface PerformanceMetrics {
  // Navigation timing
  domContentLoaded?: number
  loadComplete?: number
  domInteractive?: number
  // Core Web Vitals
  firstContentfulPaint?: number
  largestContentfulPaint?: number
  firstInputDelay?: number
  cumulativeLayoutShift?: number
  timeToInteractive?: number
  // Resource timing
  resourceCount?: number
  totalResourceSize?: number
  totalResourceDuration?: number
  // Memory usage
  memoryUsed?: number
  memoryLimit?: number
}

interface PerformanceMonitorProps {
  enabled?: boolean
  reportToConsole?: boolean
  reportToAnalytics?: boolean
  onMetrics?: (metrics: PerformanceMetrics) => void
  showVisualIndicator?: boolean
}

export function PerformanceMonitor({
  enabled = process.env.NODE_ENV === 'development',
  reportToConsole = true,
  reportToAnalytics = false,
  onMetrics,
  showVisualIndicator = false
}: PerformanceMonitorProps) {
  const pathname = usePathname()
  const [metrics, setMetrics] = useState<PerformanceMetrics>({})
  const [isVisible, setIsVisible] = useState(false)

  // Measure Core Web Vitals
  const measureWebVitals = useCallback(() => {
    if (typeof window === 'undefined' || !window.performance) return

    const metrics: PerformanceMetrics = {}

    // Navigation timing
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigationTiming) {
      metrics.domContentLoaded = navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart
      metrics.loadComplete = navigationTiming.loadEventEnd - navigationTiming.loadEventStart
      metrics.domInteractive = navigationTiming.domInteractive
    }

    // First Contentful Paint
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0]
    if (fcpEntry) {
      metrics.firstContentfulPaint = fcpEntry.startTime
    }

    // Largest Contentful Paint
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const lastEntry = entries[entries.length - 1] as any
      metrics.largestContentfulPaint = lastEntry.renderTime || lastEntry.loadTime
    })

    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch (e) {
      // LCP observer not supported
    }

    // Cumulative Layout Shift
    let clsValue = 0
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
        }
      }
      metrics.cumulativeLayoutShift = clsValue
    })

    try {
      clsObserver.observe({ type: 'layout-shift', buffered: true })
    } catch (e) {
      // CLS observer not supported
    }

    // Resource timing
    const resourceEntries = performance.getEntriesByType('resource')
    metrics.resourceCount = resourceEntries.length
    metrics.totalResourceSize = resourceEntries.reduce((total, entry: any) => {
      return total + (entry.transferSize || 0)
    }, 0)
    metrics.totalResourceDuration = resourceEntries.reduce((total, entry) => {
      return total + entry.duration
    }, 0)

    // Memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory
      metrics.memoryUsed = memory.usedJSHeapSize / 1048576 // Convert to MB
      metrics.memoryLimit = memory.jsHeapSizeLimit / 1048576
    }

    return metrics
  }, [])

  // Log metrics
  const logMetrics = useCallback((metrics: PerformanceMetrics) => {
    if (reportToConsole) {
      console.group('🚀 Performance Metrics')
      console.table({
        'DOM Content Loaded': `${metrics.domContentLoaded?.toFixed(2)}ms`,
        'Page Load Complete': `${metrics.loadComplete?.toFixed(2)}ms`,
        'First Contentful Paint': `${metrics.firstContentfulPaint?.toFixed(2)}ms`,
        'Largest Contentful Paint': `${metrics.largestContentfulPaint?.toFixed(2)}ms`,
        'Cumulative Layout Shift': metrics.cumulativeLayoutShift?.toFixed(3),
        'Resources Loaded': metrics.resourceCount,
        'Total Resource Size': `${((metrics.totalResourceSize || 0) / 1024).toFixed(2)}KB`,
        'Memory Used': `${metrics.memoryUsed?.toFixed(2)}MB / ${metrics.memoryLimit?.toFixed(2)}MB`
      })
      console.groupEnd()
    }

    if (reportToAnalytics) {
      // Send to analytics service
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'web_vitals', {
          event_category: 'Performance',
          event_label: pathname,
          value: metrics.largestContentfulPaint,
          fcp: metrics.firstContentfulPaint,
          lcp: metrics.largestContentfulPaint,
          cls: metrics.cumulativeLayoutShift
        })
      }
    }

    onMetrics?.(metrics)
  }, [reportToConsole, reportToAnalytics, pathname, onMetrics])

  // Monitor on page load
  useEffect(() => {
    if (!enabled) return

    const handleLoad = () => {
      setTimeout(() => {
        const metrics = measureWebVitals()
        if (metrics) {
          setMetrics(metrics)
          logMetrics(metrics)
        }
      }, 100) // Small delay to ensure all metrics are available
    }

    if (document.readyState === 'complete') {
      handleLoad()
    } else {
      window.addEventListener('load', handleLoad)
      return () => window.removeEventListener('load', handleLoad)
    }
  }, [enabled, measureWebVitals, logMetrics])

  // Monitor route changes
  useEffect(() => {
    if (!enabled) return

    // Reset metrics on route change
    setMetrics({})

    // Measure new page after navigation
    setTimeout(() => {
      const metrics = measureWebVitals()
      if (metrics) {
        setMetrics(metrics)
        logMetrics(metrics)
      }
    }, 500)
  }, [pathname, enabled, measureWebVitals, logMetrics])

  // Visual indicator
  if (!showVisualIndicator || !enabled) {
    return null
  }

  const getPerformanceColor = () => {
    const lcp = metrics.largestContentfulPaint
    if (!lcp) return 'bg-gray-500'
    if (lcp < 2500) return 'bg-green-500' // Good
    if (lcp < 4000) return 'bg-yellow-500' // Needs improvement
    return 'bg-red-500' // Poor
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <div className="relative">
        {/* Performance indicator dot */}
        <div className={`w-3 h-3 rounded-full ${getPerformanceColor()} cursor-pointer`} />

        {/* Metrics popup */}
        {isVisible && (
          <div className="absolute bottom-6 right-0 bg-white shadow-lg rounded-lg p-4 w-64 border border-gray-200">
            <h3 className="font-semibold text-sm mb-2">Performance Metrics</h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>FCP:</span>
                <span>{metrics.firstContentfulPaint?.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>LCP:</span>
                <span>{metrics.largestContentfulPaint?.toFixed(0)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>CLS:</span>
                <span>{metrics.cumulativeLayoutShift?.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span>Resources:</span>
                <span>{metrics.resourceCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Memory:</span>
                <span>{metrics.memoryUsed?.toFixed(1)}MB</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Hook to measure component render performance
export function useRenderPerformance(componentName: string) {
  useEffect(() => {
    const startTime = performance.now()

    return () => {
      const renderTime = performance.now() - startTime
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${componentName} render time: ${renderTime.toFixed(2)}ms`)
      }
    }
  }, [componentName])
}

// Hook to measure API call performance
export function useApiPerformance() {
  const measureApiCall = useCallback((url: string, startTime: number) => {
    const duration = performance.now() - startTime

    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Performance] ${url}: ${duration.toFixed(2)}ms`)
    }

    // Track slow API calls
    if (duration > 1000) {
      console.warn(`[Slow API] ${url} took ${duration.toFixed(2)}ms`)
    }

    return duration
  }, [])

  return { measureApiCall }
}