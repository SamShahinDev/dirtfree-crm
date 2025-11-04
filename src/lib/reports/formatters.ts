/**
 * Report Format Generators
 *
 * Convert report data to different file formats (CSV, Excel, PDF).
 */

import type { ReportData } from './generators'

/**
 * Generate CSV from report data
 */
export function generateCsv(reportData: ReportData): Buffer {
  const { data } = reportData

  if (!data || data.length === 0) {
    return Buffer.from('No data available')
  }

  // Get headers from first row
  const headers = Object.keys(data[0])

  // Create CSV content
  const csvRows: string[] = []

  // Add headers
  csvRows.push(headers.map(escapeC svValue).join(','))

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header]
      return escapeCsvValue(value)
    })
    csvRows.push(values.join(','))
  }

  // Add summary section if available
  if (reportData.summary) {
    csvRows.push('')
    csvRows.push('SUMMARY')
    csvRows.push('')

    for (const [key, value] of Object.entries(reportData.summary)) {
      if (typeof value === 'object') {
        csvRows.push(key)
        for (const [subKey, subValue] of Object.entries(value)) {
          csvRows.push(`  ${subKey},${subValue}`)
        }
      } else {
        csvRows.push(`${key},${value}`)
      }
    }
  }

  return Buffer.from(csvRows.join('\n'))
}

/**
 * Escape CSV value
 */
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }

  const stringValue = String(value)

  // If value contains comma, newline, or quotes, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

/**
 * Generate Excel from report data
 *
 * Note: This is a simplified implementation.
 * For production, consider using a library like 'exceljs' or 'xlsx'.
 */
export async function generateExcel(reportData: ReportData): Promise<Buffer> {
  // For now, we'll use a CSV-compatible format
  // In production, you'd want to use a proper Excel library
  // that can create .xlsx files with formatting, multiple sheets, etc.

  const { data, summary, title, generatedAt } = reportData

  if (!data || data.length === 0) {
    return Buffer.from('No data available')
  }

  // Simple tab-separated format that Excel can open
  const rows: string[] = []

  // Add title and metadata
  rows.push(title)
  rows.push(`Generated: ${new Date(generatedAt).toLocaleString()}`)
  rows.push('')

  // Add headers
  const headers = Object.keys(data[0])
  rows.push(headers.join('\t'))

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header]
      return value !== null && value !== undefined ? String(value) : ''
    })
    rows.push(values.join('\t'))
  }

  // Add summary if available
  if (summary) {
    rows.push('')
    rows.push('SUMMARY')
    rows.push('')

    for (const [key, value] of Object.entries(summary)) {
      if (typeof value === 'object') {
        rows.push(key)
        for (const [subKey, subValue] of Object.entries(value)) {
          rows.push(`  ${subKey}\t${subValue}`)
        }
      } else {
        rows.push(`${key}\t${value}`)
      }
    }
  }

  return Buffer.from(rows.join('\n'))
}

/**
 * Generate PDF from report data
 *
 * Note: This is a simplified HTML-based implementation.
 * For production, consider using a library like 'puppeteer', 'pdfkit', or 'jspdf'.
 */
export async function generatePdf(reportData: ReportData): Promise<Buffer> {
  const { data, summary, title, generatedAt, filters } = reportData

  // Generate HTML that can be converted to PDF
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      color: #333;
    }
    h1 {
      color: #14213d;
      border-bottom: 3px solid #fca311;
      padding-bottom: 10px;
    }
    .metadata {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background-color: #14213d;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: bold;
    }
    td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .summary {
      margin-top: 40px;
      padding: 20px;
      background-color: #f5f5f5;
      border-left: 4px solid #fca311;
    }
    .summary h2 {
      margin-top: 0;
      color: #14213d;
    }
    .summary-item {
      margin: 10px 0;
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #ddd;
    }
    .summary-label {
      font-weight: bold;
      color: #555;
    }
    .summary-value {
      color: #14213d;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>

  <div class="metadata">
    <p>Generated: ${new Date(generatedAt).toLocaleString()}</p>
    ${
      filters.startDate && filters.endDate
        ? `<p>Period: ${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}</p>`
        : ''
    }
  </div>

  ${
    data && data.length > 0
      ? `
  <table>
    <thead>
      <tr>
        ${Object.keys(data[0])
          .map((header) => `<th>${formatHeader(header)}</th>`)
          .join('')}
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (row) => `
        <tr>
          ${Object.values(row)
            .map((value) => `<td>${value !== null && value !== undefined ? value : '-'}</td>`)
            .join('')}
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  `
      : '<p>No data available for the selected period.</p>'
  }

  ${
    summary
      ? `
  <div class="summary">
    <h2>Summary</h2>
    ${Object.entries(summary)
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `
          <div class="summary-section">
            <strong>${formatHeader(key)}:</strong>
            ${Object.entries(value)
              .map(
                ([subKey, subValue]) => `
              <div class="summary-item">
                <span class="summary-label">${formatHeader(subKey)}</span>
                <span class="summary-value">${subValue}</span>
              </div>
            `
              )
              .join('')}
          </div>
        `
        } else {
          return `
          <div class="summary-item">
            <span class="summary-label">${formatHeader(key)}</span>
            <span class="summary-value">${value}</span>
          </div>
        `
        }
      })
      .join('')}
  </div>
  `
      : ''
  }
</body>
</html>
  `

  // In production, you would use puppeteer or similar to convert HTML to PDF:
  // const browser = await puppeteer.launch()
  // const page = await browser.newPage()
  // await page.setContent(html)
  // const pdf = await page.pdf({ format: 'A4' })
  // await browser.close()
  // return Buffer.from(pdf)

  // For now, return HTML as buffer
  // This allows the system to work without puppeteer dependency
  // The HTML can be opened in a browser and printed to PDF
  return Buffer.from(html)
}

/**
 * Format header text for display
 */
function formatHeader(header: string): string {
  return header
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .replace(/_/g, ' ') // Replace underscores with spaces
    .trim()
}

/**
 * Get MIME type for format
 */
export function getMimeType(format: 'csv' | 'excel' | 'pdf'): string {
  switch (format) {
    case 'csv':
      return 'text/csv'
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'pdf':
      return 'application/pdf'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Get file extension for format
 */
export function getFileExtension(format: 'csv' | 'excel' | 'pdf'): string {
  switch (format) {
    case 'csv':
      return '.csv'
    case 'excel':
      return '.xlsx'
    case 'pdf':
      return '.pdf'
    default:
      return '.txt'
  }
}
