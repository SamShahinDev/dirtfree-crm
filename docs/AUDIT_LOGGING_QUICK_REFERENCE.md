# Audit Logging - Quick Reference

Quick code snippets for common audit logging tasks.

## Basic Logging

### Log Success
```typescript
import { logSuccess } from '@/lib/audit/audit-logger'

await logSuccess('login', {
  userId: user.id,
  ipAddress: req.headers.get('x-forwarded-for'),
  userAgent: req.headers.get('user-agent'),
})
```

### Log Failure
```typescript
import { logFailure } from '@/lib/audit/audit-logger'

await logFailure('permission_denied', {
  userId: user.id,
  resourceType: 'customer',
  resourceId: customerId,
  severity: 'high',
  errorMessage: 'Insufficient permissions',
})
```

### Log Suspicious Activity
```typescript
import { logSuspicious } from '@/lib/audit/audit-logger'

await logSuspicious('rate_limit_exceeded', {
  userId: user.id,
  details: {
    limit: 20,
    attempts: 50,
    timeWindow: '60 seconds',
  },
})
```

## Middleware Integration

### With Audit Logging
```typescript
import { withAuditLogging } from '@/lib/audit/audit-logger'

export const POST = withAuditLogging(
  async (req, context) => {
    const customer = await createCustomer(data)
    return NextResponse.json({ success: true, customer })
  },
  {
    action: 'customer_created',
    resourceType: 'customer',
    getResourceId: (result) => result.customer?.id,
    severity: 'low',
  }
)
```

### With Auth + Audit
```typescript
import { withAuth } from '@/middleware/api-auth'

export const DELETE = withAuth(
  async (req, { user }) => {
    await deleteCustomer(customerId)
    return NextResponse.json({ success: true })
  },
  {
    requirePermission: 'customers:delete',
    enableAuditLog: true, // Automatically logs
  }
)
```

## Common Actions

### Authentication Events
```typescript
// Successful login
await logSuccess('login', {
  userId: user.id,
  ipAddress: req.headers.get('x-forwarded-for'),
})

// Failed login
await logFailure('login_failed', {
  userId: user.id,
  ipAddress: req.headers.get('x-forwarded-for'),
  errorMessage: 'Invalid credentials',
  severity: 'medium',
})

// Password reset
await logSuccess('password_reset_completed', {
  userId: user.id,
  ipAddress: req.headers.get('x-forwarded-for'),
})
```

### Customer Operations
```typescript
// View customer
await logSuccess('customer_viewed', {
  userId: user.id,
  customerId: customer.id,
})

// Update customer
await logSuccess('customer_updated', {
  userId: user.id,
  customerId: customer.id,
  details: { fields: ['email', 'phone'] },
})

// Delete customer
await logSuccess('customer_deleted', {
  userId: user.id,
  customerId: customer.id,
  severity: 'high',
  details: { reason: 'GDPR request' },
})
```

### Data Export
```typescript
await logSuccess('data_exported', {
  userId: user.id,
  customerId: customer.id,
  severity: 'medium',
  details: {
    format: 'csv',
    includesPII: true,
    recordCount: 1500,
  },
})
```

### Permission Violations
```typescript
await logFailure('permission_denied', {
  userId: user.id,
  resourceType: 'opportunity',
  resourceId: oppId,
  severity: 'high',
  errorMessage: 'User lacks required permission',
  details: {
    requiredPermission: 'opportunities:delete',
    userRole: user.role,
  },
})
```

### Settings Changes
```typescript
await logSuccess('settings_changed', {
  userId: user.id,
  severity: 'medium',
  details: {
    section: 'security',
    changes: {
      mfaRequired: { old: false, new: true },
      sessionTimeout: { old: 3600, new: 1800 },
    },
  },
})
```

## Security Alerts

### Send Manual Alert
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
  },
  ipAddress: req.headers.get('x-forwarded-for'),
})
```

### Check Threshold
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

### Detect Suspicious Activity (Cron)
```typescript
import { detectAndAlertSuspiciousActivity } from '@/lib/security/alerts'

// Run every 5 minutes
export async function GET() {
  await detectAndAlertSuspiciousActivity()
  return NextResponse.json({ success: true })
}
```

## Querying Logs

### Via API - Recent Logs
```bash
curl "http://localhost:3000/api/admin/audit-logs?limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Via API - Filter by Action
```bash
curl "http://localhost:3000/api/admin/audit-logs?action=login_failed" \
  -H "Authorization: Bearer $TOKEN"
```

