import { NextRequest, NextResponse } from 'next/server'
import { renderWelcomeTemplate } from '@/lib/email/templates/welcome'
import { renderInvoiceTemplate } from '@/lib/email/templates/invoice'
import { renderJobNotificationTemplate } from '@/lib/email/templates/job-notification'
import { renderPasswordResetTemplate } from '@/lib/email/templates/password-reset'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const template = searchParams.get('template') || 'welcome'

  let html = ''

  try {
    switch (template) {
      case 'welcome':
        html = renderWelcomeTemplate({
          userName: 'John Doe',
          userEmail: 'john.doe@example.com',
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
          companyName: 'Dirt Free Carpet',
          companyPhone: '(555) 123-4567',
          supportEmail: 'support@dirtfreecarpet.com',
          inviterName: 'Sarah Manager'
        })
        break

      case 'invoice':
        html = renderInvoiceTemplate({
          customerName: 'Jane Smith',
          customerEmail: 'jane.smith@example.com',
          invoiceNumber: 'INV-2024-001',
          invoiceDate: new Date().toLocaleDateString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          items: [
            {
              description: 'Living Room Carpet Deep Clean',
              quantity: 1,
              rate: 150.00,
              amount: 150.00
            },
            {
              description: 'Bedroom Carpet Steam Clean',
              quantity: 2,
              rate: 80.00,
              amount: 160.00
            },
            {
              description: 'Stain Protection Treatment',
              quantity: 1,
              rate: 50.00,
              amount: 50.00
            }
          ],
          subtotal: 360.00,
          tax: 32.40,
          total: 392.40,
          paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/pay/INV-2024-001`,
          invoiceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/INV-2024-001`,
          companyName: 'Dirt Free Carpet',
          companyAddress: '123 Main Street, Your City, State 12345',
          companyPhone: '(555) 123-4567',
          companyEmail: 'billing@dirtfreecarpet.com',
          notes: 'Thank you for choosing our professional carpet cleaning services. We guarantee your satisfaction!'
        })
        break

      case 'job_confirmation':
        html = renderJobNotificationTemplate({
          customerName: 'Bob Johnson',
          customerEmail: 'bob.johnson@example.com',
          jobType: 'appointment_confirmation',
          jobDescription: 'Whole House Carpet Deep Clean',
          appointmentDate: 'Monday, October 30th, 2024',
          appointmentTime: '2:00 PM - 4:00 PM',
          technicianName: 'Mike Tech',
          technicianPhone: '(555) 987-6543',
          address: '456 Oak Street, Your City, State 12345',
          companyName: 'Dirt Free Carpet',
          companyPhone: '(555) 123-4567',
          companyEmail: 'service@dirtfreecarpet.com',
          notes: 'Please ensure all furniture is moved from carpeted areas before our arrival.'
        })
        break

      case 'job_on_the_way':
        html = renderJobNotificationTemplate({
          customerName: 'Bob Johnson',
          customerEmail: 'bob.johnson@example.com',
          jobType: 'on_the_way',
          jobDescription: 'Whole House Carpet Deep Clean',
          appointmentDate: 'Monday, October 30th, 2024',
          appointmentTime: '2:00 PM - 4:00 PM',
          technicianName: 'Mike Tech',
          technicianPhone: '(555) 987-6543',
          estimatedArrival: '1:45 PM',
          address: '456 Oak Street, Your City, State 12345',
          companyName: 'Dirt Free Carpet',
          companyPhone: '(555) 123-4567',
          companyEmail: 'service@dirtfreecarpet.com'
        })
        break

      case 'job_completion':
        html = renderJobNotificationTemplate({
          customerName: 'Bob Johnson',
          customerEmail: 'bob.johnson@example.com',
          jobType: 'completion',
          jobDescription: 'Whole House Carpet Deep Clean',
          appointmentDate: 'Monday, October 30th, 2024',
          appointmentTime: '2:00 PM - 4:00 PM',
          technicianName: 'Mike Tech',
          technicianPhone: '(555) 987-6543',
          address: '456 Oak Street, Your City, State 12345',
          companyName: 'Dirt Free Carpet',
          companyPhone: '(555) 123-4567',
          companyEmail: 'service@dirtfreecarpet.com',
          feedbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/feedback/12345`,
          notes: 'Your carpets will be slightly damp. Please avoid heavy foot traffic for 4-6 hours.'
        })
        break

      case 'password_reset':
        html = renderPasswordResetTemplate({
          resetLink: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset?token=sample-token-12345`,
          email: 'user@example.com',
          companyName: 'Dirt Free Carpet',
          supportEmail: 'support@dirtfreecarpet.com'
        })
        break

      default:
        return NextResponse.json(
          { error: 'Invalid template type' },
          { status: 400 }
        )
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Template preview error:', error)
    return NextResponse.json(
      { error: 'Failed to render template' },
      { status: 500 }
    )
  }
}

// Also provide a list of available templates
export async function POST() {
  return NextResponse.json({
    available_templates: [
      {
        id: 'welcome',
        name: 'Welcome Email',
        description: 'Welcome new team members to the CRM system',
        preview_url: `/api/test-email-preview?template=welcome`
      },
      {
        id: 'invoice',
        name: 'Invoice Email',
        description: 'Professional invoice with itemized billing',
        preview_url: `/api/test-email-preview?template=invoice`
      },
      {
        id: 'job_confirmation',
        name: 'Appointment Confirmation',
        description: 'Confirm upcoming service appointments',
        preview_url: `/api/test-email-preview?template=job_confirmation`
      },
      {
        id: 'job_on_the_way',
        name: 'On The Way Notification',
        description: 'Notify customers when technician is en route',
        preview_url: `/api/test-email-preview?template=job_on_the_way`
      },
      {
        id: 'job_completion',
        name: 'Service Completion',
        description: 'Notify customers when service is complete',
        preview_url: `/api/test-email-preview?template=job_completion`
      },
      {
        id: 'password_reset',
        name: 'Password Reset',
        description: 'Secure password reset instructions',
        preview_url: `/api/test-email-preview?template=password_reset`
      }
    ],
    test_sending: {
      endpoint: '/api/test-email',
      methods: ['GET', 'POST'],
      description: 'Send actual test emails to verify email service functionality'
    }
  })
}