/**
 * Review Escalation Email Template
 *
 * Internal email sent to managers when a low-rating review
 * remains unresolved after 48 hours.
 *
 * Used by: Escalation cron job
 * Audience: Managers, admins, owners
 * Trigger: Support ticket from 1-3 star review > 48 hours old
 */

export interface ReviewEscalationEmailProps {
  managerName: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  serviceType: string
  rating: number
  feedback: string
  resolutionRequest: string | null
  hoursSinceReview: number
  ticketUrl: string
}

export function renderReviewEscalationEmail(props: ReviewEscalationEmailProps): string {
  const {
    managerName,
    customerName,
    customerEmail,
    customerPhone,
    serviceType,
    rating,
    feedback,
    resolutionRequest,
    hoursSinceReview,
    ticketUrl,
  } = props

  const daysSinceReview = Math.floor(hoursSinceReview / 24)
  const ratingColor = rating === 1 ? '#dc2626' : rating === 2 ? '#ea580c' : '#f59e0b'
  const priorityLabel = rating === 1 ? 'CRITICAL' : 'HIGH'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unresolved Low-Rating Review</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 20px 0;">

        <!-- Main Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${ratingColor} 0%, #991b1b 100%); padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">
                🚨 URGENT ACTION REQUIRED
              </h1>
              <p style="margin: 10px 0 0 0; color: #fef3c7; font-size: 14px; font-weight: 500;">
                Unresolved Low-Rating Review
              </p>
            </td>
          </tr>

          <!-- Priority Badge -->
          <tr>
            <td style="padding: 20px 30px 0 30px;">
              <div style="background-color: ${ratingColor}; color: white; padding: 12px 20px; border-radius: 6px; text-align: center; font-weight: 700; font-size: 16px; letter-spacing: 1px;">
                ${priorityLabel} PRIORITY - ${daysSinceReview} DAYS UNRESOLVED
              </div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 20px 30px 10px 30px;">
              <p style="margin: 0; color: #111827; font-size: 16px; line-height: 1.6;">
                Hi ${managerName},
              </p>
            </td>
          </tr>

          <!-- Alert Message -->
          <tr>
            <td style="padding: 10px 30px 20px 30px;">
              <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                A customer who left a <strong style="color: ${ratingColor};">${rating}-star review</strong> has not received a response for <strong>${hoursSinceReview} hours</strong> (${daysSinceReview} days). This requires immediate attention.
              </p>
            </td>
          </tr>

          <!-- Customer Info Card -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; border-left: 4px solid ${ratingColor}; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 700;">
                      Customer Information
                    </h3>

                    <div style="margin-bottom: 8px;">
                      <span style="color: #6b7280; font-size: 14px;">Name:</span>
                      <span style="color: #111827; font-size: 14px; font-weight: 600; margin-left: 8px;">${customerName}</span>
                    </div>

                    <div style="margin-bottom: 8px;">
                      <span style="color: #6b7280; font-size: 14px;">Email:</span>
                      <a href="mailto:${customerEmail}" style="color: #2563eb; font-size: 14px; font-weight: 600; margin-left: 8px; text-decoration: none;">${customerEmail}</a>
                    </div>

                    ${customerPhone ? `
                    <div style="margin-bottom: 8px;">
                      <span style="color: #6b7280; font-size: 14px;">Phone:</span>
                      <a href="tel:${customerPhone}" style="color: #2563eb; font-size: 14px; font-weight: 600; margin-left: 8px; text-decoration: none;">${customerPhone}</a>
                    </div>
                    ` : ''}

                    <div>
                      <span style="color: #6b7280; font-size: 14px;">Service:</span>
                      <span style="color: #111827; font-size: 14px; font-weight: 600; margin-left: 8px;">${serviceType}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rating Display -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef2f2; border-left: 4px solid ${ratingColor}; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 700;">
                      Customer Rating
                    </h3>
                    <div style="font-size: 32px; margin-bottom: 8px;">
                      ${'⭐'.repeat(rating)}${'☆'.repeat(5 - rating)}
                    </div>
                    <div style="color: ${ratingColor}; font-size: 18px; font-weight: 700;">
                      ${rating} out of 5 stars
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Feedback -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 700;">
                Customer Feedback
              </h3>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px;">
                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.7; font-style: italic;">
                  "${feedback}"
                </p>
              </div>
            </td>
          </tr>

          ${resolutionRequest ? `
          <!-- Resolution Request -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <h3 style="margin: 0 0 12px 0; color: #111827; font-size: 16px; font-weight: 700;">
                Customer's Resolution Request
              </h3>
              <div style="background-color: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px; padding: 16px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.7; font-weight: 500;">
                  "${resolutionRequest}"
                </p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Action Required -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 700;">
                      ⚡ Required Actions
                    </h3>
                    <ol style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                      <li>Contact customer within 2 hours</li>
                      <li>Listen to their concerns and apologize</li>
                      <li>Propose a solution (refund, redo, discount, etc.)</li>
                      <li>Update support ticket with outcome</li>
                      <li>Follow up within 24 hours to ensure resolution</li>
                    </ol>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 10px 30px 30px 30px;">
              <a href="${ticketUrl}" style="display: inline-block; background-color: ${ratingColor}; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                View Support Ticket & Take Action →
              </a>
            </td>
          </tr>

          <!-- Reminder -->
          <tr>
            <td style="padding: 0 30px 20px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center;">
                ⏰ This ticket has been escalated to <strong>HIGH PRIORITY</strong>. Customer service recovery is critical for business reputation.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.5;">
                <strong>Dirt Free Carpet Cleaning - Management Alert</strong><br>
                This is an automated escalation notification. Please respond immediately.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`
}
