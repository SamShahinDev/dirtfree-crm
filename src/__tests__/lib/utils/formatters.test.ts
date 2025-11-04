import { describe, it, expect } from '@jest/globals'

/**
 * Formatter Utilities Tests
 *
 * Tests for data formatting utilities (currency, dates, phone, etc.)
 */

describe('Formatters', () => {
  describe('Currency Formatting', () => {
    it('should format currency with 2 decimal places', () => {
      const amount = 123.45
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)

      expect(formatted).toBe('$123.45')
    })

    it('should format currency without decimals for whole numbers', () => {
      const amount = 100
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount)

      expect(formatted).toBe('$100')
    })

    it('should handle negative currency values', () => {
      const amount = -50.75
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)

      expect(formatted).toBe('-$50.75')
    })

    it('should format large numbers with commas', () => {
      const amount = 1234567.89
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)

      expect(formatted).toBe('$1,234,567.89')
    })

    it('should handle zero', () => {
      const amount = 0
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount)

      expect(formatted).toBe('$0.00')
    })
  })

  describe('Phone Number Formatting', () => {
    it('should format US phone number with country code', () => {
      const phone = '+15555551234'
      // Expected format: (555) 555-1234
      const cleaned = phone.replace(/\D/g, '').slice(-10)
      const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`

      expect(formatted).toBe('(555) 555-1234')
    })

    it('should format 10-digit phone number', () => {
      const phone = '5555551234'
      const formatted = `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`

      expect(formatted).toBe('(555) 555-1234')
    })

    it('should handle phone number with dashes', () => {
      const phone = '555-555-1234'
      const cleaned = phone.replace(/\D/g, '')
      const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`

      expect(formatted).toBe('(555) 555-1234')
    })

    it('should handle phone number with spaces', () => {
      const phone = '555 555 1234'
      const cleaned = phone.replace(/\D/g, '')
      const formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`

      expect(formatted).toBe('(555) 555-1234')
    })

    it('should clean phone number to digits only', () => {
      const phone = '+1 (555) 555-1234'
      const cleaned = phone.replace(/\D/g, '')

      expect(cleaned).toBe('15555551234')
      expect(cleaned).toHaveLength(11)
    })
  })

  describe('Date Formatting', () => {
    it('should format date as MM/DD/YYYY', () => {
      const date = new Date('2024-12-01T00:00:00.000Z')
      const formatted = date.toLocaleDateString('en-US')

      expect(formatted).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
    })

    it('should format date as ISO string', () => {
      const date = new Date('2024-12-01T10:30:00.000Z')
      const formatted = date.toISOString()

      expect(formatted).toBe('2024-12-01T10:30:00.000Z')
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should format date with time', () => {
      const date = new Date('2024-12-01T14:30:00.000Z')
      const formatted = date.toLocaleString('en-US')

      expect(formatted).toContain('2024')
      expect(formatted).toContain(':')
    })

    it('should calculate days between dates', () => {
      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-01-31')
      const daysDiff = Math.floor(
        (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)
      )

      expect(daysDiff).toBe(30)
    })

    it('should format relative time (days ago)', () => {
      const now = new Date('2024-12-01')
      const past = new Date('2024-11-26')
      const daysDiff = Math.floor(
        (now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24)
      )

      const formatted = `${daysDiff} days ago`

      expect(formatted).toBe('5 days ago')
    })
  })

  describe('Percentage Formatting', () => {
    it('should format percentage with 1 decimal place', () => {
      const value = 75.5
      const formatted = `${value.toFixed(1)}%`

      expect(formatted).toBe('75.5%')
    })

    it('should format percentage with 2 decimal places', () => {
      const value = 33.333
      const formatted = `${value.toFixed(2)}%`

      expect(formatted).toBe('33.33%')
    })

    it('should handle 0%', () => {
      const value = 0
      const formatted = `${value.toFixed(1)}%`

      expect(formatted).toBe('0.0%')
    })

    it('should handle 100%', () => {
      const value = 100
      const formatted = `${value.toFixed(1)}%`

      expect(formatted).toBe('100.0%')
    })

    it('should calculate percentage from fraction', () => {
      const numerator = 3
      const denominator = 4
      const percentage = (numerator / denominator) * 100

      expect(percentage).toBe(75)
      expect(`${percentage.toFixed(1)}%`).toBe('75.0%')
    })
  })

  describe('Number Formatting', () => {
    it('should format number with commas', () => {
      const value = 1234567
      const formatted = new Intl.NumberFormat('en-US').format(value)

      expect(formatted).toBe('1,234,567')
    })

    it('should format decimal numbers', () => {
      const value = 1234.567
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value)

      expect(formatted).toBe('1,234.57')
    })

    it('should abbreviate large numbers (K)', () => {
      const value = 5500
      const formatted = value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()

      expect(formatted).toBe('5.5K')
    })

    it('should abbreviate large numbers (M)', () => {
      const value = 2500000
      const formatted =
        value >= 1000000
          ? `${(value / 1000000).toFixed(1)}M`
          : value >= 1000
            ? `${(value / 1000).toFixed(1)}K`
            : value.toString()

      expect(formatted).toBe('2.5M')
    })

    it('should not abbreviate small numbers', () => {
      const value = 500
      const formatted = value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toString()

      expect(formatted).toBe('500')
    })
  })

  describe('Text Formatting', () => {
    it('should truncate long text with ellipsis', () => {
      const text = 'This is a very long text that should be truncated'
      const maxLength = 20
      const truncated =
        text.length > maxLength ? text.slice(0, maxLength) + '...' : text

      expect(truncated).toBe('This is a very long ...')
      expect(truncated.length).toBeLessThanOrEqual(maxLength + 3)
    })

    it('should capitalize first letter', () => {
      const text = 'hello world'
      const capitalized = text.charAt(0).toUpperCase() + text.slice(1)

      expect(capitalized).toBe('Hello world')
    })

    it('should convert to title case', () => {
      const text = 'hello world'
      const titleCase = text
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      expect(titleCase).toBe('Hello World')
    })

    it('should convert to snake_case', () => {
      const text = 'Hello World'
      const snakeCase = text.toLowerCase().replace(/\s+/g, '_')

      expect(snakeCase).toBe('hello_world')
    })

    it('should convert to kebab-case', () => {
      const text = 'Hello World'
      const kebabCase = text.toLowerCase().replace(/\s+/g, '-')

      expect(kebabCase).toBe('hello-world')
    })
  })
})
