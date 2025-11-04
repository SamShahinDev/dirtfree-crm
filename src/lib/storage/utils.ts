import { createClient } from '@/lib/supabase/client'

// Storage bucket names
export const STORAGE_BUCKETS = {
  VEHICLE_PHOTOS: 'vehicle-photos',
  JOB_PHOTOS: 'job-photos',
  CUSTOMER_DOCUMENTS: 'customer-documents',
  MAINTENANCE_RECORDS: 'maintenance-records'
} as const

export type StorageBucket = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS]

// File validation constants
export const FILE_CONSTRAINTS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_SIZE_IMAGES: 5 * 1024 * 1024, // 5MB for images
  MAX_SIZE_DOCUMENTS: 10 * 1024 * 1024, // 10MB for documents
  IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  DOCUMENT_TYPES: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ],
  // Security constraints
  BLOCKED_EXTENSIONS: ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.zip', '.rar'],
  MAX_FILENAME_LENGTH: 255,
  ALLOWED_DIMENSIONS: {
    MIN_WIDTH: 10,
    MIN_HEIGHT: 10,
    MAX_WIDTH: 4096,
    MAX_HEIGHT: 4096
  }
} as const

// File validation utilities
export function validateFileSize(file: File, bucket?: StorageBucket): { valid: boolean; error?: string } {
  const isPhotoBucket = bucket && bucket.includes('photo')
  const maxSize = isPhotoBucket ? FILE_CONSTRAINTS.MAX_SIZE_IMAGES : FILE_CONSTRAINTS.MAX_SIZE_DOCUMENTS

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`
    }
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File appears to be empty'
    }
  }

  return { valid: true }
}

export function validateFileType(file: File, bucket: StorageBucket): { valid: boolean; error?: string } {
  const isPhotoBucket = bucket.includes('photo')
  const isDocumentBucket = bucket.includes('document') || bucket.includes('record')

  if (isPhotoBucket && !FILE_CONSTRAINTS.IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed. Supported image types: ${FILE_CONSTRAINTS.IMAGE_TYPES.join(', ')}`
    }
  }

  if (isDocumentBucket && !FILE_CONSTRAINTS.DOCUMENT_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed. Supported document types: ${FILE_CONSTRAINTS.DOCUMENT_TYPES.join(', ')}`
    }
  }

  return { valid: true }
}

export function validateFile(file: File, bucket: StorageBucket): { valid: boolean; error?: string } {
  const sizeCheck = validateFileSize(file)
  if (!sizeCheck.valid) return sizeCheck

  const typeCheck = validateFileType(file, bucket)
  if (!typeCheck.valid) return typeCheck

  return { valid: true }
}

// File name utilities
export function generateUniqueFileName(originalName: string, prefix?: string): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 8)
  const extension = getFileExtension(originalName)

  const baseName = prefix ? `${prefix}_${timestamp}_${randomString}` : `${timestamp}_${randomString}`
  return extension ? `${baseName}.${extension}` : baseName
}

export function getFileExtension(fileName: string): string | null {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : null
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
}

// URL utilities
export function getPublicUrl(bucket: StorageBucket, fileName: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
  return data.publicUrl
}

export function getSignedUrl(bucket: StorageBucket, fileName: string, expiresIn = 3600): Promise<string | null> {
  const supabase = createClient()
  return supabase.storage
    .from(bucket)
    .createSignedUrl(fileName, expiresIn)
    .then(({ data, error }) => {
      if (error) {
        console.error('Error creating signed URL:', error)
        return null
      }
      return data?.signedUrl || null
    })
}

// File management utilities
export async function deleteFile(bucket: StorageBucket, fileName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    const { error } = await supabase.storage.from(bucket).remove([fileName])

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    }
  }
}

export async function listFiles(
  bucket: StorageBucket,
  path = '',
  options?: {
    limit?: number
    offset?: number
    sortBy?: 'name' | 'updated_at' | 'created_at'
    sortOrder?: 'asc' | 'desc'
  }
): Promise<{ files: any[]; error?: string }> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path, {
        limit: options?.limit,
        offset: options?.offset,
        sortBy: { column: options?.sortBy || 'created_at', order: options?.sortOrder || 'desc' }
      })

    if (error) {
      return { files: [], error: error.message }
    }

    return { files: data || [] }
  } catch (error) {
    return {
      files: [],
      error: error instanceof Error ? error.message : 'List files failed'
    }
  }
}

// Image optimization utilities
export function resizeImage(file: File, maxWidth: number, maxHeight: number, quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to resize image'))
          }
        },
        file.type,
        quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

export async function optimizeImageForUpload(file: File): Promise<File> {
  // Only optimize if it's an image and larger than 1MB
  if (!file.type.startsWith('image/') || file.size < 1024 * 1024) {
    return file
  }

  try {
    const resizedBlob = await resizeImage(file, 1920, 1080, 0.85)
    return new File([resizedBlob], file.name, { type: file.type })
  } catch (error) {
    console.warn('Failed to optimize image, using original:', error)
    return file
  }
}

// Utility functions
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getFileTypeIcon(fileName: string): string {
  const extension = getFileExtension(fileName)

  switch (extension) {
    case 'pdf':
      return '📄'
    case 'doc':
    case 'docx':
      return '📝'
    case 'txt':
      return '📃'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return '🖼️'
    default:
      return '📎'
  }
}

export function isImageFile(fileName: string): boolean {
  const extension = getFileExtension(fileName)
  return extension ? ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension) : false
}

// Storage service wrapper
export class StorageService {
  private supabase = createClient()

  async upload(
    bucket: StorageBucket,
    file: File,
    options?: {
      path?: string
      filename?: string
      optimize?: boolean
      onProgress?: (progress: number) => void
    }
  ) {
    const path = options?.path || ''
    const filename = options?.filename || generateUniqueFileName(file.name)
    const fullPath = path ? `${path}/${filename}` : filename

    // Validate file
    const validation = validateFile(file, bucket)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Optimize if requested and it's an image
    let fileToUpload = file
    if (options?.optimize !== false) {
      fileToUpload = await optimizeImageForUpload(file)
    }

    // Upload
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .upload(fullPath, fileToUpload, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw new Error(error.message)
    }

    // Return public URL
    const publicUrl = getPublicUrl(bucket, fullPath)

    return {
      path: fullPath,
      publicUrl,
      fileName: filename
    }
  }

  async delete(bucket: StorageBucket, filePath: string) {
    return deleteFile(bucket, filePath)
  }

  async list(bucket: StorageBucket, path?: string, options?: Parameters<typeof listFiles>[2]) {
    return listFiles(bucket, path, options)
  }

  getPublicUrl(bucket: StorageBucket, filePath: string) {
    return getPublicUrl(bucket, filePath)
  }

  async getSignedUrl(bucket: StorageBucket, filePath: string, expiresIn?: number) {
    return getSignedUrl(bucket, filePath, expiresIn)
  }
}

// Export singleton instance
export const storageService = new StorageService()

// ============================================================================
// ENHANCED SECURITY & VALIDATION
// ============================================================================

// Enhanced filename validation
export function validateFileName(filename: string): { valid: boolean; error?: string } {
  // Check filename length
  if (filename.length > FILE_CONSTRAINTS.MAX_FILENAME_LENGTH) {
    return {
      valid: false,
      error: `Filename too long (max ${FILE_CONSTRAINTS.MAX_FILENAME_LENGTH} characters)`
    }
  }

  // Check for blocked extensions
  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  if (FILE_CONSTRAINTS.BLOCKED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File type ${extension} is not allowed for security reasons`
    }
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.(exe|bat|cmd|scr|pif|com|jar)$/i,
    /^\.+$/, // Only dots
    /[\x00-\x1f\x7f-\x9f]/, // Control characters
    /[<>:"|?*]/, // Windows reserved characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i // Windows reserved names
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(filename)) {
      return {
        valid: false,
        error: 'Filename contains invalid or suspicious characters'
      }
    }
  }

  return { valid: true }
}

