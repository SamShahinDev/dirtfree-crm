/**
 * Invoice PDF Generation Service
 * Generates branded invoice PDFs using React-PDF with proper accessibility and styling
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, pdf, Font, Image, Link } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { formatCurrency, type InvoiceWithRelations, type PDFGenerationOptions } from '@/types/invoice'

// =============================================================================
// FONT REGISTRATION
// =============================================================================

// Register fonts for better typography
Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 400,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 600,
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hjp-Ek-_EeA.woff2',
      fontWeight: 700,
    },
  ],
})

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  // Page and layout
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    fontFamily: 'Inter',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#1f2937', // gray-800
    padding: 40,
  },

  // Header section
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb', // blue-600
  },

  // Company branding
  companySection: {
    flex: 1,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 700,
    color: '#2563eb', // blue-600
    marginBottom: 8,
  },
  companyAddress: {
    fontSize: 10,
    color: '#6b7280', // gray-500
    lineHeight: 1.3,
  },

  // Invoice metadata
  invoiceMetaSection: {
    alignItems: 'flex-end',
    minWidth: 200,
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1f2937', // gray-800
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151', // gray-700
    marginBottom: 4,
  },
  invoiceDate: {
    fontSize: 10,
    color: '#6b7280', // gray-500
  },

  // Main content area
  content: {
    flex: 1,
  },

  // Customer section
  customerSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#374151', // gray-700
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerInfo: {
    backgroundColor: '#f9fafb', // gray-50
    padding: 15,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb', // blue-600
  },
  customerName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1f2937', // gray-800
    marginBottom: 4,
  },
  customerDetails: {
    fontSize: 10,
    color: '#6b7280', // gray-500
    lineHeight: 1.3,
  },

  // Job section
  jobSection: {
    marginBottom: 30,
  },
  jobInfo: {
    backgroundColor: '#fef3c7', // amber-100
    padding: 15,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b', // amber-500
  },
  jobTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#92400e', // amber-800
    marginBottom: 4,
  },
  jobDetails: {
    fontSize: 10,
    color: '#78350f', // amber-900
    lineHeight: 1.3,
  },

  // Line items table
  itemsSection: {
    marginBottom: 30,
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb', // gray-200
    paddingBottom: 8,
    marginBottom: 12,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6', // gray-100
  },

  // Table columns
  colDescription: {
    flex: 3,
    paddingRight: 10,
  },
  colQuantity: {
    flex: 1,
    textAlign: 'center',
  },
  colUnitPrice: {
    flex: 1,
    textAlign: 'right',
  },
  colTotal: {
    flex: 1,
    textAlign: 'right',
  },

  // Table text styles
  tableHeaderText: {
    fontSize: 10,
    fontWeight: 600,
    color: '#374151', // gray-700
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCellText: {
    fontSize: 10,
    color: '#1f2937', // gray-800
  },
  tableCellDescription: {
    fontSize: 10,
    color: '#1f2937', // gray-800
    lineHeight: 1.3,
  },

  // Totals section
  totalsSection: {
    marginTop: 20,
    marginLeft: 'auto',
    width: 250,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
    color: '#6b7280', // gray-500
  },
  totalValue: {
    fontSize: 10,
    color: '#1f2937', // gray-800
    fontWeight: 600,
  },
  finalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: '#2563eb', // blue-600
    marginTop: 8,
  },
  finalTotalLabel: {
    fontSize: 12,
    color: '#1f2937', // gray-800
    fontWeight: 700,
  },
  finalTotalValue: {
    fontSize: 14,
    color: '#2563eb', // blue-600
    fontWeight: 700,
  },

  // Payment section
  paymentSection: {
    marginTop: 40,
    padding: 20,
    backgroundColor: '#eff6ff', // blue-50
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe', // blue-200
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1e40af', // blue-800
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentInstructions: {
    fontSize: 10,
    color: '#1e3a8a', // blue-900
    textAlign: 'center',
    lineHeight: 1.4,
    marginBottom: 15,
  },
  paymentLink: {
    fontSize: 10,
    color: '#2563eb', // blue-600
    textAlign: 'center',
    marginBottom: 15,
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  qrCodeText: {
    fontSize: 8,
    color: '#6b7280', // gray-500
    marginTop: 5,
  },

  // Footer
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb', // gray-200
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af', // gray-400
    textAlign: 'center',
    lineHeight: 1.3,
  },

  // Status indicators
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusDraft: {
    backgroundColor: '#f3f4f6', // gray-100
    color: '#374151', // gray-700
  },
  statusSent: {
    backgroundColor: '#dbeafe', // blue-100
    color: '#1e40af', // blue-800
  },
  statusPaid: {
    backgroundColor: '#d1fae5', // green-100
    color: '#065f46', // green-800
  },
  statusVoid: {
    backgroundColor: '#fee2e2', // red-100
    color: '#991b1b', // red-800
  },
  statusText: {
    fontSize: 8,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})

// =============================================================================
// INTERFACES
// =============================================================================

interface InvoicePDFProps {
  invoice: InvoiceWithRelations
  companyInfo: {
    name: string
    address: string
    cityStateZip: string
    phone: string
    website: string
    email: string
  }
  options?: PDFGenerationOptions
  qrCodeDataURL?: string
}

// =============================================================================
// COMPONENTS
// =============================================================================

function InvoiceHeader({ invoice, companyInfo }: Pick<InvoicePDFProps, 'invoice' | 'companyInfo'>) {
  const invoiceDate = new Date(invoice.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const statusStyle = {
    ...styles.statusBadge,
    ...(invoice.status === 'draft' ? styles.statusDraft :
        invoice.status === 'sent' ? styles.statusSent :
        invoice.status === 'paid' ? styles.statusPaid :
        styles.statusVoid)
  }

  return (
    <View style={styles.header}>
      <View style={styles.companySection}>
        <Text style={styles.companyName}>{companyInfo.name}</Text>
        <Text style={styles.companyAddress}>
          {companyInfo.address}{'\n'}
          {companyInfo.cityStateZip}{'\n'}
          {companyInfo.phone}{'\n'}
          {companyInfo.website}
        </Text>
      </View>

      <View style={styles.invoiceMetaSection}>
        <Text style={styles.invoiceTitle}>INVOICE</Text>
        <Text style={styles.invoiceNumber}>#{invoice.number}</Text>
        <Text style={styles.invoiceDate}>{invoiceDate}</Text>
        <View style={statusStyle}>
          <Text style={styles.statusText}>{invoice.status}</Text>
        </View>
      </View>
    </View>
  )
}

function CustomerSection({ invoice }: Pick<InvoicePDFProps, 'invoice'>) {
  return (
    <View style={styles.customerSection}>
      <Text style={styles.sectionTitle}>Bill To</Text>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{invoice.customer.name}</Text>
        <Text style={styles.customerDetails}>
          {invoice.customer.email}{'\n'}
          {invoice.customer.phone}{'\n'}
          {invoice.customer.address}
        </Text>
      </View>
    </View>
  )
}

function JobSection({ invoice }: Pick<InvoicePDFProps, 'invoice'>) {
  const jobDate = new Date(invoice.job.scheduled_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <View style={styles.jobSection}>
      <Text style={styles.sectionTitle}>Service Details</Text>
      <View style={styles.jobInfo}>
        <Text style={styles.jobTitle}>{invoice.job.service_type}</Text>
        <Text style={styles.jobDetails}>
          Service Date: {jobDate}{'\n'}
          Technician: {invoice.job.assigned_technician}{'\n'}
          Job ID: {invoice.job.id}
        </Text>
      </View>
    </View>
  )
}

function ItemsTable({ invoice }: Pick<InvoicePDFProps, 'invoice'>) {
  return (
    <View style={styles.itemsSection}>
      <Text style={styles.sectionTitle}>Services Provided</Text>

      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeader}>
          <View style={styles.colDescription}>
            <Text style={styles.tableHeaderText}>Description</Text>
          </View>
          <View style={styles.colQuantity}>
            <Text style={styles.tableHeaderText}>Qty</Text>
          </View>
          <View style={styles.colUnitPrice}>
            <Text style={styles.tableHeaderText}>Rate</Text>
          </View>
          <View style={styles.colTotal}>
            <Text style={styles.tableHeaderText}>Amount</Text>
          </View>
        </View>

        {/* Table Rows */}
        {invoice.items.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <View style={styles.colDescription}>
              <Text style={styles.tableCellDescription}>{item.description}</Text>
            </View>
            <View style={styles.colQuantity}>
              <Text style={styles.tableCellText}>{item.quantity}</Text>
            </View>
            <View style={styles.colUnitPrice}>
              <Text style={styles.tableCellText}>{formatCurrency(item.unit_cents)}</Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.tableCellText}>{formatCurrency(item.line_total_cents)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function TotalsSection({ invoice }: Pick<InvoicePDFProps, 'invoice'>) {
  return (
    <View style={styles.totalsSection}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Subtotal:</Text>
        <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal_cents)}</Text>
      </View>

      {invoice.tax_cents > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax:</Text>
          <Text style={styles.totalValue}>{formatCurrency(invoice.tax_cents)}</Text>
        </View>
      )}

      {invoice.discount_cents > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Discount:</Text>
          <Text style={styles.totalValue}>-{formatCurrency(invoice.discount_cents)}</Text>
        </View>
      )}

      <View style={styles.finalTotalRow}>
        <Text style={styles.finalTotalLabel}>Total:</Text>
        <Text style={styles.finalTotalValue}>{formatCurrency(invoice.total_cents)}</Text>
      </View>
    </View>
  )
}

