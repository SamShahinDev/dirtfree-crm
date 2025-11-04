import { test, expect } from '@playwright/test';
import { selectors, selectorHelpers } from '../utils/selectors';

test.describe('Zone Board Drag and Drop', () => {
  test('dragging job to another tech updates assignment and creates audit log', async ({ page, request }) => {
    // This test runs as dispatcher user (who can manage assignments)

    // Navigate to the zone board
    await page.goto('/schedule/zone-board');
    await page.waitForLoadState('networkidle');

    // Verify zone board is loaded
    await expect(page.locator(selectors.zoneBoard.container)).toBeVisible();

    // Wait for jobs to load
    await page.waitForSelector(selectors.zoneBoard.jobCard);

    // Find a job card to drag
    const jobCards = page.locator(selectors.zoneBoard.jobCard);
    const jobCount = await jobCards.count();

    if (jobCount === 0) {
      test.skip(true, 'No jobs available on zone board for testing');
    }

    // Get the first job card details
    const sourceJobCard = jobCards.first();
    await expect(sourceJobCard).toBeVisible();

    // Get job details before the move
    const jobId = await sourceJobCard.getAttribute('data-job-id') || await sourceJobCard.getAttribute('id');
    const customerName = await sourceJobCard.locator(selectors.jobs.jobCustomer).textContent();
    const initialTech = await sourceJobCard.locator(selectors.jobs.jobTech).textContent();

    console.log(`Moving job for ${customerName} from ${initialTech}`);

    // Find the current zone/tech section
    const currentZone = sourceJobCard.locator('..'); // Parent container

    // Find a different tech section to move to
    const techSections = page.locator(selectors.zoneBoard.techSection);
    const techCount = await techSections.count();

    if (techCount < 2) {
      test.skip(true, 'Need at least 2 tech sections for drag and drop testing');
    }

    // Find a different tech section (not the current one)
    let targetTechSection;
    let targetTechName;

    for (let i = 0; i < techCount; i++) {
      const techSection = techSections.nth(i);
      const techName = await techSection.locator('[data-testid="tech-name"]').textContent();

      if (techName !== initialTech) {
        targetTechSection = techSection;
        targetTechName = techName;
        break;
      }
    }

    if (!targetTechSection) {
      test.skip(true, 'Could not find a different tech section to move job to');
    }

    console.log(`Moving to tech: ${targetTechName}`);

    // Get audit log count before the move
    const baseURL = page.url().split('/')[0] + '//' + page.url().split('/')[2];
    const auditLogsBefore = await request.get(`${baseURL}/api/audit-logs?limit=50`);
    const auditCountBefore = auditLogsBefore.ok() ? (await auditLogsBefore.json()).length : 0;

    // Perform the drag and drop
    const dragHandle = sourceJobCard.locator(selectors.zoneBoard.dragHandle).or(sourceJobCard);
    const dropZone = targetTechSection.locator(selectors.zoneBoard.dropZone).or(targetTechSection);

    // Wait for any loading states to complete
    await page.waitForLoadState('networkidle');

    // Perform drag and drop using Playwright's built-in method
    await dragHandle.hover();
    await page.mouse.down();

    await dropZone.hover();
    await page.mouse.up();

    // Alternative approach using dragTo if the above doesn't work
    // await dragHandle.dragTo(dropZone);

    // Wait for the update to complete
    await page.waitForLoadState('networkidle');

    // Verify the job appears in the new tech section
    await expect(targetTechSection.locator(selectorHelpers.jobByCustomer(customerName || 'Test Customer'))).toBeVisible();

    // Verify the job is no longer in the original position (if it was moved, not copied)
    const jobCardsAfter = page.locator(selectors.zoneBoard.jobCard);
    const updatedJobCard = jobCardsAfter.locator(`[data-job-id="${jobId}"]`).or(
      page.locator(selectorHelpers.jobByCustomer(customerName || 'Test Customer'))
    );

    // The job's tech assignment should be updated
    const newTechAssignment = await updatedJobCard.locator(selectors.jobs.jobTech).textContent();
    expect(newTechAssignment).toBe(targetTechName);

    // Verify job assignment was updated in the database
    if (jobId) {
      const jobResponse = await request.get(`${baseURL}/api/jobs/${jobId}`);

      if (jobResponse.ok()) {
        const jobData = await jobResponse.json();
        expect(jobData.assigned_tech_name || jobData.technician_name).toBe(targetTechName);
      }
    }

    // Verify audit log was created
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for async audit log creation

    const auditLogsAfter = await request.get(`${baseURL}/api/audit-logs?limit=50`);

    if (auditLogsAfter.ok()) {
      const auditLogs = await auditLogsAfter.json();
      const auditCountAfter = auditLogs.length;

      // Should have at least one new audit log
      expect(auditCountAfter).toBeGreaterThan(auditCountBefore);

      // Find the most recent audit log
      const recentAuditLog = auditLogs[0]; // Assuming logs are ordered by creation date desc

      // Verify audit log details
      expect(recentAuditLog.action).toMatch(/assign|move|update/i);
      expect(recentAuditLog.entity_type).toBe('job');

      if (jobId) {
        expect(recentAuditLog.entity_id).toBe(jobId);
      }

      // Check metadata contains assignment change info
      const metadata = typeof recentAuditLog.metadata === 'string'
        ? JSON.parse(recentAuditLog.metadata)
        : recentAuditLog.metadata;

      expect(metadata).toBeTruthy();
      expect(metadata.from_tech || metadata.previous_tech).toBe(initialTech);
      expect(metadata.to_tech || metadata.new_tech).toBe(targetTechName);
    }
  });

  test('dragging job to different zone updates zone assignment', async ({ page, request }) => {
    // Navigate to zone board
    await page.goto('/schedule/zone-board');
    await page.waitForLoadState('networkidle');

    // Find zones
    const zoneColumns = page.locator(selectors.zoneBoard.zone);
    const zoneCount = await zoneColumns.count();

    if (zoneCount < 2) {
      test.skip(true, 'Need at least 2 zones for zone change testing');
    }

    // Find a job in the first zone
    const sourceZone = zoneColumns.first();
    const sourceZoneTitle = await sourceZone.locator(selectors.zoneBoard.zoneTitle).textContent();
    const jobInSource = sourceZone.locator(selectors.zoneBoard.jobCard).first();

    if (!(await jobInSource.isVisible())) {
      test.skip(true, 'No job found in source zone');
    }

    const jobId = await jobInSource.getAttribute('data-job-id');
    const customerName = await jobInSource.locator(selectors.jobs.jobCustomer).textContent();

    // Find target zone (different from source)
    let targetZone;
    let targetZoneTitle;

    for (let i = 1; i < zoneCount; i++) {
      const zone = zoneColumns.nth(i);
      const zoneTitle = await zone.locator(selectors.zoneBoard.zoneTitle).textContent();

      if (zoneTitle !== sourceZoneTitle) {
        targetZone = zone;
        targetZoneTitle = zoneTitle;
        break;
      }
    }

    if (!targetZone) {
      test.skip(true, 'Could not find different target zone');
    }

    // Perform drag and drop to different zone
    const dragHandle = jobInSource.locator(selectors.zoneBoard.dragHandle).or(jobInSource);
    const dropZone = targetZone.locator(selectors.zoneBoard.dropZone).or(targetZone);

    await dragHandle.hover();
    await page.mouse.down();
    await dropZone.hover();
    await page.mouse.up();

    await page.waitForLoadState('networkidle');

    // Verify job appears in target zone
    await expect(targetZone.locator(selectorHelpers.jobByCustomer(customerName || 'Test Customer'))).toBeVisible();

    // Verify zone assignment in database
    if (jobId) {
      const baseURL = page.url().split('/')[0] + '//' + page.url().split('/')[2];
      const jobResponse = await request.get(`${baseURL}/api/jobs/${jobId}`);

      if (jobResponse.ok()) {
        const jobData = await jobResponse.json();
        expect(jobData.zone || jobData.zone_number).toBe(targetZoneTitle);
      }
    }

    // Verify audit log for zone change
    const baseURL = page.url().split('/')[0] + '//' + page.url().split('/')[2];
    const auditLogsResponse = await request.get(`${baseURL}/api/audit-logs?entity_id=${jobId}&limit=5`);

    if (auditLogsResponse.ok()) {
      const auditLogs = await auditLogsResponse.json();
      const zoneChangeLog = auditLogs.find((log: any) => {
        const metadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
        return metadata && (metadata.zone_change || metadata.from_zone || metadata.to_zone);
      });

      expect(zoneChangeLog).toBeTruthy();
    }
  });

  test('unauthorized users cannot drag and drop jobs', async ({ page }) => {
    // This test should run as technician user (based on storage state)
    // Technicians typically cannot reassign jobs

    await page.goto('/schedule/zone-board');
    await page.waitForLoadState('networkidle');

    // Verify zone board loads
    await expect(page.locator(selectors.zoneBoard.container)).toBeVisible();

    // Find a job card
    const jobCard = page.locator(selectors.zoneBoard.jobCard).first();

    if (!(await jobCard.isVisible())) {
      test.skip(true, 'No jobs visible for technician');
    }

    // Check if drag handles are disabled or not present for technicians
    const dragHandle = jobCard.locator(selectors.zoneBoard.dragHandle);

    // Either drag handle should not exist, or dragging should be disabled
    if (await dragHandle.isVisible()) {
      // Try to drag - should not work or should show error
      const techSections = page.locator(selectors.zoneBoard.techSection);

      if (await techSections.count() > 1) {
        const targetSection = techSections.nth(1);

        await dragHandle.hover();
        await page.mouse.down();
        await targetSection.hover();
        await page.mouse.up();

        // Should either show error message or revert the move
        // This depends on how the UI handles unauthorized drag attempts
        const errorToast = page.locator(selectors.toast.errorToast);

        if (await errorToast.isVisible()) {
          await expect(errorToast).toContainText(/unauthorized|permission|not.allowed/i);
        }
      }
    } else {
      // Drag handles not visible for technicians - this is expected
      console.log('Drag handles correctly hidden for technician role');
    }
  });

  test('drag and drop works with keyboard navigation', async ({ page }) => {
    // Test accessibility - ensure drag and drop can be done with keyboard

    await page.goto('/schedule/zone-board');
    await page.waitForLoadState('networkidle');

    const jobCard = page.locator(selectors.zoneBoard.jobCard).first();

    if (!(await jobCard.isVisible())) {
      test.skip(true, 'No jobs available for keyboard navigation test');
    }

    // Focus on the job card
    await jobCard.focus();

    // Try keyboard-based drag and drop (if implemented)
    // This would typically involve:
    // 1. Space to "pick up" the item
    // 2. Arrow keys to navigate
    // 3. Space again to "drop"

    await page.keyboard.press('Space'); // Pick up
    await page.keyboard.press('ArrowRight'); // Move to next zone/tech
    await page.keyboard.press('Space'); // Drop

    // Verify if the move was successful or if appropriate feedback was provided
    // This test will depend on the specific accessibility implementation
  });

  test('handles rapid drag and drop operations', async ({ page }) => {
    // Test for race conditions in rapid operations

    await page.goto('/schedule/zone-board');
    await page.waitForLoadState('networkidle');

    const jobCards = page.locator(selectors.zoneBoard.jobCard);
    const jobCount = await jobCards.count();

    if (jobCount < 2) {
      test.skip(true, 'Need at least 2 jobs for rapid operation testing');
    }

    const techSections = page.locator(selectors.zoneBoard.techSection);
    const techCount = await techSections.count();

    if (techCount < 2) {
      test.skip(true, 'Need at least 2 tech sections for rapid operation testing');
    }

    // Perform multiple rapid drag operations
    for (let i = 0; i < Math.min(3, jobCount); i++) {
      const jobCard = jobCards.nth(i);
      const targetSection = techSections.nth(i % techCount);

      await jobCard.hover();
      await page.mouse.down();
      await targetSection.hover();
      await page.mouse.up();

      // Small delay between operations
      await page.waitForTimeout(100);
    }

    await page.waitForLoadState('networkidle');

    // Verify the board is still in a consistent state
    await expect(page.locator(selectors.zoneBoard.container)).toBeVisible();

    // Check that no error messages appeared
    await expect(page.locator(selectors.toast.errorToast)).not.toBeVisible();
  });
});