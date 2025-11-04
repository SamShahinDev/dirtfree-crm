interface WelcomeTemplateProps {
  userName: string
  userEmail: string
  dashboardUrl: string
  companyName?: string
  companyPhone?: string
  supportEmail?: string
  inviterName?: string
}

export function WelcomeTemplate({
  userName,
  userEmail,
  dashboardUrl,
  companyName = 'Dirt Free Carpet',
  companyPhone = '(555) 123-4567',
  supportEmail = 'support@dirtfreecarpet.com',
  inviterName
}: WelcomeTemplateProps) {
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
        backgroundColor: '#10b981',
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
          🎉 Welcome to {companyName}!
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
          Welcome to the Team!
        </h2>

        <p style={{
          fontSize: '16px',
          marginBottom: '20px',
          color: '#4b5563'
        }}>
          Hi {userName},
        </p>

        <p style={{
          fontSize: '16px',
          marginBottom: '30px',
          color: '#4b5563'
        }}>
          Welcome to {companyName}! {inviterName ? `${inviterName} has` : 'You have been'} invited you to join our team and access our CRM system.
        </p>

        {/* Account Details */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '6px',
          padding: '20px',
          margin: '30px 0'
        }}>
          <h3 style={{
            color: '#0c4a6e',
            fontSize: '16px',
            marginTop: '0',
            marginBottom: '15px'
          }}>
            📋 Your Account Details
          </h3>
          <div style={{ color: '#0c4a6e', fontSize: '14px' }}>
            <p style={{ margin: '5px 0' }}>
              <strong>Email:</strong> {userEmail}
            </p>
            <p style={{ margin: '5px 0' }}>
              <strong>Company:</strong> {companyName}
            </p>
            <p style={{ margin: '5px 0' }}>
              <strong>Status:</strong> Account Active
            </p>
          </div>
        </div>

        <p style={{
          fontSize: '16px',
          marginBottom: '30px',
          color: '#4b5563'
        }}>
          Your account has been set up and you can now access our CRM dashboard to manage customers, schedule jobs, and track service history.
        </p>

        {/* Dashboard Button */}
        <div style={{ textAlign: 'center' as const, margin: '40px 0' }}>
          <a
            href={dashboardUrl}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '16px 32px',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'inline-block'
            }}
          >
            Access Your Dashboard
          </a>
        </div>

        {/* Getting Started */}
        <div style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          padding: '20px',
          margin: '30px 0'
        }}>
          <h3 style={{
            color: '#374151',
            fontSize: '16px',
            marginTop: '0',
            marginBottom: '15px'
          }}>
            🚀 Getting Started
          </h3>
          <ul style={{
            color: '#4b5563',
            fontSize: '14px',
            marginBottom: '0',
            paddingLeft: '20px'
          }}>
            <li style={{ marginBottom: '8px' }}>
              <strong>Dashboard:</strong> View your daily schedule and pending jobs
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Customers:</strong> Search and manage customer information
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Jobs:</strong> Create, update, and track service appointments
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>Reports:</strong> Access performance metrics and analytics
            </li>
          </ul>
        </div>

        {/* Support Info */}
        <div style={{
          backgroundColor: '#fef7ff',
          border: '1px solid #c084fc',
          borderRadius: '6px',
          padding: '20px',
          margin: '30px 0'
        }}>
          <h3 style={{
            color: '#7c2d12',
            fontSize: '16px',
            marginTop: '0',
            marginBottom: '10px'
          }}>
            💬 Need Help?
          </h3>
          <p style={{
            color: '#7c2d12',
            fontSize: '14px',
            marginBottom: '10px'
          }}>
            Our team is here to help you get started:
          </p>
          <div style={{ color: '#7c2d12', fontSize: '14px' }}>
            <p style={{ margin: '5px 0' }}>
              📧 Email: <a href={`mailto:${supportEmail}`} style={{ color: '#3b82f6' }}>{supportEmail}</a>
            </p>
            <p style={{ margin: '5px 0' }}>
              📞 Phone: <a href={`tel:${companyPhone}`} style={{ color: '#3b82f6' }}>{companyPhone}</a>
            </p>
          </div>
        </div>

        <p style={{
          fontSize: '16px',
          marginTop: '30px',
          color: '#4b5563'
        }}>
          We're excited to have you on board and look forward to working together!
        </p>

        <p style={{
          fontSize: '16px',
          marginTop: '20px',
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
          Welcome email sent by {companyName}
        </p>

        <p style={{
          fontSize: '12px',
          color: '#9ca3af',
          margin: '0'
        }}>
          This email contains important information about your account setup.
        </p>
      </div>
    </div>
  )
}

