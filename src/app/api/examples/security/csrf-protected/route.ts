/**
 * Example: CSRF Protection
 *
 * Demonstrates how to protect state-changing endpoints from CSRF attacks.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { withCsrfProtection } from '@/lib/security/csrf'

// Combine auth and CSRF protection
const handler = withAuth(async (req, { user }) => {
  const body = await req.json()

  // This endpoint is protected from CSRF attacks
  // Only requests with valid CSRF tokens can access it

  console.log('Processing CSRF-protected request for user:', user.id)

  // Your business logic here...

  return NextResponse.json({
    success: true,
    message: 'Operation completed successfully',
    data: body,
  })
}, { requirePermission: 'customers:write' })

// Wrap with CSRF protection
export const POST = withCsrfProtection(handler, {
  tokenHeader: 'x-csrf-token',
  errorMessage: 'Invalid or missing CSRF token',
  skipSafeMethods: true, // Skip CSRF check for GET, HEAD, OPTIONS
})

export const dynamic = 'force-dynamic'
