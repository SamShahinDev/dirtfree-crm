# Security Audit Logging System

Comprehensive security audit logging for compliance, forensics, and threat detection.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Dashboard](#dashboard)
- [Security Alerts](#security-alerts)
- [Compliance](#compliance)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Security Audit Logging system provides:

- **Comprehensive Event Tracking**: 60+ predefined action types
- **Multi-Level Severity**: low, medium, high, critical
- **Automated Alerts**: Real-time notifications for suspicious activity
- **Flexible Filtering**: Query by user, action, date range, severity, status
- **Export Capabilities**: CSV and JSON export for compliance
- **Immutable Logs**: RLS policies prevent modification or deletion
- **Performance Optimized**: Comprehensive indexing for fast queries
- **Real-Time Monitoring**: PostgreSQL notifications for critical events

---

## Features

### 1. Audit Action Types

60+ predefined actions categorized by domain:

**Authentication & Authorization**
- `login`, `logout`, `login_failed`, `password_reset_requested`, `password_reset_completed`
- `permission_denied`, `role_escalation_attempt`, `mfa_enabled`, `mfa_disabled`

**Customer Management**
- `customer_created`, `customer_updated`, `customer_deleted`, `customer_viewed`
- `customer_searched`, `customer_merged`, `customer_exported`

**Security Events**
- `suspicious_activity`, `rate_limit_exceeded`, `unauthorized_access_attempt`
- `csrf_token_invalid`, `sql_injection_attempt`, `xss_attempt`

**Data Privacy**
- `pii_accessed`, `pii_exported`, `pii_deleted`, `data_exported`
- `encryption_key_rotated`

**System Events**
- `backup_created`, `backup_restored`, `migration_executed`
- `job_executed`, `job_failed`, `cron_executed`

### 2. Security Alerts

Automated alerting via multiple channels:
- Email notifications
- Webhook integrations
- Slack messages
- SMS alerts (Twilio)

### 3. Dashboard Features

- Real-time log viewer
- Advanced filtering
- Security alerts monitoring
- Export functionality
- Failed login tracking

---

## Setup

### 1. Run Database Migration

```bash
# Apply audit logging schema
npx supabase db push

# Or if using migrations directly
psql -f supabase/migrations/20251024110000_audit_logging.sql
```

### 2. Configure Environment Variables

```bash
# .env.local

# Security alert email
SECURITY_EMAIL=security@dirtfreecarpet.com

# Optional: Webhook URL for security alerts
SECURITY_WEBHOOK_URL=https://your-webhook.com/security

# Optional: Slack webhook
SLACK_SECURITY_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. Verify Setup

```bash
# Check that tables were created
psql -c "SELECT COUNT(*) FROM audit_logs;"

# Check that views exist
psql -c "SELECT * FROM security_alerts LIMIT 1;"
```

---

## Usage

### Basic Logging

```typescript
import { logAudit } from '@/lib/audit/audit-logger'

// Log a successful action
await logAudit({
  action: 'customer_created',
  userId: user.id,
  customerId: customer.id,
  resourceType: 'customer',
  resourceId: customer.id,
  status: 'success',
  severity: 'low',
  ipAddress: req.headers.get('x-forwarded-for'),
  userAgent: req.headers.get('user-agent'),
  details: {
    customerName: customer.name,
    source: 'web_form',
  },
})
```

### Convenience Functions

```typescript
import { logSuccess, logFailure, logSuspicious } from '@/lib/audit/audit-logger'

// Log success (severity defaults to 'low')
await logSuccess('login', {
  userId: user.id,
  ipAddress: req.headers.get('x-forwarded-for'),
})

// Log failure (severity defaults to 'medium')
await logFailure('permission_denied', {
  userId: user.id,
  resourceType: 'opportunity',
  resourceId: oppId,
  severity: 'high',
  errorMessage: 'User lacks required permission',
})

// Log suspicious activity (severity automatically set to 'critical')
await logSuspicious('rate_limit_exceeded', {
  userId: user.id,
  details: {
    limit: 20,
    attempts: 50,
    timeWindow: '60 seconds',
  },
})
```

### Middleware Integration

```typescript
import { withAuditLogging } from '@/lib/audit/audit-logger'

export const POST = withAuditLogging(
  async (req, context) => {
    // Your handler code
    const customer = await createCustomer(data)

    return NextResponse.json({ success: true, customer })
  },
  {
    action: 'customer_created',
    resourceType: 'customer',
    getResourceId: (result) => result.customer?.id,
    severity: 'low',
    getDetails: (req, result) => ({
      customerName: result.customer?.name,
    }),
  }
)
```

### With Auth Middleware

```typescript
import { withAuth } from '@/middleware/api-auth'

export const DELETE = withAuth(
  async (req, { user }) => {
    // Handler automatically logs the action
    // because enableAuditLog is true

    await deleteCustomer(customerId)

    return NextResponse.json({ success: true })
  },
  {
    requirePermission: 'customers:delete',
    enableAuditLog: true, // Automatically logs the action
  }
)
```

### Extracting Request Metadata

```typescript
import { getRequestMetadata } from '@/lib/audit/audit-logger'

const metadata = getRequestMetadata(req)
// Returns: { ipAddress: string | null, userAgent: string | null }

await logAudit({
  action: 'data_exported',
  userId: user.id,
  status: 'success',
  severity: 'medium',
  ...metadata, // Spread IP and user agent
})
```

---

## API Endpoints

### GET /api/admin/audit-logs

Retrieve audit logs with filtering.

**Query Parameters:**
- `userId` - Filter by user ID
- `customerId` - Filter by customer ID
- `action` - Filter by action type (e.g., `login`, `customer_created`)
- `status` - Filter by status (`success`, `failure`, `warning`)
- `severity` - Filter by severity (`low`, `medium`, `high`, `critical`)
- `startDate` - Start date (ISO string)
- `endDate` - End date (ISO string)
- `limit` - Maximum logs to return (default: 100)
- `format` - Response format (`json` or `csv`)

**Example - Retrieve Recent Logs:**
```bash
curl "http://localhost:3000/api/admin/audit-logs?limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

**Example - Filter by Action:**
```bash
curl "http://localhost:3000/api/admin/audit-logs?action=login_failed&limit=100" \
  -H "Authorization: Bearer $TOKEN"
```

**Example - Export as CSV:**
```bash
curl "http://localhost:3000/api/admin/audit-logs?format=csv&startDate=2025-01-01" \
  -H "Authorization: Bearer $TOKEN" \
  -o audit-logs.csv
```

**Example - Filter by Severity and Date Range:**
```bash
curl "http://localhost:3000/api/admin/audit-logs?severity=critical&startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (JSON):**
```json
{
  "success": true,
  "count": 45,
  "filters": {
    "action": "login_failed",
    "limit": 100
  },
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "login_failed",
      "status": "failure",
      "severity": "medium",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "ip_address": "192.168.1.1",
      "error_message": "Invalid credentials",
      "created_at": "2025-01-24T10:30:00Z",
      "users": {
        "email": "user@example.com",
        "display_name": "John Doe"
      }
    }
  ]
}
```

### POST /api/admin/audit-logs

Generate security reports.

**Request Body:**
```json
{
  "reportType": "summary" | "suspicious" | "compliance",
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-31T23:59:59Z",
  "userId": "optional-user-id"
}
```

**Report Types:**

#### 1. Summary Report
Aggregated statistics about audit events.

```bash
curl -X POST "http://localhost:3000/api/admin/audit-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "summary",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-01-31T23:59:59Z"
  }'
