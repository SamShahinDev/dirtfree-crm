import { nanoid } from 'nanoid'

/**
 * Valid upload kinds that determine the storage structure
 */
export type UploadKind = 'truck' | 'tool' | 'thread' | 'maintenance'

/**
 * Build a structured object key for storage
 * Format: ${kind}/${entityId}/${yyyy}/${mm}/${nanoid()}.${ext}
 */
export function buildObjectKey({
  kind,
  entityId,
  ext
}: {
  kind: UploadKind
  entityId: string
  ext: string
}): string {
  // Validate inputs
  if (!kind || !entityId || !ext) {
    throw new Error('Missing required parameters for object key')
  }

  // Sanitize entityId to ensure it's safe for file paths
  const safeEntityId = sanitizeEntityId(entityId)

  // Get current date for organization
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')

  // Generate a unique identifier
  const uniqueId = nanoid(12) // 12 characters for good uniqueness

  // Sanitize extension
  const safeExt = sanitizeExtension(ext)

  // Build the key
  return `${kind}/${safeEntityId}/${year}/${month}/${uniqueId}.${safeExt}`
}

/**
 * Parse an object key to extract its components
 */
export function parseObjectKey(key: string): {
  kind: UploadKind
  entityId: string
  year: string
  month: string
  filename: string
  ext: string
} | null {
  // Expected format: kind/entityId/yyyy/mm/filename.ext
  const parts = key.split('/')

  if (parts.length !== 5) {
    return null
  }

  const [kind, entityId, year, month, filename] = parts
  const extMatch = filename.match(/\.([^.]+)$/)
  const ext = extMatch ? extMatch[1] : ''

  // Validate kind
  if (!isValidUploadKind(kind)) {
    return null
  }

  return {
    kind: kind as UploadKind,
    entityId,
    year,
    month,
    filename,
    ext
  }
}

/**
 * Generate a display name for a file based on its key and metadata
 */
export function getDisplayName(key: string, originalName?: string): string {
  const parsed = parseObjectKey(key)

  if (!parsed) {
    return originalName || key
  }

  // If we have an original name, use it; otherwise create a descriptive name
  if (originalName) {
    return originalName
  }

  const { kind, entityId, year, month, ext } = parsed
  return `${kind}-${entityId}-${year}${month}.${ext}`
}

/**
 * Get the storage prefix for a specific entity
 */
export function getEntityPrefix(kind: UploadKind, entityId: string): string {
  const safeEntityId = sanitizeEntityId(entityId)
  return `${kind}/${safeEntityId}/`
}

/**
 * Get the storage prefix for a specific kind
 */
export function getKindPrefix(kind: UploadKind): string {
  return `${kind}/`
}

/**
 * Sanitize entity ID to ensure it's safe for file paths
 */
function sanitizeEntityId(entityId: string): string {
  // Remove or replace unsafe characters
  return entityId
    .replace(/[^a-zA-Z0-9\-_]/g, '_') // Replace unsafe chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Trim leading/trailing underscores
    .toLowerCase()
}

/**
 * Sanitize file extension
 */
function sanitizeExtension(ext: string): string {
  return ext
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric characters
    .substring(0, 10) // Limit length
}

/**
 * Check if a string is a valid upload kind
 */
function isValidUploadKind(kind: string): kind is UploadKind {
  const validKinds: UploadKind[] = ['truck', 'tool', 'thread', 'maintenance']
  return validKinds.includes(kind as UploadKind)
}

/**
 * Validate that an upload kind is supported
 */
export function validateUploadKind(kind: string): UploadKind {
  if (!isValidUploadKind(kind)) {
    throw new Error(`Invalid upload kind: ${kind}. Must be one of: truck, tool, thread, maintenance`)
  }
  return kind
}

/**
 * Generate a temporary key for uploads in progress
 */
export function buildTempKey(kind: UploadKind, entityId: string): string {
  const safeEntityId = sanitizeEntityId(entityId)
  const tempId = nanoid(8)
  return `temp/${kind}/${safeEntityId}/${tempId}`
}

/**
 * Check if a key is a temporary key
 */
export function isTempKey(key: string): boolean {
  return key.startsWith('temp/')
}

/**
 * Convert a temporary key to a permanent key
 */
export function permanentizeKey(tempKey: string, ext: string): string {
  if (!isTempKey(tempKey)) {
    throw new Error('Key is not a temporary key')
  }

  // Extract kind and entityId from temp key
  // Format: temp/kind/entityId/tempId
  const parts = tempKey.split('/')
  if (parts.length !== 4 || parts[0] !== 'temp') {
    throw new Error('Invalid temporary key format')
  }

  const [, kind, entityId] = parts

  return buildObjectKey({
    kind: validateUploadKind(kind),
    entityId,
    ext: sanitizeExtension(ext)
  })
}