import { NextRequest, NextResponse } from 'next/server'
import { fileTypeFromBuffer } from 'file-type'

import { requireAuth, requireRole } from '@/lib/auth/guards'
import { getUserRole } from '@/lib/auth/roles'
import { getServerSupabase } from '@/lib/supabase/server'
import { allowedMime, putObject, getSignedUrl } from '@/lib/storage'
import { sanitizeUpload } from '@/lib/storage/sanitize'
import { buildObjectKey, validateUploadKind, type UploadKind } from '@/lib/storage/keys'

// Configuration from environment
const MAX_BYTES = parseInt(process.env.UPLOADS_MAX_BYTES || '5242880') // 5MB default
const SIGNED_TTL = parseInt(process.env.UPLOADS_SIGNED_TTL || '300') // 5 minutes default

interface UploadResponse {
  ok: boolean
  key?: string
  url?: string
  mime?: string
  size?: number
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Authentication & Authorization
    const user = await requireAuth()
    const role = await getUserRole(user.id)

    if (!role) {
      return NextResponse.json(
        { ok: false, error: 'Unable to determine user role' },
        { status: 403 }
      )
    }

    // Check role permissions - admin, dispatcher, technician allowed
    if (!['admin', 'dispatcher', 'technician'].includes(role)) {
      return NextResponse.json(
        { ok: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const kind = formData.get('kind') as string | null
    const entityId = formData.get('entityId') as string | null

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'File is required' },
        { status: 400 }
      )
    }

    if (!kind) {
      return NextResponse.json(
        { ok: false, error: 'Kind is required' },
        { status: 400 }
      )
    }

    if (!entityId) {
      return NextResponse.json(
        { ok: false, error: 'Entity ID is required' },
        { status: 400 }
      )
    }

    // Validate upload kind
    let uploadKind: UploadKind
    try {
      uploadKind = validateUploadKind(kind)
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : 'Invalid kind' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: `File too large. Maximum size is ${Math.round(MAX_BYTES / 1024 / 1024)}MB` },
        { status: 413 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { ok: false, error: 'File is empty' },
        { status: 400 }
      )
    }

    // Read file to buffer
    const bytes = Buffer.from(await file.arrayBuffer())

    // Detect actual file type
    const detectedType = await fileTypeFromBuffer(bytes)
    if (!detectedType) {
      return NextResponse.json(
        { ok: false, error: 'Unable to detect file type' },
        { status: 415 }
      )
    }

    // Validate MIME type
    if (!allowedMime(detectedType.mime)) {
      return NextResponse.json(
        { ok: false, error: `Unsupported file type: ${detectedType.mime}. Allowed types: image/jpeg, image/png, image/webp, image/gif, image/heic, application/pdf` },
        { status: 415 }
      )
    }

    // Cross-check with Content-Type header
    const contentType = file.type
    if (contentType && !allowedMime(contentType)) {
      return NextResponse.json(
        { ok: false, error: `Unsupported content type: ${contentType}` },
        { status: 415 }
      )
    }

    // Additional authorization check for technicians
    // Note: For now we do basic role checking. In P7.3 when threads/assignments
    // exist, we'll add strict checks for technician access to specific entities
    if (role === 'technician') {
      // Technicians can upload to any entity for now
      // TODO: Add strict entity access validation in P7.3
    }

    // Sanitize the upload
    let sanitizedResult
    try {
      sanitizedResult = await sanitizeUpload({
        bytes,
        sniffedExt: detectedType.ext,
        mime: detectedType.mime
      })
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: `File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 400 }
      )
    }

    const { output, outMime, outExt } = sanitizedResult

    // Generate object key
    const key = buildObjectKey({
      kind: uploadKind,
      entityId,
      ext: outExt
    })

    // Upload to storage
    try {
      await putObject({
        key,
        bytes: output,
        contentType: outMime
      })
    } catch (error) {
      console.error('Storage upload failed:', error)
      return NextResponse.json(
        { ok: false, error: 'Upload failed' },
        { status: 500 }
      )
    }

    // Generate signed URL
    let signedUrl: string
    try {
      signedUrl = await getSignedUrl({
        key,
        expiresInSec: SIGNED_TTL
      })
    } catch (error) {
      console.error('Signed URL generation failed:', error)
      // Don't fail the upload if URL generation fails
      signedUrl = ''
    }

    // Write audit log
    try {
      const supabase = getServerSupabase()
      await supabase
        .from('audit_logs')
        .insert({
          action: 'upload_object',
          entity: uploadKind,
          entity_id: entityId,
          meta: {
            key: key.substring(0, 100), // Truncate key for logging
            mime: outMime,
            size: output.length,
            original_name: file.name.substring(0, 100), // Truncate filename
            original_size: file.size
          }
        })
    } catch (error) {
      console.error('Audit log failed:', error)
      // Don't fail the upload if audit logging fails
    }

    // Return success response
    return NextResponse.json({
      ok: true,
      key,
      url: signedUrl,
      mime: outMime,
      size: output.length
    })

  } catch (error) {
    console.error('Upload API error:', error)

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Authentication')) {
        return NextResponse.json(
          { ok: false, error: 'Authentication required' },
          { status: 401 }
        )
      }

      if (error.message.includes('permissions') || error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { ok: false, error: 'Insufficient permissions' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Only allow POST method
export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    { status: 405 }
  )
}