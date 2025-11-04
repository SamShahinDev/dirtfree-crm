/**
 * PII Masking for Logs
 *
 * Masks Personally Identifiable Information (PII) in logs and outputs
 * to prevent accidental exposure of sensitive data.
 *
 * @module lib/logging/mask-pii
 */

/**
 * Mask email address
 *
 * Shows first 2 characters of local part and full domain.
 *
 * @param email - Email to mask
 * @returns Masked email
 *
 * @example
 * ```typescript
 * maskEmail('john.doe@example.com')
 * // Returns: 'jo*******@example.com'
 * ```
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***@***'
  }

  const [local, domain] = email.split('@')

  if (local.length <= 2) {
    return `${local[0]}*@${domain}`
  }

  return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`
}

/**
 * Mask phone number
 *
 * Shows only last 4 digits.
 *
 * @param phone - Phone number to mask
 * @returns Masked phone
 *
 * @example
 * ```typescript
 * maskPhone('+15551234567')
 * // Returns: '***-***-4567'
 * ```
 */
export function maskPhone(phone: string): string {
  if (!phone) {
    return '***-***-****'
  }

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '')

  if (digits.length < 4) {
    return '***-***-****'
  }

  const last4 = digits.slice(-4)
  return `***-***-${last4}`
}

/**
 * Mask credit card number
 *
 * Shows only last 4 digits.
 *
 * @param cardNumber - Card number to mask
 * @returns Masked card number
 *
 * @example
 * ```typescript
 * maskCreditCard('4532123456781234')
 * // Returns: '****-****-****-1234'
 * ```
 */
export function maskCreditCard(cardNumber: string): string {
  if (!cardNumber) {
    return '****-****-****-****'
  }

  // Remove all non-digits
  const digits = cardNumber.replace(/\D/g, '')

  if (digits.length < 4) {
    return '****-****-****-****'
  }

  const last4 = digits.slice(-4)
  return `****-****-****-${last4}`
}

/**
 * Mask Social Security Number
 *
 * Shows only last 4 digits.
 *
 * @param ssn - SSN to mask
 * @returns Masked SSN
 *
 * @example
 * ```typescript
 * maskSSN('123-45-6789')
 * // Returns: '***-**-6789'
 * ```
 */
export function maskSSN(ssn: string): string {
  if (!ssn) {
    return '***-**-****'
  }

  // Remove all non-digits
  const digits = ssn.replace(/\D/g, '')

  if (digits.length !== 9) {
    return '***-**-****'
  }

  const last4 = digits.slice(-4)
  return `***-**-${last4}`
}

/**
 * Mask address
 *
 * Shows only city and state.
 *
 * @param address - Address object or string
 * @returns Masked address
 *
 * @example
 * ```typescript
 * maskAddress('123 Main St, San Francisco, CA 94102')
 * // Returns: '*** ******, San Francisco, CA *****'
 * ```
 */
export function maskAddress(address: string | object): string {
  if (typeof address === 'string') {
    // Try to extract city and state if comma-separated
    const parts = address.split(',').map((p) => p.trim())

    if (parts.length >= 3) {
      return `*** ******, ${parts[parts.length - 2]}, ${parts[parts.length - 1].split(' ')[0]} *****`
    }

    return '*** ******, ****, ** *****'
  }

  // If it's an object
  const addr = address as any
  return `*** ******, ${addr.city || '****'}, ${addr.state || '**'} *****`
}

/**
 * Mask IP address
 *
 * Shows only first two octets.
 *
 * @param ip - IP address to mask
 * @returns Masked IP
 *
 * @example
 * ```typescript
 * maskIP('192.168.1.100')
 * // Returns: '192.168.***.***'
 * ```
 */
export function maskIP(ip: string): string {
  if (!ip) {
    return '***.***.***.***'
  }

  const parts = ip.split('.')

  if (parts.length !== 4) {
    return '***.***.***.***'
  }

  return `${parts[0]}.${parts[1]}.***.***`
}

/**
 * Mask API key or token
 *
 * Shows only first and last 4 characters.
 *
 * @param key - API key to mask
 * @returns Masked key
 *
 * @example
 * ```typescript
 * maskApiKey('sk_live_1234567890abcdef')
 * // Returns: 'sk_l***cdef'
 * ```
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) {
    return '****'
  }

  const first4 = key.slice(0, 4)
  const last4 = key.slice(-4)

  return `${first4}${'*'.repeat(Math.min(key.length - 8, 20))}${last4}`
}

/**
 * Mask PII in an object
 *
 * Automatically detects and masks common PII fields.
 *
 * @param data - Object containing potential PII
 * @returns Object with masked PII
 *
 * @example
 * ```typescript
 * const customer = {
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   phone: '+15551234567',
 *   ssn: '123-45-6789',
 *   card_number: '4532123456781234'
 * }
 *
 * const masked = maskPii(customer)
 * // {
 * //   name: 'John Doe',
 * //   email: 'jo***@example.com',
 * //   phone: '***-***-4567',
 * //   ssn: '***-**-6789',
 * //   card_number: '****-****-****-1234'
 * // }
 * ```
 */
