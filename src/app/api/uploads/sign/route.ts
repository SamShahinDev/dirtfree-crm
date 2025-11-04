import { NextRequest, NextResponse } from 'next/server'

import { requireAuth } from '@/lib/auth/guards'
import { getUserRole } from '@/lib/auth/roles'
import { getSignedUrl } from '@/lib/storage'
import { parseObjectKey } from '@/lib/storage/keys'

interface SignResponse {
  ok: boolean
  url?: string
  expiresIn?: number
  error?: string
}

/**
 * GET /api/uploads/sign?key=...&ttl=...
 * Generate a fresh signed URL for an existing object
 */
export async function GET(request: NextRequest): Promise<NextResponse<SignResponse>> {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const ttlParam = searchParams.get('ttl')

    // Validate required parameters
    if (!key) {
      return NextResponse.json(
        { ok: false, error: 'Key parameter is required' },
        { status: 400 }
      )
    }

    // Parse and validate TTL
    let ttl = parseInt(process.env.UPLOADS_SIGNED_TTL || '300') // Default 5 minutes
    if (ttlParam) {
      const parsedTtl = parseInt(ttlParam)
      if (isNaN(parsedTtl) || parsedTtl < 1 || parsedTtl > 3600) {
        return NextResponse.json(
          { ok: false, error: 'TTL must be between 1 and 3600 seconds' },
          { status: 400 }
        )
      }
      ttl = parsedTtl
    }

    // Parse the object key to validate its structure
    const parsedKey = parseObjectKey(key)
    if (!parsedKey) {
      return NextResponse.json(
        { ok: false, error: 'Invalid object key format' },
        { status: 400 }
      )
    }

    // Additional authorization check for technicians
    // For now, we allow technicians to access any object
    // TODO: In P7.3, add strict checks that technicians can only access
    // objects related to their assigned trucks/jobs/threads
    if (role === 'technician') {
      // Basic validation - technicians can access any valid object for now
      // In the future, check if the technician has access to the specific entity
    }

    // Generate signed URL
    let signedUrl: string
    try {
      signedUrl = await getSignedUrl({
        key,
        expiresInSec: ttl
      })
    } catch (error) {
      console.error('Failed to generate signed URL:', error)

      // Check if it's an object not found error
      if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
        return NextResponse.json(
          { ok: false, error: 'Object not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(
        { ok: false, error: 'Failed to generate signed URL' },
        { status: 500 }
      )
    }

    // Return success response
    return NextResponse.json({
      ok: true,
      url: signedUrl,
      expiresIn: ttl
    })

  } catch (error) {
    console.error('Sign API error:', error)

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

// Only allow GET method
export async function POST() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use GET with query parameters.' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use GET with query parameters.' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { ok: false, error: 'Method not allowed. Use GET with query parameters.' },
    { status: 405 }
  )
}