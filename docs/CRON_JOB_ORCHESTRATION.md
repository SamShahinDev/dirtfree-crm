# Cron Job Orchestration

Comprehensive cron job management system for automated background tasks.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
- [Job Registry](#job-registry)
- [Job Execution](#job-execution)
- [API Endpoints](#api-endpoints)
- [Management Dashboard](#management-dashboard)
- [Database Schema](#database-schema)
- [Adding New Jobs](#adding-new-jobs)
- [Monitoring](#monitoring)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Cron Job Orchestration system provides centralized management for all scheduled background tasks:

- **17 Pre-configured Jobs**: Opportunities, promotions, reviews, loyalty, analytics, monitoring, and cleanup
- **Intelligent Execution**: Timeout handling, retry logic with exponential backoff
- **Comprehensive Logging**: All executions logged to database with detailed metrics
- **Real-Time Monitoring**: Live dashboard showing job status and statistics
- **Flexible Control**: Enable/disable jobs, manual execution, execution history

---

## Features

### 1. Job Registry

- Centralized configuration for all cron jobs
- Categorized by function (opportunities, promotions, reviews, etc.)
- Configurable timeouts and retry behavior
- Enable/disable without code changes

### 2. Execution Engine

- **Concurrent Execution Prevention**: Jobs can't run simultaneously
- **Timeout Protection**: Auto-kill jobs that exceed timeout
- **Retry Logic**: Exponential backoff (5s, 10s, 15s, etc.)
- **Sentry Integration**: All failures tracked and reported
- **Database Logging**: Complete execution history

### 3. Management Dashboard

- Real-time job status and statistics
- Success rate tracking and trending
- Manual job execution
- Enable/disable toggle
- Execution history with charts
- Category filtering

### 4. API Endpoints

- Unified execution endpoint for all jobs
- Job listing and configuration
- Toggle enable/disable
- Manual trigger
- Execution history

---

## Setup

### 1. Environment Variables

```bash
# .env.local

# Required: Cron secret for authentication
CRON_SECRET=your-secure-random-string

# Required: Application URL
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### 2. Run Database Migration

```bash
# Apply cron job tables and functions
npx supabase db push

# Or apply specific migration
psql -f supabase/migrations/20251024130000_cron_job_logs.sql
```

### 3. Configure Cron Jobs in Vercel

For each job you want to run, add a cron job in Vercel:

**Dashboard: Project Settings → Cron Jobs**

| Job Name | Path | Schedule | Authorization |
|----------|------|----------|---------------|
| Health Check | `/api/cron/execute/health-check` | `*/5 * * * *` | `Bearer ${CRON_SECRET}` |
| Promotion Deliveries | `/api/cron/execute/process-promotion-deliveries` | `*/30 * * * *` | `Bearer ${CRON_SECRET}` |
| Review Requests | `/api/cron/execute/send-review-requests` | `0 */6 * * *` | `Bearer ${CRON_SECRET}` |
| Daily Analytics | `/api/cron/execute/aggregate-portal-analytics` | `0 1 * * *` | `Bearer ${CRON_SECRET}` |

**Schedule Format (Cron Expression):**
```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Day of Week (0-7, 0 and 7 are Sunday)
│ │ │ └─── Month (1-12)
│ │ └───── Day of Month (1-31)
│ └─────── Hour (0-23)
└───────── Minute (0-59)
```

**Examples:**
- `*/5 * * * *` - Every 5 minutes
- `0 */6 * * *` - Every 6 hours
- `0 8 * * *` - Daily at 8am
- `0 0 * * 0` - Weekly on Sunday at midnight
- `0 0 1 * *` - Monthly on the 1st at midnight

### 4. Verify Setup

```bash
# Test cron secret authentication
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/jobs

# Test job execution
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/execute/health-check

# View management dashboard
open http://localhost:3000/dashboard/admin/cron-jobs
```

---

## Job Registry

### Pre-configured Jobs

#### Opportunities (2 jobs)

**process-opportunity-offers**
- Schedule: `0 8 * * *` (Daily at 8am)
- Purpose: Send automated offers for missed opportunities
- Timeout: 600s
- Retries: 3

**opportunity-reminders**
- Schedule: `0 8 * * *` (Daily at 8am)
- Purpose: Send follow-up reminders for opportunities
- Timeout: 300s
- Retries: 2

#### Promotions (3 jobs)

**process-promotion-deliveries**
- Schedule: `*/30 * * * *` (Every 30 minutes)
- Purpose: Deliver queued promotions to customers
- Timeout: 300s
- Retries: 2

**calculate-promotion-analytics**
- Schedule: `0 2 * * *` (Daily at 2am)
- Purpose: Calculate promotion performance metrics
- Timeout: 300s
- Retries: 1

**promotion-triggers**
- Schedule: `0 10 * * *` (Daily at 10am)
- Purpose: Check and trigger automated promotions
- Timeout: 600s
- Retries: 2

#### Reviews (2 jobs)

**send-review-requests**
- Schedule: `0 */6 * * *` (Every 6 hours)
- Purpose: Send review requests for completed jobs
- Timeout: 300s
- Retries: 2

**review-follow-ups**
- Schedule: `0 9 * * *` (Daily at 9am)
- Purpose: Send review reminders and handle escalations
- Timeout: 300s
- Retries: 2

#### Loyalty & Referrals (3 jobs)

**process-tier-upgrades**
- Schedule: `0 3 * * *` (Daily at 3am)
- Purpose: Check and process customer tier upgrades
- Timeout: 300s
- Retries: 1

**process-achievements**
- Schedule: `0 4 * * *` (Daily at 4am)
- Purpose: Check and award customer achievements
- Timeout: 300s
- Retries: 1

**process-referrals**
- Schedule: `0 */4 * * *` (Every 4 hours)
- Purpose: Check referral conversions and award points
- Timeout: 300s
- Retries: 2

#### Analytics (2 jobs)

**aggregate-portal-analytics**
- Schedule: `0 1 * * *` (Daily at 1am)
- Purpose: Aggregate daily portal usage statistics
- Timeout: 300s
- Retries: 1

**aggregate-opportunity-analytics**
- Schedule: `0 1 * * *` (Daily at 1am)
- Purpose: Aggregate daily opportunity pipeline metrics
- Timeout: 300s
- Retries: 1

#### Monitoring (1 job)

**health-check**
- Schedule: `*/5 * * * *` (Every 5 minutes)
- Purpose: Monitor system health and uptime
- Timeout: 30s
- Retries: 1

#### Cleanup (4 jobs)

**cleanup-expired-sessions**
- Schedule: `0 0 * * *` (Daily at midnight)
- Purpose: Remove expired authentication sessions
- Timeout: 300s
- Retries: 1

**cleanup-old-logs**
- Schedule: `0 0 * * 0` (Weekly on Sunday at midnight)
- Purpose: Archive or delete old log entries
- Timeout: 600s
- Retries: 1

**cleanup-old-uptime-logs**
- Schedule: `0 0 1 * *` (Monthly on the 1st)
- Purpose: Remove uptime logs older than 90 days
- Timeout: 600s
- Retries: 1

**cleanup-old-alerts**
- Schedule: `0 0 1 * *` (Monthly on the 1st)
- Purpose: Remove resolved alerts older than 90 days
- Timeout: 600s
- Retries: 1

### Job Configuration

```typescript
// /src/lib/cron/registry.ts

export interface CronJob {
  name: string              // Unique job identifier
  schedule: string          // Cron expression
  handler: () => Promise<void>  // Async function to execute
  enabled: boolean          // Default enabled state
  timeout: number           // Max execution time (seconds)
  retries: number           // Number of retry attempts
  description: string       // Human-readable description
  category?: string         // Grouping category
}
```

---

## Job Execution

### How Jobs are Executed

1. **Trigger**: Vercel cron or manual trigger hits `/api/cron/execute/[jobName]`
2. **Authentication**: Cron secret verified
3. **Validation**: Job exists and is enabled
4. **Concurrency Check**: Ensure job not already running
5. **Execution**: Run job with timeout and retry logic
6. **Logging**: Record start, completion, duration, errors
7. **Alerting**: Notify on failures via Sentry

### Execution Flow

```typescript
// Simplified execution flow
async function executeCronJob(jobName: string) {
  // 1. Get job configuration
  const job = getCronJob(jobName)

  // 2. Check if enabled
  if (!job.enabled) return { skipped: true }

  // 3. Check if already running
  if (isJobRunning(jobName)) return { skipped: true, reason: 'already_running' }

  // 4. Start tracking
  const execution = { jobName, startedAt: new Date(), status: 'running' }
  runningJobs.set(jobName, execution)

  // 5. Log start to database
  await logJobExecution({ job_name: jobName, status: 'started', ... })

  // 6. Execute with retry loop
  let attempt = 0
  while (attempt < job.retries) {
    try {
      // Execute with timeout
      await Promise.race([
        job.handler(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), job.timeout * 1000)
        )
      ])

      // Success!
      await logJobExecution({ status: 'completed', ... })
      return { success: true, execution }

    } catch (error) {
      attempt++
      if (attempt < job.retries) {
        // Exponential backoff: 5s, 10s, 15s, etc.
        await sleep(5000 * attempt)
      }
    }
  }

  // 7. All retries failed
  await logJobExecution({ status: 'failed', error: ... })
  Sentry.captureException(error)

  return { success: false, error }
}
```

### Retry Behavior

Jobs automatically retry on failure with exponential backoff:

- **Attempt 1**: Immediate execution
- **Attempt 2**: Wait 5 seconds
- **Attempt 3**: Wait 10 seconds
- **Attempt 4**: Wait 15 seconds

Example:
```typescript
{
  name: 'process-promotions',
  retries: 3,  // Will attempt up to 3 times
  timeout: 300, // Each attempt has 300s max
}
```

### Timeout Protection

Jobs that exceed their timeout are automatically terminated:

```typescript
await Promise.race([
  job.handler(),  // Your job function
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), job.timeout * 1000)
  )
])
```

---

## API Endpoints

### Execute Job

**POST `/api/cron/execute/[jobName]`**

Execute a specific cron job.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "success": true,
  "jobName": "health-check",
  "execution": {
    "startedAt": "2025-01-24T10:00:00Z",
    "completedAt": "2025-01-24T10:00:05Z",
    "duration": 5234,
    "status": "success"
  },
  "message": "Job health-check completed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "jobName": "health-check",
  "error": "Job timeout after 30 seconds",
  "execution": {
    "startedAt": "2025-01-24T10:00:00Z",
    "duration": 30000,
    "status": "failed"
  }
}
```

### List Jobs

**GET `/api/cron/jobs`**

List all registered cron jobs.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "total": 17,
  "jobs": [
    {
      "name": "health-check",
      "schedule": "*/5 * * * *",
      "enabled": true,
      "timeout": 30,
      "retries": 1,
      "description": "Monitor system health and uptime",
      "category": "monitoring"
    }
  ],
  "categories": {
    "monitoring": 1,
    "opportunities": 2,
    "promotions": 3,
    ...
  }
}
```

### Get Job Info

**GET `/api/cron/execute/[jobName]`**

Get configuration for a specific job.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "name": "health-check",
  "schedule": "*/5 * * * *",
  "enabled": true,
  "timeout": 30,
  "retries": 1,
  "description": "Monitor system health and uptime",
  "category": "monitoring"
}
```

### Management API (Admin Only)

**GET `/api/admin/cron-jobs`**

List all jobs with statistics and execution history.

**Permission Required:** `analytics:view_all`

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalJobs": 17,
    "enabledJobs": 16,
    "disabledJobs": 1,
    "runningJobs": 2,
    "totalExecutions": 1247,
    "totalFailures": 12,
    "overallSuccessRate": 99.04
  },
  "jobs": [...],
  "categories": {...},
  "runningJobs": [...]
}
```

**POST `/api/admin/cron-jobs/[jobName]/toggle`**

Enable or disable a job.

**Body:**
```json
{
  "enabled": false
}
```

**POST `/api/admin/cron-jobs/[jobName]/run`**

Manually trigger a job execution.

**Response:**
```json
{
  "success": true,
  "jobName": "health-check",
  "message": "Job health-check has been queued for execution",
  "note": "Job is running asynchronously. Check execution history for results."
}
```

**GET `/api/admin/cron-jobs/[jobName]/history`**

Get execution history for a specific job.

**Query Parameters:**
- `limit` (default: 50): Number of records to return
- `days` (default: 30): Time range for timeline data

**Response:**
```json
{
  "success": true,
  "jobName": "health-check",
  "job": {...},
  "stats": {
    "totalRuns": 288,
    "successfulRuns": 286,
    "failedRuns": 2,
    "successRate": 99.31,
    "avgDuration": 1234,
    "lastRun": "2025-01-24T10:00:00Z"
  },
  "history": [...],
  "timeline": [...]
}
```

---

## Management Dashboard

### Access

Navigate to:
```
/dashboard/admin/cron-jobs
```

**Permission Required:** `analytics:view_all`

### Features

**Summary Statistics:**
- Total jobs count
- Enabled/disabled count
- Currently running jobs
- Total executions
- Failure count
- Overall success rate

**Running Jobs Banner:**
- Real-time display of currently executing jobs
- Duration since start
- Auto-updates

**Job Listing:**
- All jobs with details
- Category badges
- Success rate indicators
- Enable/disable toggle
- Manual run button
- View history button

**Category Filtering:**
- Filter by category (opportunities, promotions, reviews, etc.)
- View all or specific category

**Job History Modal:**
- Detailed execution statistics
- Timeline chart showing executions over time
- Recent executions table with status, duration, errors
- Per-execution details

### Job Status Indicators

- **Green checkmark**: Success rate ≥ 95%
- **Yellow warning**: Success rate 80-95%
- **Red X**: Success rate < 80%

### Actions

**Enable/Disable:**
- Toggle switch to enable or disable any job
- Disabled jobs will skip execution
- Configuration saved to database

**Run Now:**
- Manually trigger job execution
- Job runs asynchronously
- Check history for results

**View History:**
- Opens modal with detailed execution history
- Shows statistics, timeline chart, and recent executions
- Filter by date range

---

## Database Schema

### Tables

#### cron_job_logs

Stores execution logs for all cron jobs.

```sql
CREATE TABLE cron_job_logs (
  id UUID PRIMARY KEY,
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,  -- 'started', 'completed', 'failed'
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- `idx_cron_logs_job_started` on `(job_name, started_at DESC)`
- `idx_cron_logs_status` on `(status)`
- `idx_cron_logs_started_at` on `(started_at DESC)`
- `idx_cron_logs_job_status` on `(job_name, status)`

#### cron_job_config

Runtime configuration for jobs (enable/disable).

```sql
CREATE TABLE cron_job_config (
  job_name VARCHAR(100) PRIMARY KEY,
  enabled BOOLEAN DEFAULT TRUE,
  last_modified_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified_by UUID REFERENCES auth.users(id),
  notes TEXT
);
```

### Views

#### recent_cron_executions

Executions from the last 7 days.

```sql
SELECT * FROM recent_cron_executions;
```

#### cron_job_success_rates

Success rates and statistics (last 30 days).

```sql
SELECT
  job_name,
  successful_runs,
  failed_runs,
  total_runs,
  success_rate_percentage,
  avg_duration_ms,
  last_run_at
FROM cron_job_success_rates;
```

#### failed_cron_jobs

Most recent 100 failed executions.

```sql
SELECT * FROM failed_cron_jobs;
```

#### running_cron_jobs

Currently running jobs (started within last hour).

```sql
SELECT
  job_name,
  started_at,
  running_duration_seconds
FROM running_cron_jobs;
```

### Functions

#### get_cron_job_stats

Get detailed statistics for a job.

```sql
SELECT * FROM get_cron_job_stats('health-check', 30);

-- Returns:
-- total_runs, successful_runs, failed_runs, success_rate,
-- avg_duration_ms, min_duration_ms, max_duration_ms,
-- last_run_at, last_success_at, last_failure_at
```

#### cleanup_old_cron_logs

Delete logs older than specified days.

```sql
SELECT cleanup_old_cron_logs(90);  -- Delete logs older than 90 days
-- Returns: number of deleted rows
```

#### get_cron_job_timeline

Get hourly execution timeline.

```sql
SELECT * FROM get_cron_job_timeline('health-check', 24);

-- Returns:
-- time_bucket, executions, successes, failures, avg_duration_ms
```

#### toggle_cron_job

Enable or disable a job.

```sql
SELECT toggle_cron_job('health-check', true, 'user-uuid');
-- Returns: TRUE on success
```

---

## Adding New Jobs

### 1. Create Job Handler

Create a new file for your job logic:

```typescript
// /src/lib/promotions/triggers.ts

export async function checkPromotionTriggers(): Promise<void> {
  console.log('[CRON] Checking promotion triggers...')

  // Your job logic here
  const triggers = await getActiveTriggers()

  for (const trigger of triggers) {
    await evaluateTrigger(trigger)
  }

  console.log(`[CRON] Processed ${triggers.length} triggers`)
}
```

### 2. Register Job

Add job to the registry:

```typescript
// /src/lib/cron/registry.ts

export const cronJobs: CronJob[] = [
  // ... existing jobs

  {
    name: 'check-promotion-triggers',
    schedule: '0 */4 * * *',  // Every 4 hours
    handler: async () => {
      const { checkPromotionTriggers } = await import('../promotions/triggers')
      await checkPromotionTriggers()
    },
    enabled: true,
    timeout: 300,  // 5 minutes
    retries: 2,
    description: 'Check and activate automated promotion triggers',
    category: 'promotions',
  },
]
```

### 3. Add to Database

```sql
INSERT INTO cron_job_config (job_name, enabled)
VALUES ('check-promotion-triggers', true);
```

### 4. Configure in Vercel

Add cron job in Vercel dashboard:

- Path: `/api/cron/execute/check-promotion-triggers`
- Schedule: `0 */4 * * *`
- Authorization: `Bearer ${CRON_SECRET}`

### 5. Test Job

```bash
# Test manually
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/execute/check-promotion-triggers

# Or use the dashboard "Run Now" button
```

---

## Monitoring

### Real-Time Monitoring

1. **Dashboard**: `/dashboard/admin/cron-jobs`
   - View all jobs and their status
   - See running jobs in real-time
   - Check success rates and execution history

2. **Database Queries**:

```sql
-- View recent executions
SELECT * FROM recent_cron_executions
ORDER BY started_at DESC
LIMIT 50;

-- Check currently running jobs
SELECT * FROM running_cron_jobs;

-- Get success rates for all jobs
SELECT * FROM cron_job_success_rates;

-- Find recent failures
SELECT * FROM failed_cron_jobs
LIMIT 20;
```

3. **Sentry Integration**:
   - All job failures automatically captured
   - Tagged with job name and category
   - Transaction tracking for performance monitoring

### Alerts

Failed jobs trigger Sentry alerts with:
- Job name and description
- Number of retry attempts
- Error message and stack trace
- Execution duration
- Job category

### Log Monitoring

All executions are logged with:
- Start and completion timestamps
- Duration in milliseconds
- Status (started, completed, failed)
- Error messages (if failed)
- Number of retry attempts

---

## Best Practices

### 1. Job Design

**Keep Jobs Idempotent:**
```typescript
// ✅ GOOD - Safe to run multiple times
export async function processPromotions() {
  const pending = await getUnprocessedPromotions()
  for (const promo of pending) {
    await markAsProcessing(promo.id)
    await sendPromotion(promo)
    await markAsComplete(promo.id)
  }
}

// ❌ BAD - Not safe to run multiple times
export async function processPromotions() {
  const all = await getAllPromotions()
  for (const promo of all) {
    await sendPromotion(promo)  // Will send duplicates!
  }
}
```

**Use Appropriate Timeouts:**
```typescript
// ✅ GOOD - Realistic timeout for task
{
  name: 'send-emails',
  timeout: 300,  // 5 minutes for batch email sending
  retries: 2,
}

// ❌ BAD - Timeout too short
{
  name: 'send-emails',
  timeout: 10,  // 10 seconds - will always timeout!
  retries: 2,
}
```

**Batch Processing:**
```typescript
// ✅ GOOD - Process in batches
export async function sendReviewRequests() {
  const BATCH_SIZE = 50
  let offset = 0

  while (true) {
    const customers = await getEligibleCustomers(BATCH_SIZE, offset)
    if (customers.length === 0) break

    await Promise.all(
      customers.map(c => sendReviewRequest(c))
    )

    offset += BATCH_SIZE
  }
}
```

### 2. Error Handling

**Capture Context:**
```typescript
export async function processReferrals() {
  const referrals = await getPendingReferrals()

  for (const referral of referrals) {
    try {
      await processReferral(referral)
    } catch (error) {
      // Log specific referral that failed
      console.error(`Failed to process referral ${referral.id}:`, error)
      captureError(error, {
        severity: 'error',
        action: 'process_referral',
        details: { referralId: referral.id },
      })
      // Continue with next referral
    }
  }
}
```

**Partial Success:**
```typescript
export async function processPromotions() {
  const results = {
    processed: 0,
    failed: 0,
    errors: [],
  }

  const promotions = await getPendingPromotions()

  for (const promo of promotions) {
    try {
      await sendPromotion(promo)
      results.processed++
    } catch (error) {
      results.failed++
      results.errors.push({ promoId: promo.id, error: error.message })
    }
  }

  if (results.failed > 0) {
    console.warn(`Processed ${results.processed}, failed ${results.failed}`)
    if (results.failed > results.processed) {
      throw new Error(`Majority of promotions failed: ${JSON.stringify(results)}`)
    }
  }
}
```

### 3. Scheduling

**Avoid Overlap:**
```typescript
// ✅ GOOD - Jobs at different times
{
  name: 'process-tier-upgrades',
  schedule: '0 3 * * *',  // 3am
}
{
  name: 'process-achievements',
  schedule: '0 4 * * *',  // 4am
}

// ❌ BAD - Overlapping jobs
{
  name: 'heavy-job-1',
  schedule: '0 1 * * *',
}
{
  name: 'heavy-job-2',
  schedule: '0 1 * * *',  // Same time!
}
```

**Consider Time Zones:**
```typescript
// User-facing jobs should consider user time zones
{
  name: 'send-review-requests',
  schedule: '0 9 * * *',  // 9am - but whose timezone?
}

// Better: Schedule for off-peak hours
{
  name: 'send-review-requests',
  schedule: '0 */6 * * *',  // Every 6 hours, filter by user timezone in handler
}
```

### 4. Monitoring

**Log Important Events:**
```typescript
export async function processPromotions() {
  console.log('[CRON] Starting promotion processing')

  const promotions = await getPendingPromotions()
  console.log(`[CRON] Found ${promotions.length} pending promotions`)

  const results = await Promise.allSettled(
    promotions.map(p => sendPromotion(p))
  )

  const successful = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  console.log(`[CRON] Processed ${successful} promotions, ${failed} failed`)
}
```

**Track Metrics:**
```typescript
import { trackMetric } from '@/lib/monitoring/performance'

export async function sendEmails() {
  const startTime = Date.now()

  const emails = await getQueuedEmails()
  await Promise.all(emails.map(e => sendEmail(e)))

  const duration = Date.now() - startTime

  trackMetric('cron.send_emails.count', emails.length)
  trackMetric('cron.send_emails.duration', duration)
}
```

### 5. Testing

**Test Job Handlers Independently:**
```typescript
// jobs.test.ts
import { processPromotions } from '@/lib/promotions/delivery'

describe('processPromotions', () => {
  it('should send all pending promotions', async () => {
    const result = await processPromotions()
    expect(result.processed).toBeGreaterThan(0)
  })

  it('should handle errors gracefully', async () => {
    // Mock failure
    jest.spyOn(emailService, 'send').mockRejectedValue(new Error('Send failed'))

    await expect(processPromotions()).resolves.not.toThrow()
  })
})
```

**Test via API:**
```bash
# Test job execution
npm run test:cron

# Or manually
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/execute/test-job
```

---

## Troubleshooting

### Job Not Running

**Check:**
1. Job is enabled in database:
   ```sql
   SELECT * FROM cron_job_config WHERE job_name = 'your-job';
   ```

2. Cron job configured in Vercel:
   - Go to Project Settings → Cron Jobs
   - Verify path, schedule, and authorization

3. Cron secret matches:
   ```bash
   echo $CRON_SECRET
   ```

4. Check logs:
   ```sql
   SELECT * FROM cron_job_logs
   WHERE job_name = 'your-job'
   ORDER BY started_at DESC
   LIMIT 10;
   ```

### Job Always Timing Out

**Solutions:**
1. Increase timeout:
   ```typescript
   {
     timeout: 600,  // Increase from 300 to 600 seconds
   }
   ```

2. Optimize job logic:
   - Add indexes to database queries
   - Use batch processing
   - Implement pagination

3. Break into smaller jobs:
   ```typescript
   // Instead of one long job
   { name: 'process-everything', timeout: 3600 }

   // Split into multiple jobs
   { name: 'process-batch-1', timeout: 300 }
   { name: 'process-batch-2', timeout: 300 }
   ```

### Job Failing Repeatedly

**Debug Steps:**

1. View error in dashboard:
   - Go to `/dashboard/admin/cron-jobs`
   - Click "View History" for the job
   - Check error messages

2. Check Sentry:
   - Go to Sentry dashboard
   - Filter by `cron_job` tag
   - View full stack trace

3. Run manually with logging:
   ```typescript
   // Add detailed logging
   export async function myJob() {
     console.log('[DEBUG] Starting job')

     try {
       console.log('[DEBUG] Step 1: Fetching data')
       const data = await fetchData()
       console.log(`[DEBUG] Got ${data.length} items`)

       console.log('[DEBUG] Step 2: Processing')
       await processData(data)

       console.log('[DEBUG] Job completed successfully')
     } catch (error) {
       console.error('[DEBUG] Job failed:', error)
       throw error
     }
   }
   ```

4. Test locally:
   ```typescript
   // Create test script
   import { myJob } from '@/lib/jobs/my-job'

   async function test() {
     await myJob()
   }

   test().catch(console.error)
   ```

### High Failure Rate

**Analyze:**

```sql
-- Get failure details
SELECT
  error_message,
  COUNT(*) as occurrences
FROM cron_job_logs
WHERE job_name = 'your-job'
  AND status = 'failed'
  AND started_at > NOW() - INTERVAL '7 days'
GROUP BY error_message
ORDER BY occurrences DESC;
```

**Common Causes:**
- External API rate limits
- Database connection pool exhaustion
- Memory issues
- Timeout too short

**Solutions:**
- Add rate limiting/throttling
- Increase retry count and backoff
- Optimize memory usage
- Increase timeout or split job

### Jobs Running Concurrently

**Prevention:**

The executor prevents concurrent execution automatically:

```typescript
// Executor checks before running
if (runningJobs.has(jobName)) {
  return { skipped: true, reason: 'already_running' }
}
```

**If still happening:**
1. Check database for stuck jobs:
   ```sql
   SELECT * FROM running_cron_jobs;
   ```

2. Clear stuck job:
   ```sql
   UPDATE cron_job_logs
   SET status = 'failed',
       error_message = 'Manually terminated - stuck job'
   WHERE status = 'started'
     AND started_at < NOW() - INTERVAL '1 hour';
   ```

---

## Related Documentation

- [Health Monitoring](./HEALTH_MONITORING.md) - System health checks
- [Error Tracking](./SENTRY_ERROR_TRACKING.md) - Sentry integration
- [Audit Logging](./AUDIT_LOGGING.md) - Security audit trails

---

**Last Updated:** 2025-01-24