function PaymentSection({ invoice, options, qrCodeDataURL }: Pick<InvoicePDFProps, 'invoice' | 'options' | 'qrCodeDataURL'>) {
  // Only show payment section if invoice is not paid and has payment link
  if (invoice.status === 'paid' || !invoice.payment_link) {
    return null
  }

  return (
    <View style={styles.paymentSection}>
      <Text style={styles.paymentTitle}>Pay Online</Text>

      {options?.includePaymentInstructions !== false && (
        <Text style={styles.paymentInstructions}>
          Pay securely online using your credit card, debit card, or bank account.{'\n'}
          Visit the link below or scan the QR code with your phone's camera.
        </Text>
      )}

      <Link style={styles.paymentLink} src={invoice.payment_link}>
        {invoice.payment_link}
      </Link>

      {options?.includeQRCode !== false && qrCodeDataURL && (
        <View style={styles.qrCodeContainer}>
          <Image src={qrCodeDataURL} style={{ width: 80, height: 80 }} />
          <Text style={styles.qrCodeText}>Scan to pay online</Text>
        </View>
      )}
    </View>
  )
}

function InvoiceFooter({ companyInfo }: Pick<InvoicePDFProps, 'companyInfo'>) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        Thank you for choosing {companyInfo.name}!{'\n'}
        Questions? Contact us at {companyInfo.phone} or {companyInfo.email}
      </Text>
    </View>
  )
}

