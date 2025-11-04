import React from 'react'
import { EmailTemplate, EmailButton, EmailSection } from './base'

interface JobReminderTemplateProps {
  customerName: string
  jobDate: string
  jobTime: string
  address: string
  services: string[]
  technicianName?: string
  technicianPhone?: string
  estimatedDuration?: string
  specialInstructions?: string
  rescheduleUrl?: string
  cancelUrl?: string
}

export function JobReminderTemplate({
  customerName,
  jobDate,
  jobTime,
  address,
  services,
  technicianName,
  technicianPhone,
  estimatedDuration,
  specialInstructions,
  rescheduleUrl,
  cancelUrl
}: JobReminderTemplateProps) {
  return (
    <EmailTemplate
      title="Service Reminder"
      preheader={`Reminder: Your service is scheduled for ${jobDate} at ${jobTime}`}
    >
      <h2 style={{ color: '#1a1a1a', marginBottom: '24px' }}>
        Service Reminder
      </h2>

      <p style={{ color: '#4a4a4a', lineHeight: '1.6', marginBottom: '24px' }}>
        Hi {customerName},
      </p>

      <p style={{ color: '#4a4a4a', lineHeight: '1.6', marginBottom: '24px' }}>
        This is a friendly reminder that your service is scheduled for tomorrow.
      </p>

      <EmailSection title="Appointment Details">
        <p style={{ margin: '0 0 8px 0', color: '#1a1a1a' }}>
          <strong>Date:</strong> {jobDate}
        </p>
        <p style={{ margin: '0 0 8px 0', color: '#1a1a1a' }}>
          <strong>Time:</strong> {jobTime}
        </p>
        <p style={{ margin: '0 0 8px 0', color: '#1a1a1a' }}>
          <strong>Location:</strong> {address}
        </p>
        {estimatedDuration && (
          <p style={{ margin: '0 0 8px 0', color: '#1a1a1a' }}>
            <strong>Estimated Duration:</strong> {estimatedDuration}
          </p>
        )}
        <p style={{ margin: '0', color: '#1a1a1a' }}>
          <strong>Services:</strong> {services.join(', ')}
        </p>
      </EmailSection>

      {technicianName && (
        <EmailSection title="Your Technician">
          <p style={{ margin: '0 0 8px 0', color: '#1a1a1a' }}>
            <strong>Name:</strong> {technicianName}
          </p>
          {technicianPhone && (
            <p style={{ margin: '0', color: '#1a1a1a' }}>
              <strong>Contact:</strong> {technicianPhone}
            </p>
          )}
          <p style={{ margin: '12px 0 0 0', color: '#666', fontSize: '14px' }}>
            Your technician will arrive within the scheduled time window.
            You'll receive a notification when they're on their way.
          </p>
        </EmailSection>
      )}

      {specialInstructions && (
        <EmailSection title="Special Instructions" backgroundColor="#fff3cd">
          <p style={{ margin: '0', color: '#856404' }}>
            {specialInstructions}
          </p>
        </EmailSection>
      )}

      <div style={{ marginTop: '32px', marginBottom: '32px' }}>
        <h3 style={{ color: '#1a1a1a', fontSize: '16px', marginBottom: '16px' }}>
          Preparation Checklist:
        </h3>
        <ul style={{ color: '#4a4a4a', lineHeight: '1.8', paddingLeft: '20px' }}>
          <li>Clear the service area of personal items</li>
          <li>Ensure pets are secured in a safe area</li>
          <li>Have parking available for our service vehicle</li>
          <li>Be available during the scheduled time window</li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        {rescheduleUrl && (
          <EmailButton
            href={rescheduleUrl}
            text="Reschedule"
            backgroundColor="#6c757d"
          />
        )}
        {cancelUrl && (
          <EmailButton
            href={cancelUrl}
            text="Cancel"
            backgroundColor="#dc3545"
          />
        )}
      </div>

      <p style={{
        color: '#666',
        fontSize: '14px',
        lineHeight: '1.6',
        marginTop: '32px',
        textAlign: 'center'
      }}>
        If you have any questions or need to make changes, please contact us at
        support@dirtfreecrm.com or call (555) 123-4567.
      </p>
    </EmailTemplate>
  )
}

export function renderJobReminderTemplate(props: JobReminderTemplateProps): string {
  const ReactDOMServer = require('react-dom/server')
  return ReactDOMServer.renderToStaticMarkup(<JobReminderTemplate {...props} />)
}