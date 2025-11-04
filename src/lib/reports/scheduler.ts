/**
 * Scheduled Report Generator
 *
 * Generates and delivers reports on a schedule.
 */

import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import {
  generateRevenueSummary,
  generateCustomerActivity,
  generateOpportunityPipeline,
  generatePromotionPerformance,
  generateLoyaltyEngagement,
  type ReportData,
  type ReportFilters,
} from './generators'
import { generateCsv, generateExcel, generatePdf, getMimeType, getFileExtension } from './formatters'
import { captureError, captureMessage } from '@/lib/errors/tracking'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface ScheduledReport {
  id: string
  name: string
  report_type: string
  schedule: string
  recipients: string[]
  filters?: ReportFilters
  format: 'pdf' | 'csv' | 'excel'
  enabled: boolean
  created_by_user_id?: string
  created_at: string
}

/**
 * Generate and send a scheduled report
 */
export async function generateScheduledReport(reportId: string): Promise<void> {
  const supabase = createClient()

  // Get report configuration
  const { data: report, error: fetchError } = await supabase
    .from('scheduled_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (fetchError) {
    captureError(fetchError, {
      severity: 'error',
      action: 'fetch_scheduled_report',
      details: { reportId },
    })
    throw fetchError
  }

  if (!report) {
    throw new Error(`Report not found: ${reportId}`)
  }

  if (!report.enabled) {
    console.log(`[REPORTS] Report ${report.name} is disabled, skipping`)
    return
  }

  captureMessage(`Generating scheduled report: ${report.name}`, 'info', {
    extra: {
      reportId,
      reportType: report.report_type,
      format: report.format,
      recipients: report.recipients,
    },
  })

  try {
    // Generate report data
    const reportData = await generateReportData(report.report_type, report.filters || {})

    // Generate file in requested format
    const { attachment, mimeType, fileName } = await formatReport(
      reportData,
      report.format,
      report.report_type
    )

    // Send to all recipients
    await sendReportEmail(report, fileName, attachment, mimeType)

    // Log successful generation
    await logReportGeneration({
      scheduled_report_id: reportId,
      generated_at: new Date().toISOString(),
      recipients: report.recipients,
      file_name: fileName,
      error_message: null,
    })

    captureMessage(`Report generated successfully: ${report.name}`, 'info', {
      extra: {
        reportId,
        fileName,
        recipientCount: report.recipients.length,
      },
    })
  } catch (error) {
    // Log failed generation
    await logReportGeneration({
      scheduled_report_id: reportId,
      generated_at: new Date().toISOString(),
      recipients: report.recipients,
      file_name: null,
      error_message: (error as Error).message,
    })

    captureError(error as Error, {
      severity: 'error',
      action: 'generate_scheduled_report',
      details: {
        reportId,
        reportName: report.name,
        reportType: report.report_type,
      },
    })

    throw error
  }
}

/**
 * Generate report data based on type
 */
async function generateReportData(
  reportType: string,
  filters: ReportFilters
): Promise<ReportData> {
  console.log(`[REPORTS] Generating ${reportType} report`)

  switch (reportType) {
    case 'revenue_summary':
      return await generateRevenueSummary(filters)

    case 'customer_activity':
      return await generateCustomerActivity(filters)

    case 'opportunity_pipeline':
      return await generateOpportunityPipeline(filters)

    case 'promotion_performance':
      return await generatePromotionPerformance(filters)

    case 'loyalty_engagement':
      return await generateLoyaltyEngagement(filters)

    default:
      throw new Error(`Unknown report type: ${reportType}`)
  }
}

/**
 * Format report data to requested format
 */
async function formatReport(
  reportData: ReportData,
  format: 'csv' | 'excel' | 'pdf',
  reportType: string
): Promise<{
  attachment: Buffer
  mimeType: string
  fileName: string
}> {
  console.log(`[REPORTS] Formatting report as ${format}`)

  const dateStr = new Date().toISOString().split('T')[0]
  const fileName = `${reportType}-${dateStr}${getFileExtension(format)}`

  let attachment: Buffer

  switch (format) {
    case 'csv':
      attachment = generateCsv(reportData)
      break

    case 'excel':
      attachment = await generateExcel(reportData)
      break

    case 'pdf':
      attachment = await generatePdf(reportData)
      break

    default:
      throw new Error(`Unknown format: ${format}`)
  }

  return {
    attachment,
    mimeType: getMimeType(format),
    fileName,
  }
}

