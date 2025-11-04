import { Resend } from 'resend'
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server'
import { renderWelcomeTemplate } from './templates/welcome'
import { renderInvoiceTemplate } from './templates/invoice'
import { renderInvoiceReceiptTemplate } from './templates/invoice-receipt'
import { renderJobNotificationTemplate } from './templates/job-notification'
import { renderJobReminderTemplate } from './templates/job-reminder'

// Initialize Resend (optional - for custom emails)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Email service configuration
const emailConfig = {
  fromEmail: process.env.INVOICE_FROM_EMAIL || 'noreply@dirtfreecarpet.com',
  companyName: process.env.COMPANY_NAME || 'Dirt Free Carpet',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
}

// Email service result type
export type EmailResult = {
  success: boolean
  error?: string
  messageId?: string
  provider: 'supabase' | 'resend'
}

/**
 * Send password reset email using Supabase Auth
 */
export async function sendPasswordResetEmail(email: string): Promise<EmailResult> {
  try {
    const supabase = await getServerSupabase()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${emailConfig.appUrl}/auth/reset`,
    })

    if (error) {
      console.error('Password reset email error:', error)
      return {
        success: false,
        error: error.message,
        provider: 'supabase'
      }
    }

    return {
      success: true,
      provider: 'supabase'
    }
  } catch (error) {
    console.error('Unexpected password reset email error:', error)
    return {
      success: false,
      error: 'Failed to send password reset email',
      provider: 'supabase'
    }
  }
}

/**
 * Send email verification using Supabase Auth
 */
export async function sendEmailVerification(email: string): Promise<EmailResult> {
  try {
    const supabase = await getServerSupabase()

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      console.error('Email verification error:', error)
      return {
        success: false,
        error: error.message,
        provider: 'supabase'
      }
    }

    return {
      success: true,
      provider: 'supabase'
    }
  } catch (error) {
    console.error('Unexpected email verification error:', error)
    return {
      success: false,
      error: 'Failed to send verification email',
      provider: 'supabase'
    }
  }
}

/**
 * Send user invitation using Supabase Auth Admin
 */
export async function sendUserInvitation(email: string, inviterName?: string): Promise<EmailResult> {
  try {
    const serviceSupabase = getServiceSupabase()

    const { error } = await serviceSupabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${emailConfig.appUrl}/login`,
      data: {
        inviter_name: inviterName,
        company_name: emailConfig.companyName,
      }
    })

    if (error) {
      console.error('User invitation error:', error)
      return {
        success: false,
        error: error.message,
        provider: 'supabase'
      }
    }

    return {
      success: true,
      provider: 'supabase'
    }
  } catch (error) {
    console.error('Unexpected user invitation error:', error)
    return {
      success: false,
      error: 'Failed to send invitation email',
      provider: 'supabase'
    }
  }
}

/**
 * Send welcome email for new users (custom email using Resend)
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
  inviterName?: string
): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend not configured, skipping welcome email')
    return {
      success: false,
      error: 'Email service not configured',
      provider: 'resend'
    }
  }

  try {
    const html = renderWelcomeTemplate({
      userName: name,
      userEmail: email,
      dashboardUrl: `${emailConfig.appUrl}/dashboard`,
      companyName: emailConfig.companyName,
      companyPhone: process.env.COMPANY_PHONE,
      supportEmail: process.env.COMPANY_EMAIL,
      inviterName
    })

    const { data, error } = await resend.emails.send({
      from: emailConfig.fromEmail,
      to: email,
      subject: `Welcome to ${emailConfig.companyName}!`,
      html,
    })

    if (error) {
      console.error('Welcome email error:', error)
      return {
        success: false,
        error: error.message,
        provider: 'resend'
      }
    }

    return {
      success: true,
      messageId: data?.id,
      provider: 'resend'
    }
  } catch (error) {
    console.error('Unexpected welcome email error:', error)
    return {
      success: false,
      error: 'Failed to send welcome email',
      provider: 'resend'
    }
  }
}

/**
 * Send invoice email to customer (custom email using Resend)
 */
