/**
 * Example: Admin Only
 *
 * This route requires admin role.
 * Only users with 'admin' role can access it.
 */

import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/middleware/api-auth'

export const GET = requireAdminAuth(async (req, { user }) => {
  // Admin-only functionality
  return NextResponse.json({
    message: 'Admin dashboard data',
    user: {
      id: user.id,
      role: user.role,
    },
    systemStats: {
      totalUsers: 42,
      totalCustomers: 1234,
      systemHealth: 'healthy',
    },
  })
})

export const DELETE = requireAdminAuth(async (req, { user }) => {
  // Dangerous admin-only operation
  return NextResponse.json({
    message: 'System data purged (admin only)',
    user: {
      id: user.id,
      role: user.role,
    },
  })
})

export const dynamic = 'force-dynamic'
