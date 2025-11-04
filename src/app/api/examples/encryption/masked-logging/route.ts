/**
 * Example: Masked PII Logging
 *
 * Demonstrates how to log customer data without exposing PII.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { maskPii, safeLogger } from '@/lib/logging/mask-pii'

export const POST = withAuth(async (req, { user }) => {
  const body = await req.json()

  // Example customer data with PII
  const customerData = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+15551234567',
    ssn: '123-45-6789',
    credit_card: '4532123456781234',
    address: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94102',
    },
    ip_address: '192.168.1.100',
  }

  // ❌ BAD - Logs actual PII (NEVER do this)
  // console.log('Customer data:', customerData)

  // ✅ GOOD - Use masked logging
  const maskedData = maskPii(customerData)
  console.log('Customer data (masked):', maskedData)
  // Logs: {
  //   name: 'John Doe',
  //   email: 'jo********@example.com',
  //   phone: '***-***-4567',
  //   ssn: '***-**-6789',
  //   credit_card: '****-****-****-1234',
  //   address: '*** ******, San Francisco, CA *****',
  //   ip_address: '192.168.***.***'
  // }

  // ✅ EVEN BETTER - Use safe logger
  safeLogger.info('Customer data accessed', customerData)
  // Automatically masks PII in logs

  return NextResponse.json({
    success: true,
    message: 'Check server logs to see masked PII',
    example: maskedData,
  })
}, { requirePermission: 'customers:read' })

export const dynamic = 'force-dynamic'
