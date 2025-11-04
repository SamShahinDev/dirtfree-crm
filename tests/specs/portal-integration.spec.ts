/**
 * Portal Integration E2E Tests
 *
 * Tests complete customer portal workflows integrating multiple features
 */

import { test, expect } from '@playwright/test'
import { loginAsCustomer, logout } from '../helpers/auth'

test.describe('Customer Portal Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Login as customer
    await loginAsCustomer(page)
  })

  test.afterEach(async ({ page }) => {
    await logout(page)
  })

  test('customer views and claims promotion offer', async ({ page }) => {
    // Navigate to portal home
    await page.goto('/portal')

    // Verify portal dashboard loaded
    await expect(page.locator('h1:has-text("Welcome")')).toBeVisible()

    // Verify promotions widget visible
    await expect(page.locator('[data-testid="promotions-widget"]')).toBeVisible()

    // Navigate to promotions page
    await page.click('a:has-text("View All Promotions")')

    // Verify promotions page
    await expect(page.locator('h1:has-text("Available Promotions")')).toBeVisible()

    // Verify promotion cards displayed
    await expect(page.locator('[data-testid="promotion-card"]').first()).toBeVisible()

    // Click on promotion to view details
    await page.click('[data-testid="promotion-card"]:first-child')

    // Verify promotion details modal
    await expect(page.locator('[data-testid="promotion-details"]')).toBeVisible()
    await expect(page.locator('[data-testid="promotion-code"]')).toBeVisible()

    // Claim promotion
    await page.click('button:has-text("Claim Offer")')

    // Verify success message
    await expect(page.locator('text=Promotion claimed successfully')).toBeVisible()

    // Verify promotion added to account
    await page.goto('/portal/promotions/my-offers')
    await expect(page.locator('[data-testid="claimed-promotions"]')).toBeVisible()

    // Verify promotion code visible
    await expect(page.locator('[data-testid="promotion-code"]')).toBeVisible()

    // Copy promotion code
    await page.click('button:has-text("Copy Code")')
    await expect(page.locator('text=Code copied')).toBeVisible()
  })

  test('customer books service with claimed promotion', async ({ page }) => {
    // Navigate to booking page
    await page.goto('/portal/book')

    // Verify booking form
    await expect(page.locator('h1:has-text("Book a Service")')).toBeVisible()

    // Select service
    await page.selectOption('[name="service_type"]', 'Carpet Cleaning')

    // Fill service details
    await page.fill('[name="address"]', '123 Main St')
    await page.fill('[name="city"]', 'Sacramento')
    await page.fill('[name="zip_code"]', '95814')

    // Select rooms
    await page.fill('[name="num_rooms"]', '3')

    // Select date
    await page.fill('[name="preferred_date"]', '2025-11-05')
    await page.selectOption('[name="preferred_time"]', 'morning')

    // Proceed to pricing
    await page.click('button:has-text("Continue")')

    // Verify pricing page
    await expect(page.locator('[data-testid="pricing-summary"]')).toBeVisible()

    // Apply promotion code
    await page.fill('[name="promotion_code"]', 'SPRING20')
    await page.click('button:has-text("Apply")')

    // Verify discount applied
    await expect(page.locator('[data-testid="discount-applied"]')).toBeVisible()
    await expect(page.locator('[data-testid="discount-amount"]')).toContainText(/\$\d+/)

    // Verify loyalty discount also applied (if applicable)
    const loyaltyDiscount = page.locator('[data-testid="loyalty-discount"]')
    if (await loyaltyDiscount.isVisible()) {
      await expect(loyaltyDiscount).toContainText(/\d+%/)
    }

    // Verify total amount
    await expect(page.locator('[data-testid="total-amount"]')).toBeVisible()

    // Confirm booking
    await page.click('button:has-text("Confirm Booking")')

    // Verify booking confirmation
    await expect(page.locator('h2:has-text("Booking Confirmed")')).toBeVisible()
    await expect(page.locator('[data-testid="booking-reference"]')).toBeVisible()

    // Verify confirmation email notification
    await expect(page.locator('text=confirmation email has been sent')).toBeVisible()
  })

  test('customer completes service and submits review', async ({ page }) => {
    // Navigate to service history
    await page.goto('/portal/services')

    // Verify services list
    await expect(page.locator('h1:has-text("My Services")')).toBeVisible()

    // Filter completed services
    await page.selectOption('[name="status_filter"]', 'completed')

    // Verify completed service visible
    await expect(page.locator('[data-status="completed"]').first()).toBeVisible()

    // Click on completed service
    await page.click('[data-status="completed"]:first-child')

    // Verify service details
    await expect(page.locator('[data-testid="service-details"]')).toBeVisible()

    // Verify review prompt visible
    await expect(page.locator('text=How was your service?')).toBeVisible()

    // Click write review button
    await page.click('button:has-text("Write Review")')

    // Verify review form
    await expect(page.locator('[data-testid="review-form"]')).toBeVisible()

    // Select star rating
    await page.click('[data-star="5"]')

    // Verify stars selected
    await expect(page.locator('[data-star="5"][data-selected="true"]')).toBeVisible()

    // Write review text
    await page.fill('[name="review_text"]', 'Excellent service! The technician was professional and my carpets look amazing.')

    // Rate specific aspects
    await page.click('[data-aspect="quality"][data-rating="5"]')
    await page.click('[data-aspect="timeliness"][data-rating="5"]')
    await page.click('[data-aspect="professionalism"][data-rating="5"]')
    await page.click('[data-aspect="value"][data-rating="4"]')

    // Optionally upload photo
    const photoUpload = page.locator('[name="review_photos"]')
    if (await photoUpload.isVisible()) {
      // Upload would happen here if fixture exists
      // await page.setInputFiles('[name="review_photos"]', './tests/fixtures/carpet-after.jpg')
    }

    // Submit review
    await page.click('button:has-text("Submit Review")')

    // Verify thank you message
    await expect(page.locator('h2:has-text("Thank You")')).toBeVisible()

    // Verify loyalty points earned notification
    await expect(page.locator('text=earned')).toBeVisible()
    await expect(page.locator('text=points')).toBeVisible()

    // Navigate back to reviews
    await page.goto('/portal/reviews')

    // Verify review appears in history
    await expect(page.locator('[data-rating="5"]').first()).toBeVisible()
    await expect(page.locator('text=Excellent service')).toBeVisible()
  })

  test('customer refers a friend and tracks referral', async ({ page }) => {
    // Navigate to referrals page
    await page.goto('/portal/loyalty/referrals')

    // Verify referral page
    await expect(page.locator('h1:has-text("Refer a Friend")')).toBeVisible()

    // Verify referral benefits displayed
    await expect(page.locator('text=Earn 500 points')).toBeVisible()
    await expect(page.locator('text=Friend gets')).toBeVisible()

    // Verify referral code displayed
    await expect(page.locator('[data-testid="referral-code"]')).toBeVisible()
    const referralCode = await page.locator('[data-testid="referral-code"]').textContent()
    expect(referralCode).toBeTruthy()

    // Share via email
    await page.click('button:has-text("Share via Email")')

    // Fill referral email form
    await page.fill('[name="friend_email"]', 'friend@example.com')
    await page.fill('[name="friend_name"]', 'Jane Friend')
    await page.fill('[name="personal_message"]', 'You should try this cleaning service - they\'re amazing!')

    // Preview email
    await page.click('button:has-text("Preview")')
    await expect(page.locator('[data-testid="email-preview"]')).toBeVisible()
    await page.click('button:has-text("Close Preview")')

    // Send referral
    await page.click('button:has-text("Send Referral")')

    // Verify success message
    await expect(page.locator('text=Referral sent successfully')).toBeVisible()

    // Verify referral tracked
    await page.click('button:has-text("My Referrals")')
    await expect(page.locator('[data-testid="referrals-list"]')).toBeVisible()
    await expect(page.locator('text=friend@example.com')).toBeVisible()
    await expect(page.locator('[data-status="pending"]')).toBeVisible()

    // Verify referral statistics
    await expect(page.locator('[data-testid="total-referrals"]')).toBeVisible()
    await expect(page.locator('[data-testid="pending-referrals"]')).toBeVisible()
    await expect(page.locator('[data-testid="completed-referrals"]')).toBeVisible()
  })

  test('customer manages account settings and preferences', async ({ page }) => {
    // Navigate to account settings
    await page.goto('/portal/settings')

    // Verify settings page
    await expect(page.locator('h1:has-text("Account Settings")')).toBeVisible()

    // Update profile information
    await page.click('button:has-text("Profile")')
    await page.fill('[name="phone"]', '+15559876543')
    await page.fill('[name="address"]', '456 Oak Avenue')

    // Save profile changes
    await page.click('button:has-text("Save Profile")')
    await expect(page.locator('text=Profile updated')).toBeVisible()

    // Update communication preferences
    await page.click('button:has-text("Notifications")')

    // Toggle email preferences
    await page.check('[name="email_promotions"]')
    await page.check('[name="email_reminders"]')
    await page.uncheck('[name="email_newsletters"]')

    // Toggle SMS preferences
    await page.check('[name="sms_reminders"]')
    await page.uncheck('[name="sms_marketing"]')

    // Save preferences
    await page.click('button:has-text("Save Preferences")')
    await expect(page.locator('text=Preferences updated')).toBeVisible()

    // View payment methods
    await page.click('button:has-text("Payment Methods")')
    await expect(page.locator('[data-testid="payment-methods-list"]')).toBeVisible()

    // Add new payment method
    await page.click('button:has-text("Add Payment Method")')
    // Payment form would be filled here in real scenario
  })

  test('customer views comprehensive dashboard', async ({ page }) => {
    // Navigate to portal home
    await page.goto('/portal')

    // Verify all dashboard widgets visible
    await expect(page.locator('[data-testid="upcoming-services"]')).toBeVisible()
    await expect(page.locator('[data-testid="active-promotions"]')).toBeVisible()
    await expect(page.locator('[data-testid="loyalty-summary"]')).toBeVisible()
    await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible()

    // Verify quick actions available
    await expect(page.locator('button:has-text("Book Service")')).toBeVisible()
    await expect(page.locator('a:has-text("View Invoices")')).toBeVisible()
    await expect(page.locator('a:has-text("Contact Support")')).toBeVisible()

    // Check upcoming service details
    const upcomingService = page.locator('[data-testid="upcoming-services"] [data-testid="service-card"]').first()
    if (await upcomingService.isVisible()) {
      await expect(upcomingService).toContainText(/\d{4}-\d{2}-\d{2}/)
      await expect(upcomingService.locator('button:has-text("Reschedule")')).toBeVisible()
    }

    // Check loyalty summary
    await expect(page.locator('[data-testid="loyalty-points"]')).toBeVisible()
    await expect(page.locator('[data-testid="loyalty-tier"]')).toBeVisible()

    // Check active promotions
    const activePromo = page.locator('[data-testid="active-promotions"] [data-testid="promo-card"]').first()
    if (await activePromo.isVisible()) {
      await expect(activePromo).toBeVisible()
    }
  })

  test('customer completes full lifecycle flow', async ({ page }) => {
    // Step 1: Book service with promotion
    await page.goto('/portal/book')
    await page.selectOption('[name="service_type"]', 'Carpet Cleaning')
    await page.fill('[name="address"]', '789 Pine St')
    await page.fill('[name="city"]', 'Sacramento')
    await page.fill('[name="zip_code"]', '95815')
    await page.fill('[name="preferred_date"]', '2025-11-10')
    await page.click('button:has-text("Continue")')

    // Apply promotion
    await page.fill('[name="promotion_code"]', 'SAVE10')
    await page.click('button:has-text("Apply")')

    // Confirm booking
    await page.click('button:has-text("Confirm Booking")')
    await expect(page.locator('text=Booking Confirmed')).toBeVisible()

    const bookingRef = await page.locator('[data-testid="booking-reference"]').textContent()

    // Step 2: View booking in services list
    await page.goto('/portal/services')
    await expect(page.locator(`text=${bookingRef}`)).toBeVisible()

    // Step 3: After service completion, submit review
    // (In real scenario, service would be marked completed by staff)
    // Simulating by navigating to review submission
    await page.goto('/portal/reviews/submit?job_id=test-job&token=test-token')

    if (await page.locator('[data-testid="review-form"]').isVisible()) {
      await page.click('[data-star="5"]')
      await page.fill('[name="review_text"]', 'Complete lifecycle test - excellent service!')
      await page.click('button:has-text("Submit Review")')

      // Verify points earned
      await expect(page.locator('text=points')).toBeVisible()
    }

    // Step 4: Check loyalty points updated
    await page.goto('/portal/loyalty')
    await expect(page.locator('[data-testid="points-balance"]')).toBeVisible()

    // Step 5: Refer a friend
    await page.goto('/portal/loyalty/referrals')
    await page.click('button:has-text("Share via Email")')
    await page.fill('[name="friend_email"]', 'complete-test@example.com')
    await page.fill('[name="friend_name"]', 'Test Friend')
    await page.click('button:has-text("Send Referral")')

    await expect(page.locator('text=Referral sent successfully')).toBeVisible()

    // Verify complete workflow tracked
    await page.goto('/portal')
    await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible()
  })

  test('customer accesses help and support', async ({ page }) => {
    // Navigate to help center
    await page.goto('/portal/help')

    // Verify help center
    await expect(page.locator('h1:has-text("Help Center")')).toBeVisible()

    // Search for help article
    await page.fill('[name="help_search"]', 'reschedule')
    await page.click('button:has-text("Search")')

    // Verify search results
    await expect(page.locator('[data-testid="help-results"]')).toBeVisible()

    // Click on help article
    await page.click('[data-testid="help-article"]:first-child')

    // Verify article content
    await expect(page.locator('[data-testid="article-content"]')).toBeVisible()

    // Check if article was helpful
    await page.click('button:has-text("Yes, this helped")')
    await expect(page.locator('text=Thanks for your feedback')).toBeVisible()

    // Access chat support
    await page.goto('/portal')
    await page.click('[data-testid="chat-widget"]')
    await expect(page.locator('[data-testid="chat-window"]')).toBeVisible()
  })

  test('customer views and pays invoices', async ({ page }) => {
    // Navigate to invoices
    await page.goto('/portal/invoices')

    // Verify invoices page
    await expect(page.locator('h1:has-text("Invoices")')).toBeVisible()

    // Verify invoices list
    await expect(page.locator('[data-testid="invoices-list"]')).toBeVisible()

    // Filter pending invoices
    await page.selectOption('[name="status_filter"]', 'pending')

    // Click on pending invoice
    const pendingInvoice = page.locator('[data-status="pending"]').first()
    if (await pendingInvoice.isVisible()) {
      await pendingInvoice.click()

      // Verify invoice details
      await expect(page.locator('[data-testid="invoice-details"]')).toBeVisible()
      await expect(page.locator('[data-testid="invoice-total"]')).toBeVisible()

      // Click pay button
      await page.click('button:has-text("Pay Now")')

      // Verify payment form
      await expect(page.locator('[data-testid="payment-form"]')).toBeVisible()

      // Payment processing would happen here in real scenario
    }

    // View paid invoices
    await page.goto('/portal/invoices')
    await page.selectOption('[name="status_filter"]', 'paid')

    const paidInvoice = page.locator('[data-status="paid"]').first()
    if (await paidInvoice.isVisible()) {
      await paidInvoice.click()

      // Verify download receipt option
      await expect(page.locator('button:has-text("Download Receipt")')).toBeVisible()
    }
  })
})
