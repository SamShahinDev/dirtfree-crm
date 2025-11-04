import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface EmailOptions {
  to: string | string[]
  subject: string
  template: string
  data: Record<string, any>
}

const EMAIL_TEMPLATES = {
  welcome: (data: any) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #14213d;">Welcome to Dirt Free Carpet!</h1>
      <p>Hi ${data.customerName},</p>
      <p>Thank you for choosing Dirt Free Carpet! We're excited to serve you.</p>
      <p>We've created a customer portal account for you where you can:</p>
      <ul>
        <li>View your service history</li>
        <li>Book future appointments</li>
        <li>Earn and redeem loyalty rewards</li>
        <li>Manage your account</li>
      </ul>
      <p>
        <a href="${data.portalUrl}/register" style="background-color: #fca311; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Access Your Portal
        </a>
      </p>
      <p>If you have any questions, feel free to call us at (713) 730-2782.</p>
      <p>Best regards,<br>The Dirt Free Team</p>
    </div>
  `,

  booking_received: (data: any) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #14213d;">Booking Confirmation</h1>
      <p>Hi ${data.customerName},</p>
      <p>Thank you for booking with Dirt Free Carpet! We've received your request.</p>

      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #14213d;">Booking Details</h2>
        <p><strong>Service:</strong> ${data.serviceType}</p>
        ${data.roomCount ? `<p><strong>Number of Rooms:</strong> ${data.roomCount}</p>` : ''}
        <p><strong>Preferred Date:</strong> ${data.preferredDate}</p>
        <p><strong>Preferred Time:</strong> ${data.preferredTime}</p>
        ${data.estimatedPrice ? `<p><strong>Estimated Price:</strong> $${data.estimatedPrice}</p>` : ''}
        <p><strong>Booking ID:</strong> ${data.bookingId.slice(0, 8).toUpperCase()}</p>
      </div>

      ${data.urgency === 'same-day'
        ? '<p style="color: #d9534f; font-weight: bold;">⚡ Same-day service requested - We\'ll call you ASAP!</p>'
        : '<p><strong>What happens next?</strong><br>We\'ll call you within 2 hours to confirm your appointment time and answer any questions.</p>'
      }

      <p>In the meantime, if you have any questions, feel free to contact us:</p>
      <ul>
        <li>Phone: (713) 730-2782</li>
        <li>Email: info@dirtfreecarpet.com</li>
      </ul>

      <p>We look forward to serving you!</p>
      <p>Best regards,<br>The Dirt Free Team</p>
    </div>
  `,

  portal_welcome: (data: any) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #14213d; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">Welcome to Your Customer Portal!</h1>
      </div>

      <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi ${data.customerName},</p>

        <p style="font-size: 16px; margin-bottom: 20px;">
          We've created a customer portal account for you! Your portal gives you 24/7 access to:
        </p>

        <ul style="font-size: 16px; line-height: 1.8; margin-bottom: 30px;">
          <li>View your complete service history</li>
          <li>Book and manage appointments online</li>
          <li>Track your loyalty rewards and redeem points</li>
          <li>Access invoices and payment history</li>
          <li>Update your account information</li>
          <li>View before/after photos of your services</li>
        </ul>

        <div style="background-color: white; padding: 25px; border-radius: 8px; border-left: 4px solid #fca311; margin-bottom: 30px;">
          <h2 style="color: #14213d; margin-top: 0; font-size: 20px;">Your Login Credentials</h2>
          <p style="margin: 10px 0;"><strong>Email:</strong> ${data.email}</p>
          <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background-color: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${data.tempPassword}</code></p>
          <p style="margin-top: 15px; color: #666; font-size: 14px;">
            ⚠️ For security, please change your password after your first login.
          </p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.portalUrl}" style="background-color: #fca311; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
            Access Your Portal Now
          </a>
        </div>

        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-top: 30px;">
          <h3 style="color: #14213d; margin-top: 0; font-size: 18px;">Need Help?</h3>
          <p style="margin: 10px 0;">
            If you're having trouble logging in or need to reset your password, click here:
          </p>
          <p style="margin: 10px 0;">
            <a href="${data.resetUrl}" style="color: #1976d2; text-decoration: underline;">Reset Password</a>
          </p>
          <p style="margin: 15px 0 0 0; font-size: 14px; color: #666;">
            Or contact us at (713) 730-2782 or info@dirtfreecarpet.com
          </p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="font-size: 14px; color: #666; margin: 5px 0;">
            Best regards,<br>
            <strong>The Dirt Free Team</strong>
          </p>
          <p style="font-size: 12px; color: #999; margin-top: 20px;">
            Serving Houston since 1989 | (713) 730-2782 | dirtfreecarpet.com
          </p>
        </div>
      </div>
    </div>
  `,
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, template, data } = options

  const htmlContent = EMAIL_TEMPLATES[template as keyof typeof EMAIL_TEMPLATES]?.(data) || `
    <div style="font-family: Arial, sans-serif;">
      <p>${JSON.stringify(data)}</p>
    </div>
  `

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Dirt Free Carpet <noreply@dirtfreecarpet.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: htmlContent,
    })
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}