// =============================================================================
// MAIN INVOICE DOCUMENT
// =============================================================================

function InvoicePDF({ invoice, companyInfo, options, qrCodeDataURL }: InvoicePDFProps) {
  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author={companyInfo.name}
      subject={`Invoice for ${invoice.customer.name}`}
      creator={companyInfo.name}
      producer="Dirt Free CRM"
    >
      <Page size="A4" style={styles.page}>
        <InvoiceHeader invoice={invoice} companyInfo={companyInfo} />

        <View style={styles.content}>
          <CustomerSection invoice={invoice} />
          <JobSection invoice={invoice} />
          <ItemsTable invoice={invoice} />
          <TotalsSection invoice={invoice} />
          <PaymentSection invoice={invoice} options={options} qrCodeDataURL={qrCodeDataURL} />
        </View>

        <InvoiceFooter companyInfo={companyInfo} />
      </Page>
    </Document>
  )
}

// =============================================================================
// PDF GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate QR code data URL for payment link
 */
async function generateQRCode(paymentLink: string): Promise<string> {
  try {
    return await QRCode.toDataURL(paymentLink, {
      width: 200,
      margin: 1,
      color: {
        dark: '#1f2937', // gray-800
        light: '#ffffff'
      }
    })
  } catch (error) {
    console.error('Failed to generate QR code:', error)
    return ''
  }
}

