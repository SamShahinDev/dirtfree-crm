/**
 * Invoice Server Actions
 * RBAC-enforced server actions for invoice management operations
 */

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { generateInvoicePDF, getCompanyInfo } from '@/lib/invoices/pdf'
import { sendInvoiceEmail as sendInvoiceEmailNew } from '@/lib/email/service'
import {
  type CreateInvoiceFromJobInput,
  type VoidInvoiceInput,
  type InvoiceWithRelations,
  type Invoice,
  type InvoiceItem,
  InvoiceStatus,
  formatCurrency,
  calcTotals,
  CreateInvoiceFromJobSchema,
  VoidInvoiceSchema
} from '@/types/invoice'

// =============================================================================
// CONFIGURATION
// =============================================================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const SUCCESS_URL = process.env.STRIPE_PAYMENT_SUCCESS_URL || 'https://yourapp.com/invoices/success'
const CANCEL_URL = process.env.STRIPE_PAYMENT_CANCEL_URL || 'https://yourapp.com/invoices/cancel'

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia'
}) : null

// =============================================================================
// RBAC HELPERS
// =============================================================================

async function checkPermissions(
  requiredRoles: string[] = ['admin', 'dispatcher'],
  customCheck?: (user: any) => Promise<boolean>
): Promise<{ user: any; hasPermission: boolean }> {
  const supabase = createClient()

  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return { user: null, hasPermission: false }
    }

    const userRole = user.user_metadata?.role || user.raw_user_meta_data?.role

    // Check basic role permissions
    const hasRolePermission = requiredRoles.includes(userRole)

    // Run custom check if provided
    const hasCustomPermission = customCheck ? await customCheck(user) : true

    return {
      user,
      hasPermission: hasRolePermission && hasCustomPermission
    }
  } catch (error) {
    console.error('Permission check error:', error)
    return { user: null, hasPermission: false }
  }
}

async function auditAction(
  action: string,
  tableId: string,
  oldValues?: any,
  newValues?: any,
  user?: any
): Promise<void> {
  try {
    const supabase = createClient()

    await supabase.from('audit_logs').insert({
      table_name: 'invoices',
      record_id: tableId,
      action,
      old_values: oldValues,
      new_values: newValues,
      user_id: user?.id,
      user_role: user?.user_metadata?.role || user?.raw_user_meta_data?.role,
      ip_address: null, // Server action - no direct IP
      user_agent: 'server-action'
    })
  } catch (error) {
    console.error('Audit logging failed:', error)
  }
}

// =============================================================================
// INVOICE CREATION
// =============================================================================

