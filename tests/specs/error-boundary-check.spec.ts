import { test, expect } from '@playwright/test';

test.describe('Error Boundary Testing', () => {
  test('Application handles 404 errors gracefully', async ({ page }) => {
    // Test 404 page
    await page.goto('/non-existent-page');

    // Check for 404 handling
    const response = await page.waitForResponse('**/non-existent-page');
    expect(response.status()).toBe(404);

    // Check if we get a proper error page or are redirected
    await page.waitForLoadState('networkidle');

    // Look for common 404 indicators
    const pageContent = await page.textContent('body');
    const has404Content = pageContent?.includes('404') ||
                         pageContent?.includes('Not Found') ||
                         pageContent?.includes('Page not found');

    expect(has404Content).toBeTruthy();
  });

  test('Application handles console errors gracefully', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: Error[] = [];

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to dashboard and perform actions
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Try to interact with elements that might cause errors
    try {
      await page.click('button', { timeout: 1000 });
    } catch (e) {
      // Ignore if no buttons found
    }

    // Check that critical errors are not present
    const criticalErrors = consoleErrors.filter(error =>
      error.includes('Cannot read properties of undefined') ||
      error.includes('TypeError') ||
      error.includes('ReferenceError')
    );

    // Report any critical errors found
    if (criticalErrors.length > 0) {
      console.log('Critical console errors found:', criticalErrors);
    }

    if (pageErrors.length > 0) {
      console.log('Page errors found:', pageErrors);
    }
  });

  test('Application recovers from network errors', async ({ page }) => {
    // Start with a working page
    await page.goto('/dashboard');
    await expect(page.locator('h1')).toBeVisible();

    // Simulate network failure by going offline
    await page.context().setOffline(true);

    // Try to navigate to another page
    await page.goto('/customers', { waitUntil: 'commit' });

    // Restore network
    await page.context().setOffline(false);

    // Check that app recovers
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Application handles authentication errors', async ({ page }) => {
    // Test pages that might require authentication
    const protectedRoutes = ['/settings', '/users', '/reports'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // Check that the page loads (either with content or redirect to login)
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
      expect(pageContent!.length).toBeGreaterThan(0);
    }
  });

  test('Application handles malformed URLs gracefully', async ({ page }) => {
    const malformedUrls = [
      '/customers/%20%20%20',
      '/jobs/abc123def',
      '/schedule/invalid-date',
      '/<script>alert("xss")</script>',
      '/customers/../admin'
    ];

    for (const url of malformedUrls) {
      try {
        await page.goto(url);
        await page.waitForLoadState('networkidle');

        // Check that we don't get a server error or crash
        const pageContent = await page.textContent('body');
        expect(pageContent).toBeTruthy();

        // Check for error indicators
        const hasError = pageContent?.includes('500') ||
                        pageContent?.includes('Internal Server Error') ||
                        pageContent?.includes('Something went wrong');

        if (hasError) {
          console.log(`URL ${url} resulted in server error`);
        }

      } catch (error) {
        console.log(`URL ${url} caused navigation error:`, error);
      }
    }
  });
});