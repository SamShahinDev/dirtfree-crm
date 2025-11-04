/**
 * Example: Request Throttling
 *
 * Demonstrates how to protect API endpoints with rate limiting.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { checkThrottle } from '@/lib/security/throttling'

export const POST = withAuth(async (req, { user }) => {
  // Check throttle for opportunities action
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

  // Process request
  const body = await req.json()

  // Your business logic here...

  return NextResponse.json(
    {
      success: true,
      message: 'Request processed successfully',
    },
    {
      headers: {
        'X-RateLimit-Remaining': throttleResult.remaining.toString(),
        'X-RateLimit-Reset': throttleResult.resetAfter.toString(),
      },
    }
  )
}, { requirePermission: 'opportunities:write' })

export const dynamic = 'force-dynamic'
