# E2E Testing Guide

This document explains how to run and maintain the Phase-11 end-to-end test suite built with Playwright.

## Overview

The E2E test suite covers the following Phase-11 requirements:

1. **RLS Isolation** - Technicians can't see other techs' jobs/customers
2. **Post-Complete Follow-Up** - Setting follow-up reminders after job completion
3. **STOP Compliance** - Blocking SMS sends to opted-out numbers
4. **Quiet Hours Deferral** - Deferring reminders during 9p-8a CT
5. **Webhook Validation** - Rejecting invalid Twilio signatures
6. **Upload Validation** - Rejecting invalid files and stripping EXIF data
7. **Zone Board DnD** - Drag-and-drop job assignments with audit logging

## Prerequisites

### Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Test Configuration
TEST_SEED_SECRET=your_test_seed_secret
TWILIO_AUTH_TOKEN=your_twilio_auth_token
CRON_SECRET=your_cron_secret

# Optional: Override base URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Test Data Setup

The test suite automatically seeds test data using the `/api/test/seed` endpoint. Test users created:

- `admin@acme.test` (admin role)
- `dispatcher@acme.test` (dispatcher role)
- `tech@acme.test` (technician role)

All test users have the password: `Test123!@#`

## Running Tests Locally

### 1. Start the Development Server

```bash
npm run dev
```

Wait for the server to be ready at `http://localhost:3000`.

### 2. Run All E2E Tests

```bash
# Run all tests headlessly
npm run e2e

# Run with browser UI for debugging
npm run e2e:ui

# Run specific test files
npx playwright test tests/specs/rls-isolation.spec.ts

# Run tests for specific project (user role)
npx playwright test --project=chromium-admin
npx playwright test --project=chromium-technician
```

### 3. View Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

Reports are generated in the `playwright-report/` directory.

## Test Structure

### Directory Layout

```
tests/
├── specs/                     # Test specifications
│   ├── rls-isolation.spec.ts
│   ├── post-complete-followup.spec.ts
│   ├── stop-compliance.spec.ts
│   ├── quiet-hours-deferral.spec.ts
│   ├── webhook-validation.api.spec.ts
│   ├── upload-validation.spec.ts
│   └── zone-board-dnd.spec.ts
├── utils/                     # Test utilities
│   ├── auth.ts               # Authentication helpers
│   ├── selectors.ts          # UI selectors
│   ├── seed.ts               # Database seeding
│   └── time.ts               # Time manipulation helpers
├── .auth/                     # Stored auth states
├── global-setup.ts           # Global test setup
└── global-teardown.ts        # Global test cleanup
```

### Test Configuration

The `playwright.config.ts` file is configured for Phase-11 requirements:

- **Timeout**: 90 seconds maximum per test
- **Retries**: 1 retry on CI, 0 locally
- **Projects**: Separate contexts for each user role
- **Reporters**: HTML and list reporters
- **Storage States**: Pre-authenticated sessions for each role

## Test Scenarios

### 1. RLS Isolation (`rls-isolation.spec.ts`)

Verifies row-level security policies:

- Technicians can only see their own jobs and customers
- Admins and dispatchers can see all records
- Direct URL access is properly restricted

### 2. Post-Complete Follow-Up (`post-complete-followup.spec.ts`)

Tests the follow-up reminder workflow:

- Job completion triggers follow-up picker
- Default +12 months scheduling
- Custom date and message options
- Reminder creation in database

### 3. STOP Compliance (`stop-compliance.spec.ts`)

Ensures SMS opt-out compliance:

- Blocks sends to opted-out numbers (+15555559999)
- Returns appropriate error messages
- No SMS logs created for blocked sends
- Allows sends to non-opted-out numbers

### 4. Quiet Hours Deferral (`quiet-hours-deferral.spec.ts`)

Tests Central Time quiet hours (9p-8a CT):

