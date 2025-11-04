import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server'
import { normalizeToE164 } from '@/lib/utils/phone'
import { z } from 'zod'

// Validation schema for customer data
const CustomerRowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  zone: z.enum(['N', 'S', 'E', 'W', 'Central']).optional().or(z.literal('')),
  notes: z.string().optional(),
})

interface ImportResult {
  imported: number
  skipped: number
  errors: number
  details: string[]
}

function mapCSVRow(row: any): any {
  // Map CSV headers to database fields
  const mapped: any = {}

  // Handle various name field variations
  mapped.name = row['Name'] || row['name'] || row['Customer Name'] || row['Full Name'] || ''

  // Handle email
  mapped.email = row['Email'] || row['email'] || row['Email Address'] || ''

  // Handle phone
  mapped.phone = row['Phone'] || row['phone'] || row['Phone Number'] || row['Mobile'] || ''

  // Handle address fields
  mapped.address_line1 = row['Address Line 1'] || row['Address'] || row['Street'] || ''
  mapped.address_line2 = row['Address Line 2'] || row['Address 2'] || row['Apt'] || ''
  mapped.city = row['City'] || row['city'] || ''
  mapped.state = row['State'] || row['state'] || row['Province'] || ''
  mapped.postal_code = row['Postal Code'] || row['ZIP'] || row['Zip Code'] || row['Postcode'] || ''

  // Handle zone
  mapped.zone = row['Zone'] || row['zone'] || ''

  // Handle notes
  mapped.notes = row['Notes'] || row['notes'] || row['Comments'] || ''

  return mapped
}

function validateZone(zone: string): string | null {
  if (!zone) return null

  const normalizedZone = zone.trim().toUpperCase()

  // Handle various zone formats
  if (normalizedZone === 'NORTH' || normalizedZone === 'N') return 'N'
  if (normalizedZone === 'SOUTH' || normalizedZone === 'S') return 'S'
  if (normalizedZone === 'EAST' || normalizedZone === 'E') return 'E'
  if (normalizedZone === 'WEST' || normalizedZone === 'W') return 'W'
  if (normalizedZone === 'CENTRAL' || normalizedZone === 'C') return 'Central'

  return null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabase()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      )
    }

    // Check role permission (must be dispatcher or admin)
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'Unable to verify user permissions' },
        { status: 403 }
      )
    }

    if (!['admin', 'dispatcher'].includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Forbidden - dispatcher or admin role required' },
        { status: 403 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV file.' },
        { status: 400 }
      )
    }

    // Parse CSV
    const fileContent = await file.text()
    const parseResult = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
    })

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        { error: 'Failed to parse CSV file' },
        { status: 400 }
      )
    }

    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      errors: 0,
      details: []
    }

    // Get existing customers for duplicate checking
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('email, phone_e164')
      .not('email', 'is', null)
      .not('phone_e164', 'is', null)

    const existingEmails = new Set(existingCustomers?.map(c => c.email?.toLowerCase()) || [])
    const existingPhones = new Set(existingCustomers?.map(c => c.phone_e164) || [])

    // Process each row
    const customersToInsert: any[] = []

    for (let i = 0; i < parseResult.data.length; i++) {
      const rowNum = i + 2 // Account for header row
      const rawRow = parseResult.data[i]

      try {
        // Map CSV columns to our schema
        const mappedRow = mapCSVRow(rawRow)

        // Validate the row
        const validatedRow = CustomerRowSchema.parse(mappedRow)

        // Skip rows without required fields
        if (!validatedRow.name || validatedRow.name.trim() === '') {
          result.skipped++
          result.details.push(`Row ${rowNum}: Skipped - missing name`)
          continue
        }

        // Normalize phone number
        let phone_e164: string | null = null
        if (validatedRow.phone && validatedRow.phone.trim()) {
          phone_e164 = normalizeToE164(validatedRow.phone.trim())
        }

        // Validate zone
        const validZone = validatedRow.zone ? validateZone(validatedRow.zone) : null

        // Check for duplicates
        const email = validatedRow.email ? validatedRow.email.trim().toLowerCase() : null

        if (email && existingEmails.has(email)) {
          result.skipped++
          result.details.push(`Row ${rowNum}: Skipped - duplicate email (${email})`)
          continue
        }

        if (phone_e164 && existingPhones.has(phone_e164)) {
          result.skipped++
          result.details.push(`Row ${rowNum}: Skipped - duplicate phone (${validatedRow.phone})`)
          continue
        }

        // Prepare customer data
        const customerData = {
          name: validatedRow.name.trim(),
          email: email || null,
          phone_e164,
          address_line1: validatedRow.address_line1?.trim() || null,
          address_line2: validatedRow.address_line2?.trim() || null,
          city: validatedRow.city?.trim() || null,
          state: validatedRow.state?.trim() || null,
          postal_code: validatedRow.postal_code?.trim() || null,
          zone: validZone,
          notes: validatedRow.notes?.trim() || null,
        }

        customersToInsert.push(customerData)

        // Add to our duplicate check sets
        if (email) existingEmails.add(email)
        if (phone_e164) existingPhones.add(phone_e164)

      } catch (error) {
        result.errors++
        const errorMessage = error instanceof z.ZodError
          ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          : error instanceof Error
          ? error.message
          : 'Unknown error'
        result.details.push(`Row ${rowNum}: Error - ${errorMessage}`)
      }
    }

    // Batch insert customers using service role to bypass RLS
    // (permissions already verified above)
    if (customersToInsert.length > 0) {
      // Use service role client for bulk inserts (bypasses RLS)
      const serviceSupabase = getServiceSupabase()

      const batchSize = 100
      for (let i = 0; i < customersToInsert.length; i += batchSize) {
        const batch = customersToInsert.slice(i, i + batchSize)

        const { error } = await serviceSupabase
          .from('customers')
          .insert(batch)

        if (error) {
          result.errors += batch.length
          result.details.push(`Batch ${Math.floor(i / batchSize) + 1}: Database error - ${error.message}`)
        } else {
          result.imported += batch.length
        }
      }
    }

    // Log the import action
    if (result.imported > 0) {
      await supabase
        .from('audit_log')
        .insert({
          actor_id: user.id,
          action: 'BULK_IMPORT',
          entity: 'customer',
          entity_id: null,
          meta: {
            imported: result.imported,
            skipped: result.skipped,
            errors: result.errors,
            filename: file.name
          }
        })
    }

    // Add summary to details
    if (result.imported > 0) {
      result.details.unshift(`Successfully imported ${result.imported} customers`)
    }
    if (result.skipped > 0) {
      result.details.unshift(`Skipped ${result.skipped} rows`)
    }
    if (result.errors > 0) {
      result.details.unshift(`${result.errors} errors occurred`)
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}