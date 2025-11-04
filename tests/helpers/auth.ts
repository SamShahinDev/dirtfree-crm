/**
 * E2E Test Authentication Helpers
 *
 * Provides utilities for authentication in E2E tests
 */

import { Page } from '@playwright/test'

/**
 * Login as staff user
 */
export async function loginAsStaff(page: Page, role: 'admin' | 'manager' | 'dispatcher' = 'admin') {
  await page.goto('/login')

  const credentials = {
    admin: { email: 'admin@dirtfree.com', password: 'testpass123' },
    manager: { email: 'manager@dirtfree.com', password: 'testpass123' },
    dispatcher: { email: 'dispatcher@dirtfree.com', password: 'testpass123' },
  }

  const { email, password } = credentials[role]

  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

/**
 * Login as customer
 */
export async function loginAsCustomer(page: Page, email = 'customer@example.com', password = 'testpass123') {
  await page.goto('/login')
  await page.fill('[name="email"]', email)
  await page.fill('[name="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/portal')
}

/**
 * Logout
 */
export async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]')
  await page.click('button:has-text("Logout")')
  await page.waitForURL('/login')
}

/**
 * Check if authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('[data-testid="user-menu"]', { timeout: 1000 })
    return true
  } catch {
    return false
  }
}
