/**
 * Data Encryption & Decryption
 *
 * Provides encryption utilities for protecting sensitive data (PII).
 * Uses AES-256-GCM for authenticated encryption.
 *
 * @module lib/security/encryption
 */

import crypto from 'crypto'

/**
 * Encryption algorithm
 * AES-256-GCM provides both confidentiality and authenticity
 */
const ALGORITHM = 'aes-256-gcm'

/**
 * Get encryption key from environment
 * Must be 32 bytes (64 hex characters)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)')
  }

  return Buffer.from(key, 'hex')
}

/**
 * Generate a new encryption key
 *
 * Use this to generate a key for ENCRYPTION_KEY environment variable.
 * Store this securely in your .env file.
 *
 * @returns Hex-encoded 32-byte key
 *
 * @example
 * ```typescript
 * const key = generateEncryptionKey()
 * console.log('ENCRYPTION_KEY=' + key)
 * // Add this to your .env.local file
 * ```
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Encrypt text using AES-256-GCM
 *
 * Returns encrypted text in format: iv:authTag:encryptedData
 *
 * @param text - The plaintext to encrypt
 * @returns Encrypted string with IV and auth tag
 *
 * @example
 * ```typescript
 * const encrypted = encrypt('sensitive data')
 * // Store encrypted value in database
 * await supabase.from('table').insert({ field_encrypted: encrypted })
 * ```
 */
export function encrypt(text: string): string {
  if (!text) {
    throw new Error('Cannot encrypt empty text')
  }

  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt text that was encrypted with encrypt()
 *
 * @param encryptedText - The encrypted string (format: iv:authTag:encryptedData)
 * @returns Decrypted plaintext
 *
 * @example
 * ```typescript
 * const { data } = await supabase.from('table').select('field_encrypted').single()
 * const decrypted = decrypt(data.field_encrypted)
 * ```
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    throw new Error('Cannot decrypt empty text')
  }

  try {
    const parts = encryptedText.split(':')

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format')
    }

    const [ivHex, authTagHex, encrypted] = parts

    const key = getEncryptionKey()
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Hash sensitive data using SHA-256 (one-way)
 *
 * Use this for data that needs to be compared but never decrypted.
 * For example: storing password reset tokens, API keys for comparison.
 *
 * @param data - The data to hash
 * @returns Hex-encoded SHA-256 hash
 *
 * @example
 * ```typescript
 * const hashed = hashData('secret-token')
 * await supabase.from('tokens').insert({ token_hash: hashed })
 * ```
 */
export function hashData(data: string): string {
  if (!data) {
    throw new Error('Cannot hash empty data')
  }

  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Hash data with a salt (more secure)
 *
 * @param data - The data to hash
 * @param salt - Optional salt (will generate if not provided)
 * @returns Object with hash and salt
 *
 * @example
 * ```typescript
 * const { hash, salt } = hashDataWithSalt('secret')
 * await supabase.from('table').insert({ hash, salt })
 * ```
 */
export function hashDataWithSalt(
  data: string,
  salt?: string
): { hash: string; salt: string } {
  if (!data) {
    throw new Error('Cannot hash empty data')
  }

  const saltToUse = salt || crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .createHash('sha256')
    .update(data + saltToUse)
    .digest('hex')

  return { hash, salt: saltToUse }
}

/**
 * Verify hashed data
 *
 * @param data - The plaintext data
 * @param hash - The stored hash
 * @param salt - The stored salt
 * @returns True if data matches hash
 *
 * @example
 * ```typescript
 * const { data } = await supabase.from('table').select('hash, salt').single()
 * const isValid = verifyHash('secret', data.hash, data.salt)
 * ```
 */
export function verifyHash(data: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = hashDataWithSalt(data, salt)
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash))
}

