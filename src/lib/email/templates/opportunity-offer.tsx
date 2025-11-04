/**
 * Opportunity Offer Email Template
 *
 * Personalized re-engagement email with discount offer
 * for customers who previously declined services.
 */

export interface OpportunityOfferEmailProps {
  customerName: string
  opportunityType: string
  declinedServices: string[]
  discountPercentage: number
  offerCode: string
  expirationDate: string
  claimUrl: string
  bookingUrl?: string
  estimatedValue?: number
  reason?: string
}

const OPPORTUNITY_MESSAGES: Record<
  string,
  { subject: string; greeting: string; context: string }
> = {
  declined_service: {
    subject: "We'd Love Another Chance to Serve You",
    greeting: "We noticed you didn't book with us last time.",
    context:
      "We understand timing isn't always right. If you're ready now, we'd love to help with your cleaning needs.",
  },
  price_objection: {
    subject: 'Special Pricing Just for You',
    greeting: 'We value your business and want to make this work.',
    context:
      "We've reviewed your previous inquiry and created a special offer that we think you'll love.",
  },
  postponed_booking: {
    subject: "Ready When You Are - Special Discount Inside",
    greeting: "It's been a while since we last spoke.",
    context:
      "We're reaching out to see if you're ready to schedule the service you were interested in.",
  },
  partial_booking: {
    subject: 'Complete Your Cleaning - Exclusive Offer',
    greeting: 'Thanks for choosing us for your recent service!',
    context:
      "We'd love to help you with the additional services you were considering. Here's a special offer to make it easy.",
  },
  competitor_mention: {
    subject: 'Let Us Earn Your Business - Special Offer',
    greeting: "We know you're comparing options.",
    context:
      "We're confident in our quality and service. Here's a special offer to give us a chance to prove it.",
  },
  service_upsell: {
    subject: 'Exclusive Offer on Additional Services',
    greeting: "We'd love to do more for you!",
    context:
      "Based on your previous service, we think you'd benefit from these additional cleaning options.",
  },
}

export function renderOpportunityOfferEmail(props: OpportunityOfferEmailProps): string {
  const {
    customerName,
    opportunityType,
    declinedServices,
    discountPercentage,
    offerCode,
    expirationDate,
    claimUrl,
    bookingUrl,
    estimatedValue,
  } = props

  const messages = OPPORTUNITY_MESSAGES[opportunityType] || OPPORTUNITY_MESSAGES.declined_service
  const expiryDate = new Date(expirationDate)
  const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Format services list
  const servicesList =
    declinedServices.length > 0
      ? declinedServices
          .map((service) => `<li style="margin-bottom: 8px;">${service}</li>`)
          .join('')
      : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${messages.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                ${discountPercentage}% OFF Special Offer
              </h1>
              <p style="margin: 10px 0 0; color: #ffffff; font-size: 16px; opacity: 0.95;">
                Just for You, ${customerName}
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 40px 20px;">
              <p style="margin: 0 0 15px; color: #333333; font-size: 18px; font-weight: 600;">
                ${messages.greeting}
              </p>
              <p style="margin: 0; color: #666666; font-size: 16px; line-height: 1.6;">
                ${messages.context}
              </p>
            </td>
          </tr>

          <!-- Offer Box -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; border: 2px solid #667eea;">
                <tr>
                  <td style="padding: 30px; text-align: center;">
                    <div style="font-size: 48px; font-weight: bold; color: #667eea; margin-bottom: 10px;">
                      ${discountPercentage}%
                    </div>
                    <div style="font-size: 18px; color: #333333; font-weight: 600; margin-bottom: 15px;">
                      Discount on Your Service
                    </div>
                    <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px dashed #667eea; margin-bottom: 15px;">
                      <div style="color: #666666; font-size: 12px; margin-bottom: 5px;">
                        USE CODE
                      </div>
                      <div style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: bold; color: #667eea;">
                        ${offerCode}
                      </div>
                    </div>
                    ${
                      estimatedValue
                        ? `
                    <div style="color: #28a745; font-size: 14px; font-weight: 600;">
                      Save up to $${(estimatedValue * (discountPercentage / 100)).toFixed(2)}
                    </div>
                    `
                        : ''
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Services List -->
          ${
            servicesList
              ? `
          <tr>
            <td style="padding: 0 40px 30px;">
              <h3 style="margin: 0 0 15px; color: #333333; font-size: 16px; font-weight: 600;">
                This offer applies to:
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 15px; line-height: 1.6;">
                ${servicesList}
              </ul>
            </td>
          </tr>
          `
              : ''
          }

          <!-- CTA Buttons -->
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <a href="${claimUrl}" style="display: inline-block; padding: 16px 40px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin-bottom: 15px;">
                Claim Your Offer
              </a>
              ${
                bookingUrl
                  ? `
              <br>
              <a href="${bookingUrl}" style="display: inline-block; padding: 16px 40px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                Book Now
              </a>
              `
                  : ''
              }
            </td>
          </tr>

          <!-- Expiration Notice -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>⏰ Limited Time Offer</strong><br>
                  This offer expires on <strong>${formattedExpiry}</strong>. Don't miss out!
                </p>
              </div>
            </td>
          </tr>

          <!-- Why Choose Us -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <h3 style="margin: 0 0 15px; color: #333333; font-size: 16px; font-weight: 600;">
                Why Choose Dirt Free?
              </h3>
              <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px; line-height: 1.8;">
                <li>Professional, certified technicians</li>
                <li>Eco-friendly cleaning products</li>
                <li>100% satisfaction guarantee</li>
                <li>Same-day service available</li>
                <li>Fully insured and bonded</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px; color: #666666; font-size: 14px; line-height: 1.6;">
                Questions? We're here to help!<br>
                Call us at <a href="tel:+1234567890" style="color: #667eea; text-decoration: none;">(123) 456-7890</a><br>
                Email us at <a href="mailto:support@dirtfree.com" style="color: #667eea; text-decoration: none;">support@dirtfree.com</a>
              </p>
              <p style="margin: 20px 0 0; color: #999999; font-size: 12px;">
                This is an automated offer based on your previous inquiry. You're receiving this because you expressed interest in our services.
                If you'd prefer not to receive these offers, please <a href="#" style="color: #667eea; text-decoration: none;">unsubscribe here</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Get email subject line
 */
export function getOpportunityOfferSubject(opportunityType: string): string {
  return OPPORTUNITY_MESSAGES[opportunityType]?.subject || OPPORTUNITY_MESSAGES.declined_service.subject
}
