/**
 * Twilio Mock Utilities
 *
 * Provides mock implementations of Twilio SDK for testing
 */

export const createMockTwilioClient = () => ({
  messages: {
    create: jest.fn().mockResolvedValue({
      sid: 'SM_test123',
      status: 'queued',
      to: '+15555551234',
      from: '+15555559999',
      body: 'Test message',
      dateCreated: new Date(),
    }),
    fetch: jest.fn().mockResolvedValue({
      sid: 'SM_test123',
      status: 'delivered',
      to: '+15555551234',
      from: '+15555559999',
      body: 'Test message',
    }),
  },
  calls: {
    create: jest.fn().mockResolvedValue({
      sid: 'CA_test123',
      status: 'queued',
      to: '+15555551234',
      from: '+15555559999',
    }),
  },
  verify: {
    v2: {
      services: jest.fn(() => ({
        verifications: {
          create: jest.fn().mockResolvedValue({
            sid: 'VE_test123',
            status: 'pending',
            to: '+15555551234',
            channel: 'sms',
          }),
        },
        verificationChecks: {
          create: jest.fn().mockResolvedValue({
            sid: 'VE_test123',
            status: 'approved',
            to: '+15555551234',
          }),
        },
      })),
    },
  },
})

/**
 * Mock successful SMS send
 */
export const mockSuccessfulSMS = () => ({
  sid: 'SM_test123',
  status: 'delivered',
  to: '+15555551234',
  from: '+15555559999',
  body: 'Test SMS message',
  numSegments: '1',
  price: '-0.00750',
  priceUnit: 'USD',
  dateCreated: new Date(),
  dateSent: new Date(),
  dateUpdated: new Date(),
})

/**
 * Mock failed SMS send
 */
export const mockFailedSMS = () => ({
  sid: 'SM_test456',
  status: 'failed',
  to: '+15555551234',
  from: '+15555559999',
  body: 'Test SMS message',
  errorCode: 30003,
  errorMessage: 'Unreachable destination handset',
})

/**
 * Mock Twilio webhook request
 */
export const mockTwilioWebhook = (messageSid: string, messageStatus: string) => ({
  MessageSid: messageSid,
  MessageStatus: messageStatus,
  To: '+15555551234',
  From: '+15555559999',
  Body: 'Test message',
  AccountSid: 'AC_test123',
})

/**
 * Mock Twilio error
 */
export const mockTwilioError = (message: string, code = 21211) => {
  const error: any = new Error(message)
  error.code = code
  error.status = 400
  error.moreInfo = `https://www.twilio.com/docs/errors/${code}`
  return error
}

/**
 * Mock phone number lookup
 */
export const mockPhoneLookup = (isValid = true) => ({
  phoneNumber: '+15555551234',
  countryCode: 'US',
  nationalFormat: '(555) 555-1234',
  valid: isValid,
  carrier: {
    mobile_country_code: '310',
    mobile_network_code: '150',
    name: 'T-Mobile USA, Inc.',
    type: 'mobile',
    error_code: null,
  },
})
