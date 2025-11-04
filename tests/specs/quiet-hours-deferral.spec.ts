import { test, expect } from '@playwright/test';
import { TimeHelper, timeUtils } from '../utils/time';

test.describe('Quiet Hours Deferral', () => {
  test('reminders are deferred during quiet hours (9p-8a CT)', async ({ page, request }) => {
    const timeHelper = new TimeHelper(page);
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    // Freeze time to 22:15 CT (10:15 PM Central Time) - during quiet hours
    const quietHoursTime = await timeHelper.freezeToQuietHours();

    console.log(`Frozen time to quiet hours: ${timeHelper.formatCentralTime(quietHoursTime)}`);

    // Verify we're in quiet hours
    expect(timeHelper.isQuietHours(quietHoursTime)).toBeTruthy();

    // Get the initial state of reminders before triggering cron
    const remindersBeforeResponse = await request.get(`${baseURL}/api/reminders`);
    expect(remindersBeforeResponse.ok()).toBeTruthy();

    const remindersBefore = await remindersBeforeResponse.json();
    const pendingRemindersBefore = remindersBefore.filter((r: any) => r.status === 'pending');

    // Trigger the reminders cron endpoint (this simulates the scheduled cron job)
    const cronResponse = await request.post(`${baseURL}/api/cron/reminders`, {
      headers: {
        'Content-Type': 'application/json',
        // Add any required cron auth headers if needed
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
      },
    });

    // The cron should run successfully but defer sends due to quiet hours
    expect(cronResponse.status()).toBe(200);

    const cronResult = await cronResponse.json();
    console.log('Cron result:', cronResult);

    // Verify that reminders due now are rescheduled to next 8 AM CT
    const remindersAfterResponse = await request.get(`${baseURL}/api/reminders`);
    expect(remindersAfterResponse.ok()).toBeTruthy();

    const remindersAfter = await remindersAfterResponse.json();

    // Find reminders that were rescheduled
    const rescheduledReminders = remindersAfter.filter((reminder: any) => {
      const scheduledTime = new Date(reminder.scheduled_date);
      const centralTime = timeHelper.toCentralTime(scheduledTime);

      // Should be scheduled for 8:00 AM Central Time on the next day
      return centralTime.getHours() === 8 && centralTime.getMinutes() === 0;
    });

    // Should have at least one rescheduled reminder
    expect(rescheduledReminders.length).toBeGreaterThan(0);

    // Verify the rescheduled time is correct (next 8 AM CT)
    const expectedNext8Am = timeHelper.getNext8AmCentral(quietHoursTime);

    for (const reminder of rescheduledReminders) {
      const scheduledTime = new Date(reminder.scheduled_date);

      // Should be scheduled for approximately the next 8 AM CT
      const timeDiff = Math.abs(scheduledTime.getTime() - expectedNext8Am.getTime());
      const minutesDiff = timeDiff / (1000 * 60);

      // Allow for small variations (within 5 minutes)
      expect(minutesDiff).toBeLessThan(5);
    }

    // Verify no immediate SMS sends occurred during quiet hours
    const smsLogsResponse = await request.get(`${baseURL}/api/sms/logs`);

    if (smsLogsResponse.ok()) {
      const smsLogs = await smsLogsResponse.json();

      // Filter to logs from the last few minutes (during our test)
      const recentLogs = smsLogs.filter((log: any) => {
        const logTime = new Date(log.created_at);
        const timeDiff = Math.abs(logTime.getTime() - quietHoursTime.getTime());
        return timeDiff < 5 * 60 * 1000; // Within last 5 minutes
      });

      // Should have no outbound SMS logs during quiet hours
      const outboundLogs = recentLogs.filter((log: any) => log.direction === 'outbound');
      expect(outboundLogs).toHaveLength(0);
    }
  });

  test('reminders are sent immediately during active hours (8a-9p CT)', async ({ page, request }) => {
    const timeHelper = new TimeHelper(page);
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    // Freeze time to 10:00 AM CT - during active hours
    const activeHoursTime = timeHelper.createCentralTime(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
      10,
      0
    );

    await timeHelper.freezeTime(activeHoursTime);

    console.log(`Frozen time to active hours: ${timeHelper.formatCentralTime(activeHoursTime)}`);

    // Verify we're NOT in quiet hours
    expect(timeHelper.isQuietHours(activeHoursTime)).toBeFalsy();

    // Create a reminder that's due now for testing
    const createReminderResponse = await request.post(`${baseURL}/api/reminders`, {
      data: {
        customer_id: 'test-customer-id',
        customer_name: 'Test Customer Inc',
        customer_phone: '+15555551234',
        scheduled_date: activeHoursTime.toISOString(),
        type: 'follow_up',
        status: 'pending',
        message: 'Test reminder for active hours',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Trigger the reminders cron
    const cronResponse = await request.post(`${baseURL}/api/cron/reminders`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET || 'test-secret'}`,
      },
    });

    expect(cronResponse.status()).toBe(200);

    const cronResult = await cronResponse.json();

    // During active hours, reminders should be sent immediately
    // Check that SMS logs were created
    const smsLogsResponse = await request.get(`${baseURL}/api/sms/logs?phone=+15555551234`);

    if (smsLogsResponse.ok()) {
      const smsLogs = await smsLogsResponse.json();

      // Should have recent outbound logs
      const recentLogs = smsLogs.filter((log: any) => {
        const logTime = new Date(log.created_at);
        const timeDiff = Math.abs(logTime.getTime() - activeHoursTime.getTime());
        return timeDiff < 5 * 60 * 1000; // Within last 5 minutes
      });

      const outboundLogs = recentLogs.filter((log: any) => log.direction === 'outbound');
      expect(outboundLogs.length).toBeGreaterThan(0);
    }
  });

  test('8 AM boundary is handled correctly', async ({ page, request }) => {
    const timeHelper = new TimeHelper(page);
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

    // Test exactly at 8:00 AM CT (should not be quiet hours)
    const eightAmTime = timeHelper.createCentralTime(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
      8,
      0
    );

    await timeHelper.freezeTime(eightAmTime);

    // 8:00 AM should NOT be quiet hours
    expect(timeHelper.isQuietHours(eightAmTime)).toBeFalsy();

    // Test 7:59 AM CT (should be quiet hours)
    const sevenFiftyNineTime = timeHelper.createCentralTime(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
      7,
      59
    );

    // 7:59 AM should be quiet hours
    expect(timeHelper.isQuietHours(sevenFiftyNineTime)).toBeTruthy();
  });

  test('9 PM boundary is handled correctly', async ({ page, request }) => {
    const timeHelper = new TimeHelper(page);

    // Test exactly at 9:00 PM CT (should be quiet hours)
    const ninePmTime = timeHelper.createCentralTime(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
      21,
      0
    );

    // 9:00 PM should be quiet hours
    expect(timeHelper.isQuietHours(ninePmTime)).toBeTruthy();

    // Test 8:59 PM CT (should NOT be quiet hours)
    const eightFiftyNineTime = timeHelper.createCentralTime(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      new Date().getDate(),
      20,
      59
    );

    // 8:59 PM should NOT be quiet hours
    expect(timeHelper.isQuietHours(eightFiftyNineTime)).toBeFalsy();
  });

  test('DST transitions are handled correctly', async ({ page }) => {
    const timeHelper = new TimeHelper(page);

    // Test during standard time (CST - UTC-6)
    const winterTime = new Date(2024, 0, 15, 12, 0); // January 15, 2024
    const winterCentral = timeHelper.toCentralTime(winterTime);

    // Test during daylight time (CDT - UTC-5)
    const summerTime = new Date(2024, 6, 15, 12, 0); // July 15, 2024
    const summerCentral = timeHelper.toCentralTime(summerTime);

    // The hour difference should account for DST
    const hourDiff = summerCentral.getHours() - winterCentral.getHours();
    expect(Math.abs(hourDiff)).toBe(1); // Should be 1 hour difference due to DST
  });
});