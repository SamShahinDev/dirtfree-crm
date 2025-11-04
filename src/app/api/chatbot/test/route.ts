import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createChatbotEngine, generateSessionId } from '@/lib/chatbot/engine'
import { z } from 'zod'

/**
 * Chatbot Testing API
 *
 * POST /api/chatbot/test
 * - Test chatbot with a message
 * - Returns intent detection results and generated response
 * - Does not save to database (test mode)
 *
 * Authentication: Required (staff only)
 */

const API_VERSION = 'v1'

/**
 * Validation schema for test request
 */
const TestRequestSchema = z.object({
  message: z.string().min(1),
  customerId: z.string().uuid().optional(),
  sessionId: z.string().optional(),
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
  const { getServiceSupabase } = await import('@/lib/supabase/server')
  const supabase = getServiceSupabase()

  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error || !data) {
    return false
  }

  return requiredRoles.includes(data.role)
}

/**
 * POST - Test chatbot with a message
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
    const validation = TestRequestSchema.safeParse(body)

    if (!validation.success) {
      return createErrorResponse(
        'validation_failed',
        `Invalid test data: ${validation.error.issues.map((e: any) => e.message).join(', ')}`,
        400
      )
    }

    const { message, customerId, sessionId } = validation.data

    // Generate or use provided session ID
    const testSessionId = sessionId || `test_${generateSessionId()}`

    // Create chatbot engine instance
    const chatbot = createChatbotEngine(testSessionId, customerId)

    // Initialize with customer data if provided
    if (customerId) {
      await chatbot.initialize()
    }

    // Extract intent detection without processing (for detailed analysis)
    const { extractIntent } = await import('@/lib/chatbot/engine')
    const intentDetection = extractIntent(message)

    // Process message to get full response
    const response = await chatbot.processMessage(message)

    // Get conversation context
    const context = chatbot.getContext()

    // Compile detailed test results
    const testResults = {
      input: {
        message,
        customerId: customerId || null,
        sessionId: testSessionId,
      },
      intentDetection: {
        intent: intentDetection.intent,
        confidence: intentDetection.confidence,
        confidencePercentage: `${Math.round(intentDetection.confidence * 100)}%`,
        matchedKeywords: intentDetection.matchedKeywords,
        shouldEscalate: intentDetection.shouldEscalate,
        escalationReason: intentDetection.escalationReason,
        isUrgent: intentDetection.isUrgent,
      },
      response: {
        text: response.text,
        shouldEscalate: response.shouldEscalate,
        followUpQuestions: response.followUpQuestions,
      },
      context: {
        customerName: context.customerName,
        appointmentDate: context.appointmentDate,
        appointmentTime: context.appointmentTime,
        balance: context.balance,
        serviceType: context.serviceType,
      },
      conversationHistory: chatbot.getHistory().map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        intent: msg.intent,
        confidence: msg.confidence,
      })),
    }

    return createSuccessResponse(testResults)
  } catch (error) {
    console.error('[Chatbot Test] POST /api/chatbot/test error:', error)
    return createErrorResponse(
      'server_error',
      error instanceof Error ? error.message : 'Internal server error',
      500
    )
  }
}
