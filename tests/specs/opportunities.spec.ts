/**
 * Opportunities Management E2E Tests
 *
 * Tests the complete opportunity workflow from creation to conversion
 */

import { test, expect } from '@playwright/test'
import { loginAsStaff, logout } from '../helpers/auth'

test.describe('Opportunities Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as staff user with manager role
    await loginAsStaff(page, 'manager')
  })

  test.afterEach(async ({ page }) => {
    await logout(page)
  })

  test('creates new opportunity', async ({ page }) => {
    // Navigate to opportunities page
    await page.goto('/dashboard/opportunities')
    await expect(page.locator('h1:has-text("Opportunities")')).toBeVisible()

    // Click new opportunity button
    await page.click('button:has-text("New Opportunity")')

    // Fill opportunity form
    await page.fill('[name="customer_name"]', 'John Smith')
    await page.fill('[name="email"]', 'john.smith@example.com')
    await page.fill('[name="phone"]', '+15551234567')
    await page.fill('[name="address"]', '123 Elm Street')
    await page.fill('[name="city"]', 'Sacramento')
    await page.fill('[name="state"]', 'CA')
    await page.fill('[name="zip_code"]', '95814')

    // Select service type
    await page.selectOption('[name="service_type"]', 'Carpet Cleaning')

    // Select lead source
    await page.selectOption('[name="lead_source"]', 'Website')

    // Add notes
    await page.fill('[name="notes"]', 'Customer interested in deep carpet cleaning for 3 bedrooms')

    // Set estimated value
    await page.fill('[name="estimated_value"]', '250')

    // Submit form
    await page.click('button:has-text("Create Opportunity")')

    // Verify success message
    await expect(page.locator('text=Opportunity created successfully')).toBeVisible()

    // Verify redirect to opportunities list
    await page.waitForURL(/\/dashboard\/opportunities/)

    // Verify opportunity appears in list
    await expect(page.locator('text=John Smith')).toBeVisible()
    await expect(page.locator('text=Carpet Cleaning')).toBeVisible()
  })

  test('converts opportunity to booking', async ({ page }) => {
    // Navigate to opportunities page
    await page.goto('/dashboard/opportunities')

    // Click on first opportunity
    await page.click('tr:has-text("John Smith"):first-child')

    // Wait for opportunity detail page
    await expect(page.locator('h2:has-text("Opportunity Details")')).toBeVisible()

    // Click convert to booking button
    await page.click('button:has-text("Convert to Booking")')

    // Fill booking details
    await page.fill('[name="scheduled_date"]', '2025-11-01')
    await page.fill('[name="scheduled_time"]', '10:00')

    // Select technician
    await page.selectOption('[name="assigned_technician"]', { index: 1 })

    // Add special instructions
    await page.fill('[name="special_instructions"]', 'Please call 30 minutes before arrival')

    // Confirm conversion
    await page.click('button:has-text("Confirm Booking")')

    // Verify success message
    await expect(page.locator('text=Opportunity converted to booking')).toBeVisible()

    // Verify redirect to jobs page
    await page.waitForURL(/\/dashboard\/jobs/)

    // Verify job was created
    await expect(page.locator('text=John Smith')).toBeVisible()
    await expect(page.locator('[data-status="scheduled"]')).toBeVisible()
  })

  test('manages opportunity pipeline board', async ({ page }) => {
    // Navigate to pipeline board
    await page.goto('/dashboard/opportunities/board')

    // Verify board columns are visible
    await expect(page.locator('[data-column="new"]')).toBeVisible()
    await expect(page.locator('[data-column="contacted"]')).toBeVisible()
    await expect(page.locator('[data-column="qualified"]')).toBeVisible()
    await expect(page.locator('[data-column="proposal"]')).toBeVisible()
    await expect(page.locator('[data-column="won"]')).toBeVisible()
    await expect(page.locator('[data-column="lost"]')).toBeVisible()

    // Verify opportunity card exists in "new" column
    const opportunityCard = page.locator('[data-column="new"] [data-opportunity-card]').first()
    await expect(opportunityCard).toBeVisible()

    // Drag opportunity from "new" to "contacted" column
    const contactedColumn = page.locator('[data-column="contacted"]')
    await opportunityCard.dragTo(contactedColumn)

    // Verify opportunity moved to contacted column
    await expect(page.locator('[data-column="contacted"] [data-opportunity-card]').first()).toBeVisible()

    // Verify success message
    await expect(page.locator('text=Opportunity status updated')).toBeVisible()

    // Move opportunity to "qualified" stage
    const qualifiedCard = page.locator('[data-column="contacted"] [data-opportunity-card]').first()
    const qualifiedColumn = page.locator('[data-column="qualified"]')
    await qualifiedCard.dragTo(qualifiedColumn)

    // Verify moved to qualified
    await expect(page.locator('[data-column="qualified"] [data-opportunity-card]').first()).toBeVisible()

    // Click on opportunity card to view details
    await page.locator('[data-column="qualified"] [data-opportunity-card]').first().click()

    // Verify detail modal or sidebar opens
    await expect(page.locator('[data-testid="opportunity-details"]')).toBeVisible()

    // Update opportunity details from modal
    await page.fill('[name="estimated_value"]', '350')
    await page.fill('[name="notes"]', 'Customer wants additional tile cleaning')

    // Save changes
    await page.click('button:has-text("Save Changes")')

    // Verify changes saved
    await expect(page.locator('text=Opportunity updated')).toBeVisible()
  })

  test('adds follow-up task to opportunity', async ({ page }) => {
    // Navigate to opportunities page
    await page.goto('/dashboard/opportunities')

    // Click on first opportunity
    await page.click('tr:has-text("John Smith"):first-child')

    // Click add task button
    await page.click('button:has-text("Add Task")')

    // Fill task details
    await page.fill('[name="task_title"]', 'Follow up call')
    await page.fill('[name="task_description"]', 'Call to discuss pricing and availability')
    await page.fill('[name="due_date"]', '2025-10-28')
    await page.selectOption('[name="priority"]', 'high')

    // Save task
    await page.click('button:has-text("Create Task")')

    // Verify task appears in task list
    await expect(page.locator('text=Follow up call')).toBeVisible()
    await expect(page.locator('[data-priority="high"]')).toBeVisible()
  })

  test('marks opportunity as lost with reason', async ({ page }) => {
    // Navigate to opportunities page
    await page.goto('/dashboard/opportunities')

    // Click on opportunity
    await page.click('tr:first-child')

    // Click mark as lost button
    await page.click('button:has-text("Mark as Lost")')

    // Select lost reason
    await page.selectOption('[name="lost_reason"]', 'price_too_high')

    // Add notes
    await page.fill('[name="lost_notes"]', 'Customer found cheaper competitor')

    // Confirm
    await page.click('button:has-text("Confirm")')

    // Verify opportunity marked as lost
    await expect(page.locator('text=Opportunity marked as lost')).toBeVisible()

    // Verify status updated
    await expect(page.locator('[data-status="lost"]')).toBeVisible()
  })

  test('filters opportunities by stage', async ({ page }) => {
    // Navigate to opportunities page
    await page.goto('/dashboard/opportunities')

    // Select filter
    await page.selectOption('[name="stage_filter"]', 'qualified')

    // Verify only qualified opportunities shown
    await expect(page.locator('[data-stage="qualified"]')).toBeVisible()
    await expect(page.locator('[data-stage="new"]')).not.toBeVisible()

    // Clear filter
    await page.selectOption('[name="stage_filter"]', 'all')

    // Verify all opportunities shown again
    await expect(page.locator('[data-stage="new"]')).toBeVisible()
    await expect(page.locator('[data-stage="qualified"]')).toBeVisible()
  })

  test('searches opportunities by customer name', async ({ page }) => {
    // Navigate to opportunities page
    await page.goto('/dashboard/opportunities')

    // Enter search term
    await page.fill('[name="search"]', 'John Smith')

    // Verify filtered results
    await expect(page.locator('text=John Smith')).toBeVisible()

    // Verify other opportunities not shown
    const allRows = page.locator('tbody tr')
    await expect(allRows).toHaveCount(1)

    // Clear search
    await page.fill('[name="search"]', '')

    // Verify all opportunities shown again
    await expect(allRows.first()).toBeVisible()
  })
})
