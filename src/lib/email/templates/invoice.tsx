interface InvoiceItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

interface InvoiceTemplateProps {
  customerName: string
  customerEmail: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  items: InvoiceItem[]
  subtotal: number
  tax?: number
  total: number
  paymentUrl: string
  invoiceUrl?: string
  companyName?: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  notes?: string
}

export function InvoiceTemplate({
  customerName,
  customerEmail,
  invoiceNumber,
  invoiceDate,
  dueDate,
  items,
  subtotal,
  tax = 0,
  total,
  paymentUrl,
  invoiceUrl,
  companyName = 'Dirt Free Carpet',
  companyAddress = '123 Main Street, Your City, State 12345',
  companyPhone = '(555) 123-4567',
  companyEmail = 'billing@dirtfreecarpet.com',
  notes
}: InvoiceTemplateProps) {
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
        backgroundColor: '#1f2937',
        padding: '40px 30px',
        textAlign: 'center' as const,
        borderRadius: '8px 8px 0 0'
      }}>
        <h1 style={{
          color: 'white',
          margin: '0 0 10px 0',
          fontSize: '32px',
          fontWeight: 'bold'
        }}>
          {companyName}
        </h1>
        <p style={{
          color: '#d1d5db',
          margin: '0',
          fontSize: '16px'
        }}>
          Professional Carpet Cleaning Services
        </p>
      </div>

      {/* Invoice Header */}
      <div style={{
        backgroundColor: '#3b82f6',
        padding: '20px 30px',
        color: 'white'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            margin: '0',
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            📄 Invoice #{invoiceNumber}
          </h2>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            Due: {dueDate}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        backgroundColor: 'white',
        padding: '40px 30px',
        border: '1px solid #e5e7eb',
        borderTop: 'none'
      }}>
        {/* Invoice Info */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '30px',
          marginBottom: '40px'
        }}>
          {/* Bill To */}
          <div>
            <h3 style={{
              color: '#374151',
              fontSize: '16px',
              marginTop: '0',
              marginBottom: '15px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Bill To
            </h3>
            <div style={{ color: '#4b5563', fontSize: '14px' }}>
              <p style={{ margin: '5px 0', fontWeight: 'bold', fontSize: '16px' }}>
                {customerName}
              </p>
              <p style={{ margin: '5px 0' }}>
                {customerEmail}
              </p>
            </div>
          </div>

          {/* Invoice Details */}
          <div>
            <h3 style={{
              color: '#374151',
              fontSize: '16px',
              marginTop: '0',
              marginBottom: '15px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Invoice Details
            </h3>
            <div style={{ color: '#4b5563', fontSize: '14px' }}>
              <p style={{ margin: '5px 0' }}>
                <strong>Invoice #:</strong> {invoiceNumber}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>Issue Date:</strong> {invoiceDate}
              </p>
              <p style={{ margin: '5px 0' }}>
                <strong>Due Date:</strong> {dueDate}
              </p>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '30px'
        }}>
          {/* Table Header */}
          <div style={{
            backgroundColor: '#f9fafb',
            padding: '15px',
            borderBottom: '1px solid #e5e7eb',
            display: 'grid',
            gridTemplateColumns: '2fr 80px 120px 120px',
            gap: '15px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#374151',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <div>Description</div>
            <div style={{ textAlign: 'center' as const }}>Qty</div>
            <div style={{ textAlign: 'right' as const }}>Rate</div>
            <div style={{ textAlign: 'right' as const }}>Amount</div>
          </div>

          {/* Table Rows */}
          {items.map((item, index) => (
            <div
              key={index}
              style={{
                padding: '15px',
                borderBottom: index < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                display: 'grid',
                gridTemplateColumns: '2fr 80px 120px 120px',
                gap: '15px',
                fontSize: '14px',
                color: '#4b5563'
              }}
            >
              <div style={{ fontWeight: '500' }}>{item.description}</div>
              <div style={{ textAlign: 'center' as const }}>{item.quantity}</div>
              <div style={{ textAlign: 'right' as const }}>${item.rate.toFixed(2)}</div>
              <div style={{ textAlign: 'right' as const, fontWeight: 'bold' }}>
                ${item.amount.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '40px'
        }}>
          <div style={{ width: '300px' }}>
            {/* Subtotal */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid #f3f4f6',
              fontSize: '14px',
              color: '#4b5563'
            }}>
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            {/* Tax */}
            {tax > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid #f3f4f6',
                fontSize: '14px',
                color: '#4b5563'
              }}>
                <span>Tax:</span>
                <span>${tax.toFixed(2)}</span>
              </div>
            )}

            {/* Total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '15px 0',
              fontSize: '18px',
              fontWeight: 'bold',
              color: '#1f2937',
              borderTop: '2px solid #3b82f6'
            }}>
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Button */}
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '8px',
          padding: '30px',
          textAlign: 'center' as const,
          marginBottom: '30px'
        }}>
          <h3 style={{
            color: '#0c4a6e',
            fontSize: '18px',
            marginTop: '0',
            marginBottom: '15px'
          }}>
            💳 Ready to Pay?
          </h3>
          <p style={{
            color: '#0c4a6e',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            Click the button below to pay your invoice securely online
          </p>
          <a
            href={paymentUrl}
            style={{
              backgroundColor: '#059669',
              color: 'white',
              padding: '16px 32px',
              textDecoration: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              display: 'inline-block'
            }}
          >
            Pay ${total.toFixed(2)} Now
          </a>
        </div>

        {/* Notes */}
        {notes && (
          <div style={{
            backgroundColor: '#fefce8',
            border: '1px solid #eab308',
            borderRadius: '6px',
            padding: '20px',
            marginBottom: '30px'
          }}>
            <h3 style={{
              color: '#a16207',
              fontSize: '16px',
              marginTop: '0',
              marginBottom: '10px'
            }}>
              📝 Notes
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

        {/* Links */}
        <div style={{
          display: 'flex',
          gap: '20px',
          justifyContent: 'center',
          marginTop: '30px'
        }}>
          {invoiceUrl && (
            <a
              href={invoiceUrl}
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                fontSize: '14px',
                borderBottom: '1px solid #3b82f6'
              }}
            >
              📄 View Full Invoice
            </a>
          )}
          <a
            href={`mailto:${companyEmail}`}
            style={{
              color: '#3b82f6',
              textDecoration: 'none',
              fontSize: '14px',
              borderBottom: '1px solid #3b82f6'
            }}
          >
            💬 Contact Billing
          </a>
        </div>

        <p style={{
          fontSize: '16px',
          marginTop: '40px',
          color: '#4b5563',
          textAlign: 'center' as const
        }}>
          Thank you for your business!
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
          {companyAddress}
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
export function renderInvoiceTemplate(props: InvoiceTemplateProps): string {
  const itemsHtml = props.items.map((item, index) => `
    <div style="padding: 15px; border-bottom: ${index < props.items.length - 1 ? '1px solid #f3f4f6' : 'none'}; display: grid; grid-template-columns: 2fr 80px 120px 120px; gap: 15px; font-size: 14px; color: #4b5563;">
      <div style="font-weight: 500;">${item.description}</div>
      <div style="text-align: center;">${item.quantity}</div>
      <div style="text-align: right;">$${item.rate.toFixed(2)}</div>
      <div style="text-align: right; font-weight: bold;">$${item.amount.toFixed(2)}</div>
    </div>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Invoice ${props.invoiceNumber} - ${props.companyName || 'Dirt Free Carpet'}</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 700px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <!-- Header -->
          <div style="background-color: #1f2937; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0 0 10px 0; font-size: 32px; font-weight: bold;">
              ${props.companyName || 'Dirt Free Carpet'}
            </h1>
            <p style="color: #d1d5db; margin: 0; font-size: 16px;">
              Professional Carpet Cleaning Services
            </p>
          </div>

          <!-- Invoice Header -->
          <div style="background-color: #3b82f6; padding: 20px 30px; color: white; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; font-size: 24px; font-weight: bold;">
              📄 Invoice #${props.invoiceNumber}
            </h2>
            <div style="background-color: rgba(255, 255, 255, 0.2); padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">
              Due: ${props.dueDate}
            </div>
          </div>

          <!-- Content -->
          <div style="background-color: white; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
            <!-- Invoice Info -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
              <!-- Bill To -->
              <div>
                <h3 style="color: #374151; font-size: 16px; margin-top: 0; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">
                  Bill To
                </h3>
                <div style="color: #4b5563; font-size: 14px;">
                  <p style="margin: 5px 0; font-weight: bold; font-size: 16px;">
                    ${props.customerName}
                  </p>
                  <p style="margin: 5px 0;">
                    ${props.customerEmail}
                  </p>
                </div>
              </div>

              <!-- Invoice Details -->
              <div>
                <h3 style="color: #374151; font-size: 16px; margin-top: 0; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">
                  Invoice Details
                </h3>
                <div style="color: #4b5563; font-size: 14px;">
                  <p style="margin: 5px 0;">
                    <strong>Invoice #:</strong> ${props.invoiceNumber}
                  </p>
                  <p style="margin: 5px 0;">
                    <strong>Issue Date:</strong> ${props.invoiceDate}
                  </p>
                  <p style="margin: 5px 0;">
                    <strong>Due Date:</strong> ${props.dueDate}
                  </p>
                </div>
              </div>
            </div>

            <!-- Items Table -->
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 30px;">
              <!-- Table Header -->
              <div style="background-color: #f9fafb; padding: 15px; border-bottom: 1px solid #e5e7eb; display: grid; grid-template-columns: 2fr 80px 120px 120px; gap: 15px; font-size: 12px; font-weight: bold; color: #374151; text-transform: uppercase; letter-spacing: 1px;">
                <div>Description</div>
                <div style="text-align: center;">Qty</div>
                <div style="text-align: right;">Rate</div>
                <div style="text-align: right;">Amount</div>
              </div>

              <!-- Table Rows -->
              ${itemsHtml}
            </div>

            <!-- Totals -->
            <div style="display: flex; justify-content: flex-end; margin-bottom: 40px;">
              <div style="width: 300px;">
                <!-- Subtotal -->
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #4b5563;">
                  <span>Subtotal:</span>
                  <span>$${props.subtotal.toFixed(2)}</span>
                </div>

                ${props.tax && props.tax > 0 ? `
                <!-- Tax -->
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #4b5563;">
                  <span>Tax:</span>
                  <span>$${props.tax.toFixed(2)}</span>
                </div>
                ` : ''}

                <!-- Total -->
                <div style="display: flex; justify-content: space-between; padding: 15px 0; font-size: 18px; font-weight: bold; color: #1f2937; border-top: 2px solid #3b82f6;">
                  <span>Total:</span>
                  <span>$${props.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <!-- Payment Button -->
            <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 30px; text-align: center; margin-bottom: 30px;">
              <h3 style="color: #0c4a6e; font-size: 18px; margin-top: 0; margin-bottom: 15px;">
                💳 Ready to Pay?
              </h3>
              <p style="color: #0c4a6e; font-size: 14px; margin-bottom: 20px;">
                Click the button below to pay your invoice securely online
              </p>
              <a href="${props.paymentUrl}" style="background-color: #059669; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
                Pay $${props.total.toFixed(2)} Now
              </a>
            </div>

            ${props.notes ? `
            <!-- Notes -->
            <div style="background-color: #fefce8; border: 1px solid #eab308; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
              <h3 style="color: #a16207; font-size: 16px; margin-top: 0; margin-bottom: 10px;">
                📝 Notes
              </h3>
              <p style="color: #a16207; font-size: 14px; margin-bottom: 0;">
                ${props.notes}
              </p>
            </div>
            ` : ''}

            <!-- Links -->
            <div style="display: flex; gap: 20px; justify-content: center; margin-top: 30px;">
              ${props.invoiceUrl ? `
              <a href="${props.invoiceUrl}" style="color: #3b82f6; text-decoration: none; font-size: 14px; border-bottom: 1px solid #3b82f6;">
                📄 View Full Invoice
              </a>
              ` : ''}
              <a href="mailto:${props.companyEmail || 'billing@dirtfreecarpet.com'}" style="color: #3b82f6; text-decoration: none; font-size: 14px; border-bottom: 1px solid #3b82f6;">
                💬 Contact Billing
              </a>
            </div>

            <p style="font-size: 16px; margin-top: 40px; color: #4b5563; text-align: center;">
              Thank you for your business!
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px 20px; text-align: center; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <h3 style="color: #374151; font-size: 16px; margin-top: 0; margin-bottom: 10px;">
              ${props.companyName || 'Dirt Free Carpet'}
            </h3>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">
              ${props.companyAddress || '123 Main Street, Your City, State 12345'}
            </p>
            <p style="font-size: 12px; color: #6b7280; margin: 5px 0;">
              Phone: ${props.companyPhone || '(555) 123-4567'} | Email: ${props.companyEmail || 'billing@dirtfreecarpet.com'}
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}