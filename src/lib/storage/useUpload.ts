'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'

import type { UploadKind } from './keys'

interface UploadResult {
  key: string
  url: string
  mime: string
  size: number
}

interface UploadOptions {
  file: File
  kind: UploadKind
  entityId: string
  onProgress?: (progress: number) => void
}

interface UploadState {
  isUploading: boolean
  progress: number
  error: string | null
}

interface UploadResponse {
  ok: boolean
  key?: string
  url?: string
  mime?: string
  size?: number
  error?: string
}

/**
 * Hook for uploading files to the secure storage API
 */
export function useUpload() {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null
  })

  const upload = useCallback(async ({
    file,
    kind,
    entityId,
    onProgress
  }: UploadOptions): Promise<UploadResult> => {
    setState({
      isUploading: true,
      progress: 0,
      error: null
    })

    try {
      // Validate inputs
      if (!file) {
        throw new Error('File is required')
      }

      if (!kind) {
        throw new Error('Upload kind is required')
      }

      if (!entityId) {
        throw new Error('Entity ID is required')
      }

      // Check file size (client-side check for better UX)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        throw new Error(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`)
      }

      if (file.size === 0) {
        throw new Error('File is empty')
      }

      // Check file type (basic client-side check)
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/heic',
        'application/pdf'
      ]

      if (!allowedTypes.includes(file.type.toLowerCase())) {
        throw new Error(`Unsupported file type: ${file.type}`)
      }

      // Create form data
      const formData = new FormData()
      formData.append('file', file)
      formData.append('kind', kind)
      formData.append('entityId', entityId)

      // Track upload progress
      onProgress?.(25)
      setState(prev => ({ ...prev, progress: 25 }))

      // Make the upload request
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData
      })

      onProgress?.(75)
      setState(prev => ({ ...prev, progress: 75 }))

      // Parse response
      const result: UploadResponse = await response.json()

      onProgress?.(90)
      setState(prev => ({ ...prev, progress: 90 }))

      if (!response.ok || !result.ok) {
        const errorMessage = result.error || `Upload failed with status ${response.status}`

        // Show user-friendly error messages
        if (response.status === 401) {
          throw new Error('You need to be logged in to upload files')
        } else if (response.status === 403) {
          throw new Error('You don\'t have permission to upload files')
        } else if (response.status === 413) {
          throw new Error('File is too large')
        } else if (response.status === 415) {
          throw new Error('This file type is not supported')
        } else {
          throw new Error(errorMessage)
        }
      }

      if (!result.key || !result.url) {
        throw new Error('Invalid response from server')
      }

      onProgress?.(100)
      setState({
        isUploading: false,
        progress: 100,
        error: null
      })

      return {
        key: result.key,
        url: result.url,
        mime: result.mime || file.type,
        size: result.size || file.size
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'

      setState({
        isUploading: false,
        progress: 0,
        error: errorMessage
      })

      // Show error toast
      toast.error(`Upload failed: ${errorMessage}`)

      throw error
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null
    })
  }, [])

  return {
    upload,
    reset,
    ...state
  }
}

/**
 * Hook for multiple file uploads
 */
export function useBatchUpload() {
  const [uploads, setUploads] = useState<Map<string, UploadState>>(new Map())
  const [overallProgress, setOverallProgress] = useState(0)

  const uploadFiles = useCallback(async (
    files: Array<{
      file: File
      kind: UploadKind
      entityId: string
      id?: string // Optional ID for tracking
    }>
  ): Promise<UploadResult[]> => {
    if (files.length === 0) {
      return []
    }

    // Initialize upload states
    const uploadMap = new Map<string, UploadState>()
    files.forEach((fileUpload, index) => {
      const id = fileUpload.id || `upload-${index}`
      uploadMap.set(id, {
        isUploading: true,
        progress: 0,
        error: null
      })
    })
    setUploads(uploadMap)

    const results: UploadResult[] = []
    const errors: string[] = []

    try {
      // Upload files concurrently (but limit concurrency)
      const chunkSize = 3 // Max 3 concurrent uploads
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize)

        const chunkPromises = chunk.map(async (fileUpload, chunkIndex) => {
          const globalIndex = i + chunkIndex
          const id = fileUpload.id || `upload-${globalIndex}`

          try {
            const { upload } = useUpload()

            const result = await upload({
              file: fileUpload.file,
              kind: fileUpload.kind,
              entityId: fileUpload.entityId,
              onProgress: (progress) => {
                setUploads(prev => {
                  const updated = new Map(prev)
                  updated.set(id, {
                    isUploading: progress < 100,
                    progress,
                    error: null
                  })
                  return updated
                })

                // Update overall progress
                const totalProgress = Array.from(uploads.values())
                  .reduce((sum, state) => sum + state.progress, 0) / files.length
                setOverallProgress(totalProgress)
              }
            })

            return { success: true, result, id }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed'

            setUploads(prev => {
              const updated = new Map(prev)
              updated.set(id, {
                isUploading: false,
                progress: 0,
                error: errorMessage
              })
              return updated
            })

            return { success: false, error: errorMessage, id }
          }
        })

        const chunkResults = await Promise.allSettled(chunkPromises)

        chunkResults.forEach((promiseResult) => {
          if (promiseResult.status === 'fulfilled') {
            if (promiseResult.value.success) {
              results.push(promiseResult.value.result)
            } else {
              errors.push(promiseResult.value.error)
            }
          } else {
            errors.push(promiseResult.reason?.message || 'Upload failed')
          }
        })
      }

      setOverallProgress(100)

      if (errors.length > 0) {
        toast.error(`${errors.length} upload(s) failed`)
      }

      if (results.length > 0) {
        toast.success(`${results.length} file(s) uploaded successfully`)
      }

      return results

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch upload failed'
      toast.error(errorMessage)
      throw error
    }
  }, [uploads])

  const reset = useCallback(() => {
    setUploads(new Map())
    setOverallProgress(0)
  }, [])

  return {
    uploadFiles,
    reset,
    uploads,
    overallProgress,
    isUploading: Array.from(uploads.values()).some(state => state.isUploading)
  }
}