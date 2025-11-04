import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { getServerSupabase } from '@/lib/supabase/server'
import { formatForDisplay } from '@/lib/utils/phone'

/**
 * GET /customers/[id]/export
 *
 * Exports customer data and service history as CSV
 * Requires authentication (RLS will scope data appropriately)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require authentication
    await requireAuth()

    const customerId = params.id

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Get service history
    const { data: serviceHistory, error: historyError } = await supabase
      .from('service_history')
      .select(`
        id,
        job_id,
        completed_at,
        notes,
        jobs(description, invoice_url, scheduled_date),
        user_profiles!service_history_technician_id_fkey(display_name)
      `)
      .eq('customer_id', customerId)
      .order('completed_at', { ascending: false })

    if (historyError) {
      return NextResponse.json(
        { error: 'Failed to fetch service history' },
        { status: 500 }
      )
    }

    // Helper function to escape CSV values
    const escapeCsv = (value: string | null | undefined): string => {
      if (value === null || value === undefined) {
        return ''
      }

      const stringValue = String(value)

      // If the value contains comma, newline, or quote, wrap in quotes and escape internal quotes
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }

      return stringValue
    }

    // Helper function to format date for CSV
    const formatDateForCsv = (dateString: string | null): string => {
      if (!dateString) return ''
      return new Date(dateString).toLocaleDateString('en-US')
    }

    // Helper function to format datetime for CSV
    const formatDateTimeForCsv = (dateString: string | null): string => {
      if (!dateString) return ''
      return new Date(dateString).toLocaleString('en-US')
    }

    // Build CSV content
    const csvLines: string[] = []

    // Customer Information Section
    csvLines.push('CUSTOMER INFORMATION')
    csvLines.push('Field,Value')
    csvLines.push(`Name,${escapeCsv(customer.name)}`)
    csvLines.push(`Email,${escapeCsv(customer.email)}`)
    csvLines.push(`Phone,${escapeCsv(customer.phone_e164 ? formatForDisplay(customer.phone_e164) : null)}`)
    csvLines.push(`Address Line 1,${escapeCsv(customer.address_line1)}`)
    csvLines.push(`Address Line 2,${escapeCsv(customer.address_line2)}`)
    csvLines.push(`City,${escapeCsv(customer.city)}`)
    csvLines.push(`State,${escapeCsv(customer.state)}`)
    csvLines.push(`Postal Code,${escapeCsv(customer.postal_code)}`)
    csvLines.push(`Service Zone,${escapeCsv(customer.zone)}`)
    csvLines.push(`Notes,${escapeCsv(customer.notes)}`)
    csvLines.push(`Created Date,${formatDateForCsv(customer.created_at)}`)
    csvLines.push(`Last Updated,${formatDateForCsv(customer.updated_at)}`)
    csvLines.push('') // Empty line separator

    // Service History Section
    csvLines.push('SERVICE HISTORY')

    if (serviceHistory && serviceHistory.length > 0) {
      // Headers for service history
      csvLines.push('Completed Date,Scheduled Date,Description,Technician,Service Notes,Invoice URL')

      // Service history rows
      serviceHistory.forEach((service) => {
        const row = [
          formatDateTimeForCsv(service.completed_at),
          formatDateForCsv(service.jobs?.scheduled_date || null),
          escapeCsv(service.jobs?.description || 'Service completed'),
          escapeCsv(service.user_profiles?.display_name || 'Unknown'),
          escapeCsv(service.notes),
          escapeCsv(service.jobs?.invoice_url)
        ].join(',')

        csvLines.push(row)
      })
    } else {
      csvLines.push('No service history available')
    }

    // Join all lines
    const csvContent = csvLines.join('\n')

    // Create filename with customer name and date
    const safeCustomerName = customer.name.replace(/[^a-zA-Z0-9]/g, '_')
    const today = new Date().toISOString().split('T')[0]
    const filename = `customer_${safeCustomerName}_${today}.csv`

    // Return CSV response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('CSV export error:', error)

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}