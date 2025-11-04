import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Message Templates API
 *
 * GET /api/messages/templates
 * - List all templates with optional filtering
 * - Query params: category, search, activeOnly
 *
 * POST /api/messages/templates
 * - Create new message template
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for template creation/update
 */
const TemplateSchema = z.object({
  category: z.enum(['billing', 'scheduling', 'services', 'complaints', 'general', 'follow_up', 'emergency']),
  title: z.string().min(1).max(100),
  templateText: z.string().min(1),
  variables: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  active: z.boolean().optional().default(true),
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
 * GET - List message templates
 */
export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const serviceSupabase = getServiceSupabase()

    // Use search function if search query provided
    if (search) {
      const { data: templates, error: searchError } = await serviceSupabase.rpc(
        'search_message_templates',
        {
          p_search_query: search,
          p_category: category,
          p_active_only: activeOnly,
        } as any
      )

      if (searchError) {
        console.error('[Message Templates] Search error:', searchError)
        return createErrorResponse(
          'search_failed',
          'Failed to search templates',
          500
        )
      }

      const transformedTemplates = (templates as any[] || []).map((template) => ({
        id: template.id,
        category: template.category,
        title: template.title,
        templateText: template.template_text,
        variables: template.variables || [],
        tags: template.tags || [],
        useCount: template.use_count,
        lastUsedAt: template.last_used_at,
      }))

      return createSuccessResponse({ templates: transformedTemplates })
    }

    // Otherwise, get all templates with optional category filter
    let query = serviceSupabase
      .from('message_templates')
      .select('*')

    if (activeOnly) {
      query = query.eq('active', true)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: templates, error: templatesError } = await query.order('use_count', { ascending: false })

    if (templatesError) {
      console.error('[Message Templates] Error fetching templates:', templatesError)
      return createErrorResponse(
        'database_error',
        'Failed to fetch templates',
        500
      )
    }

    // Transform to camelCase
    const transformedTemplates = (templates || []).map((template: any) => ({
      id: template.id,
      category: template.category,
      title: template.title,
      templateText: template.template_text,
      variables: template.variables || [],
      tags: template.tags || [],
      useCount: template.use_count,
      lastUsedAt: template.last_used_at,
      createdByUserId: template.created_by_user_id,
      active: template.active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    }))

    // Get statistics
    const { data: stats } = await serviceSupabase.rpc('get_template_statistics')

    return createSuccessResponse({
      templates: transformedTemplates,
      statistics: stats || [],
    })
  } catch (error) {
    console.error('[Message Templates] GET /api/messages/templates error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Create new message template
 */
export async function POST(request: NextRequest) {
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
    const validation = TemplateSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid template data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const { category, title, templateText, variables, tags, active } = validation.data

    // Create template
    const serviceSupabase = getServiceSupabase()
    const { data: template, error: createError } = await serviceSupabase
      .from('message_templates')
      .insert({
        category,
        title,
        template_text: templateText,
        variables: JSON.stringify(variables),
        tags: JSON.stringify(tags),
        active,
        created_by_user_id: user.id,
      } as any)
      .select()
      .single()

    if (createError || !template) {
      console.error('[Message Templates] Error creating template:', createError)
      return createErrorResponse(
        'creation_failed',
        'Failed to create template',
        500
      )
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'message_template_created',
      resource_type: 'message_template',
      resource_id: (template as any).id,
      metadata: {
        category,
        title,
      },
    } as any)

    return createSuccessResponse({
      message: 'Template created successfully',
      template: {
        id: (template as any).id,
        category: (template as any).category,
        title: (template as any).title,
        templateText: (template as any).template_text,
        variables: (template as any).variables,
        tags: (template as any).tags,
        active: (template as any).active,
      },
    }, 201)
  } catch (error) {
    console.error('[Message Templates] POST /api/messages/templates error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
