/**
 * Input Sanitization and Validation
 *
 * Provides validation schemas and sanitization functions to prevent
 * injection attacks and ensure data integrity.
 *
 * @module lib/security/sanitize
 */

import { z } from 'zod'

/**
 * Common validation schemas for reuse across the application
 */
export const schemas = {
  /**
   * Email address (max 255 characters)
   */
  email: z.string().email().max(255).trim().toLowerCase(),

  /**
   * Phone number in E.164 format (+1234567890)
   */
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, {
    message: 'Invalid phone number format. Use E.164 format (+1234567890)',
  }),

  /**
   * US phone number
   */
  phoneUS: z.string().regex(/^\+1\d{10}$/, {
    message: 'Invalid US phone number. Use format +15551234567',
  }),

  /**
   * Currency amount (positive, up to 999,999.99)
   */
  currency: z
    .number()
    .positive('Amount must be positive')
    .max(999999.99, 'Amount too large')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),

  /**
   * Percentage (0-100)
   */
  percentage: z.number().min(0, 'Percentage must be at least 0').max(100, 'Percentage cannot exceed 100'),

  /**
   * Generic text field (max 10,000 characters)
   */
  text: z.string().max(10000, 'Text too long (max 10,000 characters)').trim(),

  /**
   * Short text field (max 255 characters)
   */
  shortText: z.string().max(255, 'Text too long (max 255 characters)').trim(),

  /**
   * Long text field (max 50,000 characters)
   */
  longText: z.string().max(50000, 'Text too long (max 50,000 characters)').trim(),

  /**
   * UUID
   */
  id: z.string().uuid('Invalid ID format'),

  /**
   * URL
   */
  url: z.string().url('Invalid URL format').max(2048, 'URL too long'),

  /**
   * Date string (ISO 8601)
   */
  date: z.string().datetime({ message: 'Invalid date format. Use ISO 8601' }),

  /**
   * Postal code (US)
   */
  postalCodeUS: z.string().regex(/^\d{5}(-\d{4})?$/, {
    message: 'Invalid US postal code. Use 12345 or 12345-6789 format',
  }),

  /**
   * Postal code (generic, alphanumeric)
   */
  postalCode: z.string().max(10).regex(/^[A-Za-z0-9\s-]+$/, {
    message: 'Invalid postal code format',
  }),

  /**
   * US State abbreviation
   */
  stateUS: z
    .string()
    .length(2, 'State must be 2 characters')
    .regex(/^[A-Z]{2}$/, 'State must be uppercase letters')
    .refine(
      (val) =>
        [
          'AL',
          'AK',
          'AZ',
          'AR',
          'CA',
          'CO',
          'CT',
          'DE',
          'FL',
          'GA',
          'HI',
          'ID',
          'IL',
          'IN',
          'IA',
          'KS',
          'KY',
          'LA',
          'ME',
          'MD',
          'MA',
          'MI',
          'MN',
          'MS',
          'MO',
          'MT',
          'NE',
          'NV',
          'NH',
          'NJ',
          'NM',
          'NY',
          'NC',
          'ND',
          'OH',
          'OK',
          'OR',
          'PA',
          'RI',
          'SC',
          'SD',
          'TN',
          'TX',
          'UT',
          'VT',
          'VA',
          'WA',
          'WV',
          'WI',
          'WY',
          'DC',
        ].includes(val),
      'Invalid US state code'
    ),

  /**
   * Alphanumeric string
   */
  alphanumeric: z.string().regex(/^[A-Za-z0-9]+$/, 'Must contain only letters and numbers'),

  /**
   * Slug (URL-friendly identifier)
   */
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'Slug must be lowercase letters, numbers, and hyphens',
    }),

  /**
   * Hex color code
   */
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color format. Use #RRGGBB'),

  /**
   * Integer
   */
  integer: z.number().int('Must be an integer'),

  /**
   * Positive integer
   */
  positiveInteger: z.number().int().positive('Must be a positive integer'),

  /**
   * Non-negative integer (0 or greater)
   */
  nonNegativeInteger: z.number().int().nonnegative('Must be zero or greater'),

  /**
   * Latitude (-90 to 90)
   */
  latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),

  /**
   * Longitude (-180 to 180)
   */
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
}

/**
 * Sanitize HTML input by escaping special characters
 *
 * Prevents XSS attacks by converting HTML entities.
 *
 * @param input - The string to sanitize
 * @returns Sanitized string with HTML entities escaped
 *
 * @example
 * ```typescript
 * const userInput = '<script>alert("xss")</script>'
 * const safe = sanitizeHtml(userInput)
 * // Result: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 * ```
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Sanitize SQL input by removing dangerous characters
 *
 * NOTE: This is a secondary defense. Always use parameterized queries!
 *
 * @param input - The string to sanitize
 * @returns Sanitized string
 *
 * @example
 * ```typescript
 * const userInput = "'; DROP TABLE users; --"
 * const safe = sanitizeSql(userInput)
 * // Removes quotes, semicolons, and backslashes
 * ```
 */