### Via API - Filter by Severity
```bash
curl "http://localhost:3000/api/admin/audit-logs?severity=critical" \
  -H "Authorization: Bearer $TOKEN"
```

### Via API - Date Range
```bash
curl "http://localhost:3000/api/admin/audit-logs?startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

### Via API - Export CSV
```bash
curl "http://localhost:3000/api/admin/audit-logs?format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o audit-logs.csv
```

### Via Code
```typescript
import { getAuditLogs } from '@/lib/audit/audit-logger'

const logs = await getAuditLogs({
  userId: user.id,
  action: 'customer_viewed',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  limit: 100,
})
```

## Reports

### Summary Report
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

### Suspicious Activity Report
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

### Compliance Report
```bash
curl -X POST "http://localhost:3000/api/admin/audit-logs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "compliance",
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-12-31T23:59:59Z"
  }'
```

## Database Queries

### Recent Critical Events
```sql
SELECT action, user_id, created_at, error_message
FROM audit_logs
WHERE severity = 'critical'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Failed Logins by User
```sql
SELECT user_id, COUNT(*) as attempt_count
FROM audit_logs
WHERE action = 'login_failed'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
HAVING COUNT(*) >= 3;
```

### Most Active Users
```sql
SELECT user_id, COUNT(*) as action_count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY action_count DESC
LIMIT 10;
```

### Actions by Hour
```sql
SELECT
  EXTRACT(HOUR FROM created_at) as hour,
  COUNT(*) as event_count
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

### Security Alerts (View)
```sql
SELECT * FROM security_alerts
ORDER BY occurrence_count DESC;
```

### Failed Login Attempts (View)
```sql
SELECT * FROM failed_login_attempts
ORDER BY attempt_count DESC;
```

### User Activity Summary (View)
```sql
SELECT * FROM user_activity_summary
WHERE critical_actions > 0
ORDER BY critical_actions DESC;
```

## Request Metadata

### Extract IP and User Agent
```typescript
import { getRequestMetadata } from '@/lib/audit/audit-logger'

const metadata = getRequestMetadata(req)
// Returns: { ipAddress: string | null, userAgent: string | null }

await logAudit({
  action: 'customer_viewed',
  userId: user.id,
  customerId: customer.id,
  status: 'success',
  severity: 'low',
  ...metadata, // Spread IP and user agent
})
```

## Try-Catch Pattern

```typescript
try {
  const customer = await createCustomer(data)

  await logSuccess('customer_created', {
    userId: user.id,
    customerId: customer.id,
    resourceType: 'customer',
    resourceId: customer.id,
  })

  return NextResponse.json({ success: true, customer })
} catch (error) {
  await logFailure('customer_created', {
    userId: user.id,
    errorMessage: error.message,
    severity: 'medium',
    details: { stack: error.stack },
  })

  throw error
}
```

## Dashboard Access

Navigate to:
```
/dashboard/admin/audit-logs
```

Requires permission: `analytics:view_all`

## Common Severity Levels

| Action | Severity |
|--------|----------|
| `login` | low |
| `customer_viewed` | low |
| `customer_updated` | low |
| `customer_created` | low |
| `login_failed` | medium |
| `data_exported` | medium |
| `settings_changed` | medium |
| `customer_deleted` | high |
| `permission_denied` | high |
| `user_role_changed` | high |
| `suspicious_activity` | critical |
| `rate_limit_exceeded` | critical |
| `unauthorized_access_attempt` | critical |
| `sql_injection_attempt` | critical |

## Testing

### Test Audit Logging
```typescript
import { logSuccess } from '@/lib/audit/audit-logger'

// In your test
test('should log customer creation', async () => {
  const logId = await logSuccess('customer_created', {
    userId: testUser.id,
    customerId: testCustomer.id,
    resourceType: 'customer',
    resourceId: testCustomer.id,
  })

  expect(logId).toBeTruthy()

  // Verify in database
  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('id', logId)
    .single()

  expect(data.action).toBe('customer_created')
  expect(data.status).toBe('success')
})
```

## Environment Variables

```bash
# .env.local

# Security alert email
SECURITY_EMAIL=security@dirtfreecarpet.com

# Webhook for security alerts
SECURITY_WEBHOOK_URL=https://your-webhook.com/security

# Slack webhook
SLACK_SECURITY_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

**See Also:**
- [Full Audit Logging Guide](./AUDIT_LOGGING.md)
- [Security Guide](./SECURITY.md)
- [RBAC Implementation](./AUDIT_LOG_IMPLEMENTATION.md)
