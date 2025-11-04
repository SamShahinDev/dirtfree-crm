import React from 'react'
import { EmailTemplate, EmailButton, EmailSection } from './base'

/**
 * Achievement Unlocked Email Template
 *
 * Celebratory email template for customers who have unlocked a new achievement/badge.
 * Includes achievement details, badge visualization, points awarded, and next achievement preview.
 */

interface AchievementUnlockedEmailProps {
  customerName: string
  achievement: {
    name: string
    description: string
    type: 'milestone' | 'streak' | 'referral' | 'review' | 'social'
    rarity: 'common' | 'rare' | 'epic' | 'legendary'
    iconUrl?: string
    badgeColor?: string
  }
  pointsAwarded: number
  currentTotalPoints: number
  nextAchievement?: {
    name: string
    description: string
    progress: {
      current: number
      required: number
      percentage: number
    }
  }
}

export function AchievementUnlockedEmail({
  customerName,
  achievement,
  pointsAwarded,
  currentTotalPoints,
  nextAchievement,
}: AchievementUnlockedEmailProps) {
  // Rarity colors
  const rarityColors: Record<string, { bg: string; text: string; border: string }> = {
    common: {
      bg: '#f1f5f9',
      text: '#475569',
      border: '#94a3b8',
    },
    rare: {
      bg: '#eff6ff',
      text: '#1e40af',
      border: '#3b82f6',
    },
    epic: {
      bg: '#faf5ff',
      text: '#6b21a8',
      border: '#a855f7',
    },
    legendary: {
      bg: '#fffbeb',
      text: '#92400e',
      border: '#f59e0b',
    },
  }

  // Achievement type icons
  const typeEmojis: Record<string, string> = {
    milestone: '🎯',
    streak: '🔥',
    referral: '👥',
    review: '⭐',
    social: '📱',
  }

  const rarityConfig = rarityColors[achievement.rarity] || rarityColors.common
  const typeEmoji = typeEmojis[achievement.type] || '🏆'
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.dirtfree.com'}/dashboard`

  return (
    <EmailTemplate
      title={`Achievement Unlocked: ${achievement.name}!`}
      preheader={`You've unlocked the ${achievement.name} achievement and earned ${pointsAwarded} points!`}
    >
      {/* Celebration Header */}
      <div
        style={{
          backgroundColor: rarityConfig.bg,
          borderLeft: `4px solid ${rarityConfig.border}`,
          padding: '32px',
          borderRadius: '12px',
          textAlign: 'center',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            fontSize: '64px',
            marginBottom: '16px',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          🎉
        </div>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            margin: '0 0 12px 0',
            color: '#1a1a1a',
          }}
        >
          Achievement Unlocked!
        </h1>
        <p
          style={{
            fontSize: '16px',
            margin: 0,
            color: '#4a4a4a',
          }}
        >
          Congratulations, {customerName}!
        </p>
      </div>

      {/* Achievement Badge */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: `3px solid ${rarityConfig.border}`,
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
          marginBottom: '32px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        {/* Badge Icon */}
        <div
          style={{
            display: 'inline-block',
            backgroundColor: rarityConfig.bg,
            borderRadius: '50%',
            width: '120px',
            height: '120px',
            lineHeight: '120px',
            marginBottom: '20px',
            border: `2px solid ${rarityConfig.border}`,
          }}
        >
          <div
            style={{
              fontSize: '64px',
            }}
          >
            {typeEmoji}
          </div>
        </div>

        {/* Achievement Name */}
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#1a1a1a',
            margin: '0 0 8px 0',
          }}
        >
          {achievement.name}
        </h2>

        {/* Rarity Badge */}
        <div
          style={{
            display: 'inline-block',
            backgroundColor: rarityConfig.bg,
            color: rarityConfig.text,
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '16px',
            border: `1px solid ${rarityConfig.border}`,
          }}
        >
          {achievement.rarity}
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '14px',
            color: '#666',
            lineHeight: '1.6',
            margin: '0 0 20px 0',
          }}
        >
          {achievement.description}
        </p>

        {/* Achievement Type */}
        <div
          style={{
            fontSize: '13px',
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontWeight: '600',
          }}
        >
          {achievement.type.replace('_', ' ')} Achievement
        </div>
      </div>

      {/* Points Awarded Section */}
      <EmailSection title="Points Awarded!" backgroundColor="#f0fdf4" padding="24px">
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#10b981',
              margin: '0 0 8px 0',
            }}
          >
            +{pointsAwarded.toLocaleString()}
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

      {/* What This Means */}
      <div style={{ marginTop: '32px' }}>
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#1a1a1a',
            margin: '0 0 16px 0',
          }}
        >
          Why This Matters
        </h3>
        <div
          style={{
            backgroundColor: '#f8fafc',
            padding: '20px',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#4a4a4a',
            lineHeight: '1.6',
          }}
        >
          <ul
            style={{
              margin: 0,
              paddingLeft: '20px',
            }}
          >
            <li style={{ marginBottom: '8px' }}>
              Your achievement points count toward your loyalty tier
            </li>
            <li style={{ marginBottom: '8px' }}>
              Unlock exclusive rewards and benefits as you progress
            </li>
            <li style={{ marginBottom: '8px' }}>
              Show off your badges to friends and family
            </li>
            <li>Keep collecting achievements to become a Legend!</li>
          </ul>
        </div>
      </div>

      {/* CTA Button */}
      <EmailButton
        href={dashboardUrl}
        text="View Your Achievements"
        backgroundColor={rarityConfig.border}
      />

      {/* Next Achievement Preview */}
      {nextAchievement && (
        <div style={{ marginTop: '32px' }}>
          <EmailSection
            title="Keep Going! Next Achievement"
            backgroundColor="#fef3c7"
            padding="24px"
          >
            <div style={{ marginBottom: '16px' }}>
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#92400e',
                  margin: '0 0 8px 0',
                }}
              >
                {nextAchievement.name}
              </h4>
              <p
                style={{
                  fontSize: '14px',
                  color: '#78350f',
                  margin: '0 0 16px 0',
                }}
              >
                {nextAchievement.description}
              </p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  color: '#92400e',
                  marginBottom: '8px',
                }}
              >
                <span>
                  Progress: {nextAchievement.progress.current} / {nextAchievement.progress.required}
                </span>
                <span>{nextAchievement.progress.percentage}%</span>
              </div>
              <div
                style={{
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
                    width: `${nextAchievement.progress.percentage}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            <p
              style={{
                fontSize: '13px',
                color: '#78350f',
                margin: 0,
                textAlign: 'center',
              }}
            >
              Only {nextAchievement.progress.required - nextAchievement.progress.current} more to
              go!
            </p>
          </EmailSection>
        </div>
      )}

      {/* Achievement Types Grid */}
      <div style={{ marginTop: '32px' }}>
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#1a1a1a',
            margin: '0 0 16px 0',
            textAlign: 'center',
          }}
        >
          Achievement Categories
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
          }}
        >
          {[
            { type: 'milestone', emoji: '🎯', label: 'Milestones', desc: 'Service count goals' },
            { type: 'streak', emoji: '🔥', label: 'Streaks', desc: 'Consistent booking' },
            { type: 'referral', emoji: '👥', label: 'Referrals', desc: 'Share with friends' },
            { type: 'review', emoji: '⭐', label: 'Reviews', desc: 'Leave feedback' },
          ].map((category) => (
            <div
              key={category.type}
              style={{
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '8px',
                textAlign: 'center',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{category.emoji}</div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1a1a1a',
                  marginBottom: '4px',
                }}
              >
                {category.label}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>{category.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Motivational Footer */}
      <div
        style={{
          marginTop: '32px',
          padding: '24px',
          backgroundColor: '#eff6ff',
          borderRadius: '8px',
          textAlign: 'center',
          borderLeft: '4px solid #3b82f6',
        }}
      >
        <p
          style={{
            fontSize: '16px',
            color: '#1e40af',
            margin: '0 0 8px 0',
            fontWeight: '500',
          }}
        >
          You're doing amazing! 🌟
        </p>
        <p
          style={{
            fontSize: '14px',
            color: '#1e3a8a',
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          Every achievement brings you closer to exclusive rewards and recognition. Keep up the
          great work, and thank you for being such a valued customer!
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
          Questions about your achievements? Contact us at{' '}
          <a href="mailto:support@dirtfree.com" style={{ color: '#3b82f6' }}>
            support@dirtfree.com
          </a>
        </p>
      </div>
    </EmailTemplate>
  )
}

/**
 * Render achievement unlocked email to HTML string
 */
export function renderAchievementUnlockedEmail(
  props: AchievementUnlockedEmailProps
): string {
  const { renderToStaticMarkup } = require('react-dom/server')
  return renderToStaticMarkup(<AchievementUnlockedEmail {...props} />)
}
