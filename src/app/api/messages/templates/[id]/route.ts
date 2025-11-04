import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Message Template Operations API
 *
 * GET /api/messages/templates/[id]
 * - Get template details
 *
 * PATCH /api/messages/templates/[id]
 * - Update message template
 *
 * DELETE /api/messages/templates/[id]
 * - Delete message template
 *
 * POST /api/messages/templates/[id]/use
 * - Increment usage counter
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for template update
 */
const UpdateTemplateSchema = z.object({
  category: z.enum(['billing', 'scheduling', 'services', 'complaints', 'general', 'follow_up', 'emergency']).optional(),
  title: z.string().min(1).max(100).optional(),
  templateText: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  active: z.boolean().optional(),
})

/**
 * Standard error response
 */
function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

/**
 * Standard success response
 */
function createSuccessResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() },
    { status }
  )
}

/**
 * Check if user has required role
 */
async function checkUserRole(
  userId: string,
  requiredRoles: string[]
): Promise<boolean> {
  const supabase = getServiceSupabase()

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', requiredRoles)
    .single()

  return !error && !!data
}

/**
 * GET - Get template details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Check if user has staff role
    const hasAccess = await checkUserRole(user.id, [
      'admin',
      'manager',
      'dispatcher',
      'technician',
    ])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    const templateId = params.id

    // Get template
    const serviceSupabase = getServiceSupabase()
    const { data: template, error: templateError } = await serviceSupabase
      .from('message_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return createErrorResponse(
        'not_found',
        'Template not found',
        404
      )
    }

    return createSuccessResponse({
      id: (template as any).id,
      category: (template as any).category,
      title: (template as any).title,
      templateText: (template as any).template_text,
      variables: (template as any).variables || [],
      tags: (template as any).tags || [],
      useCount: (template as any).use_count,
      lastUsedAt: (template as any).last_used_at,
      createdByUserId: (template as any).created_by_user_id,
      updatedByUserId: (template as any).updated_by_user_id,
      active: (template as any).active,
      createdAt: (template as any).created_at,
      updatedAt: (template as any).updated_at,
    })
  } catch (error) {
    console.error('[Message Template] GET /api/messages/templates/[id] error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * PATCH - Update message template
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Check if user has staff role
    const hasAccess = await checkUserRole(user.id, [
      'admin',
      'manager',
      'dispatcher',
      'technician',
    ])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Insufficient permissions',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = UpdateTemplateSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid update data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const { category, title, templateText, variables, tags, active } = validation.data
    const templateId = params.id

    // Build update object
    const updateData: any = {}
    if (category !== undefined) updateData.category = category
    if (title !== undefined) updateData.title = title
    if (templateText !== undefined) updateData.template_text = templateText
    if (variables !== undefined) updateData.variables = JSON.stringify(variables)
    if (tags !== undefined) updateData.tags = JSON.stringify(tags)
    if (active !== undefined) updateData.active = active
    updateData.updated_by_user_id = user.id

    // Update template
    const serviceSupabase = getServiceSupabase()
    const { data: template, error: updateError } = await (serviceSupabase as any)
      .from('message_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single()

    if (updateError) {
      console.error('[Message Template] Error updating template:', updateError)
      return createErrorResponse(
        'update_failed',
        'Failed to update template',
        500
      )
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'message_template_updated',
      resource_type: 'message_template',
      resource_id: templateId,
      metadata: {
        updates: validation.data,
      },
    } as any)

    return createSuccessResponse({
      message: 'Template updated successfully',
      template: {
        id: (template as any).id,
        category: (template as any).category,
        title: (template as any).title,
        templateText: (template as any).template_text,
        variables: (template as any).variables,
        tags: (template as any).tags,
        active: (template as any).active,
      },
    })
  } catch (error) {
    console.error('[Message Template] PATCH /api/messages/templates/[id] error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * DELETE - Delete message template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Check if user has admin role or is the creator
    const templateId = params.id

    const serviceSupabase = getServiceSupabase()
    const { data: template } = await serviceSupabase
      .from('message_templates')
      .select('created_by_user_id')
      .eq('id', templateId)
      .single()

    if (!template) {
      return createErrorResponse('not_found', 'Template not found', 404)
    }

    const isAdmin = await checkUserRole(user.id, ['admin'])
    const isCreator = (template as any).created_by_user_id === user.id

    if (!isAdmin && !isCreator) {
      return createErrorResponse(
        'forbidden',
        'You can only delete your own templates',
        403
      )
    }

    // Delete template
    const { error: deleteError } = await (serviceSupabase as any)
      .from('message_templates')
      .delete()
      .eq('id', templateId)

    if (deleteError) {
      console.error('[Message Template] Error deleting template:', deleteError)
      return createErrorResponse(
        'deletion_failed',
        'Failed to delete template',
        500
      )
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'message_template_deleted',
      resource_type: 'message_template',
      resource_id: templateId,
    } as any)

    return createSuccessResponse({
      message: 'Template deleted successfully',
    })
  } catch (error) {
    console.error('[Message Template] DELETE /api/messages/templates/[id] error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Increment template usage counter
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const templateId = params.id

    // Increment usage
    const serviceSupabase = getServiceSupabase()
    const { error: incrementError } = await serviceSupabase.rpc(
      'increment_template_usage',
      { p_template_id: templateId } as any
    )

    if (incrementError) {
      console.error('[Message Template] Error incrementing usage:', incrementError)
      return createErrorResponse(
        'update_failed',
        'Failed to update usage',
        500
      )
    }

    return createSuccessResponse({
      message: 'Usage incremented successfully',
    })
  } catch (error) {
    console.error('[Message Template] POST /api/messages/templates/[id] error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
