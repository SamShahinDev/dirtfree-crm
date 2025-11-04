import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Opportunity Templates API
 *
 * GET /api/opportunities/templates
 * Returns template library with filtering options
 *
 * POST /api/opportunities/templates
 * Creates a new custom template
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

const CreateTemplateSchema = z.object({
  template_type: z.enum(['email', 'sms', 'script', 'offer', 'best_practice']),
  opportunity_type: z.string().optional(),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  variables: z.record(z.string(), z.string()).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  is_public: z.boolean().optional(),
})

function createErrorResponse(error: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, error, message, version: API_VERSION },
    { status }
  )
}

function createSuccessResponse<T>(data: T) {
  return NextResponse.json(
    { success: true, data, version: API_VERSION, timestamp: new Date().toISOString() }
  )
}

/**
 * Verify staff authentication
 */
async function verifyStaffAuth(supabase: any, userId: string): Promise<boolean> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return userRole && ['admin', 'manager', 'dispatcher', 'technician'].includes(userRole.role)
}

/**
 * GET - List templates with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify staff permissions
    const isStaff = await verifyStaffAuth(supabase, user.id)
    if (!isStaff) {
      return createErrorResponse(
        'forbidden',
        'Only staff members can view templates',
        403
      )
    }

    const { searchParams } = new URL(request.url)
    const templateType = searchParams.get('template_type')
    const opportunityType = searchParams.get('opportunity_type')
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const publicOnly = searchParams.get('public_only') === 'true'

    let query = supabase
      .from('opportunity_templates')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false })

    // Apply filters
    if (templateType) {
      query = query.eq('template_type', templateType)
    }

    if (opportunityType) {
      query = query.or(`opportunity_type.eq.${opportunityType},opportunity_type.is.null`)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (publicOnly) {
      query = query.eq('is_public', true)
    } else {
      // Show public templates + user's own templates
      query = query.or(`is_public.eq.true,created_by_user_id.eq.${user.id}`)
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,content.ilike.%${search}%,tags.cs.{${search}}`
      )
    }

    const { data: templates, error: fetchError } = await query

    if (fetchError) {
      console.error('[Templates] GET error:', fetchError)
      return createErrorResponse('fetch_failed', 'Failed to fetch templates', 500)
    }

    // Group templates by category for easier UI rendering
    const grouped = (templates || []).reduce((acc: any, template: any) => {
      const cat = template.category || 'other'
      if (!acc[cat]) {
        acc[cat] = []
      }
      acc[cat].push(template)
      return acc
    }, {})

    return createSuccessResponse({
      templates: templates || [],
      grouped,
      total: templates?.length || 0,
      filters: {
        template_type: templateType,
        opportunity_type: opportunityType,
        category,
        search,
      },
    })
  } catch (error) {
    console.error('[Templates] GET error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * POST - Create new template
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    // Verify staff permissions
    const isStaff = await verifyStaffAuth(supabase, user.id)
    if (!isStaff) {
      return createErrorResponse(
        'forbidden',
        'Only staff members can create templates',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = CreateTemplateSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid request: ${validation.error.issues.map((e) => e.message).join(', ')}`,
        400
      )
    }

    const templateData = validation.data

    // Create template
    const { data: template, error: createError } = await (supabase as any)
      .from('opportunity_templates')
      .insert({
        ...templateData,
        is_public: templateData.is_public ?? false,
        created_by_user_id: user.id,
        usage_count: 0,
      })
      .select()
      .single()

    if (createError) {
      console.error('[Templates] Create error:', createError)
      return createErrorResponse('create_failed', 'Failed to create template', 500)
    }

    return createSuccessResponse({
      message: 'Template created successfully',
      template,
    })
  } catch (error) {
    console.error('[Templates] POST error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * PATCH - Update template usage count
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return createErrorResponse('unauthorized', 'Authentication required', 401)
    }

    const body = await request.json()
    const { templateId } = body

    if (!templateId) {
      return createErrorResponse('invalid_request', 'Template ID required', 400)
    }

    // Increment usage count
    const { error: updateError } = await (supabase as any)
      .from('opportunity_templates')
      .update({
        usage_count: (supabase as any).raw('usage_count + 1'),
      })
      .eq('id', templateId)

    if (updateError) {
      console.error('[Templates] Usage update error:', updateError)
      // Don't fail the request if usage tracking fails
    }

    return createSuccessResponse({ message: 'Usage tracked' })
  } catch (error) {
    console.error('[Templates] PATCH error:', error)
    return createSuccessResponse({ message: 'Usage tracking skipped' })
  }
}
