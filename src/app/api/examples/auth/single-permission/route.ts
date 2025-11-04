/**
 * Example: Single Permission Check
 *
 * This route requires a specific permission to access.
 * Only users with 'customers:write' permission can access it.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'

export const POST = withAuth(
  async (req, { user }) => {
    // Parse request body
    const body = await req.json()

    // Process the request
    // Only users with 'customers:write' permission can reach here
    return NextResponse.json({
      message: 'Customer created successfully',
      user: {
        id: user.id,
        role: user.role,
      },
      data: body,
    })
  },
  {
    requirePermission: 'customers:write',
  }
)

export const dynamic = 'force-dynamic'
