/**
 * Reviews Management E2E Tests
 *
 * Tests review request sending, portal submission, and low-rating follow-up
 */

import { test, expect } from '@playwright/test'
import { loginAsStaff, loginAsCustomer, logout } from '../helpers/auth'

test.describe('Reviews Management', () => {
  test.describe('Staff Review Management', () => {
    test.beforeEach(async ({ page }) => {
      // Login as staff user
      await loginAsStaff(page, 'manager')
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('sends review request after job completion', async ({ page }) => {
      // Navigate to completed jobs
      await page.goto('/dashboard/jobs')
      await page.selectOption('[name="status_filter"]', 'completed')

      // Click on completed job
      await page.click('tr[data-status="completed"]:first-child')

      // Verify job details visible
      await expect(page.locator('h2:has-text("Job Details")')).toBeVisible()

      // Click send review request button
      await page.click('button:has-text("Request Review")')

      // Select delivery method
      await page.check('[name="delivery_method"][value="email"]')

      // Preview review request email
      await expect(page.locator('[data-testid="review-request-preview"]')).toBeVisible()
      await expect(page.locator('text=How was your service?')).toBeVisible()

      // Optionally customize message
      await page.fill('[name="custom_message"]', 'We hope you enjoyed our service! Please share your feedback.')

      // Send review request
      await page.click('button:has-text("Send Request")')

      // Verify success message
      await expect(page.locator('text=Review request sent successfully')).toBeVisible()

      // Verify review request logged
      await expect(page.locator('[data-testid="review-request-status"]')).toHaveText('Sent')
    })

    test('sends review request via SMS', async ({ page }) => {
      // Navigate to completed jobs
      await page.goto('/dashboard/jobs')
      await page.selectOption('[name="status_filter"]', 'completed')

      // Click on job
      await page.click('tr:first-child')

      // Click send review request
      await page.click('button:has-text("Request Review")')

      // Select SMS delivery
      await page.check('[name="delivery_method"][value="sms"]')

      // Verify SMS message preview
      await expect(page.locator('[data-testid="sms-preview"]')).toBeVisible()
      await expect(page.locator('text=Rate your recent service')).toBeVisible()

      // Send request
      await page.click('button:has-text("Send Request")')

      // Verify success
      await expect(page.locator('text=Review request sent successfully')).toBeVisible()
    })

    test('views all reviews dashboard', async ({ page }) => {
      // Navigate to reviews page
      await page.goto('/dashboard/reviews')

      // Verify reviews dashboard visible
      await expect(page.locator('h1:has-text("Customer Reviews")')).toBeVisible()

      // Verify metrics displayed
      await expect(page.locator('[data-metric="average-rating"]')).toBeVisible()
      await expect(page.locator('[data-metric="total-reviews"]')).toBeVisible()
      await expect(page.locator('[data-metric="response-rate"]')).toBeVisible()

      // Verify rating distribution chart
      await expect(page.locator('[data-testid="rating-distribution"]')).toBeVisible()

      // Verify reviews list
      await expect(page.locator('[data-testid="reviews-list"]')).toBeVisible()
    })

    test('filters reviews by rating', async ({ page }) => {
      // Navigate to reviews page
      await page.goto('/dashboard/reviews')

      // Filter by 5-star reviews
      await page.click('[data-rating-filter="5"]')

      // Verify only 5-star reviews shown
      await expect(page.locator('[data-rating="5"]')).toBeVisible()

      // Filter by low ratings (1-2 stars)
      await page.click('[data-rating-filter="1-2"]')

      // Verify low-rated reviews shown
      await expect(page.locator('[data-rating="1"], [data-rating="2"]')).toBeVisible()
    })

    test('manages low-rating follow-up', async ({ page }) => {
      // Navigate to reviews page
      await page.goto('/dashboard/reviews')

      // Filter low-rated reviews
      await page.click('[data-rating-filter="1-2"]')

      // Click on low-rated review
      await page.click('[data-rating="2"]:first-child')

      // Verify review details
      await expect(page.locator('[data-testid="review-details"]')).toBeVisible()

      // Verify follow-up action button visible
      await expect(page.locator('button:has-text("Create Follow-up")')).toBeVisible()

      // Click create follow-up
      await page.click('button:has-text("Create Follow-up")')

      // Fill follow-up task details
      await page.fill('[name="task_title"]', 'Follow up on low rating')
      await page.fill('[name="task_description"]', 'Call customer to address concerns and offer solution')
      await page.selectOption('[name="assigned_to"]', { index: 1 })
      await page.selectOption('[name="priority"]', 'high')
      await page.fill('[name="due_date"]', '2025-10-26')

      // Create task
      await page.click('button:has-text("Create Task")')

      // Verify task created
      await expect(page.locator('text=Follow-up task created')).toBeVisible()

      // Verify task appears in review details
      await expect(page.locator('text=Follow up on low rating')).toBeVisible()
      await expect(page.locator('[data-priority="high"]')).toBeVisible()
    })

    test('responds to customer review', async ({ page }) => {
      // Navigate to reviews page
      await page.goto('/dashboard/reviews')

      // Click on review
      await page.click('tr:first-child')

      // Click respond button
      await page.click('button:has-text("Respond to Review")')

      // Write response
      await page.fill('[name="response"]', 'Thank you for your feedback! We appreciate your business and are glad we could help.')

      // Submit response
      await page.click('button:has-text("Submit Response")')

      // Verify response saved
      await expect(page.locator('text=Response published')).toBeVisible()

      // Verify response appears under review
      await expect(page.locator('[data-testid="staff-response"]')).toBeVisible()
      await expect(page.locator('text=Thank you for your feedback')).toBeVisible()
    })
  })

  test.describe('Customer Review Submission', () => {
    test.beforeEach(async ({ page }) => {
      // Login as customer
      await loginAsCustomer(page)
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('submits portal review from review link', async ({ page }) => {
      // Navigate to portal reviews page (from email link)
      await page.goto('/portal/reviews/submit?job_id=test-job-123&token=test-token')

      // Verify review form visible
      await expect(page.locator('h1:has-text("Share Your Experience")')).toBeVisible()

      // Verify job details shown
      await expect(page.locator('[data-testid="job-summary"]')).toBeVisible()
      await expect(page.locator('text=Carpet Cleaning')).toBeVisible()

      // Select star rating
      await page.click('[data-star="5"]')

      // Verify stars highlighted
      await expect(page.locator('[data-star="5"][data-selected="true"]')).toBeVisible()

      // Write review text
      await page.fill('[name="review_text"]', 'Excellent service! The technician was professional and thorough. My carpets look brand new!')

      // Rate specific aspects
      await page.click('[data-aspect="quality"][data-rating="5"]')
      await page.click('[data-aspect="timeliness"][data-rating="5"]')
      await page.click('[data-aspect="professionalism"][data-rating="5"]')

      // Optionally add photo
      await page.setInputFiles('[name="review_photos"]', './tests/fixtures/before-after.jpg')

      // Verify photo preview
      await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible()

      // Submit review
      await page.click('button:has-text("Submit Review")')

      // Verify thank you message
      await expect(page.locator('h2:has-text("Thank You!")')).toBeVisible()
      await expect(page.locator('text=Your feedback helps us improve')).toBeVisible()

      // Verify redirect to portal
      await page.waitForURL('/portal')
    })

    test('submits low rating with detailed feedback', async ({ page }) => {
      // Navigate to review form
      await page.goto('/portal/reviews/submit?job_id=test-job-124&token=test-token')

      // Select low rating
      await page.click('[data-star="2"]')

      // Verify additional feedback prompt appears
      await expect(page.locator('text=We\'re sorry to hear that')).toBeVisible()
      await expect(page.locator('[name="improvement_areas"]')).toBeVisible()

      // Select improvement areas
      await page.check('[name="improvement_areas"][value="quality"]')
      await page.check('[name="improvement_areas"][value="communication"]')

      // Write detailed feedback
      await page.fill('[name="review_text"]', 'The service was not up to my expectations. The technician arrived late and some areas were missed.')

      // Indicate if customer wants to be contacted
      await page.check('[name="request_callback"]')

      // Submit review
      await page.click('button:has-text("Submit Review")')

      // Verify thank you and follow-up message
      await expect(page.locator('text=A manager will contact you within 24 hours')).toBeVisible()
    })

    test('views own review history', async ({ page }) => {
      // Navigate to portal reviews page
      await page.goto('/portal/reviews')

      // Verify page header
      await expect(page.locator('h1:has-text("My Reviews")')).toBeVisible()

      // Verify reviews list
      await expect(page.locator('[data-testid="my-reviews-list"]')).toBeVisible()

      // Verify review cards show details
      await expect(page.locator('[data-testid="review-card"]').first()).toBeVisible()
      await expect(page.locator('[data-rating]').first()).toBeVisible()

      // Click on review to view details
      await page.click('[data-testid="review-card"]:first-child')

      // Verify review details modal
      await expect(page.locator('[data-testid="review-details-modal"]')).toBeVisible()

      // Verify staff response if exists
      const staffResponse = page.locator('[data-testid="staff-response"]')
      if (await staffResponse.isVisible()) {
        await expect(staffResponse).toContainText(/Thank you|appreciate/)
      }
    })

    test('edits submitted review within 24 hours', async ({ page }) => {
      // Navigate to portal reviews
      await page.goto('/portal/reviews')

      // Click on recent review
      await page.click('[data-testid="review-card"]:first-child')

      // Verify edit button visible (within 24 hours)
      await expect(page.locator('button:has-text("Edit Review")')).toBeVisible()

      // Click edit
      await page.click('button:has-text("Edit Review")')

      // Modify rating
      await page.click('[data-star="4"]')

      // Update review text
      await page.fill('[name="review_text"]', 'Updated: The service was great overall. Very satisfied!')

      // Save changes
      await page.click('button:has-text("Save Changes")')

      // Verify update success
      await expect(page.locator('text=Review updated successfully')).toBeVisible()

      // Verify updated content shown
      await expect(page.locator('text=Updated: The service was great')).toBeVisible()
    })
  })

  test.describe('Review Analytics', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsStaff(page, 'admin')
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('exports review data', async ({ page }) => {
      // Navigate to reviews page
      await page.goto('/dashboard/reviews')

      // Click export button
      await page.click('button:has-text("Export Reviews")')

      // Select date range
      await page.fill('[name="start_date"]', '2025-01-01')
      await page.fill('[name="end_date"]', '2025-12-31')

      // Select format
      await page.selectOption('[name="export_format"]', 'csv')

      // Download
      await page.click('button:has-text("Download")')

      // Verify download
      const downloadPromise = page.waitForEvent('download')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('reviews')
    })

    test('views review trends over time', async ({ page }) => {
      // Navigate to reviews analytics
      await page.goto('/dashboard/reviews/analytics')

      // Verify trends chart visible
      await expect(page.locator('[data-testid="review-trends-chart"]')).toBeVisible()

      // Select time period
      await page.selectOption('[name="time_period"]', 'last_6_months')

      // Verify chart updates
      await expect(page.locator('[data-testid="review-trends-chart"]')).toBeVisible()

      // Verify average rating trend
      await expect(page.locator('[data-metric="avg-rating-trend"]')).toBeVisible()
    })
  })
})