```

**Response:**
```json
{
  "success": true,
  "reportType": "summary",
  "period": {
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-01-31T23:59:59Z"
  },
  "report": {
    "totalEvents": 1547,
    "byStatus": {
      "success": 1420,
      "failure": 102,
      "warning": 25
    },
    "bySeverity": {
      "low": 1200,
      "medium": 300,
      "high": 42,
      "critical": 5
    },
    "byAction": {
      "login": 450,
      "customer_viewed": 320,
      "customer_updated": 180
    },
    "topUsers": {
      "user-id-1": 450,
      "user-id-2": 320
    },
    "hourlyDistribution": [10, 15, 8, 5, ...],
    "dailyDistribution": {
      "2025-01-01": 52,
      "2025-01-02": 48
    }
  }
}
```

#### 2. Suspicious Activity Report
Security alerts and failed login patterns.

```bash
curl -X POST "http://localhost:3000/api/admin/audit-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "suspicious",
    "startDate": "2025-01-24T00:00:00Z",
    "endDate": "2025-01-24T23:59:59Z"
  }'
```

**Response:**
```json
{
  "success": true,
  "reportType": "suspicious",
  "report": {
    "securityAlerts": [
      {
        "action": "login_failed",
        "user_id": "user-123",
        "occurrence_count": 8,
        "last_occurrence": "2025-01-24T15:30:00Z",
        "ip_addresses": ["192.168.1.1", "10.0.0.5"]
      }
    ],
    "failedLoginAttempts": [
      {
        "user_id": "user-456",
        "ip_address": "192.168.1.100",
        "attempt_count": 5,
        "last_attempt": "2025-01-24T14:20:00Z"
      }
    ],
    "summary": {
      "totalSuspiciousPatterns": 3,
      "totalFailedLogins": 12
    }
  }
}
```

#### 3. Compliance Report
PII access, data exports, user changes, settings changes.

```bash
curl -X POST "http://localhost:3000/api/admin/audit-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "compliance",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-01-31T23:59:59Z"
  }'