export async function sendInvoiceEmail(
  customerEmail: string,
  customerName: string,
  invoiceUrl: string,
  invoiceNumber: string,
  amount: number,
  invoiceData?: {
    items: Array<{
      description: string
      quantity: number
      rate: number
      amount: number
    }>
    subtotal: number
    tax?: number
    invoiceDate: string
    dueDate: string
    notes?: string
  }
): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend not configured, skipping invoice email')
    return {
      success: false,
      error: 'Email service not configured',
      provider: 'resend'
    }
  }

  try {
    const html = renderInvoiceTemplate({
      customerName,
      customerEmail,
      invoiceNumber,
      invoiceDate: invoiceData?.invoiceDate || new Date().toLocaleDateString(),
      dueDate: invoiceData?.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      items: invoiceData?.items || [
        {
          description: 'Professional Carpet Cleaning Service',
          quantity: 1,
          rate: amount,
          amount: amount
        }
      ],
      subtotal: invoiceData?.subtotal || amount,
      tax: invoiceData?.tax || 0,
      total: amount,
      paymentUrl: invoiceUrl,
      invoiceUrl,
      companyName: emailConfig.companyName,
      companyAddress: process.env.COMPANY_ADDRESS_LINE1 ?
        `${process.env.COMPANY_ADDRESS_LINE1}, ${process.env.COMPANY_CITY}, ${process.env.COMPANY_STATE} ${process.env.COMPANY_ZIP}` :
        undefined,
      companyPhone: process.env.COMPANY_PHONE,
      companyEmail: process.env.INVOICE_FROM_EMAIL || emailConfig.fromEmail,
      notes: invoiceData?.notes
    })

    const { data, error } = await resend.emails.send({
      from: emailConfig.fromEmail,
      to: customerEmail,
      subject: `Invoice ${invoiceNumber} from ${emailConfig.companyName}`,
      html,
    })

    if (error) {
      console.error('Invoice email error:', error)
      return {
        success: false,
        error: error.message,
        provider: 'resend'
      }
    }

    return {
      success: true,
      messageId: data?.id,
      provider: 'resend'
    }
  } catch (error) {
    console.error('Unexpected invoice email error:', error)
    return {
      success: false,
      error: 'Failed to send invoice email',
      provider: 'resend'
    }
  }
}

/**
 * Send job notification to customer
 */
export async function sendJobNotificationEmail(
  customerEmail: string,
  customerName: string,
  jobType: 'appointment_confirmation' | 'on_the_way' | 'completion' | 'reschedule' | 'cancellation',
  jobDescription: string,
  appointmentDate: string,
  appointmentTime: string,
  options?: {
    technicianName?: string
    technicianPhone?: string
    estimatedArrival?: string
    address?: string
    notes?: string
    rescheduleUrl?: string
    feedbackUrl?: string
  }
): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend not configured, skipping job notification email')
    return {
      success: false,
      error: 'Email service not configured',
      provider: 'resend'
    }
  }

  try {
    const html = renderJobNotificationTemplate({
      customerName,
      customerEmail,
      jobType,
      jobDescription,
      appointmentDate,
      appointmentTime,
      technicianName: options?.technicianName,
      technicianPhone: options?.technicianPhone,
      estimatedArrival: options?.estimatedArrival,
      address: options?.address,
      companyName: emailConfig.companyName,
      companyPhone: process.env.COMPANY_PHONE,
      companyEmail: process.env.COMPANY_EMAIL,
      notes: options?.notes,
      rescheduleUrl: options?.rescheduleUrl,
      feedbackUrl: options?.feedbackUrl
    })

    const subjectMap = {
      appointment_confirmation: `Appointment Confirmed - ${emailConfig.companyName}`,
      on_the_way: `We're On Our Way! - ${emailConfig.companyName}`,
      completion: `Service Complete - ${emailConfig.companyName}`,
      reschedule: `Appointment Rescheduled - ${emailConfig.companyName}`,
      cancellation: `Appointment Cancelled - ${emailConfig.companyName}`
    }

    const { data, error } = await resend.emails.send({
      from: emailConfig.fromEmail,
      to: customerEmail,
      subject: subjectMap[jobType],
      html,
    })

    if (error) {
      console.error('Job notification email error:', error)
      return {
        success: false,
        error: error.message,
        provider: 'resend'
      }
    }

    return {
      success: true,
      messageId: data?.id,
      provider: 'resend'
    }
  } catch (error) {
    console.error('Unexpected job notification email error:', error)
    return {
      success: false,
      error: 'Failed to send job notification email',
      provider: 'resend'
    }
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function sendJobCompletionEmail(
  customerEmail: string,
  customerName: string,
  jobDescription: string,
  technicianName?: string
): Promise<EmailResult> {
  return sendJobNotificationEmail(
    customerEmail,
    customerName,
    'completion',
    jobDescription,
    new Date().toLocaleDateString(),
    'Completed',
    {
      technicianName
    }
  )
}

/**
 * Generic email sender using Resend
 */
export async function sendCustomEmail(
  to: string,
  subject: string,
  html: string,
  from?: string
): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend not configured, cannot send custom email')
    return {
      success: false,
      error: 'Email service not configured',
      provider: 'resend'
    }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: from || emailConfig.fromEmail,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('Custom email error:', error)
      return {
        success: false,
        error: error.message,
        provider: 'resend'
      }
    }

    return {
      success: true,
      messageId: data?.id,
      provider: 'resend'
    }
  } catch (error) {
    console.error('Unexpected custom email error:', error)
    return {
      success: false,
      error: 'Failed to send custom email',
      provider: 'resend'
    }
  }
}

