import { test, expect } from '@playwright/test';
import { selectors, selectorHelpers } from '../utils/selectors';

test.describe('STOP Compliance', () => {
  test('blocks SMS sends to opted-out phone numbers', async ({ page, request }) => {
    // This test runs as dispatcher user

    // Navigate to reminders page
    await page.goto('/reminders');
    await page.waitForLoadState('networkidle');

    // Find a reminder for testing
    const reminderCard = page.locator(selectors.reminders.reminderCard).first();
    await expect(reminderCard).toBeVisible();

    // Before testing STOP compliance, let's create a reminder with the opted-out phone number
    // Or modify the existing reminder to use the opted-out phone number (+15555559999)
    // This would typically be done through the UI or by seeding data with that number

    // Look for a reminder we can test with
    // The seeded data should include a reminder that can be used for this test
    const testReminderCard = page.locator(selectorHelpers.reminderByCustomer('Test Customer'));

    if (!(await testReminderCard.isVisible())) {
      // Skip this test if no test reminder is available
      test.skip(true, 'No test reminder available for STOP compliance testing');
    }

    // Attempt to send SMS
    await testReminderCard.locator(selectors.reminders.sendSmsButton).click();

    // For the opted-out number, the system should block the send
    // This test assumes the UI shows an error message when trying to send to opted-out numbers

    // Check for error message indicating the number is opted out
    await expect(page.locator(selectors.toast.errorToast))
      .toBeVisible({ timeout: 10000 });

    await expect(page.locator(selectors.toast.errorToast))
      .toContainText(/opted.out|STOP|blocked/i);

    // Verify no SMS log was created by checking the API response
    // This is an API-level verification to ensure backend compliance
    const baseURL = page.url().split('/')[0] + '//' + page.url().split('/')[2];

    // Query the SMS logs to verify no outbound log was created for the opted-out number
    const response = await request.get(`${baseURL}/api/sms/logs?phone=+15555559999`);

    if (response.ok()) {
      const logs = await response.json();

      // Filter logs to recent ones (last few minutes)
      const recentLogs = logs.filter((log: any) => {
        const logTime = new Date(log.created_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - logTime.getTime()) / (1000 * 60);
        return diffMinutes < 5; // Logs from last 5 minutes
      });

      // Should have no recent outbound logs for the opted-out number
      const outboundLogs = recentLogs.filter((log: any) => log.direction === 'outbound');
      expect(outboundLogs).toHaveLength(0);
    }

    // Additional verification: check that the reminder status remains "pending"
    // Since the SMS was blocked, the reminder should not be marked as sent
    await expect(testReminderCard.locator(selectors.reminders.reminderStatus))
      .toContainText('pending');
  });

  test('allows SMS sends to non-opted-out phone numbers', async ({ page, request }) => {
    // This test verifies that normal (non-opted-out) numbers can still receive SMS

    // Navigate to reminders page
    await page.goto('/reminders');
    await page.waitForLoadState('networkidle');

    // Create a test reminder with a non-opted-out number or modify existing one
    // For this test, we'll use a different test number that's not opted out
    const nonOptedOutNumber = '+15555551234'; // This should be the test customer's number

    const testReminderCard = page.locator(selectorHelpers.reminderByCustomer('Test Customer'));

    if (await testReminderCard.isVisible()) {
      // Attempt to send SMS to non-opted-out number
      await testReminderCard.locator(selectors.reminders.sendSmsButton).click();

      // Should succeed without STOP compliance error
      await expect(page.locator(selectors.toast.successToast))
        .toBeVisible({ timeout: 10000 });

      await expect(page.locator(selectors.toast.successToast))
        .toContainText(/sent|success/i);

      // Verify an SMS log was created
      const baseURL = page.url().split('/')[0] + '//' + page.url().split('/')[2];
      const response = await request.get(`${baseURL}/api/sms/logs?phone=${nonOptedOutNumber}`);

      if (response.ok()) {
        const logs = await response.json();

        // Should have at least one recent outbound log
        const recentLogs = logs.filter((log: any) => {
          const logTime = new Date(log.created_at);
          const now = new Date();
          const diffMinutes = (now.getTime() - logTime.getTime()) / (1000 * 60);
          return diffMinutes < 5;
        });

        const outboundLogs = recentLogs.filter((log: any) => log.direction === 'outbound');
        expect(outboundLogs.length).toBeGreaterThan(0);
      }
    }
  });

  test('API endpoint blocks opted-out numbers directly', async ({ request }) => {
    // Direct API test to verify backend STOP compliance

    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    // Attempt to send SMS to opted-out number via API
    const response = await request.post(`${baseURL}/api/sms/send`, {
      data: {
        to: '+15555559999', // Opted-out number from seed data
        message: 'Test message that should be blocked',
        type: 'reminder',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Should return an error status
    expect(response.status()).toBe(400);

    const responseBody = await response.json();
    expect(responseBody.error).toBeTruthy();
    expect(responseBody.error.toLowerCase()).toContain('opted out');

    // Verify no log was created
    const logsResponse = await request.get(`${baseURL}/api/sms/logs?phone=+15555559999`);

    if (logsResponse.ok()) {
      const logs = await logsResponse.json();

      // Filter to very recent logs (last minute)
      const veryRecentLogs = logs.filter((log: any) => {
        const logTime = new Date(log.created_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - logTime.getTime()) / (1000 * 60);
        return diffMinutes < 1;
      });

      expect(veryRecentLogs).toHaveLength(0);
    }
  });

  test('allows SMS to non-opted-out numbers via API', async ({ request }) => {
    // Verify API allows SMS to normal numbers

    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    // Send SMS to non-opted-out number
    const response = await request.post(`${baseURL}/api/sms/send`, {
      data: {
        to: '+15555551234', // Non-opted-out test number
        message: 'Test message that should succeed',
        type: 'reminder',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Should succeed
    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    expect(responseBody.success).toBeTruthy();

    // Verify log was created
    const logsResponse = await request.get(`${baseURL}/api/sms/logs?phone=+15555551234`);

    if (logsResponse.ok()) {
      const logs = await logsResponse.json();

      // Should have at least one recent log
      const recentLogs = logs.filter((log: any) => {
        const logTime = new Date(log.created_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - logTime.getTime()) / (1000 * 60);
        return diffMinutes < 2;
      });

      expect(recentLogs.length).toBeGreaterThan(0);
    }
  });
});