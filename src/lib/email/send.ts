/**
 * Email Service
 * Secure email delivery using Resend with PII protection and error handling
 */

import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

// =============================================================================
// TYPES
// =============================================================================

interface EmailAttachment {
  filename: string
  content: Buffer | Uint8Array
  contentType?: string
}

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: EmailAttachment[]
  replyTo?: string
  from?: string
}

interface InvoiceEmailOptions {
  to: string
  customerName: string
  invoiceNumber: string
  invoiceAmount: string
  paymentLink?: string
  pdfBuffer: Buffer
  companyName: string
}

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.INVOICE_FROM_EMAIL || 'billing@example.com'
const COMPANY_NAME = process.env.COMPANY_NAME || 'Dirt Free Carpet'

if (!RESEND_API_KEY) {
  console.warn('RESEND_API_KEY not configured - email sending will be disabled')
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

function createInvoiceEmailHTML({
  customerName,
  invoiceNumber,
  invoiceAmount,
  paymentLink,
  companyName
}: Omit<InvoiceEmailOptions, 'to' | 'pdfBuffer'>): string {
  const paymentSection = paymentLink ? `
    <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
      <h3 style="color: #1e40af; margin: 0 0 10px 0;">Pay Online</h3>
      <p style="color: #1e3a8a; margin: 0 0 15px 0;">Click the button below to pay securely online</p>
      <a href="${paymentLink}"
         style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Pay ${invoiceAmount}
      </a>
    </div>
  ` : ''

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoiceNumber}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 20px; }
        .footer { background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: none; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
        h1 { margin: 0; font-size: 24px; }
        h2 { color: #374151; font-size: 18px; margin: 20px 0 10px 0; }
        .invoice-details { background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .amount { font-size: 24px; font-weight: bold; color: #059669; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Invoice from ${companyName}</h1>
        </div>

        <div class="content">
          <p>Dear ${customerName},</p>

          <p>Thank you for choosing ${companyName}! Please find your invoice attached.</p>

          <div class="invoice-details">
            <h2>Invoice Details</h2>
            <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
            <p><strong>Amount Due:</strong> <span class="amount">${invoiceAmount}</span></p>
            <p><strong>Issue Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          ${paymentSection}

          <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

          <p>Best regards,<br>The ${companyName} Team</p>
        </div>

        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

function createInvoiceEmailText({
  customerName,
  invoiceNumber,
  invoiceAmount,
  paymentLink,
  companyName
}: Omit<InvoiceEmailOptions, 'to' | 'pdfBuffer'>): string {
  const paymentSection = paymentLink ? `
PAY ONLINE
----------
You can pay securely online at: ${paymentLink}
` : ''

  return `
Invoice from ${companyName}

Dear ${customerName},

Thank you for choosing ${companyName}! Please find your invoice attached.

INVOICE DETAILS
---------------
Invoice Number: ${invoiceNumber}
Amount Due: ${invoiceAmount}
Issue Date: ${new Date().toLocaleDateString()}

${paymentSection}

If you have any questions about this invoice, please don't hesitate to contact us.

Best regards,
The ${companyName} Team

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} ${companyName}. All rights reserved.
  `.trim()
}

// =============================================================================
// PII REDACTION
// =============================================================================

function redactEmailForLogging(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '[INVALID_EMAIL]'

  const redactedLocal = local.length > 2
    ? local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1)
    : '*'.repeat(local.length)

  return `${redactedLocal}@${domain}`
}

function redactPII(data: any): any {
  if (typeof data === 'string') {
    // Redact email addresses
    if (data.includes('@')) {
      return redactEmailForLogging(data)
    }
    // Redact what looks like names (simple heuristic)
    if (data.length > 3 && /^[A-Za-z\s]+$/.test(data)) {
      return data.charAt(0) + '*'.repeat(Math.max(0, data.length - 2)) + data.charAt(data.length - 1)
    }
    return data
  }

  if (Array.isArray(data)) {
    return data.map(redactPII)
  }

  if (data && typeof data === 'object') {
    const redacted: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes('email') || key.toLowerCase().includes('name')) {
        redacted[key] = redactPII(value)
      } else {
        redacted[key] = value
      }
    }
    return redacted
  }

  return data
}

// =============================================================================
// CORE EMAIL FUNCTIONS
// =============================================================================

/**
 * Send email with comprehensive error handling and logging
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  attachments,
  replyTo,
  from = FROM_EMAIL
}: SendEmailOptions): Promise<EmailResult> {
  try {
    if (!resend) {
      console.warn('Email service not configured - skipping email send')
      return {
        success: false,
        error: 'Email service not configured'
      }
    }

    // Validate email addresses
    const recipients = Array.isArray(to) ? to : [to]
    const invalidEmails = recipients.filter(email => !isValidEmail(email))

    if (invalidEmails.length > 0) {
      const redactedInvalid = invalidEmails.map(redactEmailForLogging)
      console.error('Invalid email addresses:', redactedInvalid)
      return {
        success: false,
        error: `Invalid email addresses: ${redactedInvalid.join(', ')}`
      }
    }

    // Log email attempt (with PII redaction)
    console.log('Sending email:', {
      to: redactPII(recipients),
      subject: subject.substring(0, 50) + (subject.length > 50 ? '...' : ''),
      from: redactEmailForLogging(from),
      attachmentCount: attachments?.length || 0
    })

    // Prepare attachments for Resend
    const resendAttachments = attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
      type: att.contentType
    }))

    // Send email
    const result = await resend.emails.send({
      from,
      to: recipients,
      subject,
      html,
      text: text || stripHtml(html),
      attachments: resendAttachments,
      reply_to: replyTo
    })

    if (result.error) {
      console.error('Resend API error:', {
        error: result.error,
        to: redactPII(recipients)
      })
      return {
        success: false,
        error: result.error.message || 'Email send failed'
      }
    }

    console.log('Email sent successfully:', {
      messageId: result.data?.id,
      to: redactPII(recipients)
    })

    return {
      success: true,
      messageId: result.data?.id
    }

  } catch (error) {
    console.error('Email send error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: redactPII(Array.isArray(to) ? to : [to])
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send invoice email with PDF attachment
 */
export async function sendInvoiceEmail(options: InvoiceEmailOptions): Promise<EmailResult> {
  try {
    const {
      to,
      customerName,
      invoiceNumber,
      invoiceAmount,
      paymentLink,
      pdfBuffer,
      companyName
    } = options

    const subject = `Invoice ${invoiceNumber} from ${companyName}`

    const templateData = {
      customerName,
      invoiceNumber,
      invoiceAmount,
      paymentLink,
      companyName
    }

    const html = createInvoiceEmailHTML(templateData)
    const text = createInvoiceEmailText(templateData)

    const attachments: EmailAttachment[] = [
      {
        filename: `invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]

    return await sendEmail({
      to,
      subject,
      html,
      text,
      attachments
    })

  } catch (error) {
    console.error('Invoice email send error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      invoiceNumber: options.invoiceNumber,
      to: redactEmailForLogging(options.to)
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send invoice email'
    }
  }
}

/**
 * Log email events to audit trail
 */
export async function logEmailEvent(
  action: 'sent' | 'failed' | 'delivered' | 'bounced',
  details: {
    invoiceId?: string
    customerId?: string
    email: string
    messageId?: string
    error?: string
  }
): Promise<void> {
  try {
    const supabase = createClient()

    await supabase.from('audit_logs').insert({
      table_name: 'invoices',
      record_id: details.invoiceId,
      action: `email_${action}`,
      new_values: {
        email: redactEmailForLogging(details.email),
        message_id: details.messageId,
        error: details.error
      },
      user_id: null, // System action
      user_role: 'system',
      ip_address: null,
      user_agent: 'email-service'
    })

  } catch (error) {
    console.error('Failed to log email event:', {
      action,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: redactPII(details)
    })
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Strip HTML tags to create plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/\s+/g, ' ') // Collapse multiple whitespace
    .trim()
}

/**
 * Check if email sending is enabled
 */
export function isEmailEnabled(): boolean {
  return Boolean(RESEND_API_KEY && process.env.ENABLE_EMAIL_SENDING !== 'false')
}

/**
 * Get email configuration info (for debugging)
 */
export function getEmailConfig(): {
  configured: boolean
  fromEmail: string
  enabled: boolean
} {
  return {
    configured: Boolean(RESEND_API_KEY),
    fromEmail: FROM_EMAIL,
    enabled: isEmailEnabled()
  }
}

// =============================================================================
// TEST FUNCTIONS (development only)
// =============================================================================

/**
 * Send test email (development only)
 */
export async function sendTestEmail(to: string): Promise<EmailResult> {
  if (process.env.NODE_ENV === 'production') {
    return {
      success: false,
      error: 'Test email not available in production'
    }
  }

  return await sendEmail({
    to,
    subject: 'Test Email from Dirt Free CRM',
    html: `
      <h1>Test Email</h1>
      <p>This is a test email from Dirt Free CRM.</p>
      <p>Sent at: ${new Date().toISOString()}</p>
    `,
    text: `
      Test Email

      This is a test email from Dirt Free CRM.
      Sent at: ${new Date().toISOString()}
    `
  })
}