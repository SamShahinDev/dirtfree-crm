import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase, createClient } from '@/lib/supabase/server'
import { z } from 'zod'

/**
 * Chatbot Configuration API
 *
 * GET /api/chatbot/config
 * - Returns all chatbot intent configurations
 * - Includes response templates, thresholds, and keywords
 *
 * PATCH /api/chatbot/config
 * - Update chatbot configuration for specific intent
 * - Only admins and managers can modify
 *
 * Authentication: Required (admin/manager for PATCH)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for config update
 */
const ConfigUpdateSchema = z.object({
  intent: z.string().min(1),
  responseTemplates: z.array(z.string()).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  autoEscalateBelow: z.number().min(0).max(1).optional(),
  requiresEscalation: z.boolean().optional(),
  active: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
  phrases: z.array(z.string()).optional(),
  followUpQuestions: z.array(z.string()).optional(),
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
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return false
  }

  return requiredRoles.includes(data.role)
}

/**
 * GET - Get all chatbot configurations
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

    // Get all configurations
    const serviceSupabase = getServiceSupabase()
    const { data: configs, error: configError } = await serviceSupabase.rpc(
      'get_active_chatbot_config'
    )

    if (configError) {
      console.error('[Chatbot Config] Error fetching configs:', configError)
      return createErrorResponse(
        'database_error',
        'Failed to fetch configurations',
        500
      )
    }

    // Transform to camelCase for frontend
    const transformedConfigs = (configs as any[] || []).map((config) => ({
      id: config.id,
      intent: config.intent,
      displayName: config.display_name,
      responseTemplates: config.response_templates || [],
      confidenceThreshold: parseFloat(config.confidence_threshold),
      autoEscalateBelow: parseFloat(config.auto_escalate_below),
      requiresEscalation: config.requires_escalation,
      keywords: config.keywords || [],
      phrases: config.phrases || [],
      followUpQuestions: config.follow_up_questions || [],
    }))

    return createSuccessResponse(transformedConfigs)
  } catch (error) {
    console.error('[Chatbot Config] GET /api/chatbot/config error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}

/**
 * PATCH - Update chatbot configuration
 */
export async function PATCH(request: NextRequest) {
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

    // Check if user is admin or manager
    const hasAccess = await checkUserRole(user.id, ['admin', 'manager'])

    if (!hasAccess) {
      return createErrorResponse(
        'forbidden',
        'Only admins and managers can modify chatbot configuration',
        403
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = ConfigUpdateSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid configuration data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const {
      intent,
      responseTemplates,
      confidenceThreshold,
      autoEscalateBelow,
      requiresEscalation,
      active,
      keywords,
      phrases,
      followUpQuestions,
    } = validation.data

    // Update configuration
    const serviceSupabase = getServiceSupabase()
    const { data: configId, error: updateError } = await serviceSupabase.rpc(
      'update_chatbot_config',
      {
        p_intent: intent,
        p_response_templates: responseTemplates
          ? JSON.stringify(responseTemplates)
          : null,
        p_confidence_threshold: confidenceThreshold || null,
        p_auto_escalate_below: autoEscalateBelow || null,
        p_requires_escalation: requiresEscalation ?? null,
        p_active: active ?? null,
        p_keywords: keywords ? JSON.stringify(keywords) : null,
        p_phrases: phrases ? JSON.stringify(phrases) : null,
        p_follow_up_questions: followUpQuestions
          ? JSON.stringify(followUpQuestions)
          : null,
        p_updated_by: user.id,
      } as any
    )

    if (updateError) {
      console.error('[Chatbot Config] Error updating config:', updateError)
      return createErrorResponse(
        'update_failed',
        'Failed to update configuration',
        500
      )
    }

    // Log audit event
    await serviceSupabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'chatbot_config_update',
      resource_type: 'chatbot_config',
      resource_id: configId,
      metadata: {
        intent,
        updates: validation.data,
      },
    } as any)

    return createSuccessResponse({
      message: 'Configuration updated successfully',
      intent,
      configId,
    })
  } catch (error) {
    console.error('[Chatbot Config] PATCH /api/chatbot/config error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
