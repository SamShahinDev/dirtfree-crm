/**
 * Invoice Receipt Email Template
 * Sent after successful payment completion
 */

interface InvoiceReceiptTemplateProps {
  customerName: string
  customerEmail: string
  invoiceNumber: string
  amountPaid: number
  currency?: string
  paymentDate: string
  paymentMethod?: string
  loyaltyPointsEarned?: number
  invoiceUrl?: string
  invoicePdfUrl?: string
  nextAppointment?: {
    date: string
    time: string
    serviceType: string
  }
  companyName?: string
  companyPhone?: string
  companyEmail?: string
  portalUrl?: string
}

export function InvoiceReceiptTemplate({
  customerName,
  customerEmail,
  invoiceNumber,
  amountPaid,
  currency = 'usd',
  paymentDate,
  paymentMethod,
  loyaltyPointsEarned,
  invoiceUrl,
  invoicePdfUrl,
  nextAppointment,
  companyName = 'Dirt Free Carpet',
  companyPhone = '(555) 123-4567',
  companyEmail = 'billing@dirtfreecarpet.com',
  portalUrl = 'https://portal.dirtfreecarpet.com'
}: InvoiceReceiptTemplateProps) {
  const currencySymbol = currency === 'usd' ? '$' : currency.toUpperCase()
  const formattedAmount = `${currencySymbol}${amountPaid.toFixed(2)}`

  return (
    <div style={{
      maxWidth: '700px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1.6',
      color: '#333'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#059669',
        padding: '40px 30px',
        textAlign: 'center' as const,
        borderRadius: '8px 8px 0 0'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '10px'
        }}>
          ✓
        </div>
        <h1 style={{
          color: 'white',
          margin: '0 0 10px 0',
          fontSize: '32px',
          fontWeight: 'bold'
        }}>
          Payment Received!
        </h1>
        <p style={{
          color: '#d1fae5',
          margin: '0',
          fontSize: '16px'
        }}>
          Thank you for your payment
        </p>
      </div>

      {/* Content */}
      <div style={{
        backgroundColor: 'white',
        padding: '40px 30px',
        border: '1px solid #e5e7eb',
        borderTop: 'none'
      }}>
        {/* Greeting */}
        <p style={{
          fontSize: '16px',
          marginBottom: '20px',
          color: '#4b5563'
        }}>
          Hi {customerName},
        </p>

        <p style={{
          fontSize: '16px',
          marginBottom: '30px',
          color: '#4b5563'
        }}>
          We've successfully received your payment. Here are the details:
        </p>

        {/* Payment Details Card */}
        <div style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '30px',
          marginBottom: '30px'
        }}>
          <h2 style={{
            color: '#1f2937',
            fontSize: '20px',
            marginTop: '0',
            marginBottom: '20px',
            fontWeight: 'bold'
          }}>
            Payment Details
          </h2>

          <div style={{
            display: 'grid',
            gap: '15px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingBottom: '15px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>Invoice Number:</span>
              <span style={{ color: '#1f2937', fontSize: '14px', fontWeight: 'bold' }}>
                {invoiceNumber}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingBottom: '15px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>Amount Paid:</span>
              <span style={{ color: '#059669', fontSize: '18px', fontWeight: 'bold' }}>
                {formattedAmount}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              paddingBottom: '15px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <span style={{ color: '#6b7280', fontSize: '14px' }}>Payment Date:</span>
              <span style={{ color: '#1f2937', fontSize: '14px', fontWeight: 'bold' }}>
                {paymentDate}
              </span>
            </div>

            {paymentMethod && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingBottom: '15px',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Payment Method:</span>
                <span style={{ color: '#1f2937', fontSize: '14px', fontWeight: 'bold' }}>
                  {paymentMethod}
                </span>
              </div>
            )}

            {loyaltyPointsEarned && loyaltyPointsEarned > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                backgroundColor: '#fef3c7',
                padding: '15px',
                borderRadius: '6px',
                marginTop: '10px'
              }}>
                <span style={{ color: '#92400e', fontSize: '14px', fontWeight: 'bold' }}>
                  Loyalty Points Earned:
                </span>
                <span style={{ color: '#92400e', fontSize: '18px', fontWeight: 'bold' }}>
                  +{loyaltyPointsEarned} points
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Next Appointment Card */}
        {nextAppointment && (
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #3b82f6',
            borderRadius: '8px',
            padding: '30px',
            marginBottom: '30px'
          }}>
            <h3 style={{
              color: '#1e40af',
              fontSize: '18px',
              marginTop: '0',
              marginBottom: '15px',
              fontWeight: 'bold'
            }}>
              📅 Your Next Appointment
            </h3>
            <p style={{
              color: '#1e40af',
              fontSize: '14px',
              marginBottom: '10px'
            }}>
              <strong>Service:</strong> {nextAppointment.serviceType}
            </p>
            <p style={{
              color: '#1e40af',
              fontSize: '14px',
              marginBottom: '10px'
            }}>
              <strong>Date:</strong> {nextAppointment.date}
            </p>
            <p style={{
              color: '#1e40af',
              fontSize: '14px',
              marginBottom: '0'
            }}>
              <strong>Time:</strong> {nextAppointment.time}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '15px',
          marginBottom: '30px',
          flexWrap: 'wrap' as const
        }}>
          {invoicePdfUrl && (
            <a
              href={invoicePdfUrl}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'inline-block'
              }}
            >
              📄 Download Receipt
            </a>
          )}

          {invoiceUrl && (
            <a
              href={invoiceUrl}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'inline-block'
              }}
            >
              View Invoice Details
            </a>
          )}

          <a
            href={portalUrl}
            style={{
              backgroundColor: '#f3f4f6',
              color: '#1f2937',
              padding: '14px 24px',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'inline-block',
              border: '1px solid #d1d5db'
            }}
          >
            Visit Customer Portal
          </a>
        </div>

        {/* Thank You Message */}
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #059669',
          borderRadius: '6px',
          padding: '20px',
          marginBottom: '30px',
          textAlign: 'center' as const
        }}>
          <p style={{
            fontSize: '16px',
            color: '#065f46',
            marginBottom: '10px',
            fontWeight: 'bold'
          }}>
            Thank You for Your Business!
          </p>
          <p style={{
            fontSize: '14px',
            color: '#065f46',
            marginBottom: '0'
          }}>
            We appreciate your trust in {companyName}. If you have any questions about this payment,
            please don't hesitate to contact us.
          </p>
        </div>

        {/* Contact Information */}
        <div style={{
          textAlign: 'center' as const,
          paddingTop: '20px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            marginBottom: '10px'
          }}>
            Need help? Contact us:
          </p>
          <p style={{
            fontSize: '14px',
            color: '#1f2937',
            marginBottom: '5px'
          }}>
            <strong>Phone:</strong> {companyPhone}
          </p>
          <p style={{
            fontSize: '14px',
            color: '#1f2937',
            marginBottom: '0'
          }}>
            <strong>Email:</strong>{' '}
            <a href={`mailto:${companyEmail}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
              {companyEmail}
            </a>
          </p>
        </div>
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
          This is an automated receipt. Please do not reply to this email.
        </p>
        <p style={{
          fontSize: '12px',
          color: '#6b7280',
          margin: '5px 0'
        }}>
          © {new Date().getFullYear()} {companyName}. All rights reserved.
        </p>
      </div>
    </div>
  )
}

/**
 * Render invoice receipt template to HTML string
 */
export function renderInvoiceReceiptTemplate(props: InvoiceReceiptTemplateProps): string {
  const currencySymbol = props.currency === 'usd' ? '$' : (props.currency || 'USD').toUpperCase()
  const formattedAmount = `${currencySymbol}${props.amountPaid.toFixed(2)}`

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Payment Receipt - Invoice ${props.invoiceNumber}</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 700px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <!-- Header -->
          <div style="background-color: #059669; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <div style="font-size: 48px; margin-bottom: 10px; color: white;">✓</div>
            <h1 style="color: white; margin: 0 0 10px 0; font-size: 32px; font-weight: bold;">
              Payment Received!
            </h1>
            <p style="color: #d1fae5; margin: 0; font-size: 16px;">
              Thank you for your payment
            </p>
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
            <!-- Greeting -->
            <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
              Hi ${props.customerName},
            </p>

            <p style="font-size: 16px; margin-bottom: 30px; color: #4b5563;">
              We've successfully received your payment. Here are the details:
            </p>

            <!-- Payment Details Card -->
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
              <h2 style="color: #1f2937; font-size: 20px; margin-top: 0; margin-bottom: 20px; font-weight: bold;">
                Payment Details
              </h2>

              <div style="display: grid; gap: 15px;">
                <div style="display: flex; justify-content: space-between; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 14px;">Invoice Number:</span>
                  <span style="color: #1f2937; font-size: 14px; font-weight: bold;">${props.invoiceNumber}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 14px;">Amount Paid:</span>
                  <span style="color: #059669; font-size: 18px; font-weight: bold;">${formattedAmount}</span>
                </div>

                <div style="display: flex; justify-content: space-between; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 14px;">Payment Date:</span>
                  <span style="color: #1f2937; font-size: 14px; font-weight: bold;">${props.paymentDate}</span>
                </div>

                ${props.paymentMethod ? `
                <div style="display: flex; justify-content: space-between; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;">
                  <span style="color: #6b7280; font-size: 14px;">Payment Method:</span>
                  <span style="color: #1f2937; font-size: 14px; font-weight: bold;">${props.paymentMethod}</span>
                </div>
                ` : ''}

                ${props.loyaltyPointsEarned && props.loyaltyPointsEarned > 0 ? `
                <div style="display: flex; justify-content: space-between; background-color: #fef3c7; padding: 15px; border-radius: 6px; margin-top: 10px;">
                  <span style="color: #92400e; font-size: 14px; font-weight: bold;">Loyalty Points Earned:</span>
                  <span style="color: #92400e; font-size: 18px; font-weight: bold;">+${props.loyaltyPointsEarned} points</span>
                </div>
                ` : ''}
              </div>
            </div>

            ${props.nextAppointment ? `
            <!-- Next Appointment Card -->
            <div style="background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
              <h3 style="color: #1e40af; font-size: 18px; margin-top: 0; margin-bottom: 15px; font-weight: bold;">
                📅 Your Next Appointment
              </h3>
              <p style="color: #1e40af; font-size: 14px; margin-bottom: 10px;">
                <strong>Service:</strong> ${props.nextAppointment.serviceType}
              </p>
              <p style="color: #1e40af; font-size: 14px; margin-bottom: 10px;">
                <strong>Date:</strong> ${props.nextAppointment.date}
              </p>
              <p style="color: #1e40af; font-size: 14px; margin-bottom: 0;">
                <strong>Time:</strong> ${props.nextAppointment.time}
              </p>
            </div>
            ` : ''}

            <!-- Action Buttons -->
            <div style="display: flex; gap: 15px; margin-bottom: 30px; flex-wrap: wrap;">
              ${props.invoicePdfUrl ? `
              <a href="${props.invoicePdfUrl}" style="background-color: #3b82f6; color: white; padding: 14px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold; display: inline-block;">
                📄 Download Receipt
              </a>
              ` : ''}

              ${props.invoiceUrl ? `
              <a href="${props.invoiceUrl}" style="background-color: #6b7280; color: white; padding: 14px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold; display: inline-block;">
                View Invoice Details
              </a>
              ` : ''}

              <a href="${props.portalUrl || 'https://portal.dirtfreecarpet.com'}" style="background-color: #f3f4f6; color: #1f2937; padding: 14px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold; display: inline-block; border: 1px solid #d1d5db;">
                Visit Customer Portal
              </a>
            </div>

            <!-- Thank You Message -->
            <div style="background-color: #f0fdf4; border: 1px solid #059669; border-radius: 6px; padding: 20px; margin-bottom: 30px; text-align: center;">
              <p style="font-size: 16px; color: #065f46; margin-bottom: 10px; font-weight: bold;">
                Thank You for Your Business!
              </p>
              <p style="font-size: 14px; color: #065f46; margin-bottom: 0;">
                We appreciate your trust in ${props.companyName || 'Dirt Free Carpet'}. If you have any questions about this payment,
                please don't hesitate to contact us.
              </p>
            </div>

            <!-- Contact Information -->
            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
                Need help? Contact us:
              </p>
              <p style="font-size: 14px; color: #1f2937; margin-bottom: 5px;">
                <strong>Phone:</strong> ${props.companyPhone || '(555) 123-4567'}
              </p>
              <p style="font-size: 14px; color: #1f2937; margin-bottom: 0;">
                <strong>Email:</strong> <a href="mailto:${props.companyEmail || 'billing@dirtfreecarpet.com'}" style="color: #3b82f6; text-decoration: none;">
                  ${props.companyEmail || 'billing@dirtfreecarpet.com'}
                </a>
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <h3 style="color: #374151; font-size: 16px; margin-top: 0; margin-bottom: 10px;">
              ${props.companyName || 'Dirt Free Carpet'}
            </h3>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">
              This is an automated receipt. Please do not reply to this email.
            </p>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">
              © ${new Date().getFullYear()} ${props.companyName || 'Dirt Free Carpet'}. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}