export async function createInvoiceFromJob(
  input: CreateInvoiceFromJobInput
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    // Validate input
    const validatedInput = CreateInvoiceFromJobSchema.parse(input)
    const { jobId, taxRatePercent = 0, discountCents = 0 } = validatedInput

    // Check permissions
    const { user, hasPermission } = await checkPermissions(['admin', 'dispatcher'])
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const supabase = createClient()

    // Fetch job with customer and service details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return { success: false, error: 'Job not found' }
    }

    // Check if job is completed
    if (job.status !== 'completed') {
      return { success: false, error: 'Can only create invoices for completed jobs' }
    }

    // Check if invoice already exists for this job
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('job_id', jobId)
      .single()

    if (existingInvoice) {
      return { success: false, error: 'Invoice already exists for this job' }
    }

    // Generate invoice number
    const { data: invoiceNumberResult } = await supabase
      .rpc('generate_invoice_number')

    if (!invoiceNumberResult) {
      return { success: false, error: 'Failed to generate invoice number' }
    }

    const invoiceNumber = invoiceNumberResult

    // Create invoice line items from job details
    const lineItems: Omit<InvoiceItem, 'id' | 'invoice_id' | 'created_at' | 'updated_at'>[] = []

    // Main service item
    if (job.estimated_price_cents && job.estimated_price_cents > 0) {
      lineItems.push({
        description: `${job.service_type} - ${job.rooms?.join(', ') || 'Service areas'}`,
        quantity: 1,
        unit_cents: job.estimated_price_cents,
        line_total_cents: job.estimated_price_cents,
        sort_order: 0
      })
    } else {
      // Default service item if no price specified
      lineItems.push({
        description: `${job.service_type} - ${job.rooms?.join(', ') || 'Service areas'}`,
        quantity: 1,
        unit_cents: 15000, // $150 default
        line_total_cents: 15000,
        sort_order: 0
      })
    }

    // Add additional items if specified in job notes or custom services
    if (job.additional_services && Array.isArray(job.additional_services)) {
      job.additional_services.forEach((service: any, index: number) => {
        if (service.description && service.price_cents) {
          lineItems.push({
            description: service.description,
            quantity: service.quantity || 1,
            unit_cents: service.price_cents,
            line_total_cents: (service.quantity || 1) * service.price_cents,
            sort_order: index + 1
          })
        }
      })
    }

    // Calculate totals
    const totals = calcTotals(lineItems, taxRatePercent, discountCents)

    // Create invoice in transaction
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        job_id: jobId,
        customer_id: job.customer_id,
        number: invoiceNumber,
        status: InvoiceStatus.DRAFT,
        subtotal_cents: totals.subtotal_cents,
        tax_cents: totals.tax_cents,
        discount_cents: totals.discount_cents,
        total_cents: totals.total_cents,
        currency: 'usd'
      })
      .select()
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice creation error:', invoiceError)
      return { success: false, error: 'Failed to create invoice' }
    }

    // Create invoice items
    const invoiceItems = lineItems.map(item => ({
      ...item,
      invoice_id: invoice.id
    }))

    const { error: itemsError } = await supabase
      .from('invoice_items')
      .insert(invoiceItems)

    if (itemsError) {
      console.error('Invoice items creation error:', itemsError)
      // Clean up invoice
      await supabase.from('invoices').delete().eq('id', invoice.id)
      return { success: false, error: 'Failed to create invoice items' }
    }

    // Audit log
    await auditAction('invoice_created', invoice.id, null, {
      job_id: jobId,
      number: invoiceNumber,
      total_cents: totals.total_cents
    }, user)

    // Auto-generate PDF and payment link for immediate sending
    try {
      // Generate PDF
      await renderInvoicePdf(invoice.id)

      // Generate payment link if Stripe is configured
      if (stripe) {
        await generateStripePaymentLink(invoice.id)
      }

      // Auto-send email if customer has email and email preferences allow it
      if (job.customer?.email &&
          job.customer.email_notifications &&
          !job.customer.marketing_opt_out) {
        console.log('Auto-sending invoice email for newly created invoice:', invoice.id)

        // Don't block on email sending - log any errors but continue
        sendInvoiceEmailAction(invoice.id).catch(error => {
          console.error('Auto-send invoice email failed:', error)
        })
      } else if (job.customer?.email) {
        console.log('Skipping auto-send invoice email due to customer email preferences:', {
          invoiceId: invoice.id,
          email_notifications: job.customer.email_notifications,
          marketing_opt_out: job.customer.marketing_opt_out
        })
      }
    } catch (error) {
      console.error('Post-creation invoice setup failed:', error)
      // Don't fail the main creation process
    }

    // Revalidate pages
    revalidatePath('/invoices')
    revalidatePath(`/jobs/${jobId}`)

    return {
      success: true,
      invoiceId: invoice.id
    }

  } catch (error) {
    console.error('Create invoice error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// =============================================================================
// PDF GENERATION
// =============================================================================

export async function renderInvoicePdf(
  invoiceId: string
): Promise<{ success: boolean; pdfKey?: string; error?: string }> {
  try {
    // Check permissions
    const { user, hasPermission } = await checkPermissions(['admin', 'dispatcher'])
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const supabase = createClient()

    // Fetch invoice with relations
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        items:invoice_items(*),
        customer:customers(*),
        job:jobs(*)
      `)
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    // Type assertion for invoice with relations
    const invoiceWithRelations = invoice as unknown as InvoiceWithRelations

    // Get company info
    const companyInfo = getCompanyInfo()

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoiceWithRelations, companyInfo)

    // Generate storage key
    const date = new Date(invoice.created_at)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const pdfKey = `invoices/${invoiceId}/${year}/${month}/invoice.pdf`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('private')
      .upload(pdfKey, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('PDF upload error:', uploadError)
      return { success: false, error: 'Failed to upload PDF' }
    }

    // Update invoice with PDF key
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ pdf_key: pdfKey })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Invoice update error:', updateError)
      return { success: false, error: 'Failed to update invoice' }
    }

    // Audit log
    await auditAction('pdf_generated', invoiceId, null, { pdf_key: '[REDACTED]' }, user)

    // Revalidate
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${invoiceId}`)

    return {
      success: true,
      pdfKey
    }

  } catch (error) {
    console.error('PDF generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF generation failed'
    }
  }
}

// =============================================================================
// STRIPE PAYMENT LINK GENERATION
// =============================================================================

export async function generateStripePaymentLink(
  invoiceId: string
): Promise<{ success: boolean; paymentLink?: string; error?: string }> {
  try {
    // Check permissions
    const { user, hasPermission } = await checkPermissions(['admin', 'dispatcher'])
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' }
    }

    if (!stripe) {
      return { success: false, error: 'Stripe not configured' }
    }

    const supabase = createClient()

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    // Check if payment link already exists
    if (invoice.payment_link) {
      return {
        success: true,
        paymentLink: invoice.payment_link
      }
    }

    // Create Stripe Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: invoice.currency,
            product_data: {
              name: `Invoice ${invoice.number}`,
              description: `Payment for services from ${getCompanyInfo().name}`,
              metadata: {
                invoice_id: invoiceId,
                invoice_number: invoice.number,
                customer_id: invoice.customer_id
              }
            },
            unit_amount: invoice.total_cents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.number,
        customer_id: invoice.customer_id
      },
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${SUCCESS_URL}?invoice_id=${invoiceId}`
        }
      },
      automatic_tax: {
        enabled: false // We're handling tax ourselves
      },
      billing_address_collection: 'auto',
      customer_creation: 'if_required',
      phone_number_collection: {
        enabled: true
      }
    })

    // Update invoice with payment link
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ payment_link: paymentLink.url })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Invoice update error:', updateError)
      return { success: false, error: 'Failed to update invoice with payment link' }
    }

    // Audit log
    await auditAction('payment_link_generated', invoiceId, null, {
      payment_link_created: true,
      stripe_payment_link_id: paymentLink.id
    }, user)

    // Revalidate
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${invoiceId}`)

    return {
      success: true,
      paymentLink: paymentLink.url
    }

  } catch (error) {
    console.error('Payment link generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment link generation failed'
    }
  }
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

