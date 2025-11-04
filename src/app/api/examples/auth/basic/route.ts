/**
 * Example: Basic Authentication
 *
 * This route requires authentication but no specific permissions.
 * Any authenticated user can access it.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/middleware/api-auth'

export const GET = requireAuth(async (req, { user }) => {
  // User is guaranteed to be authenticated here
  return NextResponse.json({
    message: 'Welcome! You are authenticated.',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  })
})

export const dynamic = 'force-dynamic'