/**
 * Send job reminder email to customer
 */
export async function sendJobReminderEmail(
  customerEmail: string,
  customerName: string,
  jobDate: string,
  jobTime: string,
  address: string,
  services: string[],
  options?: {
    technicianName?: string
    technicianPhone?: string
    estimatedDuration?: string
    specialInstructions?: string
    rescheduleUrl?: string
    cancelUrl?: string
  }
): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend not configured, skipping job reminder email')
    return {
      success: false,
      error: 'Email service not configured',
      provider: 'resend'
    }
  }

  try {
    const html = renderJobReminderTemplate({
      customerName,
      jobDate,
      jobTime,
      address,
      services,
      technicianName: options?.technicianName,
      technicianPhone: options?.technicianPhone,
      estimatedDuration: options?.estimatedDuration,
      specialInstructions: options?.specialInstructions,
      rescheduleUrl: options?.rescheduleUrl || `${emailConfig.appUrl}/portal/appointments`,
      cancelUrl: options?.cancelUrl || `${emailConfig.appUrl}/portal/appointments`
    })

    const { data, error } = await resend.emails.send({
      from: emailConfig.fromEmail,
      to: customerEmail,
      subject: `Reminder: Service Scheduled for ${jobDate} - ${emailConfig.companyName}`,
      html,
    })

    if (error) {
      console.error('Job reminder email error:', error)
      return {
        success: false,
        error: error.message,
        provider: 'resend'
      }
    }

    return {
      success: true,
      messageId: data?.id,
      provider: 'resend'
    }
  } catch (error) {
    console.error('Unexpected job reminder email error:', error)
    return {
      success: false,
      error: 'Failed to send job reminder email',
      provider: 'resend'
    }
  }
}

/**
 * Send invoice receipt email after successful payment
 */
export async function sendInvoiceReceipt(
  customerEmail: string,
  customerName: string,
  invoiceNumber: string,
  amountPaid: number,
  currency: string,
  paymentDate: string,
  options?: {
    paymentMethod?: string
    loyaltyPointsEarned?: number
    invoiceUrl?: string
    invoicePdfUrl?: string
    nextAppointment?: {
      date: string
      time: string
      serviceType: string
    }
  }
): Promise<EmailResult> {
  if (!resend) {
    console.warn('Resend not configured, skipping invoice receipt email')
    return {
      success: false,
      error: 'Email service not configured',
      provider: 'resend'
    }
  }

  try {
    const html = renderInvoiceReceiptTemplate({
      customerName,
      customerEmail,
      invoiceNumber,
      amountPaid,
      currency,
      paymentDate,
      paymentMethod: options?.paymentMethod,
      loyaltyPointsEarned: options?.loyaltyPointsEarned,
      invoiceUrl: options?.invoiceUrl,
      invoicePdfUrl: options?.invoicePdfUrl,
      nextAppointment: options?.nextAppointment,
      companyName: emailConfig.companyName,
      companyPhone: process.env.COMPANY_PHONE,
      companyEmail: process.env.INVOICE_FROM_EMAIL || emailConfig.fromEmail,
      portalUrl: process.env.NEXT_PUBLIC_PORTAL_URL || emailConfig.appUrl,
    })

    const { data, error } = await resend.emails.send({
      from: emailConfig.fromEmail,
      to: customerEmail,
      subject: `Payment Receipt - Invoice ${invoiceNumber} - ${emailConfig.companyName}`,
      html,
    })

    if (error) {
      console.error('Invoice receipt email error:', error)
      return {
        success: false,
        error: error.message,
        provider: 'resend'
      }
    }

    return {
      success: true,
      messageId: data?.id,
      provider: 'resend'
    }
  } catch (error) {
    console.error('Unexpected invoice receipt email error:', error)
    return {
      success: false,
      error: 'Failed to send invoice receipt email',
      provider: 'resend'
    }
  }
}

/**
 * Check if email service is properly configured
 */
export function isEmailServiceConfigured(): { supabase: boolean; resend: boolean } {
  return {
    supabase: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    resend: !!process.env.RESEND_API_KEY
  }
}