export async function sendInvoiceEmailAction(
  invoiceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permissions
    const { user, hasPermission } = await checkPermissions(['admin', 'dispatcher'])
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const supabase = createClient()

    // Fetch invoice with relations
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        items:invoice_items(*),
        customer:customers(*),
        job:jobs(*)
      `)
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    // Check if invoice can be sent
    if (invoice.status !== InvoiceStatus.DRAFT) {
      return { success: false, error: 'Can only send draft invoices' }
    }

    // Ensure PDF exists
    if (!invoice.pdf_key) {
      const pdfResult = await renderInvoicePdf(invoiceId)
      if (!pdfResult.success) {
        return { success: false, error: 'Failed to generate PDF' }
      }
      invoice.pdf_key = pdfResult.pdfKey
    }

    // Download PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('private')
      .download(invoice.pdf_key!)

    if (downloadError || !pdfData) {
      return { success: false, error: 'Failed to download PDF' }
    }

    // Convert to buffer
    const pdfBuffer = Buffer.from(await pdfData.arrayBuffer())

    // Type assertion for invoice with relations
    const invoiceWithRelations = invoice as unknown as InvoiceWithRelations
    const companyInfo = getCompanyInfo()

    // Prepare invoice data for template
    const invoiceData = {
      items: invoice.items?.map(item => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.unit_cents / 100,
        amount: item.line_total_cents / 100
      })) || [],
      subtotal: invoice.subtotal_cents / 100,
      tax: invoice.tax_cents / 100,
      invoiceDate: new Date(invoice.created_at).toLocaleDateString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      notes: invoice.job?.notes || 'Thank you for choosing our professional carpet cleaning services!'
    }

    // Send email using new template system
    const emailResult = await sendInvoiceEmailNew(
      invoice.customer.email,
      invoice.customer.name,
      invoice.payment_link || `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}`,
      invoice.number,
      invoice.total_cents / 100,
      invoiceData
    )

    if (!emailResult.success) {
      return { success: false, error: emailResult.error }
    }

    // Update invoice status and timestamp
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: InvoiceStatus.SENT,
        emailed_at: new Date().toISOString()
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Invoice status update error:', updateError)
      return { success: false, error: 'Failed to update invoice status' }
    }

    // Create audit log for email sent
    console.log('Invoice email sent successfully:', {
      invoiceId,
      customerId: invoice.customer_id,
      email: invoice.customer.email,
      messageId: emailResult.messageId,
      provider: emailResult.provider
    })

    // Audit log
    await auditAction('invoice_sent', invoiceId,
      { status: InvoiceStatus.DRAFT },
      { status: InvoiceStatus.SENT, emailed_at: new Date().toISOString() },
      user
    )

    // Revalidate
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${invoiceId}`)

    return { success: true }

  } catch (error) {
    console.error('Send invoice email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invoice email'
    }
  }
}