// Helper function to render template to HTML string
export function renderWelcomeTemplate(props: WelcomeTemplateProps): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Welcome to ${props.companyName || 'Dirt Free Carpet'}</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <!-- Header -->
          <div style="background-color: #10b981; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
              🎉 Welcome to ${props.companyName || 'Dirt Free Carpet'}!
            </h1>
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #374151; font-size: 24px; margin-bottom: 20px; margin-top: 0;">
              Welcome to the Team!
            </h2>

            <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
              Hi ${props.userName},
            </p>

            <p style="font-size: 16px; margin-bottom: 30px; color: #4b5563;">
              Welcome to ${props.companyName || 'Dirt Free Carpet'}! ${props.inviterName ? `${props.inviterName} has` : 'You have been'} invited you to join our team and access our CRM system.
            </p>

            <!-- Account Details -->
            <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 6px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #0c4a6e; font-size: 16px; margin-top: 0; margin-bottom: 15px;">
                📋 Your Account Details
              </h3>
              <div style="color: #0c4a6e; font-size: 14px;">
                <p style="margin: 5px 0;">
                  <strong>Email:</strong> ${props.userEmail}
                </p>
                <p style="margin: 5px 0;">
                  <strong>Company:</strong> ${props.companyName || 'Dirt Free Carpet'}
                </p>
                <p style="margin: 5px 0;">
                  <strong>Status:</strong> Account Active
                </p>
              </div>
            </div>

            <p style="font-size: 16px; margin-bottom: 30px; color: #4b5563;">
              Your account has been set up and you can now access our CRM dashboard to manage customers, schedule jobs, and track service history.
            </p>

            <!-- Dashboard Button -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="${props.dashboardUrl}" style="background-color: #3b82f6; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
                Access Your Dashboard
              </a>
            </div>

            <!-- Getting Started -->
            <div style="background-color: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #374151; font-size: 16px; margin-top: 0; margin-bottom: 15px;">
                🚀 Getting Started
              </h3>
              <ul style="color: #4b5563; font-size: 14px; margin-bottom: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">
                  <strong>Dashboard:</strong> View your daily schedule and pending jobs
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>Customers:</strong> Search and manage customer information
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>Jobs:</strong> Create, update, and track service appointments
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>Reports:</strong> Access performance metrics and analytics
                </li>
              </ul>
            </div>

            <!-- Support Info -->
            <div style="background-color: #fef7ff; border: 1px solid #c084fc; border-radius: 6px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #7c2d12; font-size: 16px; margin-top: 0; margin-bottom: 10px;">
                💬 Need Help?
              </h3>
              <p style="color: #7c2d12; font-size: 14px; margin-bottom: 10px;">
                Our team is here to help you get started:
              </p>
              <div style="color: #7c2d12; font-size: 14px;">
                <p style="margin: 5px 0;">
                  📧 Email: <a href="mailto:${props.supportEmail || 'support@dirtfreecarpet.com'}" style="color: #3b82f6;">${props.supportEmail || 'support@dirtfreecarpet.com'}</a>
                </p>
                <p style="margin: 5px 0;">
                  📞 Phone: <a href="tel:${props.companyPhone || '(555) 123-4567'}" style="color: #3b82f6;">${props.companyPhone || '(555) 123-4567'}</a>
                </p>
              </div>
            </div>

            <p style="font-size: 16px; margin-top: 30px; color: #4b5563;">
              We're excited to have you on board and look forward to working together!
            </p>

            <p style="font-size: 16px; margin-top: 20px; color: #4b5563;">
              Best regards,<br />
              The ${props.companyName || 'Dirt Free Carpet'} Team
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 14px; color: #6b7280; margin: 0 0 10px 0;">
              Welcome email sent by ${props.companyName || 'Dirt Free Carpet'}
            </p>

            <p style="font-size: 12px; color: #9ca3af; margin: 0;">
              This email contains important information about your account setup.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}