import { defineConfig, devices } from '@playwright/test';

/**
 * Dirt Free CRM E2E Test Configuration
 *
 * Available Test Specs:
 * - opportunities.spec.ts: Opportunity management, pipeline, and conversion workflows
 * - promotions.spec.ts: Promotion creation, delivery, and performance tracking
 * - reviews.spec.ts: Review requests, portal submissions, and low-rating follow-ups
 * - loyalty.spec.ts: Points awarding, rewards redemption, tier progression, referrals
 * - chatbot.spec.ts: AI chatbot interactions and escalation to human agents
 * - analytics.spec.ts: Revenue dashboards, custom reports, and data export
 * - portal-integration.spec.ts: Complete customer portal workflows
 *
 * Run all tests: npm run test:e2e
 * Run specific spec: npx playwright test opportunities.spec.ts
 * Run with UI: npx playwright test --ui
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/specs',
  /* Maximum test run time (90s) */
  timeout: 90 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on failure */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI to ensure deterministic runs */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter configuration with custom HTML reports */
  reporter: [
    ['html', { outputFolder: 'tests/results/playwright-report' }],
    ['list'],
    ['json', { outputFile: 'tests/results/test-results.json' }]
  ],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL from env or fallback */
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Screenshots on failure and success for visual validation */
    screenshot: 'only-on-failure',
    /* Video on failure for debugging */
    video: 'retain-on-failure',
    /* Consistent viewport for tests */
    viewport: { width: 1280, height: 720 },
    /* Respect reduced motion for accessibility */
    reducedMotion: 'reduce',
    /* Timeouts */
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },

  /* Configure projects for comprehensive testing */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  /* Output folder for test results */
  outputDir: 'tests/results/',
});