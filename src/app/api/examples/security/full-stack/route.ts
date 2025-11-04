/**
 * Example: Full-Stack Security
 *
 * Demonstrates how to combine all security features:
 * - Authentication and authorization
 * - Permission checks
 * - Request throttling
 * - Input validation and sanitization
 * - CSRF protection
 * - Audit logging
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { checkThrottle } from '@/lib/security/throttling'
import { validateRequestBody, schemas } from '@/lib/security/sanitize'
import { verifyCsrfToken, getSessionId } from '@/lib/security/csrf'
import { z } from 'zod'

// Define input validation schema
const requestSchema = z.object({
  title: schemas.shortText,
  description: schemas.text,
  estimated_value: schemas.currency,
  customer_id: schemas.id,
})

export const POST = withAuth(
  async (req, { user }) => {
    // ========================================================================
    // Step 1: CSRF Protection
    // ========================================================================
    const csrfToken = req.headers.get('x-csrf-token')
    const sessionId = await getSessionId(req)

    if (!verifyCsrfToken(sessionId, csrfToken)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      )
    }

    // ========================================================================
    // Step 2: Rate Limiting
    // ========================================================================
    const throttleResult = await checkThrottle(user.id, 'opportunities')

    if (!throttleResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: throttleResult.errorMessage,
          retryAfter: throttleResult.resetAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': throttleResult.resetAfter.toString(),
            'Retry-After': throttleResult.resetAfter.toString(),
          },
        }
      )
    }

    // ========================================================================
    // Step 3: Input Validation and Sanitization
    // ========================================================================
    const body = await req.json()
    const validationResult = validateRequestBody(body, requestSchema)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.errors.format(),
        },
        { status: 400 }
      )
    }

    const { title, description, estimated_value, customer_id } = validationResult.data

    // ========================================================================
    // Step 4: Business Logic
    // ========================================================================

    // All security checks passed - process the request
    console.log('Creating opportunity:', {
      title,
      description,
      estimated_value,
      customer_id,
      user_id: user.id,
    })

    // Create opportunity in database...
    // const opportunity = await createOpportunity({
    //   title,
    //   description,
    //   estimated_value,
    //   customer_id,
    //   created_by: user.id,
    // })

    // Audit log is automatically created via enableAuditLog option

    // ========================================================================
    // Step 5: Return Response with Rate Limit Headers
    // ========================================================================
    return NextResponse.json(
      {
        success: true,
        message: 'Opportunity created successfully',
        data: {
          title,
          estimated_value,
          // ... other fields
        },
      },
      {
        headers: {
          'X-RateLimit-Remaining': throttleResult.remaining.toString(),
          'X-RateLimit-Reset': throttleResult.resetAfter.toString(),
        },
      }
    )
  },
  {
    // Require specific permission
    requirePermission: 'opportunities:write',

    // Enable audit logging for this sensitive operation
    enableAuditLog: true,

    // Custom error messages
    errorMessages: {
      unauthorized: 'Please log in to create opportunities',
      forbidden: 'You do not have permission to create opportunities',
    },
  }
)

export const dynamic = 'force-dynamic'
