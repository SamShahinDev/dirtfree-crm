import { getServerSupabase } from '@/lib/supabase/server'

/**
 * Get the server-side Supabase client for storage operations
 */
export function getStorage() {
  return getServerSupabase()
}

/**
 * Ensure the specified bucket exists
 * This is a noop if the bucket already exists
 */
export async function ensureBucket(name: string): Promise<void> {
  const supabase = getStorage()

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()

    if (listError) {
      console.error('Error listing buckets:', listError)
      return
    }

    const bucketExists = buckets?.some(bucket => bucket.id === name)

    if (!bucketExists) {
      console.warn(`Bucket "${name}" not found. Please run the storage setup SQL to create it.`)
    }
  } catch (error) {
    console.error('Error ensuring bucket exists:', error)
  }
}

/**
 * Upload an object to storage
 */
export async function putObject({
  key,
  bytes,
  contentType
}: {
  key: string
  bytes: Buffer
  contentType: string
}): Promise<{ key: string }> {
  const supabase = getStorage()
  const bucketName = process.env.UPLOADS_BUCKET || 'uploads'

  // Ensure bucket exists (lazy check)
  await ensureBucket(bucketName)

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(key, bytes, {
      contentType,
      cacheControl: '3600', // 1 hour cache
      upsert: false // Don't overwrite existing files
    })

  if (error) {
    throw new Error(`Failed to upload object: ${error.message}`)
  }

  return { key }
}

/**
 * Generate a signed URL for downloading an object
 */
export async function getSignedUrl({
  key,
  expiresInSec = 300
}: {
  key: string
  expiresInSec?: number
}): Promise<string> {
  const supabase = getStorage()
  const bucketName = process.env.UPLOADS_BUCKET || 'uploads'

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(key, expiresInSec)

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`)
  }

  if (!data?.signedUrl) {
    throw new Error('No signed URL returned')
  }

  return data.signedUrl
}

/**
 * Check if a MIME type is allowed for uploads
 */
export function allowedMime(mime: string): boolean {
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'application/pdf'
  ]

  return allowed.includes(mime.toLowerCase())
}

/**
 * Delete an object from storage
 */
export async function deleteObject(key: string): Promise<void> {
  const supabase = getStorage()
  const bucketName = process.env.UPLOADS_BUCKET || 'uploads'

  const { error } = await supabase.storage
    .from(bucketName)
    .remove([key])

  if (error) {
    throw new Error(`Failed to delete object: ${error.message}`)
  }
}

/**
 * List objects in storage with optional prefix
 */
export async function listObjects(prefix?: string): Promise<Array<{
  name: string
  id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  metadata: Record<string, any>
}>> {
  const supabase = getStorage()
  const bucketName = process.env.UPLOADS_BUCKET || 'uploads'

  const { data, error } = await supabase.storage
    .from(bucketName)
    .list(prefix, {
      limit: 100,
      offset: 0
    })

  if (error) {
    throw new Error(`Failed to list objects: ${error.message}`)
  }

  return data || []
}