```

**Response:**
```json
{
  "success": true,
  "reportType": "compliance",
  "report": {
    "period": {
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-01-31T23:59:59Z"
    },
    "summary": {
      "totalEvents": 1547,
      "piiAccessCount": 230,
      "dataExportsCount": 15,
      "userChangesCount": 8,
      "settingsChangesCount": 12
    },
    "piiAccess": [...],
    "dataExports": [...],
    "userChanges": [...],
    "settingsChanges": [...]
  }
}
```

---

## Database Schema

### Main Table: `audit_logs`

```sql
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),

  -- Action details
  action varchar(100) not null,
  status varchar(20) check (status in ('success', 'failure', 'warning')) not null,
  severity varchar(20) check (severity in ('low', 'medium', 'high', 'critical')) not null,

  -- Context
  user_id uuid references auth.users(id),
  customer_id uuid references customers(id),
  resource_type varchar(100),
  resource_id uuid,

  -- Request metadata
  ip_address inet,
  user_agent text,

  -- Additional data
  details jsonb default '{}'::jsonb,
  error_message text,
  duration_ms integer,

  -- Timestamp
  created_at timestamptz default now() not null
);
```

### Indexes

```sql
-- Primary query patterns
create index audit_logs_created_at_idx on audit_logs(created_at desc);
create index audit_logs_user_id_idx on audit_logs(user_id, created_at desc);
create index audit_logs_customer_id_idx on audit_logs(customer_id, created_at desc);
create index audit_logs_action_idx on audit_logs(action);
create index audit_logs_status_idx on audit_logs(status);
create index audit_logs_severity_idx on audit_logs(severity);

-- Composite indexes
create index audit_logs_action_created_at_idx on audit_logs(action, created_at desc);
create index audit_logs_severity_created_at_idx on audit_logs(severity, created_at desc);

-- GIN index for JSONB
create index audit_logs_details_idx on audit_logs using gin(details);
```

### Views

#### security_alerts

Detects suspicious patterns (high/critical severity, >3 occurrences in 24h):

```sql
create view security_alerts as
select
  action,
  user_id,
  count(*) as occurrence_count,
  max(created_at) as last_occurrence,
  array_agg(distinct ip_address) as ip_addresses
from audit_logs
where
  severity in ('high', 'critical')
  and created_at > now() - interval '24 hours'
group by action, user_id
having count(*) > 3;
```

#### failed_login_attempts

Tracks repeated login failures (≥3 attempts in 1 hour):

```sql
create view failed_login_attempts as
select
  user_id,
  ip_address,
  count(*) as attempt_count,
  max(created_at) as last_attempt
from audit_logs
where
  action = 'login_failed'
  and created_at > now() - interval '1 hour'
group by user_id, ip_address
having count(*) >= 3;
```

#### user_activity_summary

30-day activity summary per user:

```sql
create view user_activity_summary as
select
  user_id,
  count(*) as total_actions,
  count(*) filter (where status = 'success') as successful_actions,
  count(*) filter (where status = 'failure') as failed_actions,
  count(*) filter (where severity = 'critical') as critical_actions,
  max(created_at) as last_activity
from audit_logs
where created_at > now() - interval '30 days'
group by user_id;
```

### RLS Policies

Audit logs are **immutable** - cannot be updated or deleted:

```sql
-- Admins can view all
create policy "Admins can view all audit logs"
  on audit_logs for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.user_id = auth.uid()
      and user_profiles.role = 'admin'
    )
  );

-- Users can view their own
create policy "Users can view their own audit logs"
  on audit_logs for select
  using (user_id = auth.uid());

-- Service role can insert
create policy "Service role can insert audit logs"
  on audit_logs for insert
  with check (true);

-- Prevent updates and deletes
create policy "Audit logs are immutable"
  on audit_logs for update
  using (false);

create policy "Audit logs cannot be deleted"
  on audit_logs for delete
  using (false);
