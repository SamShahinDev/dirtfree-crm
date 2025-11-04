# Scheduled Reports & Exports

Automated report generation and delivery system for stakeholders.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
- [Report Types](#report-types)
- [Report Formats](#report-formats)
- [Management Dashboard](#management-dashboard)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Adding New Reports](#adding-new-reports)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Scheduled Reports system automates the generation and delivery of business intelligence reports:

- **5 Pre-built Report Types**: Revenue, customer activity, opportunities, promotions, loyalty
- **3 Output Formats**: PDF, CSV, Excel
- **Automated Delivery**: Email reports to multiple recipients
- **Flexible Scheduling**: Daily, weekly, monthly, or custom cron schedules
- **Management Dashboard**: Configure reports, view history, test generation
- **Comprehensive Logging**: Track all generations with success/failure status

---

## Features

### 1. Report Generation

- **Revenue Summary**: Payment analytics, revenue trends, payment methods
- **Customer Activity**: Portal engagement, activity metrics, tier distribution
- **Opportunity Pipeline**: Missed opportunities, conversion rates, pipeline metrics
- **Promotion Performance**: Delivery rates, view/use statistics, ROI analysis
- **Loyalty Engagement**: Points activity, tier distribution, redemption metrics

### 2. Automated Delivery

- Email reports as attachments
- Multiple recipients per report
- Professional email templates
- Automatic scheduling via cron jobs

### 3. Format Options

- **PDF**: Formatted reports with charts and tables
- **CSV**: Raw data for spreadsheet analysis
- **Excel**: Structured workbooks with formatting

### 4. Management

- Web-based dashboard for configuration
- Enable/disable reports without deletion
- Test report generation before scheduling
- View generation history and statistics
- Manual report triggering

---

## Setup

### 1. Environment Variables

```bash
# .env.local

# Required: Email service configuration
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=reports@dirtfreecarpet.com

# Application URL
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### 2. Run Database Migration

```bash
# Apply scheduled reports migration
npx supabase db push

# Or apply specific migration
psql -f supabase/migrations/20251024140000_scheduled_reports.sql
```

### 3. Configure Cron Job

The report generation job is already included in the cron registry:

**Vercel Configuration:**
- Path: `/api/cron/execute/generate-scheduled-reports`
- Schedule: `0 6 * * *` (Daily at 6am)
- Authorization: `Bearer ${CRON_SECRET}`

**Custom Schedule:**
You can modify the schedule in `/src/lib/cron/registry.ts` if needed.

### 4. Access Dashboard

Navigate to:
```
/dashboard/reports/scheduled
```

**Permission Required:** `analytics:view_all`

---

## Report Types

### 1. Revenue Summary

**Purpose:** Track revenue performance and payment analytics

**Data Included:**
- Total revenue for period
- Transaction count and average
- Revenue by payment method
- Customer details for each transaction
- Date-based breakdown

**Filters:**
- `startDate`: Beginning of date range
- `endDate`: End of date range

**Use Cases:**
- Daily revenue tracking
- Monthly financial reports
- Payment method analysis
- Revenue trend monitoring

**Example Configuration:**
```json
{
  "name": "Daily Revenue Summary",
  "report_type": "revenue_summary",
  "schedule": "0 8 * * *",
  "recipients": ["finance@dirtfreecarpet.com"],
  "filters": {},
  "format": "pdf"
}
```

### 2. Customer Activity

**Purpose:** Monitor customer engagement and portal usage

**Data Included:**
- Activity count per customer
- Last activity date
- Top activity types
- Customer tier information
- Engagement metrics

**Filters:**
- `startDate`: Beginning of date range
- `endDate`: End of date range

**Use Cases:**
- Customer engagement tracking
- Retention analysis
- Portal adoption monitoring
- Tier distribution insights

**Example Configuration:**
```json
{
  "name": "Weekly Customer Activity",
  "report_type": "customer_activity",
  "schedule": "0 8 * * 1",
  "recipients": ["manager@dirtfreecarpet.com"],
  "format": "excel"
}
```

### 3. Opportunity Pipeline

**Purpose:** Track missed opportunities and conversion metrics

**Data Included:**
- Opportunity count by status
- Estimated value (total and converted)
- Conversion rate
- Contact and conversion dates
- Customer tier analysis

**Filters:**
- `startDate`: Beginning of date range
- `endDate`: End of date range
- `status`: Filter by opportunity status

**Use Cases:**
- Sales pipeline monitoring
- Conversion rate analysis
- Follow-up tracking
- Revenue forecasting

**Example Configuration:**
```json
{
  "name": "Monthly Opportunity Pipeline",
  "report_type": "opportunity_pipeline",
  "schedule": "0 8 1 * *",
  "recipients": ["sales@dirtfreecarpet.com"],
  "format": "pdf"
}
```

### 4. Promotion Performance

**Purpose:** Analyze promotion effectiveness and ROI

**Data Included:**
- Delivery, view, and use counts
- View rate and use rate percentages
- Promotion type breakdown
- Discount value analysis
- Performance trends

**Filters:**
- `startDate`: Beginning of date range
- `endDate`: End of date range

**Use Cases:**
- Marketing campaign analysis
- Promotion ROI tracking
- Customer engagement metrics
- Campaign optimization

**Example Configuration:**
```json
{
  "name": "Weekly Promotion Performance",
  "report_type": "promotion_performance",
  "schedule": "0 8 * * 1",
  "recipients": ["marketing@dirtfreecarpet.com"],
  "format": "excel"
}
```

### 5. Loyalty Engagement

**Purpose:** Monitor loyalty program participation and effectiveness

**Data Included:**
- Tier distribution
- Points earned vs. redeemed
- Transaction counts
- Lifetime points analysis
- Member since dates

**Filters:**
- `startDate`: Beginning of date range
- `endDate`: End of date range
- `tier`: Filter by specific tier

**Use Cases:**
- Loyalty program health
- Tier upgrade tracking
- Points activity monitoring
- Member engagement analysis

**Example Configuration:**
```json
{
  "name": "Monthly Loyalty Engagement",
  "report_type": "loyalty_engagement",
  "schedule": "0 8 1 * *",
  "recipients": ["admin@dirtfreecarpet.com"],
  "format": "pdf"
}
```

---

## Report Formats

### CSV (Comma-Separated Values)

**Best For:**
- Data analysis in Excel/Google Sheets
- Importing into other systems
- Raw data manipulation
- Large datasets

**Features:**
- Plain text format
- Easy to process programmatically
- Compatible with all spreadsheet software
- Includes summary section

**File Size:** Small (~10-50 KB typically)

**Example:**
```csv
customer,email,tier,activityCount,lastActivity
John Doe,john@example.com,gold,45,01/24/2025
Jane Smith,jane@example.com,silver,23,01/23/2025

SUMMARY
totalCustomers,156
totalActivities,2341
avgActivitiesPerCustomer,15.0
```

### Excel (XLSX)

**Best For:**
- Professional reports
- Stakeholder presentations
- Data with formatting needs
- Multi-sheet workbooks (future)

**Features:**
- Tab-separated format
- Opens directly in Excel
- Maintains structure
- Includes metadata

**File Size:** Medium (~20-100 KB typically)

**Current Implementation:**
Uses tab-separated format compatible with Excel. For true `.xlsx` files with multiple sheets and formatting, consider integrating `exceljs` library.

### PDF (Portable Document Format)

**Best For:**
- Executive reports
- Printed materials
- Professional presentations
- Read-only distribution

**Features:**
- Formatted tables and charts
- Professional styling
- Consistent rendering
- Summary sections with formatting

**File Size:** Medium (~30-150 KB typically)

**Current Implementation:**
Generates HTML that can be printed to PDF. For production, consider integrating `puppeteer` or `pdfkit` for true PDF generation with charts and advanced formatting.

**HTML Template Includes:**
- Branded header with title
- Metadata (generation date, period)
- Formatted data tables
- Summary statistics section
- Professional color scheme

---

## Management Dashboard

### Access

Navigate to `/dashboard/reports/scheduled`

**Permission:** Requires `analytics:view_all`

### Features

#### 1. Report List

View all scheduled reports with:
- Report name and type
- Schedule (cron expression)
- Recipient count
- Output format
- Enabled/disabled status
- Success rate
- Last generation timestamp

#### 2. Create Report

Click "New Report" to configure:

**Required Fields:**
- **Report Name**: Descriptive name (e.g., "Daily Revenue Summary")
- **Report Type**: Select from 5 pre-built types
- **Schedule**: Choose from presets or enter custom cron expression
- **Recipients**: Comma-separated email addresses
- **Format**: PDF, CSV, or Excel

**Optional Fields:**
- **Enabled**: Toggle to enable/disable (default: enabled)
- **Filters**: Advanced filtering (future enhancement)

**Schedule Presets:**
- Daily at 6am: `0 6 * * *`
- Weekly on Monday at 8am: `0 8 * * 1`
- Monthly on the 1st at 8am: `0 8 1 * *`
- Every 6 hours: `0 */6 * * *`
- Daily at midnight: `0 0 * * *`

#### 3. Manage Reports

**Actions Per Report:**

- **Enable/Disable**: Toggle switch to activate/deactivate
- **View History**: See generation history and statistics
- **Generate Now**: Manually trigger immediate generation
- **Delete**: Remove scheduled report (with confirmation)

#### 4. Generation History

Click the calendar icon to view:

**Statistics:**
- Total generations
- Successful count
- Failed count
- Success rate percentage

**History Table:**
- Status (success/failed)
- Generation timestamp
- Recipient count
- File name
- Error message (if failed)

**Filters:**
- Last 7 days
- Last 30 days (default)
- Last 90 days

---

## API Endpoints

### List Reports

**GET** `/api/admin/reports/scheduled`

Get all scheduled reports with statistics.

**Response:**
```json
{
  "success": true,
  "reports": [
    {
      "id": "uuid",
      "name": "Daily Revenue Summary",
      "report_type": "revenue_summary",
      "schedule": "0 6 * * *",
      "recipients": ["admin@example.com"],
      "filters": {},
      "format": "pdf",
      "enabled": true,
      "created_at": "2025-01-24T10:00:00Z",
      "stats": {
        "successRate": 98.5,
        "totalGenerations": 30,
        "lastGenerated": "2025-01-24T06:00:00Z"
      }
    }
  ]
}
```

### Create Report

**POST** `/api/admin/reports/scheduled`

Create a new scheduled report.

**Request Body:**
```json
{
  "name": "Daily Revenue Summary",
  "reportType": "revenue_summary",
  "schedule": "0 6 * * *",
  "recipients": ["admin@example.com", "finance@example.com"],
  "filters": {},
  "format": "pdf",
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "report": { /* created report */ }
}
```

### Get Report

**GET** `/api/admin/reports/scheduled/[reportId]`

Get details for a specific report.

### Update Report

**PATCH** `/api/admin/reports/scheduled/[reportId]`

Update report configuration.

**Request Body:**
```json
{
  "enabled": false,
  "recipients": ["new@example.com"]
}
```

### Delete Report

**DELETE** `/api/admin/reports/scheduled/[reportId]`

Delete a scheduled report.

### Generate Report

**POST** `/api/admin/reports/scheduled/[reportId]/generate`

Manually trigger report generation.

**Response:**
```json
{
  "success": true,
  "message": "Report generation started",
  "note": "Report is being generated asynchronously. Check history for results."
}
```

### Test Report

**POST** `/api/admin/reports/scheduled/[reportId]/test`

Generate test report without sending emails.

**Request Body:**
```json
{
  "reportType": "revenue_summary",
  "format": "pdf",
  "filters": {}
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "fileName": "revenue_summary-2025-01-24.pdf",
    "fileSize": 45678,
    "fileSizeKB": "44.61"
  },
  "message": "Test report generated successfully (not sent)"
}
```

### Get History

**GET** `/api/admin/reports/scheduled/[reportId]/history?days=30`

Get generation history for a report.

**Response:**
```json
{
  "success": true,
  "report": { /* report details */ },
  "stats": {
    "total": 30,
    "successful": 29,
    "failed": 1,
    "successRate": 96.67
  },
  "history": [
    {
      "id": "uuid",
      "generated_at": "2025-01-24T06:00:00Z",
      "recipients": ["admin@example.com"],
      "file_name": "revenue_summary-2025-01-24.pdf",
      "error_message": null,
      "status": "success"
    }
  ]
}
```

---

## Database Schema

### Tables

#### scheduled_reports

Stores report configurations.

```sql
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  schedule VARCHAR(50) NOT NULL,
  recipients TEXT[] NOT NULL,
  filters JSONB,
  format VARCHAR(20) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### report_generation_log

Tracks all generation attempts.

```sql
CREATE TABLE report_generation_log (
  id UUID PRIMARY KEY,
  scheduled_report_id UUID REFERENCES scheduled_reports(id),
  generated_at TIMESTAMPTZ NOT NULL,
  recipients TEXT[],
  file_name VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Views

#### recent_report_generations

Recent generations (last 30 days).

```sql
SELECT * FROM recent_report_generations
ORDER BY generated_at DESC;
```

#### report_generation_stats

Statistics per report (last 30 days).

```sql
SELECT
  name,
  report_type,
  enabled,
  total_generations,
  successful_generations,
  failed_generations,
  success_rate,
  last_generated_at
FROM report_generation_stats;
```

### Functions

#### get_report_generation_history

```sql
SELECT * FROM get_report_generation_history(
  'report-uuid',
  30  -- days
);
```

#### get_report_success_rate

```sql
SELECT get_report_success_rate(
  'report-uuid',
  30  -- days
);
```

#### cleanup_old_report_logs

```sql
SELECT cleanup_old_report_logs(90);  -- Keep 90 days
```

---

## Adding New Reports

### 1. Create Report Generator

Create a new generator function in `/src/lib/reports/generators.ts`:

```typescript
export async function generateCustomReport(filters: ReportFilters = {}): Promise<ReportData> {
  const supabase = createClient()

  // Fetch your data
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
    .gte('created_at', filters.startDate)
    .lte('created_at', filters.endDate)

  // Format data
  const reportData = data?.map((item) => ({
    field1: item.field1,
    field2: item.field2,
    // ... more fields
  })) || []

  // Calculate summary
  const summary = {
    total: data?.length || 0,
    // ... more metrics
  }

  return {
    title: 'Custom Report',
    generatedAt: new Date().toISOString(),
    filters,
    data: reportData,
    summary,
  }
}
```

### 2. Register in Scheduler

Update `/src/lib/reports/scheduler.ts`:

```typescript
async function generateReportData(reportType: string, filters: ReportFilters) {
  switch (reportType) {
    // ... existing cases

    case 'custom_report':
      return await generateCustomReport(filters)

    default:
      throw new Error(`Unknown report type: ${reportType}`)
  }
}
```

### 3. Update Database Schema

Add new report type to constraint:

```sql
ALTER TABLE scheduled_reports
DROP CONSTRAINT scheduled_reports_report_type_check;

ALTER TABLE scheduled_reports
ADD CONSTRAINT scheduled_reports_report_type_check
CHECK (report_type IN (
  'revenue_summary',
  'customer_activity',
  'opportunity_pipeline',
  'promotion_performance',
  'loyalty_engagement',
  'custom_report'  -- New type
));
```

### 4. Update UI

Add to report types in `/src/app/(dashboard)/dashboard/reports/scheduled/page.tsx`:

```typescript
const REPORT_TYPES = [
  // ... existing types
  { value: 'custom_report', label: 'Custom Report' },
]
```

---

## Best Practices

### 1. Recipient Management

**Do:**
- Use distribution lists/groups
- Validate email addresses
- Limit to 10 recipients per report
- Document who receives which reports

**Don't:**
- Add personal emails for business reports
- Share reports with unauthorized users
- Send large reports to everyone

### 2. Scheduling

**Optimal Times:**
- **6am**: Reports ready for morning review
- **8am**: After business hours start
- **Midnight**: Off-peak for large reports

**Avoid:**
- Peak business hours (9am-5pm)
- Multiple reports at same time
- Too frequent schedules (< hourly)

### 3. Report Design

**Keep Reports:**
- Focused on specific metrics
- Limited to essential data
- Well-formatted and readable
- Actionable (include insights)

**Example Good Report:**
```
Daily Revenue Summary
- Total revenue: $X,XXX
- Top performing service
- Payment method breakdown
- Trend vs. yesterday
```

### 4. Testing

Always test before scheduling:

```bash
# Test via UI
Click "Test" button in dashboard

# Or via API
curl -X POST /api/admin/reports/scheduled/{reportId}/test \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "revenue_summary",
    "format": "pdf",
    "filters": {}
  }'
```

### 5. Monitoring

Check generation logs weekly:

```sql
-- Recent failures
SELECT * FROM failed_report_generations
ORDER BY generated_at DESC
LIMIT 20;

-- Success rates
SELECT
  name,
  success_rate,
  last_generated_at
FROM report_generation_stats
WHERE success_rate < 95
ORDER BY success_rate;
```

---

## Troubleshooting

### Reports Not Sending

**Check:**
1. RESEND_API_KEY is configured
2. EMAIL_FROM is set
3. Recipients are valid
4. Report is enabled
5. Cron job is running

**Test:**
```bash
# Test email service
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "'"$EMAIL_FROM"'",
    "to": "test@example.com",
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

### Generation Failing

**Common Causes:**
- Database query timeout
- Insufficient permissions
- Missing data for period
- Format generation error

**Debug:**
```typescript
// Enable detailed logging
console.log('[REPORTS] Starting generation for:', reportType)
console.log('[REPORTS] Filters:', filters)
console.log('[REPORTS] Data count:', data.length)
```

**Check Logs:**
```sql
SELECT *
FROM report_generation_log
WHERE error_message IS NOT NULL
ORDER BY generated_at DESC
LIMIT 10;
```

### Email Delivery Issues

**Verify:**
1. Resend account is active
2. Email domain is verified
3. Recipients aren't bouncing
4. Attachments under size limit (10MB)

**Check Resend Logs:**
Go to Resend dashboard → Logs

### Report Data Issues

**Empty Reports:**
- Check date filters
- Verify data exists for period
- Ensure correct database queries

**Incorrect Data:**
- Review filter logic
- Check data aggregation
- Validate date ranges

**Example Fix:**
```typescript
// Before (wrong)
const startDate = filters.startDate || new Date()

// After (correct)
const startDate = filters.startDate ||
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
```

---

## Related Documentation

- [Cron Job Orchestration](./CRON_JOB_ORCHESTRATION.md) - Automated task scheduling
- [Error Tracking](./SENTRY_ERROR_TRACKING.md) - Error monitoring
- [Audit Logging](./AUDIT_LOGGING.md) - Security audit trails

---

**Last Updated:** 2025-01-24
