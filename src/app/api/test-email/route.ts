import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase/server'
import {
  sendPasswordResetEmail,
  sendEmailVerification,
  sendUserInvitation,
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendJobCompletionEmail,
  sendJobNotificationEmail,
  sendCustomEmail,
  isEmailServiceConfigured
} from '@/lib/email/service'

export async function POST(request: NextRequest) {
  try {
    const { email, type = 'password_reset', ...extraData } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    let result
    let emailType = ''

    switch (type) {
      case 'password_reset':
        emailType = 'Password Reset'
        result = await sendPasswordResetEmail(email)
        break

      case 'verification':
        emailType = 'Email Verification'
        result = await sendEmailVerification(email)
        break

      case 'invite':
        emailType = 'User Invitation'
        const supabase = await getServerSupabase()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user || user.app_metadata?.role !== 'admin') {
          return NextResponse.json(
            { error: 'Admin permissions required for invitations' },
            { status: 403 }
          )
        }

        result = await sendUserInvitation(email, extraData.inviterName || 'Admin')
        break

      case 'welcome':
        emailType = 'Welcome Email'
        result = await sendWelcomeEmail(
          email,
          extraData.name || 'User',
          extraData.inviterName
        )
        break

      case 'invoice':
        emailType = 'Invoice Email'
        result = await sendInvoiceEmail(
          email,
          extraData.customerName || 'Customer',
          extraData.invoiceUrl || '#',
          extraData.invoiceNumber || 'INV-001',
          extraData.amount || 100.00,
          extraData.invoiceData
        )
        break

      case 'job_completion':
        emailType = 'Job Completion Email'
        result = await sendJobCompletionEmail(
          email,
          extraData.customerName || 'Customer',
          extraData.jobDescription || 'Carpet cleaning service',
          extraData.technicianName || 'Technician'
        )
        break

      case 'job_notification':
        emailType = 'Job Notification Email'
        result = await sendJobNotificationEmail(
          email,
          extraData.customerName || 'Customer',
          extraData.jobType || 'appointment_confirmation',
          extraData.jobDescription || 'Carpet cleaning service',
          extraData.appointmentDate || new Date().toLocaleDateString(),
          extraData.appointmentTime || '2:00 PM',
          {
            technicianName: extraData.technicianName,
            technicianPhone: extraData.technicianPhone,
            estimatedArrival: extraData.estimatedArrival,
            address: extraData.address,
            notes: extraData.notes,
            rescheduleUrl: extraData.rescheduleUrl,
            feedbackUrl: extraData.feedbackUrl
          }
        )
        break

      case 'custom':
        emailType = 'Custom Email'
        result = await sendCustomEmail(
          email,
          extraData.subject || 'Test Email',
          extraData.html || '<p>This is a test email.</p>'
        )
        break

      default:
        return NextResponse.json(
          { error: 'Invalid email type' },
          { status: 400 }
        )
    }

    if (!result.success) {
      console.error(`${emailType} email error:`, result.error)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to send ${emailType.toLowerCase()}`,
          details: result.error,
          provider: result.provider
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${emailType} sent successfully`,
      emailType,
      recipient: email,
      provider: result.provider,
      messageId: result.messageId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Test email API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  const serviceStatus = isEmailServiceConfigured()

  return NextResponse.json({
    status: 'Email service operational',
    providers: {
      supabase: serviceStatus.supabase ? 'configured' : 'missing configuration',
      resend: serviceStatus.resend ? 'configured' : 'missing API key'
    },
    supportedTypes: [
      'password_reset',
      'verification',
      'invite',
      'welcome',
      'invoice',
      'job_completion',
      'job_notification',
      'custom'
    ],
    environment: process.env.NODE_ENV,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    timestamp: new Date().toISOString()
  })
}