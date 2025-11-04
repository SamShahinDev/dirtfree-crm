/**
 * Security Module
 *
 * Central export point for all security-related utilities.
 *
 * @module lib/security
 */

// Webhook Signature Verification
export {
  verifyWebhookSignature,
  verifyWebhookSignatureWithRotation,
  verifyWebhookSignatureWithTimestamp,
  generateWebhookSignature,
  generateWebhookSignatureWithTimestamp,
  withWebhookVerification,
  type WebhookVerificationOptions,
} from './signature-verification'

// Request Throttling
export {
  checkThrottle,
  checkThrottleByIP,
  resetThrottle,
  withThrottling,
  withAuthAndThrottling,
  createThrottleConfig,
  getThrottleStatus,
  clearAllThrottles,
  throttleConfigs,
  type ThrottleConfig,
  type ThrottleResult,
} from './throttling'

// Input Sanitization and Validation
export {
  sanitizeHtml,
  sanitizeSql,
  stripHtmlTags,
  sanitizeFilename,
  validateEmail,
  validatePhone,
  sanitizeObject,
  deepSanitizeObject,
  truncateString,
  normalizeWhitespace,
  validateRequestBody,
  createValidationMiddleware,
  schemas,
  entitySchemas,
} from './sanitize'

// CSRF Protection
export {
  generateCsrfToken,
  verifyCsrfToken,
  invalidateCsrfToken,
  getSessionId,
  withCsrfProtection,
  createCsrfTokenEndpoint,
  withDoubleSubmitCookie,
  clearAllCsrfTokens,
  type CsrfProtectionOptions,
} from './csrf'

// Encryption & PII Protection
export {
  encrypt,
  decrypt,
  hashData,
  hashDataWithSalt,
  verifyHash,
  encryptFields,
  decryptFields,
  generateToken,
  generateSecurePassword,
  generateEncryptionKey,
  encryptWithMetadata,
  decryptWithMetadata,
  maskSensitiveData,
  isEncryptionConfigured,
  validateEncryptionKey,
} from './encryption'
