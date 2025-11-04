'use server'

import { createClient } from '@/lib/supabase/server'

// Types
export interface FileItem {
  id: string
  name: string
  type: 'image' | 'document' | 'other'
  size: number
  url: string
  createdAt: string
  bucket: string
  mimeType: string
  category?: string
  source: 'job_photos' | 'vehicle_photos' | 'customer_documents'
  sourceId?: string
  sourceName?: string
}

export interface FileStats {
  totalFiles: number
  totalSize: number
  imageCount: number
  documentCount: number
  bucketBreakdown: Record<string, { count: number; size: number }>
}

// Action result type
type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * Get all files from all sources
 */
export async function getAllFiles(): Promise<ActionResult<FileItem[]>> {
  try {
    const supabase = await createClient()

    // Get files from different sources
    const [jobPhotosResult, vehiclePhotosResult, customerDocsResult] = await Promise.all([
      getJobPhotos(supabase),
      getVehiclePhotos(supabase),
      getCustomerDocuments(supabase)
    ])

    const allFiles: FileItem[] = [
      ...(jobPhotosResult || []),
      ...(vehiclePhotosResult || []),
      ...(customerDocsResult || [])
    ]

    // Sort by creation date (newest first)
    allFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return { success: true, data: allFiles }
  } catch (error) {
    console.error('Error in getAllFiles:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get file statistics
 */
export async function getFileStats(): Promise<ActionResult<FileStats>> {
  try {
    const filesResult = await getAllFiles()
    if (!filesResult.success || !filesResult.data) {
      return { success: false, error: 'Failed to fetch files for statistics' }
    }

    const files = filesResult.data
    const stats: FileStats = {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      imageCount: files.filter(file => file.type === 'image').length,
      documentCount: files.filter(file => file.type === 'document').length,
      bucketBreakdown: files.reduce((acc, file) => {
        if (!acc[file.bucket]) {
          acc[file.bucket] = { count: 0, size: 0 }
        }
        acc[file.bucket].count++
        acc[file.bucket].size += file.size
        return acc
      }, {} as Record<string, { count: number; size: number }>)
    }

    return { success: true, data: stats }
  } catch (error) {
    console.error('Error in getFileStats:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Delete multiple files
 */
export async function deleteFiles(fileIds: string[]): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: 'Authentication required' }
    }

    // Note: In a real implementation, you would need to:
    // 1. Determine which table each file belongs to
    // 2. Check permissions for each file
    // 3. Delete the file records from appropriate tables
    // 4. Delete the actual files from storage

    // For now, this is a placeholder implementation
    console.log('Would delete files:', fileIds)

    return { success: true }
  } catch (error) {
    console.error('Error in deleteFiles:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// Helper functions to get files from different sources

async function getJobPhotos(supabase: any): Promise<FileItem[]> {
  try {
    // Get job completion records with photos
    const { data: completions, error } = await supabase
      .from('job_completions')
      .select(`
        id,
        job_id,
        before_photos,
        after_photos,
        completed_at,
        jobs!inner(
          id,
          customers(name)
        )
      `)
      .not('before_photos', 'is', null)
      .not('after_photos', 'is', null)

    if (error) {
      console.error('Error fetching job photos:', error)
      return []
    }

    const files: FileItem[] = []

    completions?.forEach((completion: any) => {
      const customerName = completion.jobs?.customers?.name || 'Unknown Customer'

      // Add before photos
      if (completion.before_photos && Array.isArray(completion.before_photos)) {
        completion.before_photos.forEach((url: string, index: number) => {
          files.push({
            id: `job-before-${completion.id}-${index}`,
            name: `Job ${completion.job_id} - Before ${index + 1}.jpg`,
            type: 'image',
            size: 0, // Would need to fetch from storage metadata
            url,
            createdAt: completion.completed_at,
            bucket: 'job-photos',
            mimeType: 'image/jpeg',
            category: 'before',
            source: 'job_photos',
            sourceId: completion.job_id,
            sourceName: `Job for ${customerName}`
          })
        })
      }

      // Add after photos
      if (completion.after_photos && Array.isArray(completion.after_photos)) {
        completion.after_photos.forEach((url: string, index: number) => {
          files.push({
            id: `job-after-${completion.id}-${index}`,
            name: `Job ${completion.job_id} - After ${index + 1}.jpg`,
            type: 'image',
            size: 0, // Would need to fetch from storage metadata
            url,
            createdAt: completion.completed_at,
            bucket: 'job-photos',
            mimeType: 'image/jpeg',
            category: 'after',
            source: 'job_photos',
            sourceId: completion.job_id,
            sourceName: `Job for ${customerName}`
          })
        })
      }
    })

    return files
  } catch (error) {
    console.error('Error in getJobPhotos:', error)
    return []
  }
}

async function getVehiclePhotos(supabase: any): Promise<FileItem[]> {
  try {
    // Get truck posts with photos
    const { data: posts, error } = await supabase
      .from('truck_posts')
      .select(`
        id,
        truck_id,
        image_urls,
        created_at,
        trucks!inner(
          id,
          name,
          license_plate
        )
      `)
      .not('image_urls', 'is', null)

    if (error) {
      console.error('Error fetching vehicle photos:', error)
      return []
    }

    const files: FileItem[] = []

    posts?.forEach((post: any) => {
      const truckName = post.trucks?.name || `Truck ${post.trucks?.license_plate}` || 'Unknown Vehicle'

      if (post.image_urls && Array.isArray(post.image_urls)) {
        post.image_urls.forEach((url: string, index: number) => {
          files.push({
            id: `vehicle-${post.id}-${index}`,
            name: `${truckName} - Photo ${index + 1}.jpg`,
            type: 'image',
            size: 0, // Would need to fetch from storage metadata
            url,
            createdAt: post.created_at,
            bucket: 'vehicle-photos',
            mimeType: 'image/jpeg',
            category: 'vehicle',
            source: 'vehicle_photos',
            sourceId: post.truck_id,
            sourceName: truckName
          })
        })
      }
    })

    return files
  } catch (error) {
    console.error('Error in getVehiclePhotos:', error)
    return []
  }
}

async function getCustomerDocuments(supabase: any): Promise<FileItem[]> {
  try {
    // Get customer documents
    const { data: documents, error } = await supabase
      .from('customer_documents')
      .select(`
        id,
        customer_id,
        filename,
        original_name,
        file_url,
        file_type,
        mime_type,
        file_size,
        uploaded_at,
        customers!inner(
          id,
          name
        )
      `)

    if (error) {
      console.error('Error fetching customer documents:', error)
      return []
    }

    const files: FileItem[] = documents?.map((doc: any) => ({
      id: `customer-doc-${doc.id}`,
      name: doc.original_name,
      type: doc.mime_type?.startsWith('image/') ? 'image' : 'document',
      size: doc.file_size || 0,
      url: doc.file_url,
      createdAt: doc.uploaded_at,
      bucket: 'customer-documents',
      mimeType: doc.mime_type || 'application/octet-stream',
      category: doc.file_type,
      source: 'customer_documents',
      sourceId: doc.customer_id,
      sourceName: doc.customers?.name || 'Unknown Customer'
    })) || []

    return files
  } catch (error) {
    console.error('Error in getCustomerDocuments:', error)
    return []
  }
}