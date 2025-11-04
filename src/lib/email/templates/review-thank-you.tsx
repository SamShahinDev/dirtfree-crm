/**
 * Review Thank You Email Template
 *
 * Sent to customers after they submit a review.
 *
 * Variants:
 * - High ratings (4-5 stars): Thank you + discount code + Google review CTA
 * - Low ratings (1-3 stars): Apology + commitment to resolve
 *
 * Used by: Portal review submission API
 * Audience: Customers who completed reviews
 * Trigger: Review submitted via customer portal
 */

export interface ReviewThankYouEmailProps {
  customerName: string
  rating: number
  googleReviewRequested: boolean
  promoCode?: string
  promoDiscountPercent?: number
  promoExpiryDays?: number
  googleReviewUrl?: string
}

export function renderReviewThankYouEmail(props: ReviewThankYouEmailProps): string {
  const {
    customerName,
    rating,
    googleReviewRequested,
    promoCode,
    promoDiscountPercent = 15,
    promoExpiryDays = 30,
    googleReviewUrl,
  } = props

  const isHighRating = rating >= 4

  // High rating (4-5 stars) - positive thank you with rewards
  if (isHighRating) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You for Your Review!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 20px 0;">

        <!-- Main Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #14213d 0%, #1e3a5f 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 64px; margin-bottom: 10px;">⭐</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                Thank You!
              </h1>
              <p style="margin: 10px 0 0 0; color: #cbd5e1; font-size: 16px;">
                Your feedback means the world to us
              </p>
            </td>
          </tr>

          <!-- Star Rating Display -->
          <tr>
            <td align="center" style="padding: 30px 30px 20px 30px;">
              <div style="font-size: 40px; margin-bottom: 10px;">
                ${'⭐'.repeat(rating)}
              </div>
              <p style="margin: 0; color: #10b981; font-size: 18px; font-weight: 700;">
                ${rating} out of 5 stars
              </p>
            </td>
          </tr>

          <!-- Thank You Message -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="margin: 0 0 16px 0; color: #111827; font-size: 16px; line-height: 1.6;">
                Hi ${customerName},
              </p>
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.7;">
                Thank you for taking the time to share your positive feedback! We're thrilled to hear that you're satisfied with our service.
              </p>
              <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.7;">
                Your review means a lot to our team and helps us continue providing excellent service to our community.
              </p>
            </td>
          </tr>

          ${promoCode ? `
          <!-- Discount Code Section -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; border-radius: 8px;">
                <tr>
                  <td style="padding: 30px; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 10px;">🎁</div>
                    <h2 style="margin: 0 0 10px 0; color: #1e40af; font-size: 22px; font-weight: 700;">
                      Here's a Special Thank You Gift!
                    </h2>
                    <p style="margin: 0 0 20px 0; color: #1e3a8a; font-size: 15px;">
                      Save <strong>${promoDiscountPercent}%</strong> on your next service
                    </p>

                    <!-- Promo Code Display -->
                    <div style="background-color: #ffffff; border: 3px dashed #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                        Your Exclusive Code
                      </p>
                      <div style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; color: #1e40af; letter-spacing: 2px; margin-bottom: 8px;">
                        ${promoCode}
                      </div>
                      <p style="margin: 0; color: #6b7280; font-size: 12px;">
                        Click to copy, or mention at checkout
                      </p>
                    </div>

                    <!-- Usage Instructions -->
                    <div style="background-color: #eff6ff; border-radius: 6px; padding: 16px; text-align: left;">
                      <p style="margin: 0 0 8px 0; color: #1e40af; font-size: 14px; font-weight: 600;">
                        How to use:
                      </p>
                      <ul style="margin: 0; padding-left: 20px; color: #1e3a8a; font-size: 13px; line-height: 1.8;">
                        <li>Valid for ${promoExpiryDays} days from today</li>
                        <li>Can be used on any service</li>
                        <li>Mention code when booking or enter online</li>
                        <li>One-time use only</li>
                      </ul>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          ${googleReviewRequested && googleReviewUrl ? `
          <!-- Google Review CTA -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px;">
                <tr>
                  <td style="padding: 30px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <div style="font-size: 40px; margin-bottom: 10px;">🌟</div>
                      <h3 style="margin: 0 0 10px 0; color: #14213d; font-size: 20px; font-weight: 700;">
                        Help Others Find Quality Service
                      </h3>
                      <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.6;">
                        If you have a moment, we'd greatly appreciate if you could share your experience on Google. Your review helps neighbors in our community make informed decisions.
                      </p>
                    </div>

                    <div style="text-align: center;">
                      <a href="${googleReviewUrl}" style="display: inline-block; background-color: #14213d; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        Leave a Google Review →
                      </a>
                    </div>

                    <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 12px; text-align: center;">
                      Takes less than 60 seconds
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Closing -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.7;">
                We appreciate your business and look forward to serving you again!
              </p>
              <p style="margin: 20px 0 0 0; color: #111827; font-size: 15px; line-height: 1.7;">
                Best regards,<br>
                <strong style="color: #14213d;">The Dirt Free Carpet Cleaning Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.5;">
                Dirt Free Carpet Cleaning<br>
                Professional carpet, tile, and upholstery cleaning services
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

  // Low rating (1-3 stars) - apology and commitment to resolve
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We're Here to Help</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 20px 0;">

        <!-- Main Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #14213d 0%, #1e3a5f 100%); padding: 40px 30px; text-align: center;">
              <div style="font-size: 64px; margin-bottom: 10px;">🤝</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">
                We're Committed to Making This Right
              </h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px 0; color: #111827; font-size: 16px; line-height: 1.6;">
                Hi ${customerName},
              </p>
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.7;">
                Thank you for sharing your honest feedback. We're sorry that your experience didn't meet your expectations.
              </p>
              <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.7;">
                <strong style="color: #14213d;">We take your feedback seriously.</strong> Our team has been notified and will reach out to you within 24 hours to discuss how we can make this right.
              </p>
            </td>
          </tr>

          <!-- What Happens Next -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px; font-weight: 700;">
                      What happens next:
                    </h3>
                    <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                      <li>A member of our management team will contact you</li>
                      <li>We'll listen to your concerns and work on a solution</li>
                      <li>We'll take action to prevent similar issues in the future</li>
                      <li>We'll follow up to ensure you're completely satisfied</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Our Commitment -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 24px; text-align: center;">
                <p style="margin: 0; color: #166534; font-size: 15px; line-height: 1.7; font-weight: 600;">
                  "Your satisfaction is our priority. We won't rest until we've earned back your trust."
                </p>
                <p style="margin: 10px 0 0 0; color: #166534; font-size: 13px;">
                  — Management Team
                </p>
              </div>
            </td>
          </tr>

          <!-- Contact Info -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="margin: 0 0 12px 0; color: #374151; font-size: 14px; line-height: 1.6;">
                <strong>Need to reach us sooner?</strong>
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                You can contact us directly at:<br>
                📧 Email: support@dirtfreecleaning.com<br>
                📞 Phone: (555) 123-4567
              </p>
            </td>
          </tr>

          <!-- Closing -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.7;">
                We value your business and the opportunity to earn back your trust.
              </p>
              <p style="margin: 20px 0 0 0; color: #111827; font-size: 15px; line-height: 1.7;">
                Sincerely,<br>
                <strong style="color: #14213d;">The Dirt Free Carpet Cleaning Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.5;">
                Dirt Free Carpet Cleaning<br>
                Professional carpet, tile, and upholstery cleaning services
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
