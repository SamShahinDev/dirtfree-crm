interface PasswordResetTemplateProps {
  resetLink: string
  email: string
  companyName?: string
  supportEmail?: string
}

export function PasswordResetTemplate({
  resetLink,
  email,
  companyName = 'Dirt Free Carpet',
  supportEmail = 'support@dirtfreecarpet.com'
}: PasswordResetTemplateProps) {
  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1.6',
      color: '#333'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#3b82f6',
        padding: '40px 20px',
        textAlign: 'center' as const,
        borderRadius: '8px 8px 0 0'
      }}>
        <h1 style={{
          color: 'white',
          margin: '0',
          fontSize: '28px',
          fontWeight: 'bold'
        }}>
          🔐 Password Reset Request
        </h1>
      </div>

      {/* Content */}
      <div style={{
        backgroundColor: 'white',
        padding: '40px 30px',
        border: '1px solid #e5e7eb',
        borderTop: 'none'
      }}>
        <h2 style={{
          color: '#374151',
          fontSize: '24px',
          marginBottom: '20px',
          marginTop: '0'
        }}>
          Reset Your Password
        </h2>

        <p style={{
          fontSize: '16px',
          marginBottom: '20px',
          color: '#4b5563'
        }}>
          Hi there,
        </p>

        <p style={{
          fontSize: '16px',
          marginBottom: '30px',
          color: '#4b5563'
        }}>
          We received a request to reset the password for your {companyName} account associated with <strong>{email}</strong>.
        </p>

        <p style={{
          fontSize: '16px',
          marginBottom: '30px',
          color: '#4b5563'
        }}>
          Click the button below to create a new password:
        </p>

        {/* Reset Button */}
        <div style={{ textAlign: 'center' as const, margin: '40px 0' }}>
          <a
            href={resetLink}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              padding: '16px 32px',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'inline-block',
              textAlign: 'center' as const
            }}
          >
            Reset My Password
          </a>
        </div>

        {/* Security Info */}
        <div style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '6px',
          padding: '20px',
          margin: '30px 0'
        }}>
          <h3 style={{
            color: '#92400e',
            fontSize: '16px',
            marginTop: '0',
            marginBottom: '10px'
          }}>
            🔒 Security Information
          </h3>
          <ul style={{
            color: '#92400e',
            fontSize: '14px',
            marginBottom: '0',
            paddingLeft: '20px'
          }}>
            <li>This link will expire in <strong>1 hour</strong></li>
            <li>You can only use this link once</li>
            <li>If you didn't request this reset, please ignore this email</li>
          </ul>
        </div>

        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          marginTop: '30px'
        }}>
          If the button above doesn't work, you can copy and paste this link into your browser:
        </p>

        <p style={{
          fontSize: '14px',
          color: '#3b82f6',
          wordBreak: 'break-all' as const,
          backgroundColor: '#f9fafb',
          padding: '10px',
          borderRadius: '4px',
          border: '1px solid #e5e7eb'
        }}>
          {resetLink}
        </p>

        <p style={{
          fontSize: '16px',
          marginTop: '30px',
          color: '#4b5563'
        }}>
          If you have any questions or need assistance, please contact our support team at{' '}
          <a href={`mailto:${supportEmail}`} style={{ color: '#3b82f6' }}>
            {supportEmail}
          </a>
        </p>

        <p style={{
          fontSize: '16px',
          marginTop: '30px',
          color: '#4b5563'
        }}>
          Best regards,<br />
          The {companyName} Team
        </p>
      </div>

      {/* Footer */}
      <div style={{
        backgroundColor: '#f9fafb',
        padding: '30px 20px',
        textAlign: 'center' as const,
        borderRadius: '0 0 8px 8px',
        border: '1px solid #e5e7eb',
        borderTop: 'none'
      }}>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: '0 0 10px 0'
        }}>
          This email was sent by {companyName}
        </p>

        <p style={{
          fontSize: '12px',
          color: '#9ca3af',
          margin: '0'
        }}>
          If you didn't request this password reset, you can safely ignore this email.
          Your password will remain unchanged.
        </p>
      </div>
    </div>
  )
}

// Helper function to render template to HTML string
export function renderPasswordResetTemplate(props: PasswordResetTemplateProps): string {
  // This would typically use a React renderer like ReactDOMServer
  // For now, we'll return the JSX as HTML string manually
  const template = PasswordResetTemplate(props)

  // In a real implementation, you'd use ReactDOMServer.renderToString()
  // For simplicity, we'll build the HTML string directly
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Password Reset - ${props.companyName || 'Dirt Free Carpet'}</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <!-- Header -->
          <div style="background-color: #3b82f6; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
              🔐 Password Reset Request
            </h1>
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #374151; font-size: 24px; margin-bottom: 20px; margin-top: 0;">
              Reset Your Password
            </h2>

            <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
              Hi there,
            </p>

            <p style="font-size: 16px; margin-bottom: 30px; color: #4b5563;">
              We received a request to reset the password for your ${props.companyName || 'Dirt Free Carpet'} account associated with <strong>${props.email}</strong>.
            </p>

            <p style="font-size: 16px; margin-bottom: 30px; color: #4b5563;">
              Click the button below to create a new password:
            </p>

            <!-- Reset Button -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="${props.resetLink}" style="background-color: #dc2626; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
                Reset My Password
              </a>
            </div>

            <!-- Security Info -->
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #92400e; font-size: 16px; margin-top: 0; margin-bottom: 10px;">
                🔒 Security Information
              </h3>
              <ul style="color: #92400e; font-size: 14px; margin-bottom: 0; padding-left: 20px;">
                <li>This link will expire in <strong>1 hour</strong></li>
                <li>You can only use this link once</li>
                <li>If you didn't request this reset, please ignore this email</li>
              </ul>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              If the button above doesn't work, you can copy and paste this link into your browser:
            </p>

            <p style="font-size: 14px; color: #3b82f6; word-break: break-all; background-color: #f9fafb; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb;">
              ${props.resetLink}
            </p>

            <p style="font-size: 16px; margin-top: 30px; color: #4b5563;">
              If you have any questions or need assistance, please contact our support team at
              <a href="mailto:${props.supportEmail || 'support@dirtfreecarpet.com'}" style="color: #3b82f6;">
                ${props.supportEmail || 'support@dirtfreecarpet.com'}
              </a>
            </p>

            <p style="font-size: 16px; margin-top: 30px; color: #4b5563;">
              Best regards,<br />
              The ${props.companyName || 'Dirt Free Carpet'} Team
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 10px 0;">
              This email was sent by ${props.companyName || 'Dirt Free Carpet'}
            </p>

            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              If you didn't request this password reset, you can safely ignore this email.
              Your password will remain unchanged.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}