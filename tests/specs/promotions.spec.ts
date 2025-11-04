/**
 * Promotions Management E2E Tests
 *
 * Tests promotion creation, delivery, and performance tracking
 */

import { test, expect } from '@playwright/test'
import { loginAsStaff, logout } from '../helpers/auth'

test.describe('Promotions Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as staff user with admin role
    await loginAsStaff(page, 'admin')
  })

  test.afterEach(async ({ page }) => {
    await logout(page)
  })

  test('creates new promotion', async ({ page }) => {
    // Navigate to promotions page
    await page.goto('/dashboard/promotions')
    await expect(page.locator('h1:has-text("Promotions")')).toBeVisible()

    // Click new promotion button
    await page.click('button:has-text("New Promotion")')

    // Fill promotion form
    await page.fill('[name="name"]', 'Spring Cleaning Special')
    await page.fill('[name="description"]', '20% off all carpet cleaning services')
    await page.fill('[name="code"]', 'SPRING20')

    // Select discount type
    await page.selectOption('[name="discount_type"]', 'percentage')
    await page.fill('[name="discount_value"]', '20')

    // Set validity dates
    await page.fill('[name="start_date"]', '2025-03-01')
    await page.fill('[name="end_date"]', '2025-04-30')

    // Set usage limits
    await page.fill('[name="max_uses"]', '100')
    await page.fill('[name="max_uses_per_customer"]', '1')

    // Select eligible services
    await page.check('[name="eligible_services[]"][value="carpet_cleaning"]')
    await page.check('[name="eligible_services[]"][value="upholstery"]')

    // Set minimum purchase amount
    await page.fill('[name="minimum_amount"]', '100')

    // Select customer segments
    await page.selectOption('[name="target_segment"]', 'all_customers')

    // Set auto-apply option
    await page.check('[name="auto_apply"]')

    // Submit form
    await page.click('button:has-text("Create Promotion")')

    // Verify success message
    await expect(page.locator('text=Promotion created successfully')).toBeVisible()

    // Verify promotion appears in list
    await expect(page.locator('text=Spring Cleaning Special')).toBeVisible()
    await expect(page.locator('text=SPRING20')).toBeVisible()
    await expect(page.locator('text=20%')).toBeVisible()
  })

  test('delivers promotion via email', async ({ page }) => {
    // Navigate to promotions page
    await page.goto('/dashboard/promotions')

    // Click on promotion
    await page.click('tr:has-text("Spring Cleaning Special")')

    // Click send promotion button
    await page.click('button:has-text("Send Promotion")')

    // Select delivery method
    await page.check('[name="delivery_method"][value="email"]')

    // Select recipient segment
    await page.selectOption('[name="recipient_segment"]', 'active_customers')

    // Customize email template
    await page.fill('[name="email_subject"]', 'Exclusive Spring Cleaning Offer - 20% Off!')
    await page.fill('[name="email_body"]', 'Dear valued customer, enjoy 20% off all carpet cleaning services this spring!')

    // Preview email
    await page.click('button:has-text("Preview")')
    await expect(page.locator('[data-testid="email-preview"]')).toBeVisible()
    await page.click('button:has-text("Close Preview")')

    // Schedule or send immediately
    await page.check('[name="send_timing"][value="immediate"]')

    // Confirm send
    await page.click('button:has-text("Send Now")')

    // Verify confirmation dialog
    await expect(page.locator('text=Send promotion to')).toBeVisible()
    await page.click('button:has-text("Confirm Send")')

    // Verify success message
    await expect(page.locator('text=Promotion sent successfully')).toBeVisible()

    // Verify delivery log
    await expect(page.locator('text=Email sent to')).toBeVisible()
  })

  test('delivers promotion via SMS', async ({ page }) => {
    // Navigate to promotions page
    await page.goto('/dashboard/promotions')

    // Click on promotion
    await page.click('tr:has-text("Spring Cleaning Special")')

    // Click send promotion button
    await page.click('button:has-text("Send Promotion")')

    // Select delivery method
    await page.check('[name="delivery_method"][value="sms"]')

    // Select recipient segment
    await page.selectOption('[name="recipient_segment"]', 'opted_in_sms')

    // Customize SMS message
    await page.fill('[name="sms_message"]', 'Spring Special! Get 20% off carpet cleaning with code SPRING20. Valid until 4/30. Book now!')

    // Verify character count
    await expect(page.locator('[data-testid="sms-char-count"]')).toHaveText(/\d+ \/ 160/)

    // Schedule send
    await page.check('[name="send_timing"][value="scheduled"]')
    await page.fill('[name="scheduled_date"]', '2025-03-01')
    await page.fill('[name="scheduled_time"]', '09:00')

    // Confirm send
    await page.click('button:has-text("Schedule SMS")')

    // Verify success message
    await expect(page.locator('text=SMS promotion scheduled')).toBeVisible()
  })

  test('tracks promotion performance', async ({ page }) => {
    // Navigate to promotions page
    await page.goto('/dashboard/promotions')

    // Click on promotion
    await page.click('tr:has-text("Spring Cleaning Special")')

    // Navigate to performance tab
    await page.click('button:has-text("Performance")')

    // Verify metrics are displayed
    await expect(page.locator('[data-metric="total-uses"]')).toBeVisible()
    await expect(page.locator('[data-metric="total-revenue"]')).toBeVisible()
    await expect(page.locator('[data-metric="total-discount"]')).toBeVisible()
    await expect(page.locator('[data-metric="conversion-rate"]')).toBeVisible()

    // Verify performance chart
    await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible()

    // Check usage breakdown
    await expect(page.locator('text=Usage by Service')).toBeVisible()
    await expect(page.locator('[data-service="carpet_cleaning"]')).toBeVisible()

    // Check customer breakdown
    await expect(page.locator('text=Customer Breakdown')).toBeVisible()
    await expect(page.locator('text=New Customers')).toBeVisible()
    await expect(page.locator('text=Returning Customers')).toBeVisible()

    // Export performance report
    await page.click('button:has-text("Export Report")')
    await page.selectOption('[name="export_format"]', 'csv')
    await page.click('button:has-text("Download")')

    // Verify download initiated (check for download event)
    const downloadPromise = page.waitForEvent('download')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('promotion-performance')
  })

  test('applies promotion code during booking', async ({ page }) => {
    // Navigate to new booking page
    await page.goto('/dashboard/jobs/new')

    // Fill customer information
    await page.fill('[name="customer_name"]', 'Jane Doe')
    await page.fill('[name="email"]', 'jane@example.com')
    await page.fill('[name="phone"]', '+15559876543')

    // Select service
    await page.selectOption('[name="service_type"]', 'Carpet Cleaning')

    // Fill service details
    await page.fill('[name="estimated_amount"]', '150')

    // Apply promotion code
    await page.fill('[name="promotion_code"]', 'SPRING20')
    await page.click('button:has-text("Apply Code")')

    // Verify discount applied
    await expect(page.locator('text=Discount Applied')).toBeVisible()
    await expect(page.locator('[data-testid="discount-amount"]')).toHaveText('$30.00')
    await expect(page.locator('[data-testid="total-amount"]')).toHaveText('$120.00')

    // Complete booking
    await page.fill('[name="scheduled_date"]', '2025-03-15')
    await page.click('button:has-text("Create Booking")')

    // Verify booking created with promotion
    await expect(page.locator('text=Booking created successfully')).toBeVisible()
    await expect(page.locator('text=SPRING20')).toBeVisible()
  })

  test('validates promotion code constraints', async ({ page }) => {
    // Navigate to new booking page
    await page.goto('/dashboard/jobs/new')

    // Fill minimum required fields
    await page.fill('[name="customer_name"]', 'Test Customer')
    await page.fill('[name="email"]', 'test@example.com')
    await page.selectOption('[name="service_type"]', 'Carpet Cleaning')
    await page.fill('[name="estimated_amount"]', '50')

    // Try to apply promotion (below minimum amount)
    await page.fill('[name="promotion_code"]', 'SPRING20')
    await page.click('button:has-text("Apply Code")')

    // Verify error message
    await expect(page.locator('text=Minimum purchase amount is $100')).toBeVisible()

    // Update amount to meet minimum
    await page.fill('[name="estimated_amount"]', '100')
    await page.click('button:has-text("Apply Code")')

    // Verify code applied successfully
    await expect(page.locator('text=Discount Applied')).toBeVisible()
  })

  test('deactivates expired promotion', async ({ page }) => {
    // Navigate to promotions page
    await page.goto('/dashboard/promotions')

    // Filter expired promotions
    await page.selectOption('[name="status_filter"]', 'expired')

    // Click on expired promotion
    await page.click('tr:first-child')

    // Verify expired status
    await expect(page.locator('[data-status="expired"]')).toBeVisible()

    // Deactivate promotion
    await page.click('button:has-text("Deactivate")')

    // Confirm deactivation
    await page.click('button:has-text("Confirm")')

    // Verify deactivation success
    await expect(page.locator('text=Promotion deactivated')).toBeVisible()
    await expect(page.locator('[data-status="inactive"]')).toBeVisible()
  })

  test('clones existing promotion', async ({ page }) => {
    // Navigate to promotions page
    await page.goto('/dashboard/promotions')

    // Click on promotion
    await page.click('tr:has-text("Spring Cleaning Special")')

    // Click clone button
    await page.click('button:has-text("Clone Promotion")')

    // Verify form pre-filled with existing data
    await expect(page.locator('[name="name"]')).toHaveValue(/Spring Cleaning Special/)
    await expect(page.locator('[name="code"]')).toHaveValue(/SPRING20/)

    // Update cloned promotion details
    await page.fill('[name="name"]', 'Summer Cleaning Special')
    await page.fill('[name="code"]', 'SUMMER20')
    await page.fill('[name="start_date"]', '2025-06-01')
    await page.fill('[name="end_date"]', '2025-08-31')

    // Save cloned promotion
    await page.click('button:has-text("Create Promotion")')

    // Verify new promotion created
    await expect(page.locator('text=Promotion created successfully')).toBeVisible()
    await expect(page.locator('text=Summer Cleaning Special')).toBeVisible()
  })
})
