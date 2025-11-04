import React from 'react'
import { EmailTemplate, EmailButton, EmailSection } from './base'

/**
 * Tier Upgrade Email Template
 *
 * Celebratory email template for customers who have reached a new loyalty tier.
 * Includes tier achievement details, new benefits, bonus points, and encouragement.
 */

interface TierUpgradeEmailProps {
  customerName: string
  previousTierName: string
  newTierName: string
  newTierLevel: number
  bonusPoints: number
  currentTotalPoints: number
  benefits: {
    discount: string
    priority_scheduling: boolean
    free_upgrades: string[]
    special_benefits: string[]
  }
  nextTier?: {
    name: string
    pointsRequired: number
    pointsNeeded: number
  }
}

export function TierUpgradeEmail({
  customerName,
  previousTierName,
  newTierName,
  newTierLevel,
  bonusPoints,
  currentTotalPoints,
  benefits,
  nextTier,
}: TierUpgradeEmailProps) {
  // Tier colors
  const tierColors: Record<string, string> = {
    Bronze: '#cd7f32',
    Silver: '#c0c0c0',
    Gold: '#ffd700',
    Platinum: '#e5e4e2',
  }

  const tierColor = tierColors[newTierName] || '#3b82f6'
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.dirtfree.com'}/dashboard`

  return (
    <EmailTemplate
      title={`Congratulations! You've reached ${newTierName} tier!`}
      preheader={`You've unlocked exclusive ${newTierName} tier benefits and earned ${bonusPoints} bonus points!`}
    >
      {/* Celebration Header */}
      <div
        style={{
          backgroundColor: tierColor,
          color: newTierName === 'Gold' ? '#1a1a1a' : '#ffffff',
          padding: '40px 32px',
          borderRadius: '12px',
          textAlign: 'center',
          marginBottom: '32px',
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
        }}
      >
        <div
          style={{
            fontSize: '48px',
            marginBottom: '16px',
          }}
        >
          🎉
        </div>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 'bold',
            margin: '0 0 12px 0',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          Congratulations, {customerName}!
        </h1>
        <p
          style={{
            fontSize: '18px',
            margin: 0,
            opacity: 0.95,
            fontWeight: '500',
          }}
        >
          You've reached {newTierName} tier status!
        </p>
      </div>

      {/* Tier Upgrade Visual */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          marginBottom: '32px',
          padding: '24px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
        }}
      >
        <div style={{ textAlign: 'center', flex: '1' }}>
          <div
            style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '8px',
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: '1px',
            }}
          >
            Previous Tier
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#94a3b8',
            }}
          >
            {previousTierName}
          </div>
        </div>

        <div
          style={{
            fontSize: '32px',
            color: '#10b981',
          }}
        >
          →
        </div>

        <div style={{ textAlign: 'center', flex: '1' }}>
          <div
            style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '8px',
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: '1px',
            }}
          >
            New Tier
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: tierColor,
            }}
          >
            {newTierName}
          </div>
        </div>
      </div>

      {/* Bonus Points Section */}
      <EmailSection
        title="Tier Upgrade Bonus!"
        backgroundColor="#f0fdf4"
        padding="24px"
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#10b981',
              margin: '0 0 8px 0',
            }}
          >
            +{bonusPoints.toLocaleString()}
          </div>
          <p
            style={{
              fontSize: '16px',
              color: '#166534',
              margin: '0 0 16px 0',
              fontWeight: '500',
            }}
          >
            Bonus Points Added to Your Account
          </p>
          <p
            style={{
              fontSize: '14px',
              color: '#4b5563',
              margin: 0,
            }}
          >
            Your new total: <strong>{currentTotalPoints.toLocaleString()} points</strong>
          </p>
        </div>
      </EmailSection>

      {/* New Benefits */}
      <div style={{ marginTop: '32px' }}>
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#1a1a1a',
            margin: '0 0 20px 0',
            textAlign: 'center',
          }}
        >
          Your {newTierName} Benefits
        </h2>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          {/* Discount */}
          <div
            style={{
              display: 'flex',
              alignItems: 'start',
              marginBottom: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <div style={{ fontSize: '24px', marginRight: '12px' }}>💰</div>
            <div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1a1a1a',
                  marginBottom: '4px',
                }}
              >
                {benefits.discount} Discount
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                Automatically applied to all services
              </div>
            </div>
          </div>

          {/* Priority Scheduling */}
          {benefits.priority_scheduling && (
            <div
              style={{
                display: 'flex',
                alignItems: 'start',
                marginBottom: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <div style={{ fontSize: '24px', marginRight: '12px' }}>⭐</div>
              <div>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '4px',
                  }}
                >
                  Priority Scheduling
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  Get first choice on appointment times
                </div>
              </div>
            </div>
          )}

          {/* Free Upgrades */}
          {benefits.free_upgrades && benefits.free_upgrades.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'start',
                marginBottom: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <div style={{ fontSize: '24px', marginRight: '12px' }}>🎁</div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '8px',
                  }}
                >
                  Free Service Upgrades
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    fontSize: '14px',
                    color: '#666',
                    lineHeight: '1.8',
                  }}
                >
                  {benefits.free_upgrades.map((upgrade, index) => (
                    <li key={index}>
                      {upgrade.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Special Benefits */}
          {benefits.special_benefits && benefits.special_benefits.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'start' }}>
              <div style={{ fontSize: '24px', marginRight: '12px' }}>✨</div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1a1a1a',
                    marginBottom: '8px',
                  }}
                >
                  Exclusive Perks
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: '20px',
                    fontSize: '14px',
                    color: '#666',
                    lineHeight: '1.8',
                  }}
                >
                  {benefits.special_benefits.map((benefit, index) => (
                    <li key={index}>{benefit}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CTA Button */}
      <EmailButton
        href={dashboardUrl}
        text="View Your Dashboard"
        backgroundColor={tierColor}
      />

      {/* Next Tier Preview */}
      {nextTier && (
        <div style={{ marginTop: '32px' }}>
          <EmailSection
            title={`Keep Going! ${nextTier.name} Tier Awaits`}
            backgroundColor="#fef3c7"
            padding="24px"
          >
            <p
              style={{
                fontSize: '14px',
                color: '#92400e',
                textAlign: 'center',
                margin: 0,
                lineHeight: '1.6',
              }}
            >
              You're only <strong>{nextTier.pointsNeeded.toLocaleString()} points</strong> away
              from reaching {nextTier.name} tier with even more exclusive benefits!
            </p>
            <div
              style={{
                marginTop: '16px',
                backgroundColor: '#fbbf24',
                height: '8px',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  backgroundColor: '#f59e0b',
                  height: '100%',
                  width: `${Math.min(100, ((nextTier.pointsRequired - nextTier.pointsNeeded) / nextTier.pointsRequired) * 100)}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </EmailSection>
        </div>
      )}

      {/* Thank You Message */}
      <div
        style={{
          marginTop: '32px',
          padding: '24px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: '16px',
            color: '#1a1a1a',
            margin: '0 0 12px 0',
            fontWeight: '500',
          }}
        >
          Thank you for being a valued customer!
        </p>
        <p
          style={{
            fontSize: '14px',
            color: '#666',
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          Your loyalty means the world to us. We're committed to providing you with the best
          carpet cleaning experience, and your {newTierName} status ensures you get the VIP
          treatment you deserve.
        </p>
      </div>

      {/* How to Use Benefits */}
      <div style={{ marginTop: '32px' }}>
        <h4
          style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1a1a1a',
            margin: '0 0 16px 0',
          }}
        >
          Using Your Benefits:
        </h4>
        <ol
          style={{
            fontSize: '14px',
            color: '#4a4a4a',
            lineHeight: '1.8',
            paddingLeft: '20px',
            margin: 0,
          }}
        >
          <li>Your discount is automatically applied to all bookings</li>
          <li>Free upgrades are available when scheduling your service</li>
          <li>Priority scheduling gives you first access to preferred time slots</li>
          <li>All benefits are active immediately</li>
        </ol>
      </div>

      {/* Footer Note */}
      <div
        style={{
          marginTop: '32px',
          padding: '20px',
          backgroundColor: '#eff6ff',
          borderRadius: '6px',
          borderLeft: '4px solid #3b82f6',
        }}
      >
        <p
          style={{
            fontSize: '14px',
            color: '#1e40af',
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          <strong>Pro Tip:</strong> Refer friends and family to earn even more points! Share your
          referral code and you'll both earn bonus points when they book their first service.
        </p>
      </div>

      {/* Support */}
      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <p
          style={{
            fontSize: '14px',
            color: '#666',
            margin: 0,
          }}
        >
          Questions about your {newTierName} benefits? Contact us at{' '}
          <a href="mailto:support@dirtfree.com" style={{ color: '#3b82f6' }}>
            support@dirtfree.com
          </a>
        </p>
      </div>
    </EmailTemplate>
  )
}

/**
 * Render tier upgrade email to HTML string
 */
export function renderTierUpgradeEmail(props: TierUpgradeEmailProps): string {
  const { renderToStaticMarkup } = require('react-dom/server')
  return renderToStaticMarkup(<TierUpgradeEmail {...props} />)
}
