/**
 * Stripe Mock Utilities
 *
 * Provides mock implementations of Stripe SDK for testing
 */

export const createMockStripeClient = () => ({
  customers: {
    create: jest.fn().mockResolvedValue({
      id: 'cus_test123',
      email: 'test@example.com',
      created: Math.floor(Date.now() / 1000),
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'cus_test123',
      email: 'test@example.com',
      name: 'Test Customer',
    }),
    update: jest.fn().mockResolvedValue({
      id: 'cus_test123',
      email: 'updated@example.com',
    }),
    del: jest.fn().mockResolvedValue({
      id: 'cus_test123',
      deleted: true,
    }),
  },
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'pi_test123',
      client_secret: 'pi_test123_secret_test',
      amount: 10000,
      currency: 'usd',
      status: 'requires_payment_method',
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'pi_test123',
      amount: 10000,
      currency: 'usd',
      status: 'succeeded',
    }),
    confirm: jest.fn().mockResolvedValue({
      id: 'pi_test123',
      status: 'succeeded',
    }),
    cancel: jest.fn().mockResolvedValue({
      id: 'pi_test123',
      status: 'canceled',
    }),
  },
  paymentMethods: {
    create: jest.fn().mockResolvedValue({
      id: 'pm_test123',
      type: 'card',
      card: {
        brand: 'visa',
        last4: '4242',
        exp_month: 12,
        exp_year: 2025,
      },
    }),
    attach: jest.fn().mockResolvedValue({
      id: 'pm_test123',
      customer: 'cus_test123',
    }),
    detach: jest.fn().mockResolvedValue({
      id: 'pm_test123',
      customer: null,
    }),
  },
  invoices: {
    create: jest.fn().mockResolvedValue({
      id: 'in_test123',
      customer: 'cus_test123',
      amount_due: 10000,
      status: 'open',
    }),
    retrieve: jest.fn().mockResolvedValue({
      id: 'in_test123',
      amount_due: 10000,
      status: 'paid',
    }),
    pay: jest.fn().mockResolvedValue({
      id: 'in_test123',
      status: 'paid',
      paid: true,
    }),
  },
  refunds: {
    create: jest.fn().mockResolvedValue({
      id: 're_test123',
      amount: 5000,
      status: 'succeeded',
      payment_intent: 'pi_test123',
    }),
  },
  webhookEndpoints: {
    create: jest.fn().mockResolvedValue({
      id: 'we_test123',
      url: 'https://example.com/webhook',
      enabled_events: ['payment_intent.succeeded'],
    }),
  },
})

/**
 * Mock successful payment intent
 */
export const mockSuccessfulPayment = () => ({
  id: 'pi_test123',
  object: 'payment_intent',
  amount: 10000,
  currency: 'usd',
  status: 'succeeded',
  client_secret: 'pi_test123_secret_test',
  customer: 'cus_test123',
  payment_method: 'pm_test123',
})

/**
 * Mock failed payment intent
 */
export const mockFailedPayment = () => ({
  id: 'pi_test456',
  object: 'payment_intent',
  amount: 10000,
  currency: 'usd',
  status: 'requires_payment_method',
  last_payment_error: {
    message: 'Your card was declined.',
    code: 'card_declined',
  },
})

/**
 * Mock Stripe webhook event
 */
export const mockStripeWebhookEvent = (type: string, data: any) => ({
  id: 'evt_test123',
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  type,
  data: {
    object: data,
  },
  livemode: false,
})

/**
 * Mock Stripe error
 */
export const mockStripeError = (
  message: string,
  type = 'StripeCardError',
  code = 'card_declined'
) => {
  const error: any = new Error(message)
  error.type = type
  error.code = code
  error.statusCode = 402
  return error
}
