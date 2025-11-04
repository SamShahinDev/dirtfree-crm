import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { getServiceSupabase } from '@/lib/supabase/server'
import { createPortalAuditLog } from '@/lib/audit/portal-audit'
import {
  validateAttachment,
  generateAttachmentFilename,
} from '@/lib/portal/message-filter'
import { notifyStaffOfReply } from '@/lib/portal/message-notifications'
import { z } from 'zod'

/**
 * Message Reply API
 *
 * POST /api/portal/messages/[id]/reply
 * - Add customer reply to existing thread
 * - Support image attachments (up to 5MB each)
 * - Upload attachments to Supabase Storage
 * - Notify staff of new reply
 * - Reset unread count for customer
 */

const rateLimiter = getPortalRateLimiter()
const API_VERSION = 'v1'
const MAX_ATTACHMENTS = 5

/**
 * CORS headers
 */
function getCorsHeaders(origin?: string | null): HeadersInit {
  const envOrigins = process.env.ALLOWED_PORTAL_ORIGINS?.split(',').map(o => o.trim()) || []
  const allowedOrigins = [
    ...envOrigins,
    process.env.NEXT_PUBLIC_PORTAL_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null,
  ].filter(Boolean) as string[]

  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Portal-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  }
}

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ success: false, error, message, version: API_VERSION }, { status, headers })
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, headers?: HeadersInit) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status: 200, headers }
  )
}

/**
 * Reply schema
 */
const ReplySchema = z.object({
  message: z.string().min(1).max(5000),
})

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(origin) })
}

/**
 * POST - Add reply to message thread
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Extract and validate portal token
    const portalToken = request.headers.get('X-Portal-Token') ||
                        request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!portalToken) {
      return createErrorResponse('authentication_required', 'Portal token required', 401, corsHeaders)
    }

    const auth = await validatePortalToken(portalToken)
    const rateLimitResult = await rateLimiter.limit(auth.customerId)
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.success) {
      return createErrorResponse('rate_limit_exceeded', 'Too many requests', 429, { ...corsHeaders, ...rateLimitHeaders })
    }

    const { id: threadId } = await params

    // Verify thread exists and belongs to customer
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)

    const { data: thread, error: threadError } = await supabase
      .from('truck_threads')
      .select('id, title, customer_id, status')
      .eq('id', threadId)
      .eq('customer_id', auth.customerId)
      .single()

    if (threadError || !thread) {
      return createErrorResponse('thread_not_found', 'Message thread not found or access denied', 404, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Check if thread is closed
    if (thread.status === 'closed') {
      return createErrorResponse('thread_closed', 'Cannot reply to closed thread', 400, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Parse form data (multipart/form-data for file uploads)
    const contentType = request.headers.get('content-type') || ''
    let message: string
    let attachments: File[] = []

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data with files
      const formData = await request.formData()
      message = formData.get('message') as string

      // Extract file attachments
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('attachment') && value instanceof File) {
          if (attachments.length >= MAX_ATTACHMENTS) {
            return createErrorResponse(
              'too_many_attachments',
              `Maximum ${MAX_ATTACHMENTS} attachments allowed`,
              400,
              { ...corsHeaders, ...rateLimitHeaders }
            )
          }
          attachments.push(value)
        }
      }
    } else {
      // Handle JSON body (no files)
      const body = await request.json()
      const validation = ReplySchema.safeParse(body)

      if (!validation.success) {
        return createErrorResponse(
          'validation_error',
          validation.error.errors.map(e => e.message).join(', '),
          400,
          { ...corsHeaders, ...rateLimitHeaders }
        )
      }

      message = validation.data.message
    }

    // Validate message
    if (!message || message.trim().length === 0) {
      return createErrorResponse('validation_error', 'Message is required', 400, { ...corsHeaders, ...rateLimitHeaders })
    }

    if (message.length > 5000) {
      return createErrorResponse('validation_error', 'Message must be less than 5000 characters', 400, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Validate attachments
    for (const file of attachments) {
      const validation = validateAttachment({
        type: file.type,
        size: file.size,
      })

      if (!validation.valid) {
        return createErrorResponse('invalid_attachment', validation.error || 'Invalid attachment', 400, { ...corsHeaders, ...rateLimitHeaders })
      }
    }

    // Upload attachments to Supabase Storage
    const serviceSupabase = getServiceSupabase()
    const uploadedUrls: string[] = []

    for (const file of attachments) {
      try {
        const filename = generateAttachmentFilename(auth.customerId, threadId, file.name)
        const fileBuffer = await file.arrayBuffer()

        const { data: uploadData, error: uploadError } = await serviceSupabase.storage
          .from('uploads')
          .upload(filename, fileBuffer, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('[Portal API] File upload error:', uploadError)
          // Clean up already uploaded files
          for (const url of uploadedUrls) {
            const path = url.split('/uploads/')[1]
            await serviceSupabase.storage.from('uploads').remove([path])
          }
          return createErrorResponse('upload_failed', 'Failed to upload attachment', 500, { ...corsHeaders, ...rateLimitHeaders })
        }

        // Get public URL
        const { data: publicUrlData } = serviceSupabase.storage
          .from('uploads')
          .getPublicUrl(uploadData.path)

        uploadedUrls.push(publicUrlData.publicUrl)
      } catch (uploadErr) {
        console.error('[Portal API] Attachment processing error:', uploadErr)
        return createErrorResponse('upload_failed', 'Failed to process attachment', 500, { ...corsHeaders, ...rateLimitHeaders })
      }
    }

    // Create reply post
    const { data: post, error: postError } = await serviceSupabase
      .from('truck_posts')
      .insert({
        thread_id: threadId,
        kind: 'reply',
        body: message,
        content: message,
        author_id: auth.customerId,
        image_urls: uploadedUrls,
        status: 'open',
        urgent: false,
      })
      .select()
      .single()

    if (postError || !post) {
      console.error('[Portal API] Failed to create reply:', postError)
      // Clean up uploaded files
      for (const url of uploadedUrls) {
        const path = url.split('/uploads/')[1]
        await serviceSupabase.storage.from('uploads').remove([path])
      }
      return createErrorResponse('reply_failed', 'Failed to create reply', 500, { ...corsHeaders, ...rateLimitHeaders })
    }

    // Reopen thread if it was resolved
    if (thread.status === 'resolved') {
      await serviceSupabase
        .from('truck_threads')
        .update({ status: 'open', resolved_at: null, resolved_by: null })
        .eq('id', threadId)
    }

    // Create audit log
    await createPortalAuditLog({
      actorId: auth.userId,
      action: 'CREATE',
      entity: 'customer',
      entityId: post.id,
      meta: {
        action: 'message_reply_created',
        threadId,
        threadTitle: thread.title,
        hasAttachments: uploadedUrls.length > 0,
        attachmentCount: uploadedUrls.length,
      },
    })

    // Notify staff members of new reply (non-blocking)
    notifyStaffOfReply({
      threadId,
      customerId: auth.customerId,
      message,
      hasAttachments: uploadedUrls.length > 0,
    }).catch((error) => {
      console.error('[Portal API] Failed to notify staff of reply:', error)
      // Don't fail the request if notification fails
    })

    return createSuccessResponse(
      {
        postId: post.id,
        threadId,
        attachments: uploadedUrls,
        message: 'Reply sent successfully',
      },
      { ...corsHeaders, ...rateLimitHeaders }
    )

  } catch (error) {
    console.error('[Portal API] POST /api/portal/messages/[id]/reply error:', error)
    return createErrorResponse('server_error', error instanceof Error ? error.message : 'Internal server error', 500, corsHeaders)
  }
}
