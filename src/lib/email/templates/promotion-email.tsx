import React from 'react'
import { EmailTemplate, EmailButton, EmailSection } from './base'

/**
 * Promotion Email Template
 *
 * Professional email template for delivering promotional offers to customers.
 * Includes promotion details, claim code, CTA button, and terms.
 */

interface PromotionEmailProps {
  customerName: string
  promotion: {
    promotionId: string
    title: string
    description?: string
    promotionType: string
    discountValue?: number
    discountPercentage?: number
    promoCode?: string
    startDate: string
    endDate: string
    termsAndConditions?: string
  }
  claimCode: string
}

export function PromotionEmail({
  customerName,
  promotion,
  claimCode,
}: PromotionEmailProps) {
  // Format discount display
  const getDiscountDisplay = () => {
    if (promotion.promotionType === 'percentage_off' && promotion.discountPercentage) {
      return `${promotion.discountPercentage}% OFF`
    }
    if (promotion.promotionType === 'dollar_off' && promotion.discountValue) {
      return `$${promotion.discountValue} OFF`
    }
    return 'Special Offer'
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Get claim URL
  const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.dirtfree.com'}/dashboard/promotions/claim?code=${claimCode}`

  return (
    <EmailTemplate
      title={`Special Offer: ${promotion.title}`}
      preheader={`Exclusive offer: ${getDiscountDisplay()} on your next service!`}
    >
      {/* Greeting */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{
          fontSize: '16px',
          color: '#1a1a1a',
          lineHeight: '1.6',
          margin: '0 0 16px 0'
        }}>
          Hi {customerName},
        </p>
        <p style={{
          fontSize: '16px',
          color: '#4a4a4a',
          lineHeight: '1.6',
          margin: 0
        }}>
          We have an exclusive offer just for you!
        </p>
      </div>

      {/* Promotion Card */}
      <div style={{
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        padding: '32px',
        borderRadius: '8px',
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          margin: '0 0 12px 0'
        }}>
          {getDiscountDisplay()}
        </h2>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '500',
          margin: '0 0 16px 0',
          opacity: 0.95
        }}>
          {promotion.title}
        </h3>
        {promotion.description && (
          <p style={{
            fontSize: '16px',
            lineHeight: '1.5',
            margin: 0,
            opacity: 0.9
          }}>
            {promotion.description}
          </p>
        )}
      </div>

      {/* Promo Code Section */}
      <EmailSection
        title="Your Unique Code"
        backgroundColor="#f0fdf4"
        padding="24px"
      >
        <div style={{ textAlign: 'center' }}>
          {promotion.promoCode && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{
                fontSize: '14px',
                color: '#666',
                margin: '0 0 8px 0'
              }}>
                Promo Code:
              </p>
              <div style={{
                display: 'inline-block',
                backgroundColor: '#ffffff',
                padding: '12px 24px',
                borderRadius: '6px',
                border: '2px dashed #3b82f6',
                fontSize: '24px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                color: '#3b82f6',
                letterSpacing: '2px'
              }}>
                {promotion.promoCode}
              </div>
            </div>
          )}
          <div>
            <p style={{
              fontSize: '14px',
              color: '#666',
              margin: '0 0 8px 0'
            }}>
              Claim Code:
            </p>
            <div style={{
              display: 'inline-block',
              backgroundColor: '#ffffff',
              padding: '10px 20px',
              borderRadius: '6px',
              border: '1px solid #e5e5e5',
              fontSize: '18px',
              fontWeight: '600',
              fontFamily: 'monospace',
              color: '#1a1a1a'
            }}>
              {claimCode}
            </div>
          </div>
        </div>
      </EmailSection>

      {/* CTA Button */}
      <EmailButton
        href={claimUrl}
        text="Claim Your Offer"
        backgroundColor="#3b82f6"
      />

      {/* Validity Period */}
      <div style={{
        textAlign: 'center',
        marginTop: '24px',
        marginBottom: '24px'
      }}>
        <p style={{
          fontSize: '14px',
          color: '#666',
          margin: 0
        }}>
          Valid from {formatDate(promotion.startDate)} to {formatDate(promotion.endDate)}
        </p>
      </div>

      {/* Terms & Conditions */}
      {promotion.termsAndConditions && (
        <EmailSection
          title="Terms & Conditions"
          backgroundColor="#f8f8f8"
          padding="20px"
        >
          <p style={{
            fontSize: '13px',
            color: '#666',
            lineHeight: '1.6',
            margin: 0
          }}>
            {promotion.termsAndConditions}
          </p>
        </EmailSection>
      )}

      {/* How to Redeem */}
      <div style={{ marginTop: '32px' }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#1a1a1a',
          margin: '0 0 16px 0'
        }}>
          How to Redeem:
        </h4>
        <ol style={{
          fontSize: '14px',
          color: '#4a4a4a',
          lineHeight: '1.8',
          paddingLeft: '20px',
          margin: 0
        }}>
          <li>Click the "Claim Your Offer" button above</li>
          <li>Or enter your claim code when booking your next service</li>
          <li>Your discount will be automatically applied</li>
        </ol>
      </div>

      {/* Footer Note */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        backgroundColor: '#fef3c7',
        borderRadius: '6px',
        borderLeft: '4px solid #f59e0b'
      }}>
        <p style={{
          fontSize: '14px',
          color: '#92400e',
          margin: 0,
          lineHeight: '1.6'
        }}>
          <strong>Note:</strong> This is an exclusive offer for you. The claim code is unique and can only be used once. Don't miss out - book your service before the offer expires!
        </p>
      </div>

      {/* Support */}
      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <p style={{
          fontSize: '14px',
          color: '#666',
          margin: 0
        }}>
          Have questions? Contact us at{' '}
          <a href="mailto:support@dirtfree.com" style={{ color: '#3b82f6' }}>
            support@dirtfree.com
          </a>
        </p>
      </div>
    </EmailTemplate>
  )
}

/**
 * Render promotion email to HTML string
 */
export function renderPromotionEmail(props: PromotionEmailProps): string {
  const { renderToStaticMarkup } = require('react-dom/server')
  return renderToStaticMarkup(<PromotionEmail {...props} />)
}
