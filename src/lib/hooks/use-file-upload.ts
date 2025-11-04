'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// File upload result type
export type UploadResult = {
  success: boolean
  url?: string
  error?: string
  fileName?: string
}

// File validation config
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function useFileUpload(bucket: string) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File size must be less than 5MB' }
    }

    // Check file type based on bucket
    const isImageBucket = bucket.includes('photo') || bucket.includes('image')
    const isDocumentBucket = bucket.includes('document') || bucket.includes('record')

    if (isImageBucket && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return { valid: false, error: 'Only JPEG, PNG, WebP, and GIF images are allowed' }
    }

    if (isDocumentBucket && !ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
      return { valid: false, error: 'Only PDF, TXT, DOC, and DOCX files are allowed' }
    }

    return { valid: true }
  }

  const generateUniqueFileName = (file: File): string => {
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop()
    return `${timestamp}_${randomSuffix}.${extension}`
  }

  const upload = async (file: File): Promise<UploadResult> => {
    try {
      setUploading(true)
      setProgress(0)

      // Validate file
      const validation = validateFile(file)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      // Generate unique filename
      const fileName = generateUniqueFileName(file)

      // Create Supabase client
      const supabase = createClient()

      // Upload file with progress tracking
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        return { success: false, error: error.message }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName)

      setProgress(100)

      return {
        success: true,
        url: publicUrl,
        fileName: fileName
      }

    } catch (error) {
      console.error('Unexpected upload error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    } finally {
      setUploading(false)
    }
  }

  const deleteFile = async (fileName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const supabase = createClient()

      const { error } = await supabase.storage
        .from(bucket)
        .remove([fileName])

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

  return {
    upload,
    deleteFile,
    uploading,
    progress,
    validateFile
  }
}

// Utility hook for multiple file uploads
export function useMultiFileUpload(bucket: string) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<string, number>>({})
  const { upload: uploadSingle, validateFile } = useFileUpload(bucket)

  const uploadMultiple = async (files: File[]): Promise<UploadResult[]> => {
    setUploading(true)

    const results: UploadResult[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileKey = `${file.name}_${i}`

      // Update progress for this file
      setProgress(prev => ({ ...prev, [fileKey]: 0 }))

      try {
        const result = await uploadSingle(file)
        results.push(result)

        // Mark this file as complete
        setProgress(prev => ({ ...prev, [fileKey]: 100 }))
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Upload failed'
        })
      }
    }

    setUploading(false)
    setProgress({})

    return results
  }

  return {
    uploadMultiple,
    uploading,
    progress,
    validateFile
  }
}