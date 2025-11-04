interface JobNotificationTemplateProps {
  customerName: string
  customerEmail?: string
  jobType: 'appointment_confirmation' | 'on_the_way' | 'completion' | 'reschedule' | 'cancellation'
  jobDescription: string
  appointmentDate: string
  appointmentTime: string
  technicianName?: string
  technicianPhone?: string
  estimatedArrival?: string
  address?: string
  companyName?: string
  companyPhone?: string
  companyEmail?: string
  notes?: string
  rescheduleUrl?: string
  feedbackUrl?: string
}

export function JobNotificationTemplate({
  customerName,
  customerEmail,
  jobType,
  jobDescription,
  appointmentDate,
  appointmentTime,
  technicianName,
  technicianPhone,
  estimatedArrival,
  address,
  companyName = 'Dirt Free Carpet',
  companyPhone = '(555) 123-4567',
  companyEmail = 'service@dirtfreecarpet.com',
  notes,
  rescheduleUrl,
  feedbackUrl
}: JobNotificationTemplateProps) {

  const getJobTypeConfig = () => {
    switch (jobType) {
      case 'appointment_confirmation':
        return {
          emoji: '📅',
          title: 'Appointment Confirmed',
          headerColor: '#10b981',
          message: `Your ${jobDescription.toLowerCase()} appointment has been confirmed.`
        }
      case 'on_the_way':
        return {
          emoji: '🚗',
          title: 'We\'re On Our Way!',
          headerColor: '#f59e0b',
          message: `${technicianName || 'Our technician'} is heading to your location now.`
        }
      case 'completion':
        return {
          emoji: '✅',
          title: 'Service Complete',
          headerColor: '#059669',
          message: `Your ${jobDescription.toLowerCase()} service has been completed successfully.`
        }
      case 'reschedule':
        return {
          emoji: '🔄',
          title: 'Appointment Rescheduled',
          headerColor: '#3b82f6',
          message: `Your appointment has been rescheduled to a new time.`
        }
      case 'cancellation':
        return {
          emoji: '❌',
          title: 'Appointment Cancelled',
          headerColor: '#dc2626',
          message: `Your appointment has been cancelled as requested.`
        }
      default:
        return {
          emoji: '📋',
          title: 'Service Update',
          headerColor: '#6b7280',
          message: `We have an update regarding your service appointment.`
        }
    }
  }

  const config = getJobTypeConfig()

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
        backgroundColor: config.headerColor,
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
          {config.emoji} {config.title}
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
          Hi {customerName}!
        </h2>

        <p style={{
          fontSize: '16px',
          marginBottom: '30px',
          color: '#4b5563'
        }}>
          {config.message}
        </p>

        {/* Appointment Details */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          padding: '25px',
          margin: '30px 0'
        }}>
          <h3 style={{
            color: '#0c4a6e',
            fontSize: '18px',
            marginTop: '0',
            marginBottom: '20px'
          }}>
            📋 Service Details
          </h3>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            color: '#0c4a6e',
            fontSize: '14px'
          }}>
            <div>
              <p style={{ margin: '8px 0' }}>
                <strong>Service:</strong> {jobDescription}
              </p>
              <p style={{ margin: '8px 0' }}>
                <strong>Date:</strong> {appointmentDate}
              </p>
              <p style={{ margin: '8px 0' }}>
                <strong>Time:</strong> {appointmentTime}
              </p>
            </div>
            <div>
              {technicianName && (
                <p style={{ margin: '8px 0' }}>
                  <strong>Technician:</strong> {technicianName}
                </p>
              )}
              {technicianPhone && (
                <p style={{ margin: '8px 0' }}>
                  <strong>Tech Phone:</strong>{' '}
                  <a href={`tel:${technicianPhone}`} style={{ color: '#3b82f6' }}>
                    {technicianPhone}
                  </a>
                </p>
              )}
              {address && (
                <p style={{ margin: '8px 0' }}>
                  <strong>Location:</strong> {address}
                </p>
              )}
            </div>
          </div>

          {estimatedArrival && jobType === 'on_the_way' && (
            <div style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid #22c55e',
              borderRadius: '6px',
              padding: '15px',
              marginTop: '20px'
            }}>
              <p style={{
                color: '#15803d',
                fontSize: '16px',
                fontWeight: 'bold',
                margin: '0',
                textAlign: 'center' as const
              }}>
                🕒 Estimated Arrival: {estimatedArrival}
              </p>
            </div>
          )}
        </div>

        {/* Job Type Specific Content */}
        {jobType === 'appointment_confirmation' && (
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
              marginBottom: '15px'
            }}>
              ⏰ What to Expect
            </h3>
            <ul style={{
              color: '#92400e',
              fontSize: '14px',
              marginBottom: '0',
              paddingLeft: '20px'
            }}>
              <li style={{ marginBottom: '8px' }}>
                Our technician will arrive at the scheduled time
              </li>
              <li style={{ marginBottom: '8px' }}>
                We'll send you an "on the way" notification
              </li>
              <li style={{ marginBottom: '8px' }}>
                Please ensure easy access to the service area
              </li>
              <li style={{ marginBottom: '8px' }}>
                Payment can be made after service completion
              </li>
            </ul>
          </div>
        )}

        {jobType === 'on_the_way' && (
          <div style={{
            backgroundColor: '#fff7ed',
            border: '1px solid #fb923c',
            borderRadius: '6px',
            padding: '20px',
            margin: '30px 0'
          }}>
            <h3 style={{
              color: '#9a3412',
              fontSize: '16px',
              marginTop: '0',
              marginBottom: '15px'
            }}>
              🏠 Please Prepare
            </h3>
            <ul style={{
              color: '#9a3412',
              fontSize: '14px',
              marginBottom: '0',
              paddingLeft: '20px'
            }}>
              <li style={{ marginBottom: '8px' }}>
                Clear the work area of furniture and personal items
              </li>
              <li style={{ marginBottom: '8px' }}>
                Ensure pets are secured in a safe area
              </li>
              <li style={{ marginBottom: '8px' }}>
                Have parking space available for our van
              </li>
              <li style={{ marginBottom: '8px' }}>
                Be available to let our technician in
              </li>
            </ul>
          </div>
        )}

        {jobType === 'completion' && feedbackUrl && (
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #22c55e',
            borderRadius: '6px',
            padding: '20px',
            margin: '30px 0',
            textAlign: 'center' as const
          }}>
            <h3 style={{
              color: '#15803d',
              fontSize: '16px',
              marginTop: '0',
              marginBottom: '15px'
            }}>
              ⭐ How Did We Do?
            </h3>
            <p style={{
              color: '#15803d',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              Your feedback helps us maintain our high standards of service.
            </p>
            <a
              href={feedbackUrl}
              style={{
                backgroundColor: '#059669',
                color: 'white',
                padding: '12px 24px',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'inline-block'
              }}
            >
              Leave Feedback
            </a>
          </div>
        )}

        {jobType === 'reschedule' && rescheduleUrl && (
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            padding: '20px',
            margin: '30px 0',
            textAlign: 'center' as const
          }}>
            <h3 style={{
              color: '#1e40af',
              fontSize: '16px',
              marginTop: '0',
              marginBottom: '15px'
            }}>
              📅 Need to Reschedule Again?
            </h3>
            <p style={{
              color: '#1e40af',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              You can easily reschedule online if needed.
            </p>
            <a
              href={rescheduleUrl}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '12px 24px',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'inline-block'
              }}
            >
              Reschedule Appointment
            </a>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div style={{
            backgroundColor: '#fefce8',
            border: '1px solid #eab308',
            borderRadius: '6px',
            padding: '20px',
            margin: '30px 0'
          }}>
            <h3 style={{
              color: '#a16207',
              fontSize: '16px',
              marginTop: '0',
              marginBottom: '10px'
            }}>
              📝 Additional Notes
            </h3>
            <p style={{
              color: '#a16207',
              fontSize: '14px',
              marginBottom: '0'
            }}>
              {notes}
            </p>
          </div>
        )}

        {/* Contact Info */}
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
            📞 Questions? Contact Us
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '15px',
            color: '#4b5563',
            fontSize: '14px'
          }}>
            <div>
              <p style={{ margin: '5px 0' }}>
                📧 <a href={`mailto:${companyEmail}`} style={{ color: '#3b82f6' }}>
                  {companyEmail}
                </a>
              </p>
              <p style={{ margin: '5px 0' }}>
                📞 <a href={`tel:${companyPhone}`} style={{ color: '#3b82f6' }}>
                  {companyPhone}
                </a>
              </p>
            </div>
            {technicianName && technicianPhone && (
              <div>
                <p style={{ margin: '5px 0' }}>
                  <strong>Your Technician:</strong>
                </p>
                <p style={{ margin: '5px 0' }}>
                  📱 <a href={`tel:${technicianPhone}`} style={{ color: '#3b82f6' }}>
                    {technicianName}
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>

        <p style={{
          fontSize: '16px',
          marginTop: '30px',
          color: '#4b5563',
          textAlign: 'center' as const
        }}>
          Thank you for choosing {companyName}!
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
        <h3 style={{
          color: '#374151',
          fontSize: '16px',
          marginTop: '0',
          marginBottom: '10px'
        }}>
          {companyName}
        </h3>
        <p style={{
          fontSize: '12px',
          color: '#6b7280',
          margin: '5px 0'
        }}>
          Professional Carpet Cleaning Services
        </p>
        <p style={{
          fontSize: '12px',
          color: '#6b7280',
          margin: '5px 0'
        }}>
          Phone: {companyPhone} | Email: {companyEmail}
        </p>
      </div>
    </div>
  )
}

