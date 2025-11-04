/**
 * Example: Multiple Permissions (Any)
 *
 * This route requires the user to have at least ONE of the specified permissions.
 * Users with either 'opportunities:write' OR 'opportunities:approve' can access it.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json()

    // Process opportunity
    // User has at least one of the required permissions
    return NextResponse.json({
      message: 'Opportunity updated successfully',
      user: {
        id: user.id,
        role: user.role,
      },
      data: body,
    })
  },
  {
    requireAnyPermission: ['opportunities:write', 'opportunities:approve'],
  }
)

export const dynamic = 'force-dynamic'
