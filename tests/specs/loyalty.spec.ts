/**
 * Loyalty Program E2E Tests
 *
 * Tests loyalty points, rewards, tier progression, and referrals
 */

import { test, expect } from '@playwright/test'
import { loginAsStaff, loginAsCustomer, logout } from '../helpers/auth'

test.describe('Loyalty Program', () => {
  test.describe('Staff Loyalty Management', () => {
    test.beforeEach(async ({ page }) => {
      // Login as staff user
      await loginAsStaff(page, 'admin')
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('awards points after job completion', async ({ page }) => {
      // Navigate to completed jobs
      await page.goto('/dashboard/jobs')
      await page.selectOption('[name="status_filter"]', 'completed')

      // Click on completed job
      await page.click('tr[data-status="completed"]:first-child')

      // Verify job details
      await expect(page.locator('h2:has-text("Job Details")')).toBeVisible()

      // Navigate to customer profile
      await page.click('a:has-text("View Customer")')

      // Click loyalty tab
      await page.click('button:has-text("Loyalty")')

      // Verify loyalty status visible
      await expect(page.locator('[data-testid="loyalty-status"]')).toBeVisible()
      await expect(page.locator('[data-testid="current-points"]')).toBeVisible()
      await expect(page.locator('[data-testid="current-tier"]')).toBeVisible()

      // Click award points button
      await page.click('button:has-text("Award Points")')

      // Fill points award form
      await page.fill('[name="points"]', '150')
      await page.selectOption('[name="reason"]', 'job_completion')
      await page.fill('[name="notes"]', 'Carpet cleaning service completed')

      // Submit
      await page.click('button:has-text("Award Points")')

      // Verify success message
      await expect(page.locator('text=Points awarded successfully')).toBeVisible()

      // Verify points updated
      await expect(page.locator('[data-testid="current-points"]')).toContainText('150')

      // Verify transaction logged
      await expect(page.locator('[data-testid="points-history"]')).toContainText('+150 points')
    })

    test('manually adjusts loyalty points', async ({ page }) => {
      // Navigate to customer profile
      await page.goto('/dashboard/customers')
      await page.click('tr:first-child')

      // Click loyalty tab
      await page.click('button:has-text("Loyalty")')

      // Click adjust points button
      await page.click('button:has-text("Adjust Points")')

      // Select adjustment type
      await page.selectOption('[name="adjustment_type"]', 'deduct')

      // Enter amount
      await page.fill('[name="points"]', '50')

      // Enter reason
      await page.fill('[name="reason"]', 'Points correction - duplicate entry')

      // Submit
      await page.click('button:has-text("Apply Adjustment")')

      // Verify adjustment made
      await expect(page.locator('text=Points adjusted')).toBeVisible()

      // Verify transaction logged
      await expect(page.locator('[data-testid="points-history"]')).toContainText('-50 points')
    })

    test('views loyalty program analytics', async ({ page }) => {
      // Navigate to loyalty dashboard
      await page.goto('/dashboard/loyalty')

      // Verify analytics metrics
      await expect(page.locator('[data-metric="total-members"]')).toBeVisible()
      await expect(page.locator('[data-metric="active-members"]')).toBeVisible()
      await expect(page.locator('[data-metric="points-awarded"]')).toBeVisible()
      await expect(page.locator('[data-metric="points-redeemed"]')).toBeVisible()

      // Verify tier distribution chart
      await expect(page.locator('[data-testid="tier-distribution-chart"]')).toBeVisible()

      // Verify top members list
      await expect(page.locator('[data-testid="top-members"]')).toBeVisible()

      // Click on member to view details
      await page.click('[data-testid="top-members"] tr:first-child')

      // Verify member details
      await expect(page.locator('[data-testid="member-details"]')).toBeVisible()
    })
  })

  test.describe('Customer Loyalty Portal', () => {
    test.beforeEach(async ({ page }) => {
      // Login as customer
      await loginAsCustomer(page)
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('views loyalty status and tier', async ({ page }) => {
      // Navigate to loyalty page in portal
      await page.goto('/portal/loyalty')

      // Verify loyalty dashboard visible
      await expect(page.locator('h1:has-text("Loyalty Rewards")')).toBeVisible()

      // Verify current tier displayed
      await expect(page.locator('[data-testid="current-tier"]')).toBeVisible()

      // Verify tier badge
      await expect(page.locator('[data-testid="tier-badge"]')).toBeVisible()

      // Verify points balance
      await expect(page.locator('[data-testid="points-balance"]')).toBeVisible()

      // Verify progress to next tier
      await expect(page.locator('[data-testid="tier-progress"]')).toBeVisible()

      // Verify tier benefits listed
      await expect(page.locator('[data-testid="tier-benefits"]')).toBeVisible()
      await expect(page.locator('text=discount')).toBeVisible()
    })

    test('redeems points for rewards', async ({ page }) => {
      // Navigate to loyalty rewards
      await page.goto('/portal/loyalty/rewards')

      // Verify rewards catalog visible
      await expect(page.locator('h2:has-text("Available Rewards")')).toBeVisible()

      // Verify reward cards displayed
      await expect(page.locator('[data-testid="reward-card"]').first()).toBeVisible()

      // Click on reward
      await page.click('[data-testid="reward-card"]:first-child')

      // Verify reward details modal
      await expect(page.locator('[data-testid="reward-details-modal"]')).toBeVisible()

      // Verify points cost
      await expect(page.locator('[data-testid="points-cost"]')).toBeVisible()

      // Verify current balance shown
      await expect(page.locator('[data-testid="current-balance"]')).toBeVisible()

      // Click redeem button
      await page.click('button:has-text("Redeem")')

      // Confirm redemption
      await page.click('button:has-text("Confirm Redemption")')

      // Verify success message
      await expect(page.locator('text=Reward redeemed successfully')).toBeVisible()

      // Verify points deducted
      const balanceAfter = await page.locator('[data-testid="points-balance"]').textContent()
      expect(balanceAfter).toBeTruthy()

      // Verify redemption appears in history
      await page.goto('/portal/loyalty/history')
      await expect(page.locator('[data-transaction-type="redemption"]').first()).toBeVisible()
    })

    test('tracks tier progression', async ({ page }) => {
      // Navigate to loyalty page
      await page.goto('/portal/loyalty')

      // Verify current tier (assume starting at Bronze)
      await expect(page.locator('[data-tier="bronze"]')).toBeVisible()

      // Verify next tier information
      await expect(page.locator('[data-testid="next-tier"]')).toContainText('Silver')

      // Verify points needed for next tier
      await expect(page.locator('[data-testid="points-to-next-tier"]')).toBeVisible()

      // Click tier details
      await page.click('button:has-text("View Tier Benefits")')

      // Verify all tiers displayed
      await expect(page.locator('[data-tier="bronze"]')).toBeVisible()
      await expect(page.locator('[data-tier="silver"]')).toBeVisible()
      await expect(page.locator('[data-tier="gold"]')).toBeVisible()

      // Verify benefit comparison
      await expect(page.locator('text=5% discount')).toBeVisible() // Bronze
      await expect(page.locator('text=10% discount')).toBeVisible() // Silver
      await expect(page.locator('text=15% discount')).toBeVisible() // Gold

      // Close modal
      await page.click('button:has-text("Close")')
    })

    test('views points history', async ({ page }) => {
      // Navigate to points history
      await page.goto('/portal/loyalty/history')

      // Verify history page
      await expect(page.locator('h2:has-text("Points History")')).toBeVisible()

      // Verify transactions table
      await expect(page.locator('[data-testid="points-history-table"]')).toBeVisible()

      // Verify transaction types displayed
      await expect(page.locator('[data-transaction-type="earned"]')).toBeVisible()

      // Verify transaction details
      const firstTransaction = page.locator('tr[data-transaction]').first()
      await expect(firstTransaction).toBeVisible()

      // Click on transaction for details
      await firstTransaction.click()

      // Verify transaction details modal
      await expect(page.locator('[data-testid="transaction-details"]')).toBeVisible()
    })

    test('creates referral', async ({ page }) => {
      // Navigate to referrals page
      await page.goto('/portal/loyalty/referrals')

      // Verify referral page
      await expect(page.locator('h1:has-text("Refer a Friend")')).toBeVisible()

      // Verify referral benefits displayed
      await expect(page.locator('text=Earn 500 points')).toBeVisible()

      // Verify referral code displayed
      await expect(page.locator('[data-testid="referral-code"]')).toBeVisible()

      // Copy referral code
      await page.click('button:has-text("Copy Code")')

      // Verify copied confirmation
      await expect(page.locator('text=Code copied')).toBeVisible()

      // Share via email
      await page.click('button:has-text("Share via Email")')

      // Fill email form
      await page.fill('[name="friend_email"]', 'friend@example.com')
      await page.fill('[name="friend_name"]', 'John Friend')
      await page.fill('[name="message"]', 'Check out this great cleaning service!')

      // Send referral
      await page.click('button:has-text("Send Referral")')

      // Verify success message
      await expect(page.locator('text=Referral sent successfully')).toBeVisible()

      // Verify referral tracked
      await expect(page.locator('[data-testid="pending-referrals"]')).toContainText('friend@example.com')
    })

    test('views referral status', async ({ page }) => {
      // Navigate to referrals page
      await page.goto('/portal/loyalty/referrals')

      // Click referrals tab
      await page.click('button:has-text("My Referrals")')

      // Verify referrals list
      await expect(page.locator('[data-testid="referrals-list"]')).toBeVisible()

      // Verify referral statuses
      await expect(page.locator('[data-status="pending"]')).toBeVisible()

      // Verify completed referrals
      const completedReferral = page.locator('[data-status="completed"]').first()
      if (await completedReferral.isVisible()) {
        await expect(completedReferral).toContainText('500 points')
      }

      // Verify total referral earnings
      await expect(page.locator('[data-testid="total-referral-points"]')).toBeVisible()
    })

    test('applies tier discount at checkout', async ({ page }) => {
      // Navigate to booking page
      await page.goto('/portal/book')

      // Select service
      await page.selectOption('[name="service_type"]', 'Carpet Cleaning')

      // Fill booking details
      await page.fill('[name="address"]', '123 Main St')
      await page.fill('[name="city"]', 'Sacramento')
      await page.fill('[name="zip_code"]', '95814')

      // Select date
      await page.fill('[name="preferred_date"]', '2025-11-01')

      // Proceed to pricing
      await page.click('button:has-text("Continue")')

      // Verify base price
      await expect(page.locator('[data-testid="base-price"]')).toBeVisible()

      // Verify tier discount automatically applied
      await expect(page.locator('[data-testid="tier-discount"]')).toBeVisible()
      await expect(page.locator('text=Bronze Tier Discount')).toBeVisible()

      // Verify discount percentage (5% for Bronze)
      await expect(page.locator('[data-testid="discount-amount"]')).toBeVisible()

      // Verify total with discount
      await expect(page.locator('[data-testid="total-amount"]')).toBeVisible()

      // Complete booking
      await page.click('button:has-text("Confirm Booking")')

      // Verify booking created with discount applied
      await expect(page.locator('text=Booking confirmed')).toBeVisible()
    })
  })

  test.describe('Tier Upgrade Flow', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsCustomer(page)
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('receives tier upgrade notification', async ({ page }) => {
      // Simulate customer reaching Silver tier threshold
      await page.goto('/portal/loyalty')

      // Verify upgrade notification modal
      await expect(page.locator('[data-testid="tier-upgrade-modal"]')).toBeVisible()

      // Verify congratulations message
      await expect(page.locator('text=Congratulations')).toBeVisible()
      await expect(page.locator('text=Silver Tier')).toBeVisible()

      // Verify new benefits listed
      await expect(page.locator('text=10% discount')).toBeVisible()

      // Close notification
      await page.click('button:has-text("View My Benefits")')

      // Verify redirected to benefits page
      await expect(page.locator('[data-testid="tier-benefits"]')).toBeVisible()
    })
  })

  test.describe('Points Expiration', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsCustomer(page)
    })

    test.afterEach(async ({ page }) => {
      await logout(page)
    })

    test('views expiring points warning', async ({ page }) => {
      // Navigate to loyalty page
      await page.goto('/portal/loyalty')

      // Verify expiring points warning if applicable
      const expiringWarning = page.locator('[data-testid="expiring-points-warning"]')

      if (await expiringWarning.isVisible()) {
        // Verify warning message
        await expect(expiringWarning).toContainText('expiring soon')

        // Verify points amount shown
        await expect(expiringWarning).toContainText(/\d+ points/)

        // Verify expiration date shown
        await expect(expiringWarning).toContainText(/\d{4}-\d{2}-\d{2}/)

        // Click view details
        await page.click('[data-testid="view-expiring-details"]')

        // Verify expiring points breakdown
        await expect(page.locator('[data-testid="expiring-points-table"]')).toBeVisible()
      }
    })
  })
})