/**
 * Encrypt an object's sensitive fields
 *
 * @param obj - Object containing sensitive fields
 * @param fields - Array of field names to encrypt
 * @returns Object with encrypted fields (field_encrypted)
 *
 * @example
 * ```typescript
 * const customer = {
 *   name: 'John Doe',
 *   ssn: '123-45-6789',
 *   notes: 'Sensitive information'
 * }
 *
 * const encrypted = encryptFields(customer, ['ssn', 'notes'])
 * // Result: { name: 'John Doe', ssn_encrypted: '...', notes_encrypted: '...' }
 * ```
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): Record<string, any> {
  const result: Record<string, any> = { ...obj }

  for (const field of fields) {
    const value = obj[field]

    if (value !== null && value !== undefined) {
      const fieldName = String(field)
      result[`${fieldName}_encrypted`] = encrypt(String(value))
      delete result[field] // Remove plaintext
    }
  }

  return result
}

/**
 * Decrypt an object's encrypted fields
 *
 * @param obj - Object containing encrypted fields
 * @param fields - Array of field names to decrypt
 * @returns Object with decrypted fields
 *
 * @example
 * ```typescript
 * const { data } = await supabase.from('customers').select('*').single()
 * const decrypted = decryptFields(data, ['ssn', 'notes'])
 * // Result: { name: 'John Doe', ssn: '123-45-6789', notes: '...' }
 * ```
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: string[]
): Record<string, any> {
  const result: Record<string, any> = { ...obj }

  for (const field of fields) {
    const encryptedField = `${field}_encrypted`
    const encryptedValue = obj[encryptedField]

    if (encryptedValue) {
      try {
        result[field] = decrypt(encryptedValue)
        delete result[encryptedField] // Remove encrypted version
      } catch (error) {
        console.error(`Failed to decrypt field ${field}:`, error)
        result[field] = null
      }
    }
  }

  return result
}

/**
 * Generate a secure random token
 *
 * Use for API keys, reset tokens, session IDs, etc.
 *
 * @param bytes - Number of random bytes (default: 32)
 * @returns Hex-encoded random token
 *
 * @example
 * ```typescript
 * const resetToken = generateToken()
 * const apiKey = generateToken(48) // Longer key
 * ```
 */
export function generateToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * Generate a secure random password
 *
 * @param length - Password length (default: 16)
 * @returns Random password with mixed characters
 *
 * @example
 * ```typescript
 * const password = generateSecurePassword(20)
 * ```
 */
export function generateSecurePassword(length: number = 16): string {
  const charset =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-='
  const values = crypto.randomBytes(length)
  let password = ''

  for (let i = 0; i < length; i++) {
    password += charset[values[i] % charset.length]
  }

  return password
}

/**
 * Encrypt sensitive data for storage with metadata
 *
 * Includes timestamp and version for key rotation.
 *
 * @param data - The data to encrypt
 * @param metadata - Optional metadata to include
 * @returns Encrypted bundle with metadata
 *
 * @example
 * ```typescript
 * const encrypted = encryptWithMetadata('sensitive', { userId: '123' })
 * ```
 */
export function encryptWithMetadata(
  data: string,
  metadata?: Record<string, any>
): string {
  const bundle = {
    data,
    metadata: metadata || {},
    timestamp: Date.now(),
    version: 1, // For key rotation
  }

  return encrypt(JSON.stringify(bundle))
}

/**
 * Decrypt data that was encrypted with metadata
 *
 * @param encryptedBundle - The encrypted bundle
 * @returns Decrypted data and metadata
 *
 * @example
 * ```typescript
 * const { data, metadata, timestamp } = decryptWithMetadata(encrypted)
 * ```
 */
export function decryptWithMetadata(encryptedBundle: string): {
  data: string
  metadata: Record<string, any>
  timestamp: number
  version: number
} {
  const decrypted = decrypt(encryptedBundle)
  return JSON.parse(decrypted)
}

/**
 * Mask sensitive data for display
 *
 * Shows only last N characters, rest are masked.
 *
 * @param data - The data to mask
 * @param visibleChars - Number of characters to show (default: 4)
 * @param maskChar - Character to use for masking (default: *)
 * @returns Masked string
 *
 * @example
 * ```typescript
 * maskSensitiveData('1234567890', 4) // Returns: ******7890
 * maskSensitiveData('secret@example.com', 4, 'X') // Returns: XXXXXXXXXXXXXXXXm.com
 * ```
 */
export function maskSensitiveData(
  data: string,
  visibleChars: number = 4,
  maskChar: string = '*'
): string {
  if (!data || data.length <= visibleChars) {
    return data
  }

  const masked = maskChar.repeat(data.length - visibleChars)
  const visible = data.slice(-visibleChars)

  return masked + visible
}

/**
 * Check if encryption is configured
 *
 * @returns True if encryption key is set
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length === 64
}

/**
 * Validate encryption key format
 *
 * @param key - The key to validate
 * @returns True if key is valid format
 */
export function validateEncryptionKey(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key)
}

/**
 * Encryption utilities for testing
 */
export const __testing__ = {
  ALGORITHM,
  getEncryptionKey,
}
