import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import { formatForDisplay } from '@/lib/utils/phone'

export async function GET() {
  try {
    const supabase = await getServerSupabase()

    // Get all customers with pagination to handle large datasets
    let allCustomers: any[] = []
    let page = 0
    const pageSize = 1000

    while (true) {
      const { data: customers, error } = await supabase
        .from('customers')
        .select(`
          id,
          name,
          email,
          phone_e164,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          zone,
          notes,
          created_at,
          updated_at
        `)
        .order('name')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch customers' },
          { status: 500 }
        )
      }

      if (!customers || customers.length === 0) {
        break
      }

      allCustomers = allCustomers.concat(customers)

      // If we got less than pageSize, we've reached the end
      if (customers.length < pageSize) {
        break
      }

      page++
    }

    // Format data for CSV
    const csvHeaders = [
      'Name',
      'Email',
      'Phone',
      'Address Line 1',
      'Address Line 2',
      'City',
      'State',
      'Postal Code',
      'Zone',
      'Notes',
      'Created Date',
      'Updated Date'
    ]

    const csvRows = allCustomers.map(customer => [
      customer.name || '',
      customer.email || '',
      customer.phone_e164 ? formatForDisplay(customer.phone_e164) : '',
      customer.address_line1 || '',
      customer.address_line2 || '',
      customer.city || '',
      customer.state || '',
      customer.postal_code || '',
      customer.zone || '',
      customer.notes || '',
      customer.created_at ? new Date(customer.created_at).toLocaleDateString() : '',
      customer.updated_at ? new Date(customer.updated_at).toLocaleDateString() : ''
    ])

    // Convert to CSV format
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row =>
        row.map(field => {
          // Escape fields that contain commas, quotes, or newlines
          if (typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
            return `"${field.replace(/"/g, '""')}"`
          }
          return field
        }).join(',')
      )
    ].join('\n')

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}