/**
 * Generate invoice PDF as buffer
 */
export async function generateInvoicePDF(
  invoice: InvoiceWithRelations,
  companyInfo: {
    name: string
    address: string
    cityStateZip: string
    phone: string
    website: string
    email: string
  },
  options: PDFGenerationOptions = {}
): Promise<Buffer> {
  try {
    // Generate QR code if payment link exists and QR code is enabled
    let qrCodeDataURL: string | undefined
    if (invoice.payment_link && options.includeQRCode !== false) {
      qrCodeDataURL = await generateQRCode(invoice.payment_link)
    }

    // Generate PDF
    const pdfDoc = (
      <InvoicePDF
        invoice={invoice}
        companyInfo={companyInfo}
        options={options}
        qrCodeDataURL={qrCodeDataURL}
      />
    )

    const pdfBuffer = await pdf(pdfDoc).toBuffer()
    return pdfBuffer
  } catch (error) {
    console.error('PDF generation failed:', error)
    throw new Error(`Failed to generate invoice PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get company info from environment variables
 */
export function getCompanyInfo(): {
  name: string
  address: string
  cityStateZip: string
  phone: string
  website: string
  email: string
} {
  return {
    name: process.env.COMPANY_NAME || 'Dirt Free Carpet',
    address: process.env.COMPANY_ADDRESS_LINE1 || '123 Main St',
    cityStateZip: process.env.COMPANY_CITY_STATE_ZIP || 'Houston, TX 77002',
    phone: process.env.COMPANY_PHONE || '+1 (281) 555-1212',
    website: process.env.COMPANY_WEBSITE || 'https://example.com',
    email: process.env.INVOICE_FROM_EMAIL?.split('<')[1]?.split('>')[0] || 'billing@example.com'
  }
}

// =============================================================================
// REACT COMPONENT FOR DOWNLOAD LINK
// =============================================================================

interface InvoicePDFDownloadProps {
  invoice: InvoiceWithRelations
  children: React.ReactNode
  fileName?: string
  className?: string
  options?: PDFGenerationOptions
}

export function InvoicePDFDownload({
  invoice,
  children,
  fileName,
  className,
  options = {}
}: InvoicePDFDownloadProps) {
  const companyInfo = getCompanyInfo()
  const defaultFileName = fileName || `invoice-${invoice.number}.pdf`

  const [qrCodeDataURL, setQrCodeDataURL] = React.useState<string>('')

  React.useEffect(() => {
    if (invoice.payment_link && options.includeQRCode !== false) {
      generateQRCode(invoice.payment_link).then(setQrCodeDataURL)
    }
  }, [invoice.payment_link, options.includeQRCode])

  return (
    <PDFDownloadLink
      document={
        <InvoicePDF
          invoice={invoice}
          companyInfo={companyInfo}
          options={options}
          qrCodeDataURL={qrCodeDataURL}
        />
      }
      fileName={defaultFileName}
      className={className}
    >
      {children}
    </PDFDownloadLink>
  )
}