export function sanitizeSql(input: string): string {
  return input.replace(/['";\\]/g, '')
}

/**
 * Strip HTML tags from input
 *
 * @param input - The string to strip
 * @returns String with all HTML tags removed
 *
 * @example
 * ```typescript
 * const input = '<p>Hello <b>World</b></p>'
 * const stripped = stripHtmlTags(input)
 * // Result: 'Hello World'
 * ```
 */
export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

/**
 * Sanitize filename to prevent directory traversal
 *
 * @param filename - The filename to sanitize
 * @returns Safe filename
 *
 * @example
 * ```typescript
 * const unsafe = '../../../etc/passwd'
 * const safe = sanitizeFilename(unsafe)
 * // Result: 'etcpasswd'
 * ```
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '') // Remove special chars
    .replace(/\.{2,}/g, '.') // Remove double dots
    .replace(/^\.+/, '') // Remove leading dots
    .slice(0, 255) // Limit length
}

/**
 * Validate and sanitize email address
 *
 * @param email - The email to validate
 * @returns Validated and normalized email, or null if invalid
 *
 * @example
 * ```typescript
 * const email = validateEmail('  User@Example.COM  ')
 * // Result: 'user@example.com'
 * ```
 */
export function validateEmail(email: string): string | null {
  try {
    return schemas.email.parse(email)
  } catch {
    return null
  }
}

/**
 * Validate and sanitize phone number to E.164 format
 *
 * @param phone - The phone number to validate
 * @returns Validated phone number, or null if invalid
 *
 * @example
 * ```typescript
 * const phone = validatePhone('+15551234567')
 * // Result: '+15551234567'
 * ```
 */
export function validatePhone(phone: string): string | null {
  try {
    return schemas.phone.parse(phone)
  } catch {
    return null
  }
}

/**
 * Sanitize object by removing null/undefined values
 *
 * @param obj - The object to sanitize
 * @returns Object with null/undefined values removed
 *
 * @example
 * ```typescript
 * const obj = { a: 1, b: null, c: undefined, d: 'text' }
 * const clean = sanitizeObject(obj)
 * // Result: { a: 1, d: 'text' }
 * ```
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key] = value
    }
  }

  return result
}

/**
 * Deep sanitize object (recursive)
 *
 * @param obj - The object to sanitize
 * @returns Deep sanitized object
 */
export function deepSanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: any = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deepSanitizeObject(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null ? deepSanitizeObject(item) : item
      )
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Truncate string to maximum length
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add if truncated (default: '...')
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * const text = truncateString('This is a long text', 10)
 * // Result: 'This is...'
 * ```
 */
export function truncateString(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) {
    return str
  }

  return str.slice(0, maxLength - suffix.length) + suffix
}

/**
 * Normalize whitespace in string
 *
 * @param str - The string to normalize
 * @returns String with normalized whitespace
 *
 * @example
 * ```typescript
 * const text = normalizeWhitespace('  Hello   World  \n\n')
 * // Result: 'Hello World'
 * ```
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim()
}

/**
 * Validate request body against a schema
 *
 * @param body - The request body to validate
 * @param schema - Zod schema to validate against
 * @returns Validation result with parsed data or errors
 *
 * @example
 * ```typescript
 * const bodySchema = z.object({
 *   email: schemas.email,
 *   name: schemas.shortText
 * })
 *
 * const result = validateRequestBody(requestBody, bodySchema)
 *
 * if (!result.success) {
 *   return NextResponse.json({ errors: result.errors }, { status: 400 })
 * }
 *
 * const { email, name } = result.data
 * ```
 */
export function validateRequestBody<T extends z.ZodType>(
  body: unknown,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(body)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return { success: false, errors: result.error }
}

/**
 * Create a validation middleware for API routes
 *
 * @param schema - Zod schema to validate request body
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * const validateBody = createValidationMiddleware(
 *   z.object({
 *     email: schemas.email,
 *     name: schemas.shortText
 *   })
 * )
 *
 * export const POST = validateBody(async (req, { data }) => {
 *   // data is typed and validated
 *   const { email, name } = data
 *   return NextResponse.json({ success: true })
 * })
 * ```
 */
export function createValidationMiddleware<T extends z.ZodType>(schema: T) {
  return (handler: (req: Request, context: { data: z.infer<T> }) => Promise<Response> | Response) => {
    return async (req: Request): Promise<Response> => {
      try {
        const body = await req.json()
        const result = validateRequestBody(body, schema)

        if (!result.success) {
          return new Response(
            JSON.stringify({
              error: 'Validation failed',
              details: result.errors.format(),
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        return await handler(req, { data: result.data })
      } catch (error) {
        if (error instanceof SyntaxError) {
          return new Response(
            JSON.stringify({ error: 'Invalid JSON in request body' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        console.error('Error in validation middleware:', error)
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }
  }
}

/**
 * Common validation schemas for business entities
 */
export const entitySchemas = {
  /**
   * Customer creation/update schema
   */
  customer: z.object({
    name: schemas.shortText,
    email: schemas.email.optional(),
    phone: schemas.phone.optional(),
    address_line1: schemas.shortText.optional(),
    address_line2: schemas.shortText.optional(),
    city: schemas.shortText.optional(),
    state: schemas.stateUS.optional(),
    postal_code: schemas.postalCodeUS.optional(),
    notes: schemas.longText.optional(),
  }),

  /**
   * Job creation/update schema
   */
  job: z.object({
    customer_id: schemas.id,
    technician_id: schemas.id.optional(),
    scheduled_date: schemas.date.optional(),
    description: schemas.text.optional(),
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional(),
  }),

  /**
   * Opportunity creation/update schema
   */
  opportunity: z.object({
    customer_id: schemas.id,
    title: schemas.shortText,
    description: schemas.text.optional(),
    estimated_value: schemas.currency.optional(),
    status: z.enum(['new', 'qualified', 'proposal', 'won', 'lost']).optional(),
  }),

  /**
   * Promotion creation/update schema
   */
  promotion: z.object({
    name: schemas.shortText,
    description: schemas.text.optional(),
    discount_type: z.enum(['percentage', 'fixed']),
    discount_value: z.number().positive(),
    start_date: schemas.date.optional(),
    end_date: schemas.date.optional(),
  }),
}
