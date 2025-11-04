/**
 * Jest-style tests for phone utilities
 *
 * These tests verify the behavior of phone normalization, formatting,
 * and hashing functions. No test runner configuration is needed.
 */

import { normalizeToE164, formatForDisplay, hashPhone } from '../phone'

describe('normalizeToE164', () => {
  test('normalizes US phone number with formatting', () => {
    expect(normalizeToE164('(281) 555-1212', 'US')).toBe('+12815551212')
    expect(normalizeToE164('281-555-1212', 'US')).toBe('+12815551212')
    expect(normalizeToE164('281.555.1212', 'US')).toBe('+12815551212')
    expect(normalizeToE164('281 555 1212', 'US')).toBe('+12815551212')
  })

  test('strips extensions correctly', () => {
    expect(normalizeToE164('281-555-1212 x45', 'US')).toBe('+12815551212')
    expect(normalizeToE164('281-555-1212 ext. 123', 'US')).toBe('+12815551212')
    expect(normalizeToE164('281-555-1212 extension 999', 'US')).toBe('+12815551212')
    expect(normalizeToE164('281-555-1212 #456', 'US')).toBe('+12815551212')
  })

  test('converts vanity numbers correctly', () => {
    expect(normalizeToE164('1-800-FLOWERS', 'US')).toBe('+18003569377')
    expect(normalizeToE164('1-800-CALL-NOW', 'US')).toBe('+18002255669')
    expect(normalizeToE164('281-555-HELP', 'US')).toBe('+12815554357')
  })

  test('handles international numbers', () => {
    expect(normalizeToE164('+44 20 7946 0958', 'GB')).toBe('+442079460958')
    expect(normalizeToE164('020 7946 0958', 'GB')).toBe('+442079460958')
    expect(normalizeToE164('+1 281 555 1212', 'US')).toBe('+12815551212')
  })

  test('returns null for invalid inputs', () => {
    expect(normalizeToE164('123', 'US')).toBe(null)
    expect(normalizeToE164('abc', 'US')).toBe(null)
    expect(normalizeToE164('', 'US')).toBe(null)
    expect(normalizeToE164('   ', 'US')).toBe(null)
    expect(normalizeToE164(null, 'US')).toBe(null)
    expect(normalizeToE164(undefined, 'US')).toBe(null)
  })

  test('uses default country when not specified', () => {
    expect(normalizeToE164('(281) 555-1212')).toBe('+12815551212')
  })

  test('handles edge cases', () => {
    // Too short
    expect(normalizeToE164('555', 'US')).toBe(null)

    // Just punctuation
    expect(normalizeToE164('---...', 'US')).toBe(null)

    // Extension only
    expect(normalizeToE164('x123', 'US')).toBe(null)
  })
})

describe('formatForDisplay', () => {
  test('formats US numbers in national format', () => {
    expect(formatForDisplay('+12815551212')).toBe('(281) 555-1212')
    expect(formatForDisplay('+14155551234')).toBe('(415) 555-1234')
  })

  test('formats Canadian numbers in national format', () => {
    expect(formatForDisplay('+14165551212')).toBe('(416) 555-1212')
  })

  test('formats international numbers in international format', () => {
    expect(formatForDisplay('+442079460958')).toBe('+44 20 7946 0958')
    expect(formatForDisplay('+33140205050')).toBe('+33 1 40 20 50 50')
  })

  test('handles invalid inputs gracefully', () => {
    expect(formatForDisplay('invalid')).toBe('invalid')
    expect(formatForDisplay('123')).toBe('123')
    expect(formatForDisplay('')).toBe('')
    expect(formatForDisplay(null)).toBe('')
    expect(formatForDisplay(undefined)).toBe('')
  })

  test('preserves original string for non-E164 inputs', () => {
    expect(formatForDisplay('(281) 555-1212')).toBe('(281) 555-1212')
    expect(formatForDisplay('not-a-phone')).toBe('not-a-phone')
  })
})

describe('hashPhone', () => {
  test('creates stable hash for same input', async () => {
    const hash1 = await hashPhone('+12815551212')
    const hash2 = await hashPhone('+12815551212')

    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  test('creates different hashes for different inputs', async () => {
    const hash1 = await hashPhone('+12815551212')
    const hash2 = await hashPhone('+14155551234')

    expect(hash1).not.toBe(hash2)
    expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(hash2).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  test('throws error for invalid E.164 format', async () => {
    await expect(hashPhone('123')).rejects.toThrow('valid E.164 format')
    await expect(hashPhone('(281) 555-1212')).rejects.toThrow('valid E.164 format')
    await expect(hashPhone('')).rejects.toThrow('valid E.164 phone number string')
    await expect(hashPhone('+1281555121222222')).rejects.toThrow('invalid phone number')
  })

  test('throws error in browser environment', async () => {
    // Mock browser environment
    const originalWindow = global.window
    global.window = {} as Window & typeof globalThis

    await expect(hashPhone('+12815551212')).rejects.toThrow('server-only')

    // Restore environment
    if (originalWindow === undefined) {
      delete global.window
    } else {
      global.window = originalWindow
    }
  })

  test('validates phone number with libphonenumber', async () => {
    // Valid E.164 format but invalid phone number
    await expect(hashPhone('+1000000000')).rejects.toThrow('invalid phone number')
  })
})

describe('edge cases and integration', () => {
  test('round trip: normalize then format', () => {
    const inputs = [
      '(281) 555-1212',
      '281-555-1212 x45',
      '1-800-FLOWERS',
      '+1 281 555 1212'
    ]

    inputs.forEach(input => {
      const normalized = normalizeToE164(input, 'US')
      if (normalized) {
        const formatted = formatForDisplay(normalized)
        expect(formatted).toBeTruthy()
        expect(formatted).not.toBe(normalized)
      }
    })
  })

  test('normalize then hash', async () => {
    const input = '(281) 555-1212'
    const normalized = normalizeToE164(input, 'US')

    expect(normalized).toBe('+12815551212')

    if (normalized) {
      const hash = await hashPhone(normalized)
      expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/)
    }
  })

  test('consistent behavior across different input styles', () => {
    const variations = [
      '(281) 555-1212',
      '281-555-1212',
      '281.555.1212',
      '281 555 1212',
      '+1-281-555-1212',
      '+1 (281) 555-1212'
    ]

    const normalized = variations.map(v => normalizeToE164(v, 'US'))

    // All should normalize to the same E.164
    normalized.forEach(n => {
      expect(n).toBe('+12815551212')
    })

    // All should format to the same display format
    const formatted = normalized.map(n => n ? formatForDisplay(n) : '')
    formatted.forEach(f => {
      expect(f).toBe('(281) 555-1212')
    })
  })
})