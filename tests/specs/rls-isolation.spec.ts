import { test, expect } from '@playwright/test';
import { selectors, selectorHelpers } from '../utils/selectors';

test.describe('RLS Isolation', () => {
  test('technician cannot see other technicians\' jobs and customers', async ({ page }) => {
    // This test runs as the technician user (based on storage state)

    // Navigate to jobs page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Get all job cards visible to the technician
    const jobCards = page.locator(selectors.jobs.jobCard);
    const jobCount = await jobCards.count();

    // Verify technician can see some jobs (their own)
    expect(jobCount).toBeGreaterThan(0);

    // Verify all visible jobs are assigned to this technician
    for (let i = 0; i < jobCount; i++) {
      const jobCard = jobCards.nth(i);
      const techName = await jobCard.locator(selectors.jobs.jobTech).textContent();

      // The technician should only see jobs assigned to them
      // Assuming test tech's name contains "Test Technician"
      expect(techName).toContain('Test Technician');
    }

    // Navigate to customers page
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Get all customer cards visible to the technician
    const customerCards = page.locator(selectors.customers.customerCard);
    const customerCount = await customerCards.count();

    // Verify technician can see some customers (only those they have jobs for)
    expect(customerCount).toBeGreaterThan(0);

    // Verify the technician can only see customers they have jobs with
    // This is based on the RLS policy that restricts customer visibility
    for (let i = 0; i < customerCount; i++) {
      const customerCard = customerCards.nth(i);
      const customerName = await customerCard.locator(selectors.customers.customerName).textContent();

      // Should only see "Test Customer Inc" that was seeded with their job
      expect(customerName).toContain('Test Customer');
    }

    // Attempt to navigate directly to a job that doesn't belong to them (should be blocked)
    // This would typically return a 404 or redirect due to RLS
    const unauthorizedJobId = 'non-existent-job-id';
    await page.goto(`/jobs/${unauthorizedJobId}`);

    // Should either show not found or redirect back
    await expect(page.locator(selectors.error.notFound)).toBeVisible()
      .or(expect(page).toHaveURL('/jobs'));
  });

  test('admin can see all jobs and customers', async ({ page }) => {
    // This test runs as the admin user (based on storage state)

    // Navigate to jobs page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Admin should be able to see all jobs including ones assigned to different techs
    const jobCards = page.locator(selectors.jobs.jobCard);
    const jobCount = await jobCards.count();

    // Verify admin can see jobs
    expect(jobCount).toBeGreaterThan(0);

    // Admin should see jobs with various technicians
    const techNames = await jobCards.locator(selectors.jobs.jobTech).allTextContents();

    // Should include the test technician
    expect(techNames.some(name => name.includes('Test Technician'))).toBeTruthy();

    // Navigate to customers page
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Admin should see all customers
    const customerCards = page.locator(selectors.customers.customerCard);
    const customerCount = await customerCards.count();

    expect(customerCount).toBeGreaterThan(0);

    // Should see the test customer
    await expect(page.locator(selectorHelpers.customerByName('Test Customer Inc'))).toBeVisible();
  });

  test('dispatcher can see all jobs and customers', async ({ page }) => {
    // This test runs as the dispatcher user (based on storage state)

    // Navigate to jobs page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Dispatcher should be able to see all jobs
    const jobCards = page.locator(selectors.jobs.jobCard);
    const jobCount = await jobCards.count();

    expect(jobCount).toBeGreaterThan(0);

    // Navigate to customers page
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Dispatcher should see all customers
    const customerCards = page.locator(selectors.customers.customerCard);
    const customerCount = await customerCards.count();

    expect(customerCount).toBeGreaterThan(0);

    // Should see the test customer
    await expect(page.locator(selectorHelpers.customerByName('Test Customer Inc'))).toBeVisible();
  });
});