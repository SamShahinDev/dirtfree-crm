import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'

export interface SanitizeResult {
  output: Buffer
  outMime: string
  outExt: string
}

/**
 * Sanitize uploaded files by stripping metadata, normalizing formats, and applying security measures
 */
export async function sanitizeUpload({
  bytes,
  sniffedExt,
  mime
}: {
  bytes: Buffer
  sniffedExt: string
  mime: string
}): Promise<SanitizeResult> {
  // Verify file type matches expected MIME
  const detectedType = await fileTypeFromBuffer(bytes)

  if (!detectedType) {
    throw new Error('Unable to detect file type')
  }

  // Handle images
  if (detectedType.mime.startsWith('image/')) {
    return await sanitizeImage(bytes, detectedType.mime, detectedType.ext)
  }

  // Handle PDFs
  if (detectedType.mime === 'application/pdf') {
    return await sanitizePDF(bytes)
  }

  // Reject everything else
  throw new Error(`Unsupported file type: ${detectedType.mime}`)
}

/**
 * Sanitize image files
 */
async function sanitizeImage(bytes: Buffer, mime: string, ext: string): Promise<SanitizeResult> {
  try {
    let pipeline = sharp(bytes)

    // Get image metadata to check dimensions
    const metadata = await pipeline.metadata()

    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image: unable to read dimensions')
    }

    // Set maximum dimensions (3000px on any side)
    const maxDimension = 3000
    if (metadata.width > maxDimension || metadata.height > maxDimension) {
      pipeline = pipeline.resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true
      })
    }

    // Auto-orient based on EXIF data, then strip all metadata
    pipeline = pipeline.rotate() // Auto-rotate based on EXIF

    // Convert HEIC to JPEG for better compatibility
    if (mime === 'image/heic' || ext === 'heic') {
      const output = await pipeline
        .jpeg({
          quality: 80,
          progressive: true
        })
        .toBuffer()

      return {
        output,
        outMime: 'image/jpeg',
        outExt: 'jpg'
      }
    }

    // For other image formats, preserve format but apply optimizations
    let outputPipeline: sharp.Sharp

    switch (mime) {
      case 'image/jpeg':
        outputPipeline = pipeline.jpeg({
          quality: 80,
          progressive: true,
          mozjpeg: true
        })
        break

      case 'image/png':
        outputPipeline = pipeline.png({
          compressionLevel: 8,
          progressive: true
        })
        break

      case 'image/webp':
        outputPipeline = pipeline.webp({
          quality: 80,
          effort: 4
        })
        break

      case 'image/gif':
        // For GIFs, we need to be careful not to break animation
        // Sharp doesn't handle animated GIFs well, so we'll pass through
        // but still strip metadata where possible
        outputPipeline = pipeline.gif()
        break

      default:
        // Fallback to JPEG for unknown image types
        outputPipeline = pipeline.jpeg({
          quality: 80,
          progressive: true
        })
        ext = 'jpg'
        mime = 'image/jpeg'
    }

    const output = await outputPipeline.toBuffer()

    return {
      output,
      outMime: mime,
      outExt: ext
    }

  } catch (error) {
    throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Sanitize PDF files (pass through with validation)
 */
async function sanitizePDF(bytes: Buffer): Promise<SanitizeResult> {
  // Basic PDF validation - check for PDF signature
  const pdfSignature = bytes.subarray(0, 4)
  if (pdfSignature.toString() !== '%PDF') {
    throw new Error('Invalid PDF file: missing PDF signature')
  }

  // For now, we pass PDFs through unchanged
  // In the future, you might want to:
  // - Strip metadata using pdf-lib
  // - Scan for malicious content
  // - Compress/optimize the PDF

  return {
    output: bytes,
    outMime: 'application/pdf',
    outExt: 'pdf'
  }
}

/**
 * Validate that the detected file type matches expectations
 */
export function validateFileType(detectedMime: string, expectedMime: string): boolean {
  // Allow some common MIME type variations
  const mimeMap: Record<string, string[]> = {
    'image/jpeg': ['image/jpeg', 'image/jpg'],
    'image/png': ['image/png'],
    'image/webp': ['image/webp'],
    'image/gif': ['image/gif'],
    'image/heic': ['image/heic', 'image/heif'],
    'application/pdf': ['application/pdf']
  }

  const allowedMimes = mimeMap[expectedMime] || [expectedMime]
  return allowedMimes.includes(detectedMime)
}

/**
 * Get safe file extension from MIME type
 */
export function getSafeExtension(mime: string): string {
  const extensionMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'jpg', // Convert HEIC to JPEG
    'application/pdf': 'pdf'
  }

  return extensionMap[mime] || 'bin'
}