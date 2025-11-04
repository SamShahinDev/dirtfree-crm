/**
 * Phone number utilities for the Dirt Free CRM application.
 *
 * USAGE GUIDELINES:
 * - Always store phone numbers in E.164 format in the database (+12815551212)
 * - Use formatForDisplay() only for UI presentation
 * - Use hashPhone() for PII-safe metrics and logging (server-only)
 *
 * PII POLICY:
 * - Never log raw phone numbers
 * - Use hashed values for analytics and debugging
 * - These utilities do not log any PII data
 */

import { parsePhoneNumber, type CountryCode } from 'libphonenumber-js'

/**
 * Normalizes a phone number input to E.164 format.
 *
 * This function handles various input formats:
 * - Strips all punctuation, spaces, and extensions
 * - Converts vanity letters (A-Z) to digits
 * - Parses using libphonenumber-js with country context
 * - Returns E.164 format if valid, null if invalid
 *
 * @param input - The phone number string to normalize (can be null/undefined)
 * @param defaultCountry - ISO country code for parsing context (defaults to "US")
 * @returns E.164 formatted string or null if invalid/empty
 *
 * @example
 * ```ts
 * normalizeToE164("(281) 555-1212", "US") // "+12815551212"
 * normalizeToE164("281-555-1212 x45", "US") // "+12815551212" (extension stripped)
 * normalizeToE164("1-800-FLOWERS", "US") // "+18003569377"
 * normalizeToE164("123", "US") // null (invalid)
 * normalizeToE164("", "US") // null (empty)
 * normalizeToE164(null, "US") // null
 * ```
 */
export function normalizeToE164(
  input: string | null | undefined,
  defaultCountry: CountryCode = "US"
): string | null {
  // Handle null/undefined/empty inputs
  if (!input || typeof input !== 'string') {
    return null
  }

  // Clean the input string
  let cleaned = input.trim()

  if (cleaned.length === 0) {
    return null
  }

  // Strip extensions (common patterns: x123, ext. 123, #123, extension 123)
  cleaned = cleaned.replace(/\s*(x|ext\.?|extension|#)\s*\d+$/i, '')

  // Convert vanity letters to numbers (A/B/C=2, D/E/F=3, etc.)
  cleaned = cleaned.replace(/[A-Z]/gi, (letter) => {
    const upperLetter = letter.toUpperCase()
    if ('ABC'.includes(upperLetter)) return '2'
    if ('DEF'.includes(upperLetter)) return '3'
    if ('GHI'.includes(upperLetter)) return '4'
    if ('JKL'.includes(upperLetter)) return '5'
    if ('MNO'.includes(upperLetter)) return '6'
    if ('PQRS'.includes(upperLetter)) return '7'
    if ('TUV'.includes(upperLetter)) return '8'
    if ('WXYZ'.includes(upperLetter)) return '9'
    return letter // Keep non-vanity letters as-is
  })

  // Strip all remaining non-digit characters except + at the start
  cleaned = cleaned.replace(/[^\d+]/g, '')

  // Handle empty result after cleaning
  if (cleaned.length === 0) {
    return null
  }

  try {
    // Parse with libphonenumber-js
    const phoneNumber = parsePhoneNumber(cleaned, defaultCountry)

    // Return E.164 format if valid
    if (phoneNumber && phoneNumber.isValid()) {
      return phoneNumber.format('E.164')
    }

    return null
  } catch {
    // Invalid input that couldn't be parsed
    return null
  }
}

/**
 * Formats an E.164 phone number for display in the UI.
 *
 * This function takes a valid E.164 number and formats it for human readability:
 * - US/CA numbers: National format like "(281) 555-1212"
 * - Other countries: International format like "+44 20 7946 0958"
 * - Invalid inputs: Returns the original string unchanged
 *
 * @param e164 - E.164 formatted phone number (can be null/undefined)
 * @param _locale - Locale hint for formatting (optional, defaults to automatic detection)
 * @returns Formatted phone number string for display
 *
 * @example
 * ```ts
 * formatForDisplay("+12815551212") // "(281) 555-1212"
 * formatForDisplay("+442079460958") // "+44 20 7946 0958"
 * formatForDisplay("+12815551212", "en-US") // "(281) 555-1212"
 * formatForDisplay("invalid") // "invalid" (unchanged)
 * formatForDisplay(null) // "" (empty string)
 * formatForDisplay("") // "" (empty string)
 * ```
 */
export function formatForDisplay(
  e164: string | null | undefined
): string {
  // Handle null/undefined/empty inputs
  if (!e164 || typeof e164 !== 'string' || e164.trim().length === 0) {
    return ''
  }

  try {
    // Parse the E.164 number
    const phoneNumber = parsePhoneNumber(e164)

    if (!phoneNumber || !phoneNumber.isValid()) {
      // If not a valid E.164, return original string
      return e164
    }

    // Format based on country
    const country = phoneNumber.country

    if (country === 'US' || country === 'CA') {
      // Use national format for US/Canada: (281) 555-1212
      return phoneNumber.formatNational()
    } else {
      // Use international format for other countries: +44 20 7946 0958
      return phoneNumber.formatInternational()
    }
  } catch {
    // If parsing fails, return original string
    return e164
  }
}

/**
 * Creates a SHA-256 hash of an E.164 phone number for PII-safe storage and logging.
 *
 * This function is SERVER-ONLY and will throw if called in a browser environment.
 * The hash is deterministic and can be used for:
 * - PII-safe logging and metrics
 * - Duplicate detection without storing raw numbers
 * - Analytics and reporting
 *
 * @param e164 - Valid E.164 formatted phone number
 * @returns Promise resolving to "sha256:<lowercase_hex>" format
 * @throws Error if called in browser environment
 * @throws Error if e164 is not a valid E.164 number
 *
 * @example
 * ```ts
 * // Server-side only
 * await hashPhone("+12815551212") // "sha256:a1b2c3d4e5f6..."
 *
 * // Browser throws error
 * await hashPhone("+12815551212") // throws Error
 * ```
 */
export async function hashPhone(e164: string): Promise<string> {
  // Defense-in-depth: Ensure this is never called in browser
  if (typeof window !== 'undefined') {
    throw new Error('hashPhone() is server-only and cannot be called in the browser')
  }

  // Validate input is a string
  if (!e164 || typeof e164 !== 'string') {
    throw new Error('hashPhone() requires a valid E.164 phone number string')
  }

  // Validate it's a proper E.164 format
  if (!e164.startsWith('+') || !/^\+\d{7,15}$/.test(e164)) {
    throw new Error('hashPhone() requires a valid E.164 format (+1234567890)')
  }

  // Additional validation with libphonenumber-js
  try {
    const phoneNumber = parsePhoneNumber(e164)
    if (!phoneNumber || !phoneNumber.isValid()) {
      throw new Error('hashPhone() received an invalid phone number')
    }
  } catch {
    throw new Error('hashPhone() received an invalid phone number')
  }

  // Import crypto module (Node.js only)
  const { createHash } = await import('crypto')

  // Create deterministic hash
  const hash = createHash('sha256')
  hash.update(e164, 'utf8')
  const hexHash = hash.digest('hex').toLowerCase()

  return `sha256:${hexHash}`
}