```

---

## Dashboard

Access the audit log dashboard at:

```
/dashboard/admin/audit-logs
```

### Features

1. **Real-Time Log Viewer**
   - Last 100 events by default
   - Auto-refresh capability
   - Detailed event information

2. **Advanced Filtering**
   - Action type
   - Status (success/failure/warning)
   - Severity (low/medium/high/critical)
   - User ID
   - Date range (start/end)

3. **Security Alerts Panel**
   - Critical patterns detected
   - Failed login tracking
   - Suspicious activity monitoring

4. **Statistics Cards**
   - Total events
   - Successful actions
   - Failed actions
   - Critical events

5. **Export Options**
   - CSV export with filters
   - JSON export for integrations
   - Compliance reports

### Permissions

Dashboard requires:
```typescript
requirePermission: 'analytics:view_all'
```

---

## Security Alerts

### Configuration

Configure alert channels in environment variables:

```bash
# Email alerts
SECURITY_EMAIL=security@dirtfreecarpet.com

# Webhook alerts
SECURITY_WEBHOOK_URL=https://your-webhook.com/security

# Slack alerts
SLACK_SECURITY_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Manual Alert Triggering

```typescript
import { sendSecurityAlert } from '@/lib/security/alerts'

await sendSecurityAlert({
  action: 'suspicious_activity',
  userId: user.id,
  status: 'warning',
  severity: 'critical',
  details: {
    reason: 'Multiple failed login attempts',
    attempts: 10,
    timeWindow: '5 minutes',
  },
  ipAddress: '192.168.1.1',
})
```

### Automatic Alerts

Alerts are automatically sent for:
- Any event with `severity: 'critical'`
- Patterns detected by `security_alerts` view
- Threshold violations (configurable)

### Alert Thresholds

Default thresholds:

```typescript
const DEFAULT_THRESHOLDS = [
  { action: 'login_failed', count: 5, windowMinutes: 5, severity: 'high' },
  { action: 'permission_denied', count: 10, windowMinutes: 10, severity: 'medium' },
  { action: 'rate_limit_exceeded', count: 3, windowMinutes: 5, severity: 'high' },
  { action: 'unauthorized_access_attempt', count: 3, windowMinutes: 5, severity: 'critical' },
]
```

### Check if Threshold Exceeded

```typescript
import { isThresholdExceeded } from '@/lib/security/alerts'

const exceeded = await isThresholdExceeded(
  userId,
  'login_failed',
  { count: 5, windowMinutes: 5, severity: 'high' }
)

if (exceeded) {
  await sendSecurityAlert({
    action: 'suspicious_activity',
    userId,
    severity: 'critical',
    status: 'warning',
    details: { reason: 'Login threshold exceeded' },
  })
}
```

### Scheduled Alert Detection

Run periodically via cron:

```typescript
import { detectAndAlertSuspiciousActivity } from '@/lib/security/alerts'

// In your cron job handler
export async function GET() {
  await detectAndAlertSuspiciousActivity()
  return NextResponse.json({ success: true })
}
```

---

## Compliance

### GDPR

**Article 30: Records of Processing Activities**
- ✅ Complete audit trail of all data processing
- ✅ Who accessed what data and when
- ✅ Purpose of processing (action type)
- ✅ Retention periods configurable

**Article 33: Breach Notification**
- ✅ Automated alerts for suspicious activity
- ✅ Real-time notifications
- ✅ Comprehensive forensic data

### CCPA

**1798.100: Right to Know**
- ✅ Complete record of customer data access
- ✅ Exportable reports (CSV/JSON)

**1798.105: Right to Delete**
- ✅ Audit trail of deletion requests
- ✅ Verification of data deletion

### HIPAA

**§164.308(a)(1)(ii)(D): Audit Controls**
- ✅ Hardware, software, and procedural mechanisms
- ✅ Record and examine activity
- ✅ Immutable audit logs

**§164.312(b): Audit Controls**
- ✅ Implement hardware, software mechanisms
- ✅ Record and examine activity in systems with ePHI

### SOC 2

**CC6.1: Logical and Physical Access Controls**
- ✅ Complete audit trail
- ✅ Access attempts logged
- ✅ Failed authentication tracked

**CC7.2: System Monitoring**
- ✅ Real-time monitoring
- ✅ Automated alerts
- ✅ Anomaly detection

### Compliance Reports

Generate compliance reports via API:

```bash
# GDPR Article 30 Report
curl -X POST "http://localhost:3000/api/admin/audit-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "compliance",
    "startDate": "2025-01-01",
    "endDate": "2025-12-31"
  }'

# Export as CSV for auditors
curl "http://localhost:3000/api/admin/audit-logs?format=csv&startDate=2025-01-01" \
  -H "Authorization: Bearer $TOKEN" \
  -o gdpr-audit-2025.csv
```

