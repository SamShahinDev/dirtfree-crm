/**
 * Analytics Dashboard E2E Tests
 *
 * Tests analytics viewing, custom report generation, and data export
 */

import { test, expect } from '@playwright/test'
import { loginAsStaff, logout } from '../helpers/auth'

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin user
    await loginAsStaff(page, 'admin')
  })

  test.afterEach(async ({ page }) => {
    await logout(page)
  })

  test('views revenue dashboard', async ({ page }) => {
    // Navigate to analytics dashboard
    await page.goto('/dashboard/analytics')

    // Verify dashboard page loaded
    await expect(page.locator('h1:has-text("Analytics Dashboard")')).toBeVisible()

    // Verify key revenue metrics displayed
    await expect(page.locator('[data-metric="total-revenue"]')).toBeVisible()
    await expect(page.locator('[data-metric="monthly-revenue"]')).toBeVisible()
    await expect(page.locator('[data-metric="avg-ticket-value"]')).toBeVisible()
    await expect(page.locator('[data-metric="revenue-growth"]')).toBeVisible()

    // Verify revenue values are numbers
    const totalRevenue = await page.locator('[data-metric="total-revenue"]').textContent()
    expect(totalRevenue).toMatch(/\$[\d,]+/)

    // Verify revenue trend chart
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible()

    // Verify time period selector
    await expect(page.locator('[name="time_period"]')).toBeVisible()
  })

  test('filters revenue by date range', async ({ page }) => {
    // Navigate to analytics
    await page.goto('/dashboard/analytics')

    // Select custom date range
    await page.selectOption('[name="time_period"]', 'custom')

    // Set date range
    await page.fill('[name="start_date"]', '2025-01-01')
    await page.fill('[name="end_date"]', '2025-10-24')

    // Apply filter
    await page.click('button:has-text("Apply")')

    // Verify data updated
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible()

    // Verify date range displayed
    await expect(page.locator('[data-testid="selected-range"]')).toContainText('2025-01-01')
    await expect(page.locator('[data-testid="selected-range"]')).toContainText('2025-10-24')
  })

  test('views customer analytics', async ({ page }) => {
    // Navigate to customer analytics
    await page.goto('/dashboard/analytics/customers')

    // Verify customer metrics
    await expect(page.locator('[data-metric="total-customers"]')).toBeVisible()
    await expect(page.locator('[data-metric="new-customers"]')).toBeVisible()
    await expect(page.locator('[data-metric="active-customers"]')).toBeVisible()
    await expect(page.locator('[data-metric="customer-retention"]')).toBeVisible()

    // Verify customer acquisition chart
    await expect(page.locator('[data-testid="acquisition-chart"]')).toBeVisible()

    // Verify customer segmentation
    await expect(page.locator('[data-testid="customer-segments"]')).toBeVisible()

    // Verify top customers list
    await expect(page.locator('[data-testid="top-customers"]')).toBeVisible()
  })

  test('views job performance analytics', async ({ page }) => {
    // Navigate to job analytics
    await page.goto('/dashboard/analytics/jobs')

    // Verify job metrics
    await expect(page.locator('[data-metric="total-jobs"]')).toBeVisible()
    await expect(page.locator('[data-metric="completed-jobs"]')).toBeVisible()
    await expect(page.locator('[data-metric="completion-rate"]')).toBeVisible()
    await expect(page.locator('[data-metric="avg-job-duration"]')).toBeVisible()

    // Verify jobs by status chart
    await expect(page.locator('[data-testid="jobs-status-chart"]')).toBeVisible()

    // Verify jobs by service type
    await expect(page.locator('[data-testid="service-breakdown"]')).toBeVisible()

    // Verify technician performance
    await expect(page.locator('[data-testid="technician-stats"]')).toBeVisible()
  })

  test('views marketing analytics', async ({ page }) => {
    // Navigate to marketing analytics
    await page.goto('/dashboard/analytics/marketing')

    // Verify marketing metrics
    await expect(page.locator('[data-metric="total-campaigns"]')).toBeVisible()
    await expect(page.locator('[data-metric="active-promotions"]')).toBeVisible()
    await expect(page.locator('[data-metric="conversion-rate"]')).toBeVisible()
    await expect(page.locator('[data-metric="roi"]')).toBeVisible()

    // Verify campaign performance chart
    await expect(page.locator('[data-testid="campaign-performance"]')).toBeVisible()

    // Verify lead source breakdown
    await expect(page.locator('[data-testid="lead-sources"]')).toBeVisible()

    // Verify promotion usage stats
    await expect(page.locator('[data-testid="promotion-stats"]')).toBeVisible()
  })

  test('generates custom report', async ({ page }) => {
    // Navigate to reports page
    await page.goto('/dashboard/analytics/reports')

    // Click create custom report
    await page.click('button:has-text("Create Custom Report")')

    // Verify report builder visible
    await expect(page.locator('[data-testid="report-builder"]')).toBeVisible()

    // Select report type
    await page.selectOption('[name="report_type"]', 'revenue')

    // Select metrics
    await page.check('[name="metrics[]"][value="total_revenue"]')
    await page.check('[name="metrics[]"][value="avg_ticket_value"]')
    await page.check('[name="metrics[]"][value="payment_methods"]')

    // Select dimensions
    await page.check('[name="dimensions[]"][value="service_type"]')
    await page.check('[name="dimensions[]"][value="time_period"]')

    // Set date range
    await page.fill('[name="start_date"]', '2025-01-01')
    await page.fill('[name="end_date"]', '2025-12-31')

    // Set grouping
    await page.selectOption('[name="group_by"]', 'month')

    // Add filters
    await page.click('button:has-text("Add Filter")')
    await page.selectOption('[name="filter_field"]', 'service_type')
    await page.selectOption('[name="filter_operator"]', 'equals')
    await page.selectOption('[name="filter_value"]', 'Carpet Cleaning')

    // Preview report
    await page.click('button:has-text("Preview Report")')

    // Verify preview displayed
    await expect(page.locator('[data-testid="report-preview"]')).toBeVisible()

    // Verify data table
    await expect(page.locator('[data-testid="report-table"]')).toBeVisible()

    // Verify chart visualization
    await expect(page.locator('[data-testid="report-chart"]')).toBeVisible()
  })

  test('saves custom report', async ({ page }) => {
    // Navigate to reports and create report
    await page.goto('/dashboard/analytics/reports')
    await page.click('button:has-text("Create Custom Report")')

    // Configure basic report
    await page.selectOption('[name="report_type"]', 'revenue')
    await page.check('[name="metrics[]"][value="total_revenue"]')

    // Save report
    await page.click('button:has-text("Save Report")')

    // Fill save dialog
    await page.fill('[name="report_name"]', 'Monthly Revenue Report')
    await page.fill('[name="report_description"]', 'Total revenue breakdown by month')

    // Confirm save
    await page.click('button:has-text("Save")')

    // Verify success message
    await expect(page.locator('text=Report saved successfully')).toBeVisible()

    // Verify report appears in saved reports
    await page.goto('/dashboard/analytics/reports')
    await expect(page.locator('text=Monthly Revenue Report')).toBeVisible()
  })

  test('schedules automated report', async ({ page }) => {
    // Navigate to saved reports
    await page.goto('/dashboard/analytics/reports')

    // Click on saved report
    await page.click('tr:has-text("Monthly Revenue Report")')

    // Click schedule button
    await page.click('button:has-text("Schedule Report")')

    // Configure schedule
    await page.selectOption('[name="frequency"]', 'monthly')
    await page.selectOption('[name="day_of_month"]', '1')
    await page.fill('[name="time"]', '09:00')

    // Select recipients
    await page.fill('[name="recipients"]', 'admin@dirtfree.com, manager@dirtfree.com')

    // Select format
    await page.check('[name="formats[]"][value="pdf"]')
    await page.check('[name="formats[]"][value="csv"]')

    // Save schedule
    await page.click('button:has-text("Save Schedule")')

    // Verify success
    await expect(page.locator('text=Report scheduled')).toBeVisible()

    // Verify schedule displayed
    await expect(page.locator('[data-testid="report-schedule"]')).toContainText('Monthly')
  })

  test('exports data to CSV', async ({ page }) => {
    // Navigate to analytics
    await page.goto('/dashboard/analytics')

    // Click export button
    await page.click('button:has-text("Export")')

    // Select export format
    await page.selectOption('[name="export_format"]', 'csv')

    // Select data range
    await page.fill('[name="start_date"]', '2025-01-01')
    await page.fill('[name="end_date"]', '2025-10-24')

    // Select data to include
    await page.check('[name="include[]"][value="revenue"]')
    await page.check('[name="include[]"][value="jobs"]')
    await page.check('[name="include[]"][value="customers"]')

    // Download export
    await page.click('button:has-text("Download CSV")')

    // Wait for download
    const downloadPromise = page.waitForEvent('download')
    const download = await downloadPromise

    // Verify download
    expect(download.suggestedFilename()).toContain('.csv')
    expect(download.suggestedFilename()).toContain('analytics')
  })

  test('exports data to Excel', async ({ page }) => {
    // Navigate to analytics
    await page.goto('/dashboard/analytics')

    // Click export button
    await page.click('button:has-text("Export")')

    // Select Excel format
    await page.selectOption('[name="export_format"]', 'xlsx')

    // Configure export
    await page.fill('[name="start_date"]', '2025-01-01')
    await page.fill('[name="end_date"]', '2025-10-24')

    // Download
    await page.click('button:has-text("Download Excel")')

    // Wait for download
    const downloadPromise = page.waitForEvent('download')
    const download = await downloadPromise

    // Verify download
    expect(download.suggestedFilename()).toContain('.xlsx')
  })

  test('exports data to PDF report', async ({ page }) => {
    // Navigate to analytics
    await page.goto('/dashboard/analytics')

    // Click export button
    await page.click('button:has-text("Export")')

    // Select PDF format
    await page.selectOption('[name="export_format"]', 'pdf')

    // Configure PDF options
    await page.check('[name="include_charts"]')
    await page.check('[name="include_summary"]')
    await page.selectOption('[name="page_orientation"]', 'landscape')

    // Download
    await page.click('button:has-text("Download PDF")')

    // Wait for download
    const downloadPromise = page.waitForEvent('download')
    const download = await downloadPromise

    // Verify download
    expect(download.suggestedFilename()).toContain('.pdf')
  })

  test('compares time periods', async ({ page }) => {
    // Navigate to analytics
    await page.goto('/dashboard/analytics')

    // Enable comparison mode
    await page.check('[name="enable_comparison"]')

    // Select current period
    await page.fill('[name="current_start"]', '2025-10-01')
    await page.fill('[name="current_end"]', '2025-10-24')

    // Select comparison period
    await page.fill('[name="compare_start"]', '2025-09-01')
    await page.fill('[name="compare_end"]', '2025-09-24')

    // Apply comparison
    await page.click('button:has-text("Compare")')

    // Verify comparison metrics displayed
    await expect(page.locator('[data-testid="comparison-view"]')).toBeVisible()

    // Verify percentage change indicators
    await expect(page.locator('[data-testid="revenue-change"]')).toBeVisible()
    await expect(page.locator('[data-testid="revenue-change"]')).toContainText(/%/)

    // Verify comparison chart
    await expect(page.locator('[data-testid="comparison-chart"]')).toBeVisible()
  })

  test('views real-time analytics', async ({ page }) => {
    // Navigate to real-time dashboard
    await page.goto('/dashboard/analytics/realtime')

    // Verify real-time metrics
    await expect(page.locator('h1:has-text("Real-Time Analytics")')).toBeVisible()

    // Verify live metrics
    await expect(page.locator('[data-metric="active-users"]')).toBeVisible()
    await expect(page.locator('[data-metric="jobs-today"]')).toBeVisible()
    await expect(page.locator('[data-metric="revenue-today"]')).toBeVisible()

    // Verify live activity feed
    await expect(page.locator('[data-testid="activity-feed"]')).toBeVisible()

    // Verify metrics update (check for live indicator)
    await expect(page.locator('[data-testid="live-indicator"]')).toBeVisible()
  })

  test('creates dashboard widget', async ({ page }) => {
    // Navigate to analytics
    await page.goto('/dashboard/analytics')

    // Click customize dashboard
    await page.click('button:has-text("Customize Dashboard")')

    // Enter edit mode
    await expect(page.locator('[data-testid="dashboard-edit-mode"]')).toBeVisible()

    // Click add widget
    await page.click('button:has-text("Add Widget")')

    // Select widget type
    await page.selectOption('[name="widget_type"]', 'metric')

    // Configure widget
    await page.selectOption('[name="metric"]', 'total_revenue')
    await page.fill('[name="widget_title"]', 'Total Revenue')
    await page.selectOption('[name="widget_size"]', 'medium')

    // Add widget
    await page.click('button:has-text("Add Widget")')

    // Verify widget added to dashboard
    await expect(page.locator('[data-widget="total_revenue"]')).toBeVisible()

    // Save dashboard layout
    await page.click('button:has-text("Save Layout")')

    // Verify success
    await expect(page.locator('text=Dashboard saved')).toBeVisible()
  })

  test('filters by service type', async ({ page }) => {
    // Navigate to analytics
    await page.goto('/dashboard/analytics')

    // Open filters
    await page.click('button:has-text("Filters")')

    // Select service type filter
    await page.selectOption('[name="service_type"]', 'Carpet Cleaning')

    // Apply filter
    await page.click('button:has-text("Apply Filters")')

    // Verify filter applied
    await expect(page.locator('[data-testid="active-filters"]')).toContainText('Carpet Cleaning')

    // Verify data filtered
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible()

    // Clear filter
    await page.click('[data-testid="clear-filters"]')

    // Verify filter removed
    await expect(page.locator('[data-testid="active-filters"]')).not.toContainText('Carpet Cleaning')
  })

  test('views team performance analytics', async ({ page }) => {
    // Navigate to team analytics
    await page.goto('/dashboard/analytics/team')

    // Verify team metrics
    await expect(page.locator('[data-metric="total-technicians"]')).toBeVisible()
    await expect(page.locator('[data-metric="avg-jobs-per-tech"]')).toBeVisible()
    await expect(page.locator('[data-metric="team-efficiency"]')).toBeVisible()

    // Verify technician leaderboard
    await expect(page.locator('[data-testid="technician-leaderboard"]')).toBeVisible()

    // Verify performance chart
    await expect(page.locator('[data-testid="team-performance-chart"]')).toBeVisible()

    // Click on technician for details
    await page.click('[data-testid="technician-row"]:first-child')

    // Verify technician details modal
    await expect(page.locator('[data-testid="technician-details"]')).toBeVisible()
    await expect(page.locator('[data-metric="jobs-completed"]')).toBeVisible()
    await expect(page.locator('[data-metric="avg-rating"]')).toBeVisible()
  })
})
