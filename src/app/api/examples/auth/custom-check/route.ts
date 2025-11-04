/**
 * Example: Custom Role Check with Audit Logging
 *
 * This route uses a custom role check function and enables audit logging.
 * Only admins and dispatchers can access it, and all access is logged.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json()

    // Process the request
    // Only admins and dispatchers can reach here
    // This access is logged to the audit log
    return NextResponse.json({
      message: 'Operation completed and logged',
      user: {
        id: user.id,
        role: user.role,
      },
      data: body,
    })
  },
  {
    customRoleCheck: (user) => {
      // Custom logic: Only allow admins and dispatchers
      return user.role === 'admin' || user.role === 'dispatcher'
    },
    enableAuditLog: true,
    errorMessages: {
      unauthorized: 'Please log in to continue',
      forbidden: 'This action requires admin or dispatcher role',
    },
  }
)

export const dynamic = 'force-dynamic'
