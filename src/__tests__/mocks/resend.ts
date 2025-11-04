/**
 * Resend Mock Utilities
 *
 * Provides mock implementations of Resend SDK for testing
 */

export const createMockResendClient = () => ({
  emails: {
    send: jest.fn().mockResolvedValue({
      id: 're_test123',
      from: 'noreply@example.com',
      to: ['test@example.com'],
      created_at: new Date().toISOString(),
    }),
    get: jest.fn().mockResolvedValue({
      id: 're_test123',
      from: 'noreply@example.com',
      to: ['test@example.com'],
      subject: 'Test Email',
      html: '<p>Test content</p>',
      created_at: new Date().toISOString(),
      last_event: 'delivered',
    }),
    cancel: jest.fn().mockResolvedValue({
      id: 're_test123',
      object: 'email',
    }),
  },
  batch: {
    send: jest.fn().mockResolvedValue({
      data: [
        { id: 're_test123' },
        { id: 're_test124' },
      ],
    }),
  },
  domains: {
    create: jest.fn().mockResolvedValue({
      id: 'd_test123',
      name: 'example.com',
      status: 'pending',
      region: 'us-east-1',
      created_at: new Date().toISOString(),
    }),
    verify: jest.fn().mockResolvedValue({
      id: 'd_test123',
      status: 'verified',
    }),
  },
  audiences: {
    create: jest.fn().mockResolvedValue({
      id: 'aud_test123',
      name: 'Newsletter Subscribers',
      created_at: new Date().toISOString(),
    }),
    addContact: jest.fn().mockResolvedValue({
      id: 'con_test123',
      email: 'test@example.com',
    }),
  },
})

/**
 * Mock successful email send
 */
export const mockSuccessfulEmail = () => ({
  id: 're_test123',
  from: 'noreply@example.com',
  to: ['customer@example.com'],
  subject: 'Your Service Appointment',
  html: '<p>Thank you for your booking!</p>',
  created_at: new Date().toISOString(),
})

/**
 * Mock failed email send
 */
export const mockFailedEmail = () => {
  const error: any = new Error('Invalid email address')
  error.statusCode = 422
  error.name = 'validation_error'
  return error
}

/**
 * Mock email webhook event
 */
export const mockResendWebhook = (type: string, emailId: string) => ({
  type, // 'email.sent', 'email.delivered', 'email.bounced', etc.
  created_at: new Date().toISOString(),
  data: {
    email_id: emailId,
    from: 'noreply@example.com',
    to: ['customer@example.com'],
    subject: 'Test Email',
    created_at: new Date().toISOString(),
  },
})

/**
 * Mock batch email send
 */
export const mockBatchEmailSend = (count: number) => ({
  data: Array.from({ length: count }, (_, i) => ({
    id: `re_test${i + 1}`,
  })),
})

/**
 * Mock email template
 */
export const mockEmailTemplate = (templateId: string) => ({
  id: templateId,
  name: 'Service Confirmation',
  subject: 'Your Service Appointment - {{customerName}}',
  html: '<p>Dear {{customerName}},</p><p>Your appointment is scheduled for {{date}}.</p>',
  text: 'Dear {{customerName}}, Your appointment is scheduled for {{date}}.',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})