// Helper function to render template to HTML string
export function renderJobNotificationTemplate(props: JobNotificationTemplateProps): string {
  const config = {
    'appointment_confirmation': {
      emoji: '📅',
      title: 'Appointment Confirmed',
      headerColor: '#10b981',
      message: `Your ${props.jobDescription.toLowerCase()} appointment has been confirmed.`
    },
    'on_the_way': {
      emoji: '🚗',
      title: 'We\'re On Our Way!',
      headerColor: '#f59e0b',
      message: `${props.technicianName || 'Our technician'} is heading to your location now.`
    },
    'completion': {
      emoji: '✅',
      title: 'Service Complete',
      headerColor: '#059669',
      message: `Your ${props.jobDescription.toLowerCase()} service has been completed successfully.`
    },
    'reschedule': {
      emoji: '🔄',
      title: 'Appointment Rescheduled',
      headerColor: '#3b82f6',
      message: `Your appointment has been rescheduled to a new time.`
    },
    'cancellation': {
      emoji: '❌',
      title: 'Appointment Cancelled',
      headerColor: '#dc2626',
      message: `Your appointment has been cancelled as requested.`
    }
  }[props.jobType] || {
    emoji: '📋',
    title: 'Service Update',
    headerColor: '#6b7280',
    message: `We have an update regarding your service appointment.`
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${config.title} - ${props.companyName || 'Dirt Free Carpet'}</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <!-- Header -->
          <div style="background-color: ${config.headerColor}; padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
              ${config.emoji} ${config.title}
            </h1>
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #374151; font-size: 24px; margin-bottom: 20px; margin-top: 0;">
              Hi ${props.customerName}!
            </h2>

            <p style="font-size: 16px; margin-bottom: 30px; color: #4b5563;">
              ${config.message}
            </p>

            <!-- Appointment Details -->
            <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 25px; margin: 30px 0;">
              <h3 style="color: #0c4a6e; font-size: 18px; margin-top: 0; margin-bottom: 20px;">
                📋 Service Details
              </h3>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; color: #0c4a6e; font-size: 14px;">
                <div>
                  <p style="margin: 8px 0;">
                    <strong>Service:</strong> ${props.jobDescription}
                  </p>
                  <p style="margin: 8px 0;">
                    <strong>Date:</strong> ${props.appointmentDate}
                  </p>
                  <p style="margin: 8px 0;">
                    <strong>Time:</strong> ${props.appointmentTime}
                  </p>
                </div>
                <div>
                  ${props.technicianName ? `
                  <p style="margin: 8px 0;">
                    <strong>Technician:</strong> ${props.technicianName}
                  </p>
                  ` : ''}
                  ${props.technicianPhone ? `
                  <p style="margin: 8px 0;">
                    <strong>Tech Phone:</strong>
                    <a href="tel:${props.technicianPhone}" style="color: #3b82f6;">
                      ${props.technicianPhone}
                    </a>
                  </p>
                  ` : ''}
                  ${props.address ? `
                  <p style="margin: 8px 0;">
                    <strong>Location:</strong> ${props.address}
                  </p>
                  ` : ''}
                </div>
              </div>

              ${props.estimatedArrival && props.jobType === 'on_the_way' ? `
              <div style="background-color: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 6px; padding: 15px; margin-top: 20px;">
                <p style="color: #15803d; font-size: 16px; font-weight: bold; margin: 0; text-align: center;">
                  🕒 Estimated Arrival: ${props.estimatedArrival}
                </p>
              </div>
              ` : ''}
            </div>

            ${props.notes ? `
            <!-- Notes -->
            <div style="background-color: #fefce8; border: 1px solid #eab308; border-radius: 6px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #a16207; font-size: 16px; margin-top: 0; margin-bottom: 10px;">
                📝 Additional Notes
              </h3>
              <p style="color: #a16207; font-size: 14px; margin-bottom: 0;">
                ${props.notes}
              </p>
            </div>
            ` : ''}

            <!-- Contact Info -->
            <div style="background-color: #f9fafb; border: 1px solid #d1d5db; border-radius: 6px; padding: 20px; margin: 30px 0;">
              <h3 style="color: #374151; font-size: 16px; margin-top: 0; margin-bottom: 15px;">
                📞 Questions? Contact Us
              </h3>
              <div style="color: #4b5563; font-size: 14px;">
                <p style="margin: 5px 0;">
                  📧 <a href="mailto:${props.companyEmail || 'service@dirtfreecarpet.com'}" style="color: #3b82f6;">
                    ${props.companyEmail || 'service@dirtfreecarpet.com'}
                  </a>
                </p>
                <p style="margin: 5px 0;">
                  📞 <a href="tel:${props.companyPhone || '(555) 123-4567'}" style="color: #3b82f6;">
                    ${props.companyPhone || '(555) 123-4567'}
                  </a>
                </p>
                ${props.technicianName && props.technicianPhone ? `
                <p style="margin: 10px 0 5px 0;">
                  <strong>Your Technician:</strong>
                </p>
                <p style="margin: 5px 0;">
                  📱 <a href="tel:${props.technicianPhone}" style="color: #3b82f6;">
                    ${props.technicianName}
                  </a>
                </p>
                ` : ''}
              </div>
            </div>

            <p style="font-size: 16px; margin-top: 30px; color: #4b5563; text-align: center;">
              Thank you for choosing ${props.companyName || 'Dirt Free Carpet'}!
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <h3 style="color: #374151; font-size: 16px; margin-top: 0; margin-bottom: 10px;">
              ${props.companyName || 'Dirt Free Carpet'}
            </h3>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">
              Professional Carpet Cleaning Services
            </p>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">
              Phone: ${props.companyPhone || '(555) 123-4567'} | Email: ${props.companyEmail || 'service@dirtfreecarpet.com'}
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}