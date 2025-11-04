/**
 * Review Request Email Template
 *
 * Professional email requesting customer feedback after service completion.
 *
 * Features:
 * - Thank customer for business
 * - Request 1-5 star rating
 * - Conditional Google review request based on rating
 * - Clear call-to-action buttons
 * - Service details reminder
 */

export interface ReviewRequestEmailProps {
  customerName: string
  serviceType: string
  serviceDate: string
  jobValue: number
  reviewUrl: string
  googleReviewUrl?: string
}

/**
 * Render review request email (not used, kept for reference)
 */
export function ReviewRequestEmailComponent({
  customerName,
  serviceType,
  serviceDate,
  jobValue,
  reviewUrl,
  googleReviewUrl,
}: ReviewRequestEmailProps) {
  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: '600', color: '#14213d' }}>
          Hi {customerName},
        </h2>
        <p style={{ margin: '0', fontSize: '16px', lineHeight: '24px', color: '#4a5568' }}>
          Thank you for choosing Dirt Free Carpet Cleaning for your recent {serviceType} service!
        </p>
      </div>

      {/* Service Summary */}
      <div
        style={{
          backgroundColor: '#f7fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: '#14213d' }}>
          Service Details
        </h3>
        <div style={{ fontSize: '14px', color: '#4a5568' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Service:</span>
            <span style={{ fontWeight: '600' }}>{serviceType}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Date:</span>
            <span style={{ fontWeight: '600' }}>{serviceDate}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Amount:</span>
            <span style={{ fontWeight: '600' }}>${jobValue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Main Message */}
      <div style={{ marginBottom: '32px' }}>
        <p style={{ margin: '0 0 16px 0', fontSize: '16px', lineHeight: '24px', color: '#4a5568' }}>
          We hope you&apos;re satisfied with the quality of our work! Your feedback helps us improve our
          service and helps other customers make informed decisions.
        </p>
        <p style={{ margin: '0', fontSize: '16px', lineHeight: '24px', color: '#4a5568' }}>
          It only takes a minute to share your experience:
        </p>
      </div>

      {/* 2-Step Process */}
      <div
        style={{
          backgroundColor: '#eef2ff',
          border: '2px solid #c7d2fe',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
        }}
      >
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600', color: '#14213d' }}>
          Simple 2-Step Review Process:
        </h3>

        {/* Step 1 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div
              style={{
                backgroundColor: '#14213d',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                marginRight: '12px',
                fontSize: '16px',
              }}
            >
              1
            </div>
            <h4 style={{ margin: '0', fontSize: '16px', fontWeight: '600', color: '#14213d' }}>
              Rate Your Experience (1-5 Stars)
            </h4>
          </div>
          <p style={{ margin: '0 0 0 44px', fontSize: '14px', color: '#4a5568', lineHeight: '20px' }}>
            Let us know how we did! Rate your service from 1 to 5 stars and share any feedback.
          </p>
        </div>

        {/* Step 2 */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div
              style={{
                backgroundColor: '#14213d',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                marginRight: '12px',
                fontSize: '16px',
              }}
            >
              2
            </div>
            <h4 style={{ margin: '0', fontSize: '16px', fontWeight: '600', color: '#14213d' }}>
              Help Others Find Us (Optional)
            </h4>
          </div>
          <p style={{ margin: '0 0 0 44px', fontSize: '14px', color: '#4a5568', lineHeight: '20px' }}>
            If you had a great experience (4-5 stars), we&apos;d appreciate a Google review to help
            other homeowners find quality carpet cleaning service!
          </p>
          <p style={{ margin: '8px 0 0 44px', fontSize: '13px', color: '#718096', fontStyle: 'italic' }}>
            (If you had any issues, we&apos;ll help resolve them first before asking for a public review)
          </p>
        </div>
      </div>

      {/* Primary CTA Button */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <a
          href={reviewUrl}
          style={{
            display: 'inline-block',
            backgroundColor: '#14213d',
            color: 'white',
            padding: '16px 40px',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '16px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          ⭐ Share Your Feedback
        </a>
      </div>

      {/* Why Reviews Matter */}
      <div
        style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <p style={{ margin: '0', fontSize: '14px', color: '#92400e', lineHeight: '20px' }}>
          <strong>💡 Why Your Review Matters:</strong>
          <br />
          Your honest feedback helps us maintain our high standards and helps neighbors in our
          community make informed decisions about their carpet cleaning needs.
        </p>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '24px', marginTop: '32px' }}>
        <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#718096' }}>
          We truly appreciate your business and the opportunity to serve you!
        </p>
        <p style={{ margin: '0', fontSize: '14px', color: '#718096' }}>
          Best regards,
          <br />
          <strong style={{ color: '#14213d' }}>The Dirt Free Carpet Cleaning Team</strong>
        </p>
      </div>

      {/* Quick Link Footer */}
      <div
        style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#a0aec0' }}>
          Can&apos;t see the button? Copy and paste this link:
        </p>
        <p style={{ margin: '0', fontSize: '12px', color: '#4a5568', wordBreak: 'break-all' }}>
          {reviewUrl}
        </p>
      </div>
    </div>
  )
}

/**
 * Generate review request email HTML
 */
export function renderReviewRequestEmail(props: ReviewRequestEmailProps): string {
  // This would typically use a library like @react-email/render
  // For now, return a basic HTML version
  const { customerName, serviceType, serviceDate, jobValue, reviewUrl } = props

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>We'd love your feedback!</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7fafc;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

      <!-- Greeting -->
      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #14213d;">
          Hi ${customerName},
        </h2>
        <p style="margin: 0; font-size: 16px; line-height: 24px; color: #4a5568;">
          Thank you for choosing Dirt Free Carpet Cleaning for your recent ${serviceType} service!
        </p>
      </div>

      <!-- Service Summary -->
      <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #14213d;">
          Service Details
        </h3>
        <div style="font-size: 14px; color: #4a5568;">
          <div style="margin-bottom: 8px;">
            <span>Service:</span>
            <span style="font-weight: 600; float: right;">${serviceType}</span>
          </div>
          <div style="margin-bottom: 8px;">
            <span>Date:</span>
            <span style="font-weight: 600; float: right;">${serviceDate}</span>
          </div>
          <div>
            <span>Amount:</span>
            <span style="font-weight: 600; float: right;">$${jobValue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- Main Message -->
      <div style="margin-bottom: 32px;">
        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #4a5568;">
          We hope you're satisfied with the quality of our work! Your feedback helps us improve our service and helps other customers make informed decisions.
        </p>
        <p style="margin: 0; font-size: 16px; line-height: 24px; color: #4a5568;">
          It only takes a minute to share your experience:
        </p>
      </div>

      <!-- 2-Step Process -->
      <div style="background-color: #eef2ff; border: 2px solid #c7d2fe; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
        <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #14213d;">
          Simple 2-Step Review Process:
        </h3>

        <!-- Step 1 -->
        <div style="margin-bottom: 20px;">
          <div style="margin-bottom: 12px;">
            <span style="background-color: #14213d; color: white; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; margin-right: 12px; font-size: 16px; vertical-align: middle;">1</span>
            <strong style="font-size: 16px; color: #14213d; vertical-align: middle;">Rate Your Experience (1-5 Stars)</strong>
          </div>
          <p style="margin: 0 0 0 44px; font-size: 14px; color: #4a5568; line-height: 20px;">
            Let us know how we did! Rate your service from 1 to 5 stars and share any feedback.
          </p>
        </div>

        <!-- Step 2 -->
        <div>
          <div style="margin-bottom: 12px;">
            <span style="background-color: #14213d; color: white; width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; margin-right: 12px; font-size: 16px; vertical-align: middle;">2</span>
            <strong style="font-size: 16px; color: #14213d; vertical-align: middle;">Help Others Find Us (Optional)</strong>
          </div>
          <p style="margin: 0 0 0 44px; font-size: 14px; color: #4a5568; line-height: 20px;">
            If you had a great experience (4-5 stars), we'd appreciate a Google review to help other homeowners find quality carpet cleaning service!
          </p>
          <p style="margin: 8px 0 0 44px; font-size: 13px; color: #718096; font-style: italic;">
            (If you had any issues, we'll help resolve them first before asking for a public review)
          </p>
        </div>
      </div>

      <!-- Primary CTA Button -->
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${reviewUrl}" style="display: inline-block; background-color: #14213d; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          ⭐ Share Your Feedback
        </a>
      </div>

      <!-- Why Reviews Matter -->
      <div style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 20px;">
          <strong>💡 Why Your Review Matters:</strong><br>
          Your honest feedback helps us maintain our high standards and helps neighbors in our community make informed decisions about their carpet cleaning needs.
        </p>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; margin-top: 32px;">
        <p style="margin: 0 0 12px 0; font-size: 14px; color: #718096;">
          We truly appreciate your business and the opportunity to serve you!
        </p>
        <p style="margin: 0; font-size: 14px; color: #718096;">
          Best regards,<br>
          <strong style="color: #14213d;">The Dirt Free Carpet Cleaning Team</strong>
        </p>
      </div>

      <!-- Quick Link Footer -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 12px; color: #a0aec0;">
          Can't see the button? Copy and paste this link:
        </p>
        <p style="margin: 0; font-size: 12px; color: #4a5568; word-break: break-all;">
          ${reviewUrl}
        </p>
      </div>

    </div>
  </div>
</body>
</html>
  `.trim()
}
