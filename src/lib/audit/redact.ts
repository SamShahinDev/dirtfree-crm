/**
 * PII redaction utilities for audit logs
 * Masks sensitive data while preserving structure for debugging
 */

const SENSITIVE_KEY_REGEX = /phone|e164|email|token|key|secret|sid|auth|password|pass|apikey|api_key|service_role|credential|session|jwt|bearer|oauth|webhook/i

/**
 * Deep clone and redact sensitive fields from an object
 */
export function redact(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redact(item))
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj
  }

  // Handle regular objects
  const redacted: any = {}

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      // Preserve type information while masking value
      if (typeof value === 'string') {
        redacted[key] = value.length > 0 ? '***' : ''
      } else if (typeof value === 'number') {
        redacted[key] = 0
      } else if (typeof value === 'boolean') {
        redacted[key] = false
      } else if (value === null) {
        redacted[key] = null
      } else {
        redacted[key] = '***'
      }
    } else {
      // Recursively redact nested objects
      redacted[key] = redact(value)
    }
  }

  return redacted
}

/**
 * Redact sensitive fields from email addresses and phone numbers in text
 */
export function redactText(text: string): string {
  if (!text || typeof text !== 'string') {
    return text
  }

  return text
    // Redact email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***.***')
    // Redact phone numbers (various formats)
    .replace(/\b\+?1?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '***-***-****')
    // Redact UUIDs (potential tokens/IDs)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '***-***-***-***-***')
    // Redact potential API keys (long alphanumeric strings)
    .replace(/\b[A-Za-z0-9]{32,}\b/g, '***')
}

/**
 * Redact JSON strings within text
 */
export function redactJsonInText(text: string): string {
  if (!text || typeof text !== 'string') {
    return text
  }

  // Try to find and redact JSON objects in the text
  return text.replace(/\{[^{}]*\}/g, (match) => {
    try {
      const parsed = JSON.parse(match)
      const redacted = redact(parsed)
      return JSON.stringify(redacted)
    } catch {
      // If not valid JSON, apply text redaction
      return redactText(match)
    }
  })
}

/**
 * Smart redaction that handles various data types
 */
export function smartRedact(value: any): any {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    // Try to parse as JSON first
    if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(value)
        return JSON.stringify(redact(parsed))
      } catch {
        // Fall back to text redaction
        return redactJsonInText(value)
      }
    }
    return redactText(value)
  }

  if (typeof value === 'object') {
    return redact(value)
  }

  return value
}

/**
 * Redact an audit log entry for safe display
 */
export function redactForAudit(entry: any): any {
  if (!entry || typeof entry !== 'object') {
    return entry
  }

  const redacted = { ...entry }

  // Redact known sensitive fields
  if (redacted.meta) {
    redacted.meta = redact(redacted.meta)
  }

  if (redacted.before) {
    redacted.before = redact(redacted.before)
  }

  if (redacted.after) {
    redacted.after = redact(redacted.after)
  }

  // Redact email if it contains sensitive info
  if (redacted.actor_email && typeof redacted.actor_email === 'string') {
    // Only redact if it looks like it might contain sensitive data
    // For normal emails, we want to keep them for audit purposes
    if (SENSITIVE_KEY_REGEX.test(redacted.actor_email)) {
      redacted.actor_email = '***@***.***'
    }
  }

  // Apply smart redaction to other fields that might contain JSON or sensitive text
  const fieldsToRedact = ['error_message', 'details', 'context', 'notes']
  fieldsToRedact.forEach(field => {
    if (redacted[field]) {
      redacted[field] = smartRedact(redacted[field])
    }
  })

  return redacted
}

/**
 * Check if a key name suggests it contains sensitive data
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_REGEX.test(key)
}

/**
 * Get a list of all sensitive keys found in an object (for debugging)
 */
export function findSensitiveKeys(obj: any, path: string = ''): string[] {
  if (!obj || typeof obj !== 'object') {
    return []
  }

  const sensitiveKeys: string[] = []

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      sensitiveKeys.push(...findSensitiveKeys(item, `${path}[${index}]`))
    })
  } else {
    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key

      if (isSensitiveKey(key)) {
        sensitiveKeys.push(currentPath)
      }

      if (typeof value === 'object' && value !== null) {
        sensitiveKeys.push(...findSensitiveKeys(value, currentPath))
      }
    })
  }

  return sensitiveKeys
}