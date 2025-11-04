import { test, expect } from '@playwright/test';

// Define all routes in the application
const routes = [
  { path: '/', name: 'Home' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/customers', name: 'Customers' },
  { path: '/jobs', name: 'Jobs' },
  { path: '/invoices', name: 'Invoices' },
  { path: '/schedule/calendar', name: 'Schedule Calendar' },
  { path: '/schedule/zone-board', name: 'Zone Board' },
  { path: '/reminders', name: 'Reminders' },
  { path: '/trucks', name: 'Trucks' },
  { path: '/reports', name: 'Reports' },
  { path: '/reports/satisfaction', name: 'Satisfaction Reports' },
  { path: '/reports/audit', name: 'Audit Logs' },
  { path: '/settings', name: 'Settings' },
  { path: '/settings/messaging', name: 'Messaging Settings' },
  { path: '/users', name: 'Users' },
  { path: '/help', name: 'Help' }
];

test.describe('Full Site Validation', () => {
  // Test each route for basic loading and no errors
  routes.forEach(({ path, name }) => {
    test(`${name} page (${path}) loads without errors`, async ({ page }) => {
      // Collect console errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Collect page errors (uncaught exceptions)
      const pageErrors: Error[] = [];
      page.on('pageerror', error => {
        pageErrors.push(error);
      });

      // Navigate to the page
      const response = await page.goto(path);

      // Check response status
      expect(response?.status()).toBeLessThan(400);

      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');

      // Check for common error indicators
      await expect(page.locator('text="Build Error"')).not.toBeVisible();
      await expect(page.locator('text="Application error"')).not.toBeVisible();
      await expect(page.locator('text="Something went wrong"')).not.toBeVisible();
      await expect(page.locator('text="404"')).not.toBeVisible();
      await expect(page.locator('text="Internal Server Error"')).not.toBeVisible();

      // Verify no console errors
      expect(consoleErrors).toHaveLength(0);

      // Verify no page errors
      expect(pageErrors).toHaveLength(0);

      // Take a screenshot for visual verification
      await page.screenshot({
        path: `tests/screenshots/${name.toLowerCase().replace(/\s+/g, '-')}.png`,
        fullPage: true
      });
    });
  });

  // Test critical user flows
  test.describe('Critical User Flows', () => {
    test('Create new customer flow', async ({ page }) => {
      await page.goto('/customers');

      // Check if new customer button exists and is clickable
      const newCustomerBtn = page.locator('button:has-text("New Customer")');
      await expect(newCustomerBtn).toBeVisible();
      await newCustomerBtn.click();

      // Check if dialog opens
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('Create new job flow', async ({ page }) => {
      await page.goto('/jobs');

      // Check if new job button exists
      const newJobBtn = page.locator('button:has-text("New Job")');
      await expect(newJobBtn).toBeVisible();
      await newJobBtn.click();

      // Check if dialog opens
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('Navigate between major sections', async ({ page }) => {
      await page.goto('/dashboard');

      // Test sidebar navigation
      await page.click('text=Customers');
      await expect(page).toHaveURL('/customers');

      await page.click('text=Jobs');
      await expect(page).toHaveURL('/jobs');

      await page.click('text=Calendar');
      await expect(page).toHaveURL('/schedule/calendar');
    });
  });

  // Test responsive design
  test.describe('Responsive Design', () => {
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ];

    viewports.forEach(({ name, width, height }) => {
      test(`Dashboard renders correctly on ${name}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Check if key elements are visible
        await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

        // Take screenshot for visual verification
        await page.screenshot({
          path: `tests/screenshots/dashboard-${name.toLowerCase()}.png`,
          fullPage: true
        });
      });
    });
  });
});

// Create a separate test for checking all links
test.describe('Link Validation', () => {
  test('All internal links work correctly', async ({ page }) => {
    await page.goto('/');

    // Get all internal links
    const links = await page.locator('a[href^="/"]').all();

    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href) {
        const response = await page.request.get(href);
        expect(response.status()).toBeLessThan(400);
      }
    }
  });
});

// Performance testing
test.describe('Performance Checks', () => {
  test('Dashboard loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });
});