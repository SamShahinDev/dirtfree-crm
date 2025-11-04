# Application Health Monitoring

Comprehensive health monitoring and alerting system for production reliability.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
- [Health Checks](#health-checks)
- [Uptime Monitoring](#uptime-monitoring)
- [Alert System](#alert-system)
- [Dashboard](#dashboard)
- [Database Schema](#database-schema)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Health Monitoring system provides:

- **Automated Health Checks**: Monitor all critical services
- **Uptime Tracking**: 24/7 availability monitoring
- **Smart Alerting**: Rule-based alerts via multiple channels
- **Real-Time Dashboard**: Visual monitoring interface
- **Historical Data**: Long-term uptime and performance tracking
- **Performance Metrics**: Response time and service health

---

## Features

### 1. Health Checks

- Database connectivity and performance
- External service availability (Stripe, Twilio, Email)
- Memory and resource usage
- File system access
- Cache health
- Comprehensive service status

### 2. Uptime Monitoring

- Continuous availability tracking
- Historical uptime logs
- Uptime percentage calculations (24h, 7d, 30d)
- Response time tracking
- Downtime event detection

### 3. Alert System

- Configurable alert rules
- Multiple severity levels (info, warning, critical)
- Multi-channel notifications (Email, SMS, Slack, Webhook)
- Cooldown periods to prevent spam
- Alert acknowledgment and resolution

### 4. Monitoring Dashboard

- Real-time system status
- Uptime statistics and charts
- Service health overview
- Recent alerts
- Performance metrics
- Auto-refresh capability

---

## Setup

### 1. Environment Variables

```bash
# .env.local

# Cron job authentication
CRON_SECRET=your-secret-key

# App URL for health checks
NEXT_PUBLIC_APP_URL=https://your-app.com

# Operations contact
OPS_EMAIL=ops@dirtfreecarpet.com
OPS_PHONE=+15551234567

# Alert channels (optional)
SLACK_MONITORING_WEBHOOK_URL=https://hooks.slack.com/services/...
MONITORING_WEBHOOK_URL=https://your-webhook.com/monitoring
```

### 2. Run Database Migration

```bash
# Apply monitoring tables migration
npx supabase db push

# Or apply specific migration
psql -f supabase/migrations/20251024120000_monitoring_tables.sql
```

### 3. Configure Cron Job

**On Vercel:**

1. Go to Project Settings → Cron Jobs
2. Add new cron job:
   - Path: `/api/cron/health-check`
   - Schedule: `*/5 * * * *` (every 5 minutes)
   - Authorization: `Bearer ${CRON_SECRET}`

**On other platforms:**

Use a cron service or scheduler to hit `/api/cron/health-check` every 5 minutes.

### 4. Verify Setup

```bash
# Test health check endpoint
curl http://localhost:3000/api/health/detailed

# Test cron job (with your CRON_SECRET)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/health-check
```

---

## Health Checks

### Basic Health Check

```bash
GET /api/health
```

Simple endpoint that returns 200 OK if the service is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-24T10:30:00Z",
  "uptime": 3600
}
```

### Detailed Health Check

```bash
GET /api/health/detailed
```

Comprehensive health check of all services.

**Response:**
```json
{
  "timestamp": "2025-01-24T10:30:00Z",
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 45,
      "details": { "type": "supabase" }
    },
    "stripe": {
      "status": "healthy",
      "responseTime": 234
    },
    "twilio": {
      "status": "degraded",
      "responseTime": 1567,
      "details": { "note": "Slow response" }
    },
    "memory": {
      "status": "healthy",
      "details": {
        "heapUsedMB": 128,
        "heapTotalMB": 256,
        "usagePercentage": 50
      }
    },
    "overall": {
      "status": "healthy",
      "responseTime": 456,
      "details": {
        "totalChecks": 7,
        "healthyChecks": 6,
        "degradedChecks": 1
      }
    }
  }
}
```

### Service Checks

The system checks:

1. **Database** - Supabase connectivity and query performance
2. **Stripe** - Payment processing API availability
3. **Twilio** - SMS/Voice service availability
4. **Email** - Resend API configuration
5. **Cache** - In-memory cache health
6. **Memory** - Heap usage and resource consumption
7. **File System** - Read/write capabilities

### Status Levels

- `healthy` - Service operating normally (200)
- `degraded` - Service slow or partially functional (503)
- `unhealthy` - Service down or non-responsive (503)

---

## Uptime Monitoring

### Record Uptime

Automatically recorded by the cron job every 5 minutes.

**Manual recording:**
```typescript
import { recordUptime } from '@/lib/monitoring/uptime'

const record = await recordUptime()
// Returns: { timestamp, status, responseTime, errors, checks }
```

### Get Uptime Stats

```typescript
import { getUptimeStats } from '@/lib/monitoring/uptime'

// Get stats for last 24 hours
const stats = getUptimeStats(24)

// Returns:
{
  uptime: 99.5,           // Percentage
  total: 288,             // Total checks
  up: 286,                // Successful checks
  down: 1,                // Failed checks
  degraded: 1,            // Degraded checks
  avgResponseTime: 345,   // Average response time in ms
  recentRecords: [...]    // Last 20 records
}
```

### Calculate Uptime Percentage

```typescript
import { calculateUptimePercentage } from '@/lib/monitoring/uptime'

const startDate = new Date('2025-01-01')
const endDate = new Date('2025-01-31')

const uptime = await calculateUptimePercentage(startDate, endDate)
// Returns: 99.95
```

### Get Uptime Logs

```typescript
import { getUptimeLogs } from '@/lib/monitoring/uptime'

const logs = await getUptimeLogs(
  100,                           // limit
  new Date('2025-01-01'),       // startDate (optional)
  new Date('2025-01-31')        // endDate (optional)
)
```

---

## Alert System

### Alert Rules

Pre-defined alert rules:

```typescript
import { DEFAULT_ALERT_RULES } from '@/lib/monitoring/alerts'

// Available rules:
- High Error Rate (>5%) - Critical, 15min cooldown
- Slow Response Time (>2s) - Warning, 30min cooldown
- Very Slow Response Time (>5s P95) - Critical, 15min cooldown
- Database Connection Issues - Critical, 5min cooldown
- High Memory Usage (>90%) - Warning, 20min cooldown
- Critical Memory Usage (>95%) - Critical, 10min cooldown
- Service Degradation - Warning, 15min cooldown
- Multiple Services Down - Critical, 5min cooldown
```

### Check Alerts

```typescript
import { checkAlerts, type SystemMetrics } from '@/lib/monitoring/alerts'

const metrics: SystemMetrics = {
  errorRate: 6.5,                    // Will trigger "High Error Rate" alert
  avgResponseTime: 2500,             // Will trigger "Slow Response Time" alert
  database: {
    healthy: true,
    responseTime: 100,
  },
  memoryUsage: 92,                   // Will trigger "High Memory Usage" alert
}

const triggeredAlerts = await checkAlerts(metrics)
// Returns array of triggered AlertRule objects
```

### Send Custom Alert

```typescript
import { sendSystemAlert } from '@/lib/monitoring/alerts'

await sendSystemAlert({
  name: 'Custom Alert',
  severity: 'warning',
  message: 'Something important happened',
  details: {
    customData: 'value',
    timestamp: new Date().toISOString(),
  },
})
```

### Alert Channels

Alerts are sent via:

1. **Email** - Always (if `OPS_EMAIL` is set)
2. **SMS** - Critical alerts only (if `OPS_PHONE` is set)
3. **Slack** - All alerts (if `SLACK_MONITORING_WEBHOOK_URL` is set)
4. **Webhook** - All alerts (if `MONITORING_WEBHOOK_URL` is set)

### Custom Alert Rules

```typescript
import { AlertRule, checkAlerts } from '@/lib/monitoring/alerts'

const customRules: AlertRule[] = [
  {
    name: 'High API Error Rate',
    condition: (metrics) => (metrics.errorCount || 0) > 100,
    severity: 'critical',
    cooldown: 10,
    description: 'More than 100 API errors detected',
  },
  {
    name: 'Disk Space Low',
    condition: (metrics) => (metrics.diskUsage || 0) > 85,
    severity: 'warning',
    cooldown: 60,
    description: 'Disk usage exceeds 85%',
  },
]

await checkAlerts(metrics, customRules)
```

### Get Recent Alerts

```typescript
import { getRecentAlerts } from '@/lib/monitoring/alerts'

const alerts = await getRecentAlerts(50)
// Returns last 50 alerts from database
```

---

## Dashboard

### Access

Navigate to:
```
/dashboard/admin/monitoring
```

Requires: `analytics:view_all` permission

### Features

**System Status:**
- Current system health (healthy/degraded/unhealthy)
- System uptime
- Last check timestamp

**Uptime Statistics:**
- 24-hour uptime percentage
- 7-day uptime percentage
- 30-day uptime percentage
- Average response time

**Response Time Chart:**
- Line chart showing response time trend
- Hover for detailed timestamps
- Visual spike detection

**Service Health:**
- Status of all monitored services
- Response times per service
- Memory usage metrics

**Recent Alerts:**
- Last 10 alerts
- Severity indicators
- Alert details and timestamps

**Auto-Refresh:**
- Toggle auto-refresh (default: ON)
- Refreshes every 30 seconds
- Manual refresh button

### Period Selection

- Last Hour
- Last 24 Hours
- Last 7 Days
- Last 30 Days

---

## Database Schema

### Tables

#### uptime_logs

```sql
CREATE TABLE uptime_logs (
  id UUID PRIMARY KEY,
  status VARCHAR(20),           -- 'up', 'down', 'degraded'
  response_time INTEGER,        -- Milliseconds
  errors TEXT[],                -- Error messages
  checks JSONB,                 -- Detailed check results
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

#### alert_history

```sql
CREATE TABLE alert_history (
  id UUID PRIMARY KEY,
  alert_name VARCHAR(255),
  severity VARCHAR(20),          -- 'info', 'warning', 'critical'
  message TEXT,
  details JSONB,
  triggered_at TIMESTAMPTZ,
  acknowledged BOOLEAN,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);
```

### Views

#### current_system_status

Current status based on last 5 minutes of checks.

```sql
SELECT * FROM current_system_status;
```

#### uptime_summary_24h

Uptime statistics for the last 24 hours.

```sql
SELECT * FROM uptime_summary_24h;
```

#### unresolved_alerts

All unresolved alerts ordered by severity.

```sql
SELECT * FROM unresolved_alerts;
```

#### recent_critical_alerts

Critical alerts from the last 7 days.

```sql
SELECT * FROM recent_critical_alerts;
```

### Functions

#### get_uptime_percentage

```sql
SELECT get_uptime_percentage(
  '2025-01-01'::TIMESTAMPTZ,
  '2025-01-31'::TIMESTAMPTZ
);
-- Returns: 99.95
```

#### get_avg_response_time

```sql
SELECT get_avg_response_time(
  NOW() - INTERVAL '24 hours',
  NOW()
);
-- Returns: 345 (ms)
```

#### acknowledge_alert

```sql
SELECT acknowledge_alert(
  'alert-uuid',
  'user-uuid'
);
-- Returns: TRUE
```

#### resolve_alert

```sql
SELECT resolve_alert('alert-uuid');
-- Returns: TRUE
```

#### get_downtime_events

```sql
SELECT * FROM get_downtime_events(
  NOW() - INTERVAL '7 days',
  NOW()
);
```

---

## Best Practices

### 1. Set Appropriate Alert Thresholds

```typescript
// ❌ TOO SENSITIVE - Will spam alerts
{
  name: 'Slow Response',
  condition: (m) => m.avgResponseTime > 500,  // Too low
  cooldown: 1,  // Too short
}

// ✅ GOOD - Balanced thresholds
{
  name: 'Slow Response',
  condition: (m) => m.avgResponseTime > 2000,
  cooldown: 30,
  severity: 'warning',
}
```

### 2. Use Cooldown Periods

```typescript
// Prevent alert spam with appropriate cooldowns
{
  name: 'High Error Rate',
  severity: 'critical',
  cooldown: 15,  // 15 minutes between alerts
}
```

### 3. Monitor the Monitors

```typescript
// Alert if health checks stop running
{
  name: 'Health Check Failure',
  condition: (m) => {
    const lastCheck = m.lastCheckTime
    return Date.now() - lastCheck > 10 * 60 * 1000  // 10 minutes
  },
  severity: 'critical',
  cooldown: 5,
}
```

### 4. Regular Review

- Check dashboard daily
- Review alert history weekly
- Adjust thresholds based on patterns
- Acknowledge and resolve alerts promptly

### 5. Test Alerting

```typescript
// Trigger test alert
await sendSystemAlert({
  name: 'Test Alert',
  severity: 'info',
  message: 'Testing alert system',
  details: { test: true },
})
```

### 6. Retention Management

```sql
-- Run monthly to clean old data
SELECT cleanup_old_uptime_logs();  -- Keeps 90 days
SELECT cleanup_old_alerts();       -- Keeps 90 days
```

### 7. Performance Considerations

```typescript
// Don't check too frequently in production
const CHECK_INTERVAL = process.env.NODE_ENV === 'production'
  ? 5 * 60 * 1000  // 5 minutes
  : 1 * 60 * 1000  // 1 minute
```

---

## Troubleshooting

### Health Checks Always Failing

**Check:**
1. `NEXT_PUBLIC_APP_URL` is set correctly
2. App is actually running and accessible
3. Database credentials are valid
4. Network connectivity

```bash
# Test manually
curl http://localhost:3000/api/health/detailed
```

### Alerts Not Sending

**Check:**
1. Alert channel environment variables are set
2. Cooldown period hasn't been reached
3. Alert condition is actually true
4. No errors in server logs

```typescript
// Test alert manually
import { clearAlertCooldown, sendSystemAlert } from '@/lib/monitoring/alerts'

clearAlertCooldown('Test Alert')
await sendSystemAlert({
  name: 'Test Alert',
  severity: 'critical',
  message: 'Testing alerts',
})
```

### Cron Job Not Running

**Check:**
1. Cron job is configured in Vercel/platform
2. `CRON_SECRET` matches in config and environment
3. URL path is correct (`/api/cron/health-check`)
4. Check cron job logs

```bash
# Test cron job manually
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.com/api/cron/health-check
```

### Dashboard Not Loading

**Check:**
1. User has `analytics:view_all` permission
2. API endpoint `/api/monitoring/metrics` is accessible
3. No JavaScript errors in browser console
4. Database has uptime logs

```bash
# Test metrics API
curl http://localhost:3000/api/monitoring/metrics \
  -H "Authorization: Bearer $TOKEN"
```

### High Memory Usage Alerts

**Solutions:**
1. Optimize code for memory leaks
2. Increase memory limits
3. Implement garbage collection
4. Clear old caches

```typescript
// Force garbage collection (development only)
if (global.gc) {
  global.gc()
}
```

### Database Connection Issues

**Check:**
1. Database is running and accessible
2. Connection pool not exhausted
3. Credentials are valid
4. Network connectivity

```bash
# Test database connection
psql -h your-db-host -U your-user -d your-database
```

---

## Monitoring Checklist

### Daily
- [ ] Check dashboard for system status
- [ ] Review critical alerts
- [ ] Verify uptime is >99%

### Weekly
- [ ] Review all alerts
- [ ] Check response time trends
- [ ] Verify cron job is running
- [ ] Review service health patterns

### Monthly
- [ ] Analyze uptime trends
- [ ] Adjust alert thresholds if needed
- [ ] Run retention cleanup
- [ ] Review and update alert rules
- [ ] Test alert channels

---

## Related Documentation

- [Error Tracking](./SENTRY_ERROR_TRACKING.md) - Sentry integration
- [Audit Logging](./AUDIT_LOGGING.md) - Security audit trails
- [Performance Monitoring](../src/lib/monitoring/performance.ts) - Performance utilities

---

**Last Updated:** 2025-01-24
