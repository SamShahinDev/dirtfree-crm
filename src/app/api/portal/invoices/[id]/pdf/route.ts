import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getPortalRateLimiter, createRateLimitHeaders } from '@/lib/rate-limiter'
import { validatePortalToken } from '@/lib/portal-api'
import { formatCurrency } from '@/types/invoice'

/**
 * Invoice PDF Generation API
 *
 * GET /api/portal/invoices/[id]/pdf
 * - Generates professional branded invoice PDF
 * - Returns PDF for download or inline view
 * - Includes company branding and invoice details
 */

const rateLimiter = getPortalRateLimiter()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const portalToken = request.headers.get('X-Portal-Token') ||
                        request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!portalToken) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const auth = await validatePortalToken(portalToken)
    const rateLimitResult = await rateLimiter.limit(auth.customerId)

    if (!rateLimitResult.success) {
      return new NextResponse('Rate limit exceeded', { status: 429, headers: createRateLimitHeaders(rateLimitResult) })
    }

    const { id: invoiceId } = await params

    // Fetch invoice with all details
    const supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        items:invoice_items(description, quantity, unit_cents, line_total_cents, sort_order),
        customer:customers(name, email, phone_e164, address_line1, address_line2, city, state, postal_code)
      `)
      .eq('id', invoiceId)
      .eq('customer_id', auth.customerId)
      .single()

    if (error || !invoice) {
      return new NextResponse('Invoice not found', { status: 404 })
    }

    // Generate PDF
    const pdf = new jsPDF()
    const pageWidth = pdf.internal.pageSize.getWidth()
    let yPos = 20

    // Company Header
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Dirt Free Carpet', 20, yPos)
    yPos += 10

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(process.env.COMPANY_ADDRESS_LINE1 || '123 Main St', 20, yPos)
    yPos += 5
    pdf.text(process.env.COMPANY_CITY_STATE_ZIP || 'Houston, TX 77002', 20, yPos)
    yPos += 5
    pdf.text(process.env.COMPANY_PHONE || '(281) 555-1212', 20, yPos)
    yPos += 5
    pdf.text(process.env.COMPANY_EMAIL || 'billing@dirtfreecarpet.com', 20, yPos)

    // Invoice Title
    yPos += 15
    pdf.setFontSize(24)
    pdf.setFont('helvetica', 'bold')
    pdf.text('INVOICE', pageWidth - 60, 30)

    // Invoice Details (right side)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(`Invoice #: ${invoice.number}`, pageWidth - 60, 40)
    pdf.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, pageWidth - 60, 45)
    pdf.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - 60, 50)

    // Bill To
    yPos = 70
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Bill To:', 20, yPos)
    yPos += 7

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(invoice.customer?.name || 'Customer', 20, yPos)
    yPos += 5
    if (invoice.customer?.email) {
      pdf.text(invoice.customer.email, 20, yPos)
      yPos += 5
    }
    if (invoice.customer?.address_line1) {
      pdf.text(invoice.customer.address_line1, 20, yPos)
      yPos += 5
    }
    if (invoice.customer?.city) {
      const addressLine2 = `${invoice.customer.city}, ${invoice.customer.state || ''} ${invoice.customer.postal_code || ''}`
      pdf.text(addressLine2.trim(), 20, yPos)
      yPos += 5
    }

    // Line Items Table
    yPos += 10
    const tableTop = yPos

    // Table Header
    pdf.setFillColor(240, 240, 240)
    pdf.rect(20, yPos, pageWidth - 40, 8, 'F')

    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text('Description', 25, yPos + 5)
    pdf.text('Qty', pageWidth - 80, yPos + 5)
    pdf.text('Unit Price', pageWidth - 60, yPos + 5)
    pdf.text('Amount', pageWidth - 30, yPos + 5, { align: 'right' })

    yPos += 12

    // Table Items
    pdf.setFont('helvetica', 'normal')
    const items = invoice.items || []
    for (const item of items) {
      pdf.text(item.description, 25, yPos)
      pdf.text(item.quantity.toString(), pageWidth - 80, yPos)
      pdf.text(formatCurrency(item.unit_cents, invoice.currency), pageWidth - 60, yPos)
      pdf.text(formatCurrency(item.line_total_cents, invoice.currency), pageWidth - 25, yPos, { align: 'right' })
      yPos += 7
    }

    // Totals
    yPos += 10
    pdf.setFont('helvetica', 'normal')
    pdf.text('Subtotal:', pageWidth - 60, yPos)
    pdf.text(formatCurrency(invoice.subtotal_cents, invoice.currency), pageWidth - 25, yPos, { align: 'right' })

    yPos += 7
    pdf.text('Tax:', pageWidth - 60, yPos)
    pdf.text(formatCurrency(invoice.tax_cents, invoice.currency), pageWidth - 25, yPos, { align: 'right' })

    if (invoice.discount_cents > 0) {
      yPos += 7
      pdf.text('Discount:', pageWidth - 60, yPos)
      pdf.text(`-${formatCurrency(invoice.discount_cents, invoice.currency)}`, pageWidth - 25, yPos, { align: 'right' })
    }

    yPos += 10
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('Total:', pageWidth - 60, yPos)
    pdf.text(formatCurrency(invoice.total_cents, invoice.currency), pageWidth - 25, yPos, { align: 'right' })

    // Footer
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'italic')
    pdf.text('Thank you for your business!', 20, pdf.internal.pageSize.getHeight() - 20)
    pdf.text(`Questions? Contact us at ${process.env.COMPANY_EMAIL || 'support@dirtfreecarpet.com'}`, 20, pdf.internal.pageSize.getHeight() - 15)

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))

    // Return PDF
    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    headers.set('Content-Disposition', `inline; filename="invoice-${invoice.number}.pdf"`)
    headers.set('Content-Length', pdfBuffer.length.toString())

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers,
    })

  } catch (error) {
    console.error('[Portal API] GET /api/portal/invoices/[id]/pdf error:', error)
    return new NextResponse('Failed to generate PDF', { status: 500 })
  }
}