// =============================================================================
// INVOICE VOIDING
// =============================================================================

export async function voidInvoice(
  input: VoidInvoiceInput
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate input
    const validatedInput = VoidInvoiceSchema.parse(input)
    const { invoiceId, reason } = validatedInput

    // Check permissions
    const { user, hasPermission } = await checkPermissions(['admin', 'dispatcher'])
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const supabase = createClient()

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    // Check if invoice can be voided
    if (invoice.status === InvoiceStatus.VOID) {
      return { success: false, error: 'Invoice is already void' }
    }

    if (invoice.status === InvoiceStatus.PAID) {
      return { success: false, error: 'Cannot void paid invoices' }
    }

    // Update invoice to void status
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: InvoiceStatus.VOID })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Invoice void error:', updateError)
      return { success: false, error: 'Failed to void invoice' }
    }

    // Audit log
    await auditAction('invoice_voided', invoiceId,
      { status: invoice.status },
      { status: InvoiceStatus.VOID, void_reason: reason },
      user
    )

    // Revalidate
    revalidatePath('/invoices')
    revalidatePath(`/invoices/${invoiceId}`)

    return { success: true }

  } catch (error) {
    console.error('Void invoice error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to void invoice'
    }
  }
}

// =============================================================================
// PDF DOWNLOAD
// =============================================================================

export async function getInvoicePdfUrl(
  invoiceId: string
): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
  try {
    // Check permissions (all roles can download PDFs for invoices they can see)
    const { user, hasPermission } = await checkPermissions(['admin', 'dispatcher', 'technician'])
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const supabase = createClient()

    // Fetch invoice (RLS will handle access control)
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('pdf_key')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    if (!invoice.pdf_key) {
      return { success: false, error: 'PDF not generated yet' }
    }

    // Generate signed URL (short TTL for security)
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('private')
      .createSignedUrl(invoice.pdf_key, 300) // 5 minutes

    if (urlError || !signedUrl) {
      return { success: false, error: 'Failed to generate download URL' }
    }

    return {
      success: true,
      downloadUrl: signedUrl.signedUrl
    }

  } catch (error) {
    console.error('PDF download URL error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate download URL'
    }
  }
}

// =============================================================================
// RESEND EMAIL
// =============================================================================

export async function resendInvoiceEmail(
  invoiceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check permissions
    const { user, hasPermission } = await checkPermissions(['admin', 'dispatcher'])
    if (!hasPermission) {
      return { success: false, error: 'Insufficient permissions' }
    }

    const supabase = createClient()

    // Check invoice status
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return { success: false, error: 'Invoice not found' }
    }

    if (invoice.status !== InvoiceStatus.SENT) {
      return { success: false, error: 'Can only resend sent invoices' }
    }

    // Reuse the send invoice email function
    const result = await sendInvoiceEmailAction(invoiceId)

    if (result.success) {
      // Audit log for resend
      await auditAction('invoice_resent', invoiceId, null, {
        action: 'email_resent'
      }, user)
    }

    return result

  } catch (error) {
    console.error('Resend invoice email error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend invoice email'
    }
  }
}