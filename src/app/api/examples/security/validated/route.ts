/**
 * Example: Input Validation and Sanitization
 *
 * Demonstrates how to validate and sanitize user input.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { createValidationMiddleware, schemas, entitySchemas } from '@/lib/security/sanitize'
import { z } from 'zod'

// Define validation schema
const customerSchema = z.object({
  name: schemas.shortText,
  email: schemas.email,
  phone: schemas.phone.optional(),
  address: z.object({
    line1: schemas.shortText,
    line2: schemas.shortText.optional(),
    city: schemas.shortText,
    state: schemas.stateUS,
    postalCode: schemas.postalCodeUS,
  }),
  notes: schemas.longText.optional(),
})

// Create validation middleware
const validateCustomer = createValidationMiddleware(customerSchema)

// Apply both auth and validation
export const POST = withAuth(
  validateCustomer(async (req, { data }) => {
    // data is fully validated and typed
    const { name, email, phone, address, notes } = data

    // All inputs are sanitized and validated
    console.log('Creating customer:', { name, email, phone, address, notes })

    // Create customer in database...
    // const customer = await createCustomer(data)

    return NextResponse.json({
      success: true,
      message: 'Customer created successfully',
      data: {
        name,
        email,
        // ... other fields
      },
    })
  }),
  { requirePermission: 'customers:write' }
)

export const dynamic = 'force-dynamic'
