/**
 * Example: Customer Sensitive Data with Encryption
 *
 * Demonstrates how to:
 * - Encrypt sensitive customer data
 * - Store encrypted data in database
 * - Log PII access
 * - Decrypt data for authorized users
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/middleware/api-auth'
import { encrypt, decrypt, encryptFields, decryptFields } from '@/lib/security/encryption'
import { logPiiAccess } from '@/lib/db/pii-access-log'
import { createClient } from '@/lib/supabase/server'

/**
 * GET - Retrieve customer sensitive data
 *
 * - Requires 'customers:read' permission
 * - Automatically logs PII access
 * - Decrypts sensitive fields
 */
export const GET = withAuth(
  async (req, { user, params }) => {
    const customerId = params?.id

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch encrypted sensitive data
    const { data: sensitiveData, error } = await supabase
      .from('customer_sensitive_data')
      .select('*')
      .eq('customer_id', customerId)
      .single()

    if (error || !sensitiveData) {
      return NextResponse.json(
        { error: 'Sensitive data not found' },
        { status: 404 }
      )
    }

    // Log PII access
    const ipAddress = req.headers.get('x-forwarded-for')
    const userAgent = req.headers.get('user-agent')

    await logPiiAccess({
      userId: user.id,
      customerId,
      fieldAccessed: ['ssn', 'notes', 'payment_method'],
      action: 'view',
      ipAddress,
      userAgent,
      accessReason: 'Customer profile view',
    })

    // Decrypt sensitive fields
    const decrypted = decryptFields(sensitiveData, ['ssn', 'notes'])

    return NextResponse.json({
      success: true,
      data: {
        id: decrypted.id,
        customerId: decrypted.customer_id,
        ssn: decrypted.ssn, // Decrypted
        notes: decrypted.notes, // Decrypted
        creditCardLast4: decrypted.credit_card_last4, // Not encrypted, safe to show
        paymentMethodType: decrypted.payment_method_type,
      },
    })
  },
  {
    requirePermission: 'customers:read',
    enableAuditLog: true,
  }
)

/**
 * POST - Create/Update customer sensitive data
 *
 * - Requires 'customers:write' permission
 * - Encrypts sensitive fields before storage
 * - Logs PII access
 */
export const POST = withAuth(
  async (req, { user, params }) => {
    const customerId = params?.id

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID required' }, { status: 400 })
    }

    const body = await req.json()
    const { ssn, notes, creditCardLast4, paymentMethodToken, paymentMethodType } = body

    // Encrypt sensitive fields
    const encrypted = encryptFields(
      { ssn, notes },
      ['ssn', 'notes']
    )

    const supabase = await createClient()

    // Upsert encrypted data
    const { data, error } = await supabase
      .from('customer_sensitive_data')
      .upsert({
        customer_id: customerId,
        ssn_encrypted: encrypted.ssn_encrypted,
        notes_encrypted: encrypted.notes_encrypted,
        credit_card_last4: creditCardLast4,
        payment_method_token: paymentMethodToken,
        payment_method_type: paymentMethodType,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving sensitive data:', error)
      return NextResponse.json(
        { error: 'Failed to save sensitive data' },
        { status: 500 }
      )
    }

    // Log PII access
    const ipAddress = req.headers.get('x-forwarded-for')
    const userAgent = req.headers.get('user-agent')

    await logPiiAccess({
      userId: user.id,
      customerId,
      fieldAccessed: ['ssn', 'notes', 'payment_method'],
      action: 'edit',
      ipAddress,
      userAgent,
      accessReason: 'Update customer sensitive data',
    })

    return NextResponse.json({
      success: true,
      message: 'Sensitive data saved successfully',
      data: {
        id: data.id,
        customerId: data.customer_id,
      },
    })
  },
  {
    requirePermission: 'customers:write',
    enableAuditLog: true,
  }
)

export const dynamic = 'force-dynamic'
