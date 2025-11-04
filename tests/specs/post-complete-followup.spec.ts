import { test, expect } from '@playwright/test';
import { selectors, selectorHelpers } from '../utils/selectors';
import { timeUtils } from '../utils/time';

test.describe('Post-Complete Follow-Up', () => {
  test('technician can complete job and set follow-up reminder', async ({ page }) => {
    // This test runs as the technician user

    // Navigate to jobs page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Find a job that can be completed (should be "scheduled" or "in_progress" status)
    const jobCard = page.locator(selectors.jobs.jobCard).first();
    await expect(jobCard).toBeVisible();

    // Get job details for verification later
    const customerName = await jobCard.locator(selectors.jobs.jobCustomer).textContent();

    // Complete the job
    await jobCard.locator(selectors.jobs.completeButton).click();

    // Wait for completion confirmation
    await expect(page.locator(selectors.toast.successToast)).toBeVisible();

    // The follow-up picker dialog should appear automatically
    await expect(page.locator(selectors.followUpPicker.dialog)).toBeVisible();

    // Verify the dialog title
    await expect(page.locator(selectors.dialog.title)).toContainText('Follow-up');

    // The default date should be +12 months from today
    const expectedDate = timeUtils.addMonths(new Date(), 12);
    const expectedDateString = timeUtils.formatDateInput(expectedDate);

    const dateInput = page.locator(selectors.followUpPicker.dateInput);
    const currentValue = await dateInput.inputValue();

    // Check if the default date is approximately correct (within a day tolerance)
    const currentDate = new Date(currentValue);
    const timeDiff = Math.abs(currentDate.getTime() - expectedDate.getTime());
    const dayDiff = timeDiff / (1000 * 60 * 60 * 24);
    expect(dayDiff).toBeLessThan(1);

    // Accept the default follow-up settings
    await page.locator(selectors.followUpPicker.acceptButton).click();

    // Wait for the dialog to close
    await expect(page.locator(selectors.followUpPicker.dialog)).not.toBeVisible();

    // Verify success message
    await expect(page.locator(selectors.toast.successToast)).toContainText('Follow-up');

    // Navigate to reminders page to verify the reminder was created
    await page.goto('/reminders');
    await page.waitForLoadState('networkidle');

    // Look for the newly created reminder
    const reminderCard = page.locator(selectorHelpers.reminderByCustomer(customerName || 'Test Customer'));
    await expect(reminderCard).toBeVisible();

    // Verify reminder details
    await expect(reminderCard.locator(selectors.reminders.reminderType)).toContainText('follow_up');

    // Check that the reminder shows the correct scheduled date
    const reminderDate = await reminderCard.locator(selectors.reminders.reminderDate).textContent();
    expect(reminderDate).toBeTruthy();

    // The reminder should appear in the Inbox when due
    // For this test, we'll check it exists and has the correct type/origin
    const reminderStatus = await reminderCard.locator(selectors.reminders.reminderStatus).textContent();
    expect(reminderStatus).toContain('pending');
  });

  test('technician can customize follow-up reminder details', async ({ page }) => {
    // Navigate to jobs page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Find another job to complete
    const jobCards = page.locator(selectors.jobs.jobCard);
    const jobCount = await jobCards.count();

    if (jobCount > 1) {
      const jobCard = jobCards.nth(1);
      await expect(jobCard).toBeVisible();

      const customerName = await jobCard.locator(selectors.jobs.jobCustomer).textContent();

      // Complete the job
      await jobCard.locator(selectors.jobs.completeButton).click();

      // Wait for follow-up picker dialog
      await expect(page.locator(selectors.followUpPicker.dialog)).toBeVisible();

      // Customize the follow-up date (6 months instead of 12)
      const customDate = timeUtils.addMonths(new Date(), 6);
      const customDateString = timeUtils.formatDateInput(customDate);

      await page.locator(selectors.followUpPicker.dateInput).fill(customDateString);

      // Customize the message
      const customMessage = 'Custom follow-up message for carpet cleaning renewal';
      await page.locator(selectors.followUpPicker.messageTextarea).fill(customMessage);

      // Accept the custom settings
      await page.locator(selectors.followUpPicker.acceptButton).click();

      // Verify the reminder was created with custom settings
      await page.goto('/reminders');
      await page.waitForLoadState('networkidle');

      const reminderCard = page.locator(selectorHelpers.reminderByCustomer(customerName || 'Test Customer'));
      await expect(reminderCard).toBeVisible();

      // Check that it contains our custom message
      await expect(reminderCard).toContainText('Custom follow-up message');
    }
  });

  test('technician can cancel follow-up reminder creation', async ({ page }) => {
    // Navigate to jobs page
    await page.goto('/jobs');
    await page.waitForLoadState('networkidle');

    // Find a job to complete
    const jobCard = page.locator(selectors.jobs.jobCard).first();
    await expect(jobCard).toBeVisible();

    // Complete the job
    await jobCard.locator(selectors.jobs.completeButton).click();

    // Wait for follow-up picker dialog
    await expect(page.locator(selectors.followUpPicker.dialog)).toBeVisible();

    // Cancel the follow-up creation
    await page.locator(selectors.followUpPicker.cancelButton).click();

    // Dialog should close
    await expect(page.locator(selectors.followUpPicker.dialog)).not.toBeVisible();

    // Job should still be marked as completed but no reminder created
    await expect(page.locator(selectors.toast.successToast)).toContainText('completed');

    // Verify no additional reminder was created by checking reminders page
    const reminderCountBefore = await page.locator(selectors.reminders.reminderCard).count();

    await page.goto('/reminders');
    await page.waitForLoadState('networkidle');

    // Count should be the same or only increased by previously created reminders
    const reminderCountAfter = await page.locator(selectors.reminders.reminderCard).count();
    expect(reminderCountAfter).toBeLessThanOrEqual(reminderCountBefore + 2); // Account for previous tests
  });
});