- Time freezing at 22:15 CT
- Reminder deferral to next 8 AM CT
- No immediate sends during quiet hours
- Boundary testing (8 AM and 9 PM transitions)

### 5. Webhook Validation (`webhook-validation.api.spec.ts`)

API-level security testing:

- Invalid Twilio signatures return 401
- Valid signatures are accepted
- Malformed payloads handled gracefully
- Required fields validation

### 6. Upload Validation (`upload-validation.spec.ts`)

File upload security and processing:

- Rejects .exe files with friendly errors
- Returns 400 for invalid MIME types
- Accepts valid JPEGs
- Strips EXIF data from images
- Handles large files appropriately

### 7. Zone Board DnD (`zone-board-dnd.spec.ts`)

Drag-and-drop functionality:

- Updates job assignments
- Creates audit log entries
- Handles zone changes
- Respects user permissions
- Keyboard accessibility

## Debugging Tests

### Running Tests in Debug Mode

```bash
# Run with browser visible
npx playwright test --headed

# Debug specific test
npx playwright test --debug tests/specs/rls-isolation.spec.ts

# Run with inspector
npx playwright test --ui
```

### Viewing Traces

When tests fail, traces are automatically captured:

```bash
npx playwright show-trace test-results/path-to-trace.zip
```

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots (`screenshot: 'only-on-failure'`)
- Videos (`video: 'retain-on-failure'`)

## Maintaining Tests

### Updating Selectors

When UI changes, update selectors in `tests/utils/selectors.ts`:

```typescript
export const selectors = {
  jobs: {
    completeButton: '[data-testid="job-complete-button"]',
    // Add new selectors here
  }
};
```

### Adding Test Data

To add new test data, modify `tests/utils/seed.ts`:

```typescript
// Add new test entities
const newTestData = {
  // ... your test data
};

await this.supabase.from('your_table').insert(newTestData);
```

### Updating Time Helpers

For new time-related tests, extend `tests/utils/time.ts`:

```typescript
export class TimeHelper {
  // Add new time manipulation methods
}
```

## CI/CD Integration

### GitHub Actions

The `.github/workflows/e2e.yml` workflow:

1. Sets up Node.js and dependencies
2. Starts Supabase local development
3. Builds and starts the Next.js app
4. Seeds test database
5. Runs Playwright tests
6. Uploads test reports as artifacts
7. Cleans up test data

### Required Secrets

Configure these GitHub secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TEST_SEED_SECRET`
- `TWILIO_AUTH_TOKEN`
- `CRON_SECRET`
- `STAGING_URL` (for staging tests)

### Running on Staging

For staging environment testing:

```bash
# Manual workflow dispatch with staging target
gh workflow run e2e.yml
```

## Performance Considerations

### Test Speed Optimization

- Tests run in parallel by default
- Storage states eliminate repeated logins
- Database seeding is idempotent
- Selective test running with tags

### Resource Management

- Maximum 90-second timeout per test
- Automatic cleanup after failures
- Trace collection only on retries
- Video recording only on failures

## Troubleshooting

### Common Issues

**Tests timeout waiting for elements:**
- Check if selectors match actual DOM
- Verify page load states
- Add explicit waits where needed

**Authentication failures:**
- Verify environment variables
- Check Supabase configuration
- Ensure test users exist

**Database seeding errors:**
- Confirm `TEST_SEED_SECRET` is set
- Check Supabase permissions
- Verify API route accessibility

**Time-related test failures:**
- Ensure time zone handling is correct
- Check DST transition logic
- Verify Central Time calculations

### Getting Help

1. Check the Playwright documentation: https://playwright.dev/
2. Review test logs in CI artifacts
3. Use `--debug` mode for interactive debugging
4. Check browser dev tools during `--headed` runs

## Future Improvements

- Add visual regression testing
- Implement parallel test data isolation
- Add performance benchmarking
- Extend mobile viewport testing
- Add accessibility testing automation