---

## Best Practices

### 1. Log Everything Important

```typescript
// ✅ GOOD - Log all security-relevant actions
await logAudit({
  action: 'customer_viewed',
  userId: user.id,
  customerId: customer.id,
  status: 'success',
  severity: 'low',
})
```

### 2. Use Appropriate Severity Levels

```typescript
// Authentication events
await logFailure('login_failed', { severity: 'medium' })

// Permission violations
await logFailure('permission_denied', { severity: 'high' })

// Security attacks
await logSuspicious('sql_injection_attempt', {
  severity: 'critical' // Automatically set
})
```

### 3. Include Context in Details

```typescript
await logAudit({
  action: 'customer_deleted',
  userId: user.id,
  customerId: customer.id,
  status: 'success',
  severity: 'high',
  details: {
    customerName: customer.name,
    reason: 'GDPR deletion request',
    requestId: deletionRequest.id,
    verifiedBy: admin.email,
  },
})
```

### 4. Always Log Failures

```typescript
try {
  await deleteCustomer(id)
  await logSuccess('customer_deleted', { customerId: id })
} catch (error) {
  await logFailure('customer_deleted', {
    customerId: id,
    errorMessage: error.message,
    severity: 'high',
  })
  throw error
}
```

### 5. Use Middleware for Consistency

```typescript
// Instead of manually logging every endpoint
export const POST = withAuditLogging(
  handler,
  { action: 'customer_created', resourceType: 'customer' }
)
```

### 6. Monitor Critical Actions

```typescript
// Set up alerts for sensitive operations
if (action === 'user_role_changed' && newRole === 'admin') {
  await sendSecurityAlert({
    action: 'user_role_changed',
    userId: targetUser.id,
    severity: 'high',
    status: 'success',
    details: {
      oldRole: oldRole,
      newRole: 'admin',
      changedBy: admin.email,
    },
  })
}
```

### 7. Regular Review

```bash
# Review failed actions daily
curl "http://localhost:3000/api/admin/audit-logs?status=failure&startDate=$(date -d '1 day ago' -Iminutes)" \
  -H "Authorization: Bearer $TOKEN"

# Review critical events weekly
curl "http://localhost:3000/api/admin/audit-logs?severity=critical&startDate=$(date -d '7 days ago' -Iminutes)" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Troubleshooting

### Logs Not Appearing

**Check:**
1. Database migration ran successfully
2. RLS policies allow inserts
3. User/service role has correct permissions
4. No errors in server logs

```bash
# Check if table exists
psql -c "\d audit_logs"

# Check recent logs
psql -c "SELECT COUNT(*), MAX(created_at) FROM audit_logs;"

# Check RLS policies
psql -c "SELECT * FROM pg_policies WHERE tablename = 'audit_logs';"
```

### Performance Issues

**Solutions:**
1. Ensure indexes are created
2. Use filtering to reduce result set
3. Consider partitioning for high-volume
4. Implement retention policies

```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'audit_logs'
ORDER BY idx_scan ASC;

-- Enable partitioning (see migration file)
```

### Alerts Not Sending

**Check:**
1. Environment variables set correctly
2. Webhook URLs are accessible
3. Email service configured
4. No rate limiting on alert channels

```typescript
// Test alert manually
import { sendSecurityAlert } from '@/lib/security/alerts'

await sendSecurityAlert({
  action: 'test_alert',
  status: 'success',
  severity: 'critical',
  details: { test: true },
})
```

### Dashboard Not Loading

**Check:**
1. User has `analytics:view_all` permission
2. API endpoint is accessible
3. No CORS issues
4. Check browser console for errors

```bash
# Test API endpoint
curl "http://localhost:3000/api/admin/audit-logs?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

### CSV Export Issues

**Check:**
1. Format parameter is correct
2. No special characters breaking CSV
3. File size not too large

```bash
# Test CSV export
curl "http://localhost:3000/api/admin/audit-logs?format=csv&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Related Documentation

- [Security Guide](./SECURITY.md) - Overall security architecture
- [Encryption & PII](./ENCRYPTION_AND_PII.md) - Data protection
- [Authentication](./AUTHENTICATION.md) - Auth system
- [RBAC Implementation](./AUDIT_LOG_IMPLEMENTATION.md) - Permissions

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review server logs
3. Check database logs
4. Contact security team

---

**Last Updated:** 2025-01-24