export function maskPii(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskPii(item))
  }

  const masked = { ...data }

  // Email fields
  if (masked.email) {
    masked.email = maskEmail(masked.email)
  }

  // Phone fields
  const phoneFields = ['phone', 'phone_number', 'mobile', 'telephone', 'phone_e164']
  for (const field of phoneFields) {
    if (masked[field]) {
      masked[field] = maskPhone(masked[field])
    }
  }

  // Credit card fields
  const cardFields = ['card_number', 'credit_card', 'cardNumber', 'cc_number']
  for (const field of cardFields) {
    if (masked[field]) {
      masked[field] = maskCreditCard(masked[field])
    }
  }

  // SSN fields
  const ssnFields = ['ssn', 'social_security', 'social_security_number']
  for (const field of ssnFields) {
    if (masked[field]) {
      masked[field] = maskSSN(masked[field])
    }
  }

  // Address fields
  const addressFields = ['address', 'address_line1', 'street', 'street_address']
  for (const field of addressFields) {
    if (masked[field]) {
      if (typeof masked[field] === 'string') {
        masked[field] = '*** ******, ****, ** *****'
      }
    }
  }

  // Postal code
  if (masked.postal_code || masked.zip || masked.zipcode) {
    const field = masked.postal_code ? 'postal_code' : masked.zip ? 'zip' : 'zipcode'
    masked[field] = '*****'
  }

  // API keys and tokens
  const keyFields = ['api_key', 'token', 'access_token', 'secret', 'password']
  for (const field of keyFields) {
    if (masked[field]) {
      masked[field] = maskApiKey(masked[field])
    }
  }

  // IP address
  if (masked.ip_address || masked.ip) {
    const field = masked.ip_address ? 'ip_address' : 'ip'
    masked[field] = maskIP(masked[field])
  }

  // Recursively mask nested objects
  for (const key in masked) {
    if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskPii(masked[key])
    }
  }

  return masked
}

/**
 * Mask PII in array of objects
 *
 * @param data - Array of objects
 * @returns Array with masked PII
 */
export function maskPiiArray<T>(data: T[]): T[] {
  return data.map((item) => maskPii(item))
}

/**
 * Check if a value looks like PII
 *
 * @param value - Value to check
 * @returns True if value looks like PII
 */
export function looksLikePii(value: any): boolean {
  if (typeof value !== 'string') {
    return false
  }

  // Email pattern
  if (/@/.test(value) && /\w+@\w+\.\w+/.test(value)) {
    return true
  }

  // Phone pattern (10+ digits)
  const digits = value.replace(/\D/g, '')
  if (digits.length >= 10) {
    return true
  }

  // SSN pattern
  if (/^\d{3}-\d{2}-\d{4}$/.test(value)) {
    return true
  }

  // Credit card pattern (13-19 digits)
  if (digits.length >= 13 && digits.length <= 19) {
    return true
  }

  return false
}

/**
 * Redact sensitive fields from object
 *
 * Completely removes sensitive fields instead of masking.
 *
 * @param data - Object to redact
 * @param fields - Fields to redact
 * @returns Object with redacted fields
 *
 * @example
 * ```typescript
 * const customer = {
 *   name: 'John Doe',
 *   ssn: '123-45-6789',
 *   email: 'john@example.com'
 * }
 *
 * const redacted = redactFields(customer, ['ssn'])
 * // { name: 'John Doe', email: 'john@example.com' }
 * ```
 */
export function redactFields<T extends Record<string, any>>(
  data: T,
  fields: (keyof T)[]
): Partial<T> {
  const result = { ...data }

  for (const field of fields) {
    delete result[field]
  }

  return result
}

/**
 * Create a safe logger that automatically masks PII
 *
 * @returns Logger object with masked logging methods
 *
 * @example
 * ```typescript
 * const logger = createSafeLogger()
 *
 * logger.info('Customer data', {
 *   email: 'john@example.com',
 *   phone: '+15551234567'
 * })
 * // Logs: Customer data { email: 'jo***@example.com', phone: '***-***-4567' }
 * ```
 */
export function createSafeLogger() {
  return {
    log: (message: string, data?: any) => {
      console.log(message, data ? maskPii(data) : '')
    },

    info: (message: string, data?: any) => {
      console.info(message, data ? maskPii(data) : '')
    },

    warn: (message: string, data?: any) => {
      console.warn(message, data ? maskPii(data) : '')
    },

    error: (message: string, data?: any) => {
      console.error(message, data ? maskPii(data) : '')
    },

    debug: (message: string, data?: any) => {
      console.debug(message, data ? maskPii(data) : '')
    },
  }
}

/**
 * Export safe logger instance
 */
export const safeLogger = createSafeLogger()
