'use client'

import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, Image as ImageIcon, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useFileUpload, type UploadResult } from '@/lib/hooks/use-file-upload'

interface FileUploadProps {
  bucket: string
  onUploadComplete?: (result: UploadResult) => void
  onUploadError?: (error: string) => void
  accept?: 'images' | 'documents' | 'all'
  maxFiles?: number
  className?: string
  disabled?: boolean
}

interface UploadedFile {
  file: File
  preview?: string
  result?: UploadResult
  uploading?: boolean
}

export function FileUpload({
  bucket,
  onUploadComplete,
  onUploadError,
  accept = 'images',
  maxFiles = 1,
  className,
  disabled = false
}: FileUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const { upload, uploading, progress, validateFile } = useFileUpload(bucket)

  // Define accepted file types based on accept prop
  const getAcceptedFiles = () => {
    switch (accept) {
      case 'images':
        return {
          'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif']
        }
      case 'documents':
        return {
          'application/pdf': ['.pdf'],
          'text/plain': ['.txt'],
          'application/msword': ['.doc'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        }
      default:
        return {}
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (disabled) return

    // Validate files before processing
    const validFiles = acceptedFiles.filter(file => {
      const validation = validateFile(file)
      if (!validation.valid) {
        onUploadError?.(validation.error || 'Invalid file')
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    // Create file objects with previews for images
    const newFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      uploading: true
    }))

    setUploadedFiles(prev => [...prev, ...newFiles].slice(0, maxFiles))

    // Upload files
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]

      try {
        const result = await upload(file)

        setUploadedFiles(prev =>
          prev.map(f =>
            f.file === file
              ? { ...f, result, uploading: false }
              : f
          )
        )

        if (result.success) {
          onUploadComplete?.(result)
        } else {
          onUploadError?.(result.error || 'Upload failed')
        }
      } catch (error) {
        setUploadedFiles(prev =>
          prev.map(f =>
            f.file === file
              ? { ...f, uploading: false, result: { success: false, error: 'Upload failed' } }
              : f
          )
        )
        onUploadError?.(error instanceof Error ? error.message : 'Upload failed')
      }
    }
  }, [upload, validateFile, disabled, maxFiles, onUploadComplete, onUploadError])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: getAcceptedFiles(),
    maxFiles,
    disabled
  })

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev]
      const removedFile = newFiles[index]

      // Revoke object URL to prevent memory leaks
      if (removedFile.preview) {
        URL.revokeObjectURL(removedFile.preview)
      }

      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4" />
    }
    return <FileText className="h-4 w-4" />
  }

  const getResultIcon = (result?: UploadResult) => {
    if (!result) return null
    if (result.success) {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }
    return <AlertCircle className="h-4 w-4 text-red-600" />
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Drop Zone */}
      {uploadedFiles.length < maxFiles && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors relative z-20',
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} className="relative z-30" />
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            {isDragActive
              ? 'Drop files here...'
              : `Drag & drop ${accept === 'images' ? 'images' : accept === 'documents' ? 'documents' : 'files'} here, or click to select`}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {accept === 'images' && 'JPEG, PNG, WebP, GIF up to 5MB'}
            {accept === 'documents' && 'PDF, TXT, DOC, DOCX up to 5MB'}
            {accept === 'all' && 'Any file up to 5MB'}
          </p>
        </div>
      )}

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploadedFiles.map((uploadedFile, index) => (
            <div
              key={index}
              className="flex items-center p-3 bg-gray-50 rounded-lg border"
            >
              {/* File Preview/Icon */}
              <div className="flex-shrink-0 mr-3">
                {uploadedFile.preview ? (
                  <img
                    src={uploadedFile.preview}
                    alt="Preview"
                    className="h-12 w-12 object-cover rounded"
                  />
                ) : (
                  <div className="h-12 w-12 bg-gray-200 rounded flex items-center justify-center">
                    {getFileIcon(uploadedFile.file)}
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadedFile.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB
                </p>

                {/* Progress Bar */}
                {uploadedFile.uploading && (
                  <div className="mt-1">
                    <Progress value={progress} className="h-1" />
                  </div>
                )}

                {/* Error Message */}
                {uploadedFile.result && !uploadedFile.result.success && (
                  <p className="text-xs text-red-600 mt-1">
                    {uploadedFile.result.error}
                  </p>
                )}

                {/* Success Message */}
                {uploadedFile.result?.success && uploadedFile.result.url && (
                  <p className="text-xs text-green-600 mt-1">
                    Upload complete
                  </p>
                )}
              </div>

              {/* Status Icon */}
              <div className="flex-shrink-0 ml-2">
                {uploadedFile.uploading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                ) : (
                  getResultIcon(uploadedFile.result)
                )}
              </div>

              {/* Remove Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                className="flex-shrink-0 ml-2 h-8 w-8 p-0 relative z-10 cursor-pointer"
                disabled={uploadedFile.uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Status */}
      {uploading && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">Uploading files...</p>
        </div>
      )}
    </div>
  )
}

// Simple variant for single image upload with preview
export function ImageUpload({
  bucket,
  onUploadComplete,
  onUploadError,
  className,
  disabled = false,
  currentImageUrl
}: {
  bucket: string
  onUploadComplete?: (result: UploadResult) => void
  onUploadError?: (error: string) => void
  className?: string
  disabled?: boolean
  currentImageUrl?: string
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null)

  const handleUploadComplete = (result: UploadResult) => {
    if (result.success && result.url) {
      setPreviewUrl(result.url)
    }
    onUploadComplete?.(result)
  }

  return (
    <div className={cn('w-full', className)}>
      {previewUrl && (
        <div className="mb-4">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full h-48 object-cover rounded-lg border"
          />
        </div>
      )}

      <FileUpload
        bucket={bucket}
        accept="images"
        maxFiles={1}
        onUploadComplete={handleUploadComplete}
        onUploadError={onUploadError}
        disabled={disabled}
      />
    </div>
  )
}