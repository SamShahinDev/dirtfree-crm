import React from 'react'

interface EmailTemplateProps {
  title: string
  preheader?: string
  children: React.ReactNode
  footerText?: string
}

export function EmailTemplate({
  title,
  preheader,
  children,
  footerText = '© 2024 Dirt Free CRM. All rights reserved.'
}: EmailTemplateProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {preheader && (
          <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>
            {preheader}
          </div>
        )}
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#f4f4f4'
      }}>
        <table width="100%" cellPadding={0} cellSpacing={0}>
          <tr>
            <td align="center" style={{ padding: '40px 0' }}>
              <table width="600" cellPadding={0} cellSpacing={0} style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <tr>
                  <td style={{ padding: '40px' }}>
                    {/* Logo */}
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                      <h1 style={{ color: '#1a1a1a', margin: 0 }}>Dirt Free CRM</h1>
                    </div>

                    {/* Content */}
                    {children}

                    {/* Footer */}
                    <div style={{
                      marginTop: '40px',
                      paddingTop: '32px',
                      borderTop: '1px solid #e5e5e5',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: '#666'
                    }}>
                      <p>{footerText}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  )
}

// Email Button Component
interface EmailButtonProps {
  href: string
  text: string
  backgroundColor?: string
  textColor?: string
}

export function EmailButton({
  href,
  text,
  backgroundColor = '#3b82f6',
  textColor = '#ffffff'
}: EmailButtonProps) {
  return (
    <div style={{ textAlign: 'center', marginTop: '32px' }}>
      <a href={href} style={{
        display: 'inline-block',
        padding: '12px 24px',
        backgroundColor,
        color: textColor,
        textDecoration: 'none',
        borderRadius: '6px',
        fontWeight: '500'
      }}>
        {text}
      </a>
    </div>
  )
}

// Email Section Component
interface EmailSectionProps {
  title?: string
  children: React.ReactNode
  backgroundColor?: string
  padding?: string
}

export function EmailSection({
  title,
  children,
  backgroundColor = '#f8f8f8',
  padding = '20px'
}: EmailSectionProps) {
  return (
    <div style={{
      backgroundColor,
      padding,
      borderRadius: '6px',
      marginBottom: '24px'
    }}>
      {title && (
        <h3 style={{
          margin: '0 0 16px 0',
          color: '#1a1a1a',
          fontSize: '16px'
        }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

// Email List Component
interface EmailListProps {
  items: string[]
  ordered?: boolean
}

export function EmailList({ items, ordered = false }: EmailListProps) {
  const Tag = ordered ? 'ol' : 'ul'

  return (
    <Tag style={{
      color: '#4a4a4a',
      lineHeight: '1.8',
      paddingLeft: '20px',
      margin: '16px 0'
    }}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </Tag>
  )
}