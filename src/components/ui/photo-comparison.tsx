'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, Download, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface PhotoComparisonProps {
  beforePhotos?: string[]
  afterPhotos: string[]
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showLabels?: boolean
}

export function PhotoComparison({
  beforePhotos = [],
  afterPhotos,
  className,
  size = 'md',
  showLabels = true
}: PhotoComparisonProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; type: 'before' | 'after' } | null>(null)

  // Get the maximum number of photos to display
  const maxPhotos = Math.max(beforePhotos.length, afterPhotos.length)

  if (maxPhotos === 0) {
    return null
  }

  const sizeClasses = {
    sm: 'h-32 w-32',
    md: 'h-48 w-48',
    lg: 'h-64 w-64'
  }

  const openLightbox = (url: string, type: 'before' | 'after') => {
    setLightboxPhoto({ url, type })
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
    setLightboxPhoto(null)
  }

  const nextPhoto = () => {
    setCurrentIndex((prev) => (prev + 1) % maxPhotos)
  }

  const prevPhoto = () => {
    setCurrentIndex((prev) => (prev - 1 + maxPhotos) % maxPhotos)
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

  const currentBeforePhoto = beforePhotos[currentIndex]
  const currentAfterPhoto = afterPhotos[currentIndex]

  return (
    <>
      <div className={cn('space-y-4', className)}>
        {/* Navigation Header */}
        {maxPhotos > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Photo {currentIndex + 1} of {maxPhotos}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={prevPhoto}
                disabled={maxPhotos <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={nextPhoto}
                disabled={maxPhotos <= 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Photo Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Before Photo */}
          <div className="space-y-2">
            {showLabels && (
              <h4 className="text-sm font-medium text-gray-700">Before</h4>
            )}

            {currentBeforePhoto ? (
              <div className={cn(
                'relative group cursor-pointer rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors',
                sizeClasses[size]
              )}>
                <img
                  src={currentBeforePhoto}
                  alt={`Before photo ${currentIndex + 1}`}
                  className="w-full h-full object-cover"
                  onClick={() => openLightbox(currentBeforePhoto, 'before')}
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation()
                        openLightbox(currentBeforePhoto, 'before')
                      }}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadImage(currentBeforePhoto, `before-${currentIndex + 1}.jpg`)
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn(
                'flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg',
                sizeClasses[size]
              )}>
                <div className="text-center text-gray-500">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No before photo</p>
                </div>
              </div>
            )}
          </div>

          {/* After Photo */}
          <div className="space-y-2">
            {showLabels && (
              <h4 className="text-sm font-medium text-gray-700">After</h4>
            )}

            {currentAfterPhoto ? (
              <div className={cn(
                'relative group cursor-pointer rounded-lg overflow-hidden border-2 border-green-200 hover:border-green-400 transition-colors',
                sizeClasses[size]
              )}>
                <img
                  src={currentAfterPhoto}
                  alt={`After photo ${currentIndex + 1}`}
                  className="w-full h-full object-cover"
                  onClick={() => openLightbox(currentAfterPhoto, 'after')}
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation()
                        openLightbox(currentAfterPhoto, 'after')
                      }}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadImage(currentAfterPhoto, `after-${currentIndex + 1}.jpg`)
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn(
                'flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg',
                sizeClasses[size]
              )}>
                <div className="text-center text-gray-500">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No after photo</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Photo counter dots for multiple photos */}
        {maxPhotos > 1 && (
          <div className="flex justify-center gap-2">
            {Array.from({ length: maxPhotos }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                )}
                aria-label={`View photo ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl w-full h-full max-h-[90vh] p-0 bg-black border-none">
          {lightboxPhoto && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={closeLightbox}
              >
                ✕
              </Button>

              {/* Download button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-16 z-10 text-white hover:bg-white/20"
                onClick={() => downloadImage(
                  lightboxPhoto.url,
                  `${lightboxPhoto.type}-${currentIndex + 1}.jpg`
                )}
              >
                <Download className="h-4 w-4" />
              </Button>

              {/* Photo Type Label */}
              <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">
                {lightboxPhoto.type === 'before' ? 'Before' : 'After'}
              </div>

              {/* Main image */}
              <img
                src={lightboxPhoto.url}
                alt={`${lightboxPhoto.type} photo ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// Utility component for compact comparison display
export function PhotoComparisonPreview({
  beforePhotos = [],
  afterPhotos,
  className
}: {
  beforePhotos?: string[]
  afterPhotos: string[]
  className?: string
}) {
  if (afterPhotos.length === 0) return null

  const hasBeforePhoto = beforePhotos.length > 0
  const photoCount = Math.max(beforePhotos.length, afterPhotos.length)

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Thumbnail grid */}
      <div className="flex gap-2">
        {hasBeforePhoto && (
          <div className="relative">
            <img
              src={beforePhotos[0]}
              alt="Before"
              className="w-12 h-12 object-cover rounded border border-gray-200"
            />
            <div className="absolute -bottom-1 -left-1 bg-blue-600 text-white text-xs px-1 rounded">
              B
            </div>
          </div>
        )}
        <div className="relative">
          <img
            src={afterPhotos[0]}
            alt="After"
            className="w-12 h-12 object-cover rounded border border-green-200"
          />
          <div className="absolute -bottom-1 -right-1 bg-green-600 text-white text-xs px-1 rounded">
            A
          </div>
        </div>
      </div>

      {/* Photo count */}
      <div className="text-xs text-gray-500">
        {photoCount} photo{photoCount === 1 ? '' : 's'}
        {hasBeforePhoto ? ' (before/after)' : ' (after only)'}
      </div>
    </div>
  )
}