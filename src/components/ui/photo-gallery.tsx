'use client'

import { useState } from 'react'
import { X, Download, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Photo {
  url: string
  alt?: string
}

interface PhotoGalleryProps {
  photos: Photo[]
  className?: string
  onDelete?: (index: number) => void
  showDeleteButton?: boolean
  maxPreviewImages?: number
  size?: 'sm' | 'md' | 'lg'
}

export function PhotoGallery({
  photos,
  className,
  onDelete,
  showDeleteButton = false,
  maxPreviewImages = 3,
  size = 'md'
}: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  if (!photos || photos.length === 0) {
    return null
  }

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32'
  }

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % photos.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + photos.length) % photos.length)
  }

  const downloadImage = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || `photo-${Date.now()}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error('Failed to download image:', error)
    }
  }

  const visiblePhotos = photos.slice(0, maxPreviewImages)
  const remainingCount = photos.length - maxPreviewImages

  return (
    <>
      {/* Photo Grid */}
      <div className={cn('flex flex-wrap gap-2', className)}>
        {visiblePhotos.map((photo, index) => (
          <div
            key={index}
            className={cn(
              'relative group cursor-pointer rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors',
              sizeClasses[size]
            )}
            onClick={() => openLightbox(index)}
          >
            <img
              src={photo.url}
              alt={photo.alt || `Photo ${index + 1}`}
              className="w-full h-full object-cover"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Delete button */}
            {showDeleteButton && onDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(index)
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}

        {/* Remaining count indicator */}
        {remainingCount > 0 && (
          <div
            className={cn(
              'relative cursor-pointer rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors bg-gray-100 flex items-center justify-center',
              sizeClasses[size]
            )}
            onClick={() => openLightbox(maxPreviewImages)}
          >
            <span className="text-sm font-medium text-gray-600">
              +{remainingCount}
            </span>
          </div>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl w-full h-full max-h-[90vh] p-0 bg-black border-none">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
              onClick={closeLightbox}
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Download button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-4 right-16 z-10 text-white hover:bg-white/20"
              onClick={() => downloadImage(photos[currentImageIndex].url)}
            >
              <Download className="h-4 w-4" />
            </Button>

            {/* Previous button */}
            {photos.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 text-white hover:bg-white/20"
                onClick={prevImage}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}

            {/* Next button */}
            {photos.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 text-white hover:bg-white/20"
                onClick={nextImage}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}

            {/* Main image */}
            <img
              src={photos[currentImageIndex].url}
              alt={photos[currentImageIndex].alt || `Photo ${currentImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />

            {/* Image counter */}
            {photos.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {photos.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Utility component for simple photo display with count
export function PhotoPreview({
  photos,
  maxVisible = 2,
  size = 'sm',
  className
}: {
  photos: string[]
  maxVisible?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  if (!photos || photos.length === 0) return null

  const photoObjects = photos.map((url, index) => ({ url, alt: `Photo ${index + 1}` }))

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <PhotoGallery
        photos={photoObjects}
        maxPreviewImages={maxVisible}
        size={size}
      />
      {photos.length > maxVisible && (
        <span className="text-xs text-gray-500">
          +{photos.length - maxVisible} more
        </span>
      )}
    </div>
  )
}