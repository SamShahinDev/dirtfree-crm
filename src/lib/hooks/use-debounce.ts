'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * Hook that debounces a value with a specified delay.
 * Enhanced version with immediate mode option.
 */
export function useDebounce<T>(value: T, delay: number, immediate?: boolean): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (immediate && !timeoutRef.current) {
      setDebouncedValue(value)
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [value, delay, immediate])

  return debouncedValue
}

/**
 * Hook that returns a debounced callback function
 * Useful for event handlers
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const callbackRef = useRef(callback)

  // Update callback ref on each render
  callbackRef.current = callback

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [delay]
  )
}

/**
 * Hook for search functionality with debouncing
 */
export function useSearchDebounce(
  initialValue: string = '',
  delay: number = 300,
  minLength: number = 2
) {
  const [searchTerm, setSearchTerm] = useState(initialValue)
  const debouncedValue = useDebounce(searchTerm, delay)

  // Only return debounced value if it meets minimum length
  const effectiveValue = debouncedValue.length >= minLength ? debouncedValue : ''

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm: effectiveValue,
    isDebouncing: searchTerm !== debouncedValue,
    clear: () => setSearchTerm('')
  }
}

/**
 * Hook that throttles a value or function
 * Useful for scroll events or frequent updates
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastExecuted = useRef<number>(Date.now())

  useEffect(() => {
    if (Date.now() >= lastExecuted.current + interval) {
      lastExecuted.current = Date.now()
      setThrottledValue(value)
    } else {
      const timerId = setTimeout(() => {
        lastExecuted.current = Date.now()
        setThrottledValue(value)
      }, interval)

      return () => clearTimeout(timerId)
    }
  }, [value, interval])

  return throttledValue
}

/**
 * Hook for input validation with debouncing
 */
export function useDebouncedValidation<T>(
  value: T,
  validate: (value: T) => string | null | Promise<string | null>,
  delay: number = 500
) {
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const debouncedValue = useDebounce(value, delay)

  useEffect(() => {
    let cancelled = false

    async function performValidation() {
      if (!debouncedValue) {
        setError(null)
        return
      }

      setIsValidating(true)

      try {
        const validationError = await validate(debouncedValue)
        if (!cancelled) {
          setError(validationError)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Validation failed')
        }
      } finally {
        if (!cancelled) {
          setIsValidating(false)
        }
      }
    }

    performValidation()

    return () => {
      cancelled = true
    }
  }, [debouncedValue, validate])

  return {
    error,
    isValidating,
    isValid: !error && !isValidating
  }
}

/**
 * Hook for API requests with debouncing
 */
export function useDebouncedRequest<T, R>(
  value: T,
  fetcher: (value: T) => Promise<R>,
  delay: number = 300,
  enabled: boolean = true
) {
  const [data, setData] = useState<R | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const debouncedValue = useDebounce(value, delay)
  const abortControllerRef = useRef<AbortController>()

  useEffect(() => {
    if (!enabled || !debouncedValue) {
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()

    async function fetchData() {
      setIsLoading(true)
      setError(null)

      try {
        const result = await fetcher(debouncedValue)
        setData(result)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err)
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [debouncedValue, fetcher, enabled])

  return {
    data,
    error,
    isLoading,
    refetch: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      // Trigger refetch by updating deps
    }
  }
}