// Validate image dimensions and content
export async function validateImageFile(file: File): Promise<{ valid: boolean; error?: string; dimensions?: { width: number; height: number } }> {
  if (!file.type.startsWith('image/')) {
    return { valid: true } // Not an image, skip validation
  }

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width, height } = img
      const { MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT } = FILE_CONSTRAINTS.ALLOWED_DIMENSIONS

      if (width < MIN_WIDTH || height < MIN_HEIGHT) {
        resolve({
          valid: false,
          error: `Image too small (min ${MIN_WIDTH}x${MIN_HEIGHT}px)`
        })
        return
      }

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        resolve({
          valid: false,
          error: `Image too large (max ${MAX_WIDTH}x${MAX_HEIGHT}px)`
        })
        return
      }

      resolve({
        valid: true,
        dimensions: { width, height }
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({
        valid: false,
        error: 'Invalid or corrupted image file'
      })
    }

    img.src = url
  })
}

// Comprehensive file validation with security checks
export async function validateFileSecure(file: File, bucket: StorageBucket): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  // Basic validations
  const sizeValidation = validateFileSize(file, bucket)
  if (!sizeValidation.valid && sizeValidation.error) {
    errors.push(sizeValidation.error)
  }

  const typeValidation = validateFileType(file, bucket)
  if (!typeValidation.valid && typeValidation.error) {
    errors.push(typeValidation.error)
  }

  const nameValidation = validateFileName(file.name)
  if (!nameValidation.valid && nameValidation.error) {
    errors.push(nameValidation.error)
  }

  // Image-specific validation
  if (file.type.startsWith('image/')) {
    const imageValidation = await validateImageFile(file)
    if (!imageValidation.valid && imageValidation.error) {
      errors.push(imageValidation.error)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// Advanced image compression with quality control
export async function compressImage(file: File, maxWidth: number = 1920, maxHeight: number = 1080, quality: number = 0.8): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file // Not an image, return as-is
  }

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions maintaining aspect ratio
      let { width, height } = img
      const aspectRatio = width / height

      if (width > maxWidth) {
        width = maxWidth
        height = width / aspectRatio
      }

      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }

      // Set canvas dimensions
      canvas.width = width
      canvas.height = height

      // Enable image smoothing for better quality
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now()
          })
          resolve(compressedFile)
        } else {
          resolve(file) // Fallback to original
        }
      }, file.type, quality)
    }

    img.onerror = () => resolve(file) // Fallback to original
    img.src = URL.createObjectURL(file)
  })
}

// Generate secure filename with sanitization
export function generateSecureFilename(originalName: string, prefix?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = originalName.slice(originalName.lastIndexOf('.'))

  // Sanitize the base name
  const baseName = originalName
    .slice(0, originalName.lastIndexOf('.'))
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .substring(0, 50) // Limit length

  const finalName = prefix
    ? `${prefix}_${baseName}_${timestamp}_${random}${extension}`
    : `${baseName}_${timestamp}_${random}${extension}`

  return finalName
}

// File content type validation using magic numbers
export async function validateFileContentType(file: File): Promise<{ valid: boolean; detectedType?: string; error?: string }> {
  // Read first few bytes to check magic numbers
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer
      if (!buffer) {
        resolve({ valid: false, error: 'Could not read file' })
        return
      }

      const bytes = new Uint8Array(buffer)
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

      // Check common file signatures
      const signatures = {
        'ffd8ff': 'image/jpeg',
        '89504e47': 'image/png',
        '47494638': 'image/gif',
        '52494646': 'image/webp', // RIFF (WebP container)
        '25504446': 'application/pdf',
        '504b0304': 'application/zip', // Also used by Office documents
        'd0cf11e0': 'application/msoffice' // Legacy Office documents
      }

      let detectedType: string | undefined
      for (const [signature, mimeType] of Object.entries(signatures)) {
        if (hex.startsWith(signature)) {
          detectedType = mimeType
          break
        }
      }

      // Check if detected type matches declared type
      if (detectedType && detectedType !== file.type) {
        // Allow some flexibility for Office documents
        if (file.type.includes('officedocument') && detectedType === 'application/zip') {
          resolve({ valid: true, detectedType })
          return
        }

        resolve({
          valid: false,
          detectedType,
          error: `File content doesn't match declared type. Expected: ${file.type}, Detected: ${detectedType}`
        })
        return
      }

      resolve({ valid: true, detectedType })
    }

    reader.onerror = () => {
      resolve({ valid: false, error: 'Could not read file for validation' })
    }

    // Read first 16 bytes for magic number detection
    reader.readAsArrayBuffer(file.slice(0, 16))
  })
}

// Virus/malware scanning simulation (placeholder for real implementation)
export async function scanFileForThreats(file: File): Promise<{ safe: boolean; threats?: string[] }> {
  // In a real implementation, this would integrate with a virus scanning service
  // For now, we'll do basic checks for suspicious patterns

  const threats: string[] = []

  // Check filename for suspicious patterns
  const suspiciousNames = [
    /\.(exe|bat|cmd|scr|pif|com|jar|vbs|js)$/i,
    /^(invoice|receipt|document)\.(exe|scr)$/i,
    /trojan|virus|malware|ransomware/i
  ]

  for (const pattern of suspiciousNames) {
    if (pattern.test(file.name)) {
      threats.push(`Suspicious filename pattern: ${file.name}`)
    }
  }

  // Check file size for suspicious patterns
  if (file.size > 100 * 1024 * 1024) { // 100MB
    threats.push('File size unusually large for document type')
  }

  if (file.size < 100 && file.name.includes('.')) {
    threats.push('File suspiciously small for declared type')
  }

  return {
    safe: threats.length === 0,
    threats: threats.length > 0 ? threats : undefined
  }
}

// ============================================================================
// STORAGE OPTIMIZATION
// ============================================================================

// Storage usage monitoring
export interface StorageUsage {
  totalFiles: number
  totalSize: number
  bucketUsage: Record<string, { files: number; size: number }>
  largestFiles: Array<{ name: string; size: number; bucket: string }>
  oldestFiles: Array<{ name: string; date: string; bucket: string }>
}

export async function getStorageUsage(): Promise<StorageUsage> {
  // This would integrate with your database to get actual usage stats
  // Placeholder implementation
  return {
    totalFiles: 0,
    totalSize: 0,
    bucketUsage: {},
    largestFiles: [],
    oldestFiles: []
  }
}

// Cleanup utilities
export async function cleanupOrphanedFiles(bucket: StorageBucket): Promise<{ cleaned: number; errors: string[] }> {
  // This would find files in storage that don't have corresponding database records
  // Placeholder implementation
  return {
    cleaned: 0,
    errors: []
  }
}

export async function archiveOldFiles(bucket: StorageBucket, daysOld: number = 365): Promise<{ archived: number; errors: string[] }> {
  // This would move old files to an archive bucket or cold storage
  // Placeholder implementation
  return {
    archived: 0,
    errors: []
  }
}