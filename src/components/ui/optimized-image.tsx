'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  containerClassName?: string
  priority?: boolean
  quality?: number
  fill?: boolean
  sizes?: string
  onLoad?: () => void
  fallback?: string
}

export function OptimizedImage({
  src,
  alt,
  width = 400,
  height = 300,
  className = '',
  containerClassName = '',
  priority = false,
  quality = 85,
  fill = false,
  sizes,
  onLoad,
  fallback = '/images/placeholder.jpg'
}: OptimizedImageProps) {
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const handleLoad = () => {
    setLoading(false)
    onLoad?.()
  }

  const handleError = () => {
    setError(true)
    setLoading(false)
  }

  // Use fallback image if there's an error
  const imageSrc = error ? fallback : src

  if (fill) {
    return (
      <div className={cn('relative overflow-hidden', containerClassName)}>
        {isLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
        )}
        <Image
          src={imageSrc}
          alt={alt}
          fill
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          quality={quality}
          sizes={sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'duration-700 ease-in-out object-cover',
            isLoading ? 'scale-110 blur-2xl grayscale' : 'scale-100 blur-0 grayscale-0',
            className
          )}
        />
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', containerClassName)} style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        quality={quality}
        sizes={sizes}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'duration-700 ease-in-out',
          isLoading ? 'scale-110 blur-2xl grayscale' : 'scale-100 blur-0 grayscale-0',
          className
        )}
      />
    </div>
  )
}

// Thumbnail variant for lists
interface ThumbnailImageProps {
  src: string
  alt: string
  size?: number
  className?: string
}

export function ThumbnailImage({
  src,
  alt,
  size = 40,
  className = ''
}: ThumbnailImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      quality={75}
      className={cn('rounded-full object-cover', className)}
      containerClassName={cn('rounded-full', className)}
    />
  )
}

// Avatar component with fallback
interface AvatarImageProps {
  src?: string | null
  name: string
  size?: number
  className?: string
}

export function AvatarImage({
  src,
  name,
  size = 40,
  className = ''
}: AvatarImageProps) {
  const initials = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (!src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 text-white font-medium rounded-full',
          className
        )}
        style={{ width: size, height: size }}
      >
        <span style={{ fontSize: size * 0.4 }}>{initials}</span>
      </div>
    )
  }

  return (
    <OptimizedImage
      src={src}
      alt={name}
      width={size}
      height={size}
      quality={75}
      className={cn('rounded-full object-cover', className)}
      containerClassName="rounded-full"
      fallback={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${size}&background=3b82f6&color=fff`}
    />
  )
}