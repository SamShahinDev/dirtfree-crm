/**
 * Integration Test Database Helpers
 *
 * Provides utilities for database setup, teardown, and test data management
 */

import { createClient } from '@/lib/supabase/server'

let testTransactionId: string | null = null

/**
 * Setup test database
 * Creates a transaction for test isolation
 */
export async function setupTestDatabase() {
  const supabase = await createClient()

  // Begin transaction for test isolation
  const { data: transaction, error } = await supabase.rpc('begin_test_transaction')

  if (error) {
    throw new Error(`Failed to setup test database: ${error.message}`)
  }

  testTransactionId = transaction?.id || null

  return { supabase, transactionId: testTransactionId }
}

/**
 * Teardown test database
 * Rolls back transaction to clean up test data
 */
export async function teardownTestDatabase() {
  if (!testTransactionId) {
    return
  }

  const supabase = await createClient()

  // Rollback transaction
  const { error } = await supabase.rpc('rollback_test_transaction', {
    transaction_id: testTransactionId,
  })

  if (error) {
    console.error('Failed to rollback test transaction:', error)
  }

  testTransactionId = null
}

/**
 * Clear all test data from specific tables
 */
export async function clearTestData(tables: string[]) {
  const supabase = await createClient()

  for (const table of tables) {
    await supabase.from(table).delete().ilike('id', 'test-%')
  }
}

/**
 * Create test customer
 */
export async function createTestCustomer(overrides = {}) {
  const supabase = await createClient()

  const customer = {
    id: `test-customer-${Date.now()}`,
    name: 'Test Customer',
    email: `test-${Date.now()}@example.com`,
    phone: '+15555551234',
    address: '123 Test St',
    city: 'Test City',
    state: 'CA',
    zip_code: '12345',
    source: 'test',
    ...overrides,
  }

  const { data, error } = await supabase.from('customers').insert(customer).select().single()

  if (error) {
    throw new Error(`Failed to create test customer: ${error.message}`)
  }

  return data
}

/**
 * Create test staff user
 */
export async function createTestStaff(overrides = {}) {
  const supabase = await createClient()

  const staff = {
    id: `test-staff-${Date.now()}`,
    email: `staff-${Date.now()}@example.com`,
    first_name: 'Test',
    last_name: 'Staff',
    phone: '+15555555678',
    role: 'admin',
    ...overrides,
  }

  const { data, error } = await supabase.from('users').insert(staff).select().single()

  if (error) {
    throw new Error(`Failed to create test staff: ${error.message}`)
  }

  return data
}

/**
 * Create test job
 */
export async function createTestJob(customerId: string, overrides = {}) {
  const supabase = await createClient()

  const job = {
    id: `test-job-${Date.now()}`,
    customer_id: customerId,
    service_type: 'Carpet Cleaning',
    status: 'scheduled',
    scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    zone: 'North',
    booking_source: 'portal',
    estimated_duration: 120,
    ...overrides,
  }

  const { data, error } = await supabase.from('jobs').insert(job).select().single()

  if (error) {
    throw new Error(`Failed to create test job: ${error.message}`)
  }

  return data
}

/**
 * Create test invoice
 */
export async function createTestInvoice(jobId: string, customerId: string, overrides = {}) {
  const supabase = await createClient()

  const invoice = {
    id: `test-invoice-${Date.now()}`,
    invoice_number: `TEST-INV-${Date.now()}`,
    job_id: jobId,
    customer_id: customerId,
    status: 'pending',
    subtotal: 100.0,
    tax_amount: 8.0,
    total_amount: 108.0,
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }

  const { data, error } = await supabase.from('invoices').insert(invoice).select().single()

  if (error) {
    throw new Error(`Failed to create test invoice: ${error.message}`)
  }

  return data
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait for condition to be true
 */
export async function waitForCondition(
  conditionFn: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await conditionFn()) {
      return
    }
    await waitForAsync(interval)
  }

  throw new Error('Condition not met within timeout')
}

/**
 * Mock authentication context
 */
export function mockAuthContext(userId: string, role = 'customer') {
  return {
    user: {
      id: userId,
      email: `${userId}@example.com`,
      role,
    },
  }
}

/**
 * Create test promotion
 */
export async function createTestPromotion(overrides = {}) {
  const supabase = await createClient()

  const promotion = {
    id: `test-promo-${Date.now()}`,
    code: `TEST${Date.now()}`,
    description: 'Test promotion',
    discount_type: 'percentage',
    discount_value: 20,
    valid_from: new Date().toISOString(),
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    active: true,
    max_uses: 100,
    current_uses: 0,
    ...overrides,
  }

  const { data, error } = await supabase.from('promotions').insert(promotion).select().single()

  if (error) {
    throw new Error(`Failed to create test promotion: ${error.message}`)
  }

  return data
}

/**
 * Verify email was sent
 */
export async function verifyEmailSent(
  recipientEmail: string,
  subject: string,
  timeout = 5000
): Promise<boolean> {
  // In real implementation, this would check email queue or mock email service
  // For tests, we can check email_logs table
  const supabase = await createClient()

  return waitForCondition(async () => {
    const { data } = await supabase
      .from('email_logs')
      .select('*')
      .eq('recipient_email', recipientEmail)
      .ilike('subject', `%${subject}%`)
      .single()

    return !!data
  }, timeout)
}

/**
 * Verify SMS was sent
 */
export async function verifySmsSent(
  recipientPhone: string,
  timeout = 5000
): Promise<boolean> {
  const supabase = await createClient()

  return waitForCondition(async () => {
    const { data } = await supabase
      .from('sms_logs')
      .select('*')
      .eq('recipient_phone', recipientPhone)
      .single()

    return !!data
  }, timeout)
}