/**
 * Send report via email
 */
async function sendReportEmail(
  report: ScheduledReport,
  fileName: string,
  attachment: Buffer,
  mimeType: string
): Promise<void> {
  console.log(`[REPORTS] Sending report to ${report.recipients.length} recipients`)

  if (!process.env.RESEND_API_KEY) {
    console.warn('[REPORTS] RESEND_API_KEY not configured, skipping email send')
    return
  }

  const emailPromises = report.recipients.map(async (recipient) => {
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'reports@dirtfreecarpet.com',
        to: recipient,
        subject: `${report.name} - ${new Date().toLocaleDateString()}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #14213d; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">${report.name}</h1>
            </div>

            <div style="padding: 30px; background-color: #f9f9f9;">
              <p style="font-size: 16px; color: #333;">
                Hello,
              </p>

              <p style="font-size: 14px; color: #666; line-height: 1.6;">
                Please find attached the <strong>${report.name}</strong> for ${new Date().toLocaleDateString()}.
              </p>

              <p style="font-size: 14px; color: #666; line-height: 1.6;">
                This is an automated report generated by Dirt Free CRM.
              </p>

              <div style="background-color: white; border-left: 4px solid #fca311; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 13px; color: #666;">
                  <strong>Report Details:</strong><br>
                  Type: ${formatReportType(report.report_type)}<br>
                  Format: ${report.format.toUpperCase()}<br>
                  Generated: ${new Date().toLocaleString()}
                </p>
              </div>

              <p style="font-size: 12px; color: #999; margin-top: 30px;">
                If you have any questions about this report, please contact your system administrator.
              </p>
            </div>

            <div style="background-color: #14213d; color: #999; padding: 15px; text-align: center; font-size: 12px;">
              <p style="margin: 0;">
                Dirt Free Carpet Cleaning &amp; Restoration<br>
                Automated Report System
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: fileName,
            content: attachment,
          },
        ],
      })

      console.log(`[REPORTS] Email sent to ${recipient}`)
    } catch (error) {
      console.error(`[REPORTS] Failed to send email to ${recipient}:`, error)
      captureError(error as Error, {
        severity: 'warning',
        action: 'send_report_email',
        details: {
          recipient,
          reportName: report.name,
        },
      })
    }
  })

  await Promise.allSettled(emailPromises)
}

/**
 * Log report generation to database
 */
async function logReportGeneration(logData: {
  scheduled_report_id: string
  generated_at: string
  recipients: string[]
  file_name: string | null
  error_message: string | null
}): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('report_generation_log').insert(logData)

  if (error) {
    console.error('[REPORTS] Failed to log report generation:', error)
  }
}

/**
 * Format report type for display
 */
function formatReportType(reportType: string): string {
  return reportType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Generate all enabled scheduled reports
 *
 * Called by cron job to process all reports.
 */
export async function generateAllScheduledReports(): Promise<void> {
  const supabase = createClient()

  console.log('[REPORTS] Checking for enabled scheduled reports')

  const { data: reports, error } = await supabase
    .from('scheduled_reports')
    .select('id, name')
    .eq('enabled', true)

  if (error) {
    captureError(error, {
      severity: 'error',
      action: 'fetch_enabled_reports',
    })
    throw error
  }

  if (!reports || reports.length === 0) {
    console.log('[REPORTS] No enabled reports found')
    return
  }

  console.log(`[REPORTS] Found ${reports.length} enabled reports`)

  const results = await Promise.allSettled(
    reports.map((report) => generateScheduledReport(report.id))
  )

  const successful = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  console.log(`[REPORTS] Generated ${successful} reports, ${failed} failed`)

  if (failed > 0) {
    const errors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason)

    captureMessage(`Some scheduled reports failed to generate`, 'warning', {
      extra: {
        successful,
        failed,
        errors: errors.map((e) => e.message),
      },
    })
  }
}

/**
 * Test report generation (for manual testing)
 */
export async function testReportGeneration(
  reportType: string,
  format: 'csv' | 'excel' | 'pdf',
  filters: ReportFilters = {}
): Promise<{ fileName: string; fileSize: number }> {
  const reportData = await generateReportData(reportType, filters)
  const { attachment, fileName } = await formatReport(reportData, format, reportType)

  return {
    fileName,
    fileSize: attachment.length,
  }
}
