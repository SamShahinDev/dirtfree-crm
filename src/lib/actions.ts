import { z } from 'zod'
import { AppRole } from './auth/roles'
import { requireRole, requireAuth, UnauthorizedError, UnauthenticatedError } from './auth/guards'

// Base action result type
export type ActionResult<T = unknown> = {
  success: true
  data: T
} | {
  success: false
  error: string
  code?: string
}

// Action context type
export type ActionContext = {
  user: NonNullable<Awaited<ReturnType<typeof requireAuth>>>
  role: AppRole
}

// Action handler type
export type ActionHandler<TInput, TOutput> = (
  input: TInput,
  context: ActionContext
) => Promise<TOutput>

// Public action handler type (no auth required)
export type PublicActionHandler<TInput, TOutput> = (
  input: TInput
) => Promise<TOutput>

// Configuration for protected actions
export type ActionConfig = {
  minimumRole?: AppRole
  requireAuth?: boolean
}

// Create a protected server action with validation and RBAC
export function makeAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: ActionHandler<TInput, TOutput>,
  config: ActionConfig = { requireAuth: true }
) {
  return async (input: unknown): Promise<ActionResult<TOutput>> => {
    console.log('🎬 [ACTION WRAPPER] Called with input:', input)

    try {
      // Validate input with Zod
      console.log('🔍 [ACTION WRAPPER] Validating input...')
      const validatedInput = schema.parse(input)
      console.log('✅ [ACTION WRAPPER] Validation passed')

      // Authentication check
      const user = await requireAuth()
      console.log('✅ [ACTION WRAPPER] User authenticated:', { userId: user.id })

      // Role authorization check
      if (config.minimumRole) {
        await requireRole(config.minimumRole)
        console.log('✅ [ACTION WRAPPER] Role check passed for:', config.minimumRole)
      }

      // Get user role for context
      const { getUserRole } = await import('./auth/roles')
      const role = await getUserRole(user.id) || 'technician'

      // Create action context
      const context: ActionContext = { user, role }

      // Execute the handler
      console.log('🎯 [ACTION WRAPPER] Executing handler...')
      const result = await handler(validatedInput, context)

      console.log('📦 [ACTION WRAPPER] Handler returned:', {
        resultType: typeof result,
        isObject: typeof result === 'object' && result !== null,
        hasOkProperty: result && typeof result === 'object' && 'ok' in result,
        hasDataProperty: result && typeof result === 'object' && 'data' in result,
        keys: result && typeof result === 'object' ? Object.keys(result) : []
      })

      const finalResponse = {
        success: true,
        data: result
      }

      console.log('✅ [ACTION WRAPPER] Returning final response:', {
        success: finalResponse.success,
        dataType: typeof finalResponse.data,
        dataKeys: finalResponse.data && typeof finalResponse.data === 'object' ? Object.keys(finalResponse.data) : []
      })

      return finalResponse
    } catch (error) {
      console.error('❌ [ACTION WRAPPER] Action error:', error)

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid input data',
          code: 'VALIDATION_ERROR'
        }
      }

      if (error instanceof UnauthenticatedError) {
        return {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHENTICATED'
        }
      }

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Insufficient permissions',
          code: 'UNAUTHORIZED'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}

// Create a public server action (no authentication required)
export function makePublicAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: PublicActionHandler<TInput, TOutput>
) {
  return async (input: unknown): Promise<ActionResult<TOutput>> => {
    try {
      // Validate input with Zod
      const validatedInput = schema.parse(input)

      // Execute the handler
      const result = await handler(validatedInput)

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('Public action error:', error)

      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid input data',
          code: 'VALIDATION_ERROR'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      }
    }
  }
}

// Convenience function for admin-only actions
export function makeAdminAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: ActionHandler<TInput, TOutput>
) {
  return makeAction(schema, handler, { minimumRole: 'admin' })
}

// Convenience function for dispatcher+ actions
export function makeDispatcherAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: ActionHandler<TInput, TOutput>
) {
  return makeAction(schema, handler, { minimumRole: 'dispatcher' })
}

// Convenience function for technician+ actions (all authenticated users)
export function makeTechnicianAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: ActionHandler<TInput, TOutput>
) {
  return makeAction(schema, handler, { minimumRole: 'technician' })
}