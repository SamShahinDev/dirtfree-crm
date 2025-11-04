/**
 * Example: Multiple Permissions (All)
 *
 * This route requires the user to have ALL of the specified permissions.
 * Users must have both 'customers:read' AND 'analytics:view_all' to access it.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'

export const GET = withAuth(
  async (req, { user }) => {
    // Generate advanced analytics report
    // User has all required permissions
    return NextResponse.json({
      message: 'Advanced analytics report',
      user: {
        id: user.id,
        role: user.role,
      },
      data: {
        customerCount: 1234,
        revenueTotal: 567890,
        conversionRate: 0.45,
      },
    })
  },
  {
    requireAllPermissions: ['customers:read', 'analytics:view_all'],
  }
)

export const dynamic = 'force-dynamic'
