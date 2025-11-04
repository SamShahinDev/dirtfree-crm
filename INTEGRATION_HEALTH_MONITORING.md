# Integration Health Monitoring System

## Overview

The Integration Health Monitoring System provides comprehensive real-time monitoring of all platform integrations and external services across the Dirt Free ecosystem. It tracks connectivity, performance metrics, uptime, and automatically alerts administrators when issues are detected.

## Features

- **Multi-Platform Monitoring**: Track health across CRM, Portal, and Website
- **Service Monitoring**: Monitor Stripe, Twilio, Resend, and Supabase services
- **Real-time Status**: Up-to-date health status with sub-second response times
- **Performance Metrics**: Track response times, success rates, and uptime percentages
- **Automated Alerts**: Email/notification alerts when services go down
- **Historical Tracking**: Complete audit trail of all health checks
- **Dashboard UI**: Beautiful admin dashboard for monitoring
- **Cron Automation**: Automated health checks every 5 minutes
- **Automatic Cleanup**: Old logs automatically removed (90-day retention)

## Architecture

### Database Tables

#### `integration_health`
Main table storing current health status of all integrations:
- Integration identification (name, type, endpoint)
- Health status (healthy, degraded, down, unknown)
- Performance metrics (response time, success rate, uptime)
- Error tracking (last error message and details)
- Alert configuration (thresholds, email recipients)
- Check configuration (interval, timeout, enabled status)

#### `integration_health_log`
Historical log of all health checks:
- Check timestamp
- Status at time of check
- Response time
- Success/failure indication
- Error messages and details
- Metadata

### Health Check Flow

1. **Cron Job** runs every 5 minutes (`/api/cron/check-integration-health`)
2. **Health Checks** executed for all enabled integrations
3. **Results Logged** to `integration_health_log` table
4. **Status Updated** in `integration_health` table
5. **Metrics Calculated** (success rate, uptime, avg response time)
6. **Alerts Sent** if consecutive failures exceed threshold
7. **Dashboard** displays real-time status

## Setup Instructions

### 1. Database Setup

Run the SQL migration:

```bash
# In Supabase SQL Editor or via CLI
psql -h your-supabase-url -U postgres -d postgres -f sql/20-integration-health-monitoring.sql
```

This creates:
- `integration_health` table
- `integration_health_log` table
- Helper functions for metrics
- Views for monitoring
- Pre-seeded integrations

### 2. Update Integration Endpoints

Update the endpoint URLs in the database for your environment:

```sql
-- Update CRM endpoint
UPDATE integration_health
SET endpoint_url = 'https://your-crm-domain.com/api/health'
WHERE integration_name = 'CRM Platform';

-- Update Portal endpoint
UPDATE integration_health
SET endpoint_url = 'https://your-portal-domain.com/api/health'
WHERE integration_name = 'Customer Portal';

-- Update Website endpoint
UPDATE integration_health
SET endpoint_url = 'https://your-website-domain.com/api/health'
WHERE integration_name = 'Marketing Website';
```

### 3. Configure Alert Emails

Set alert email addresses:

```sql
UPDATE integration_health
SET alert_email = 'alerts@yourdomain.com'
WHERE alert_on_failure = true;
```

### 4. Set Up Cron Jobs

Configure cron jobs in your hosting platform (Vercel, etc.):

#### Health Check Job
- **Endpoint**: `/api/cron/check-integration-health`
- **Schedule**: `*/5 * * * *` (every 5 minutes)
- **Method**: POST
- **Headers**: `Authorization: Bearer ${CRON_SECRET}`

#### Cleanup Job
- **Endpoint**: `/api/cron/cleanup-health-logs`
- **Schedule**: `0 3 * * *` (daily at 3 AM)
- **Method**: POST
- **Headers**: `Authorization: Bearer ${CRON_SECRET}`

**Example Vercel Configuration** (vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/cron/check-integration-health",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/cleanup-health-logs",
      "schedule": "0 3 * * *"
    }
  ]
}
```

### 5. Environment Variables

Ensure these are set in `.env.local`:

```env
# Cron Secret
CRON_SECRET=your_random_secret_string

# Alert Configuration
NEXT_PUBLIC_APP_URL=https://your-crm-url.com

# Service credentials (for health checks)
STRIPE_SECRET_KEY=sk_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
RESEND_API_KEY=re_...
```

### 6. Test the System

Test health checks manually:

```bash
# Test health endpoint
curl https://your-domain.com/api/health

# Test health check cron (in development)
curl -X POST http://localhost:3001/api/cron/check-integration-health \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test cleanup cron
curl -X POST http://localhost:3001/api/cron/cleanup-health-logs \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitored Integrations

### Platforms
- **CRM Platform**: Main CRM application health
- **Customer Portal**: Customer-facing portal health
- **Marketing Website**: Public website health

### Database & Storage
- **Supabase Database**: PostgreSQL database connectivity
- **Supabase Storage**: File storage service health
- **Supabase Auth**: Authentication service health

### External Services
- **Stripe Payment Gateway**: Payment processing API
- **Twilio SMS Service**: SMS messaging service
- **Resend Email Service**: Email delivery service

## Health Status Levels

### Healthy ✅
- All subsystems operational
- Response times within acceptable ranges
- No errors or failures

### Degraded ⚠️
- Service is functional but slow
- Response times elevated (>2-5 seconds)
- Some non-critical issues detected

### Down ❌
- Service is unavailable
- Critical failures detected
- Unable to connect or authenticate

### Unknown ❓
- Service not checked recently
- Configuration issues
- Credentials not provided

## Dashboard Access

Access the monitoring dashboard at:
```
https://your-crm-url.com/dashboard/monitoring/integrations
```

**Dashboard Features:**
- Overall system status at a glance
- Detailed status cards for each integration
- Response time metrics
- Success rates (24 hours)
- Uptime percentages (30 days)
- Real-time updates
- Error messages and details
- Stale check warnings

## Alert System

### Alert Triggers

Alerts are sent when:
1. An integration fails health check
2. Consecutive failures reach threshold (default: 3)
3. Status changes from healthy to degraded/down

### Alert Throttling

- Maximum 1 alert per hour per integration
- Prevents alert spam during extended outages
- `alert_sent_at` timestamp tracks last alert

### Alert Content

Alerts include:
- Integration name and current status
- Consecutive failure count
- Last error message
- Response time
- Link to dashboard

### Alert Delivery

Alerts are sent via:
- Email to configured alert addresses
- In-app CRM notifications to admins
- Uses unified notification system

## API Reference

### GET /api/health

CRM platform health endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-15T10:30:00Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 86400,
  "responseTime": 45,
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 12
    },
    "storage": {
      "status": "healthy",
      "responseTime": 8
    },
    "auth": {
      "status": "healthy",
      "responseTime": 5
    }
  }
}
```

### POST /api/cron/check-integration-health

Run health checks on all integrations.

**Headers:**
```
Authorization: Bearer ${CRON_SECRET}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2024-03-15T10:30:00Z",
  "summary": {
    "total": 9,
    "healthy": 8,
    "degraded": 1,
    "down": 0,
    "unknown": 0,
    "averageResponseTime": 250
  },
  "checks": [...]
}
```

### POST /api/cron/cleanup-health-logs

Clean up old health logs.

**Headers:**
```
Authorization: Bearer ${CRON_SECRET}
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2024-03-15T03:00:00Z",
  "deleted": 15000,
  "remaining": 45000,
  "oldestLog": "2024-01-01T00:00:00Z",
  "retentionDays": 90
}
```

## Database Queries

### Check Current Status

```sql
SELECT
  integration_name,
  status,
  last_check_at,
  response_time_ms,
  success_rate,
  uptime_percentage
FROM integration_health
ORDER BY
  CASE status
    WHEN 'down' THEN 1
    WHEN 'degraded' THEN 2
    WHEN 'unknown' THEN 3
    WHEN 'healthy' THEN 4
  END;
```

### View Recent Failures

```sql
SELECT
  integration_name,
  check_time,
  error_message,
  response_time_ms
FROM integration_health_log
WHERE
  success = false AND
  check_time > NOW() - INTERVAL '24 hours'
ORDER BY check_time DESC;
```

### Calculate Uptime for Integration

```sql
SELECT
  integration_name,
  COUNT(*) as total_checks,
  COUNT(*) FILTER (WHERE status IN ('healthy', 'degraded')) as successful_checks,
  ROUND(
    (COUNT(*) FILTER (WHERE status IN ('healthy', 'degraded'))::DECIMAL /
     COUNT(*)::DECIMAL) * 100,
    2
  ) as uptime_percentage
FROM integration_health_log
WHERE
  integration_name = 'CRM Platform' AND
  check_time > NOW() - INTERVAL '30 days'
GROUP BY integration_name;
```

### Get Average Response Times

```sql
SELECT
  integration_name,
  ROUND(AVG(response_time_ms)) as avg_response_time,
  MIN(response_time_ms) as min_response_time,
  MAX(response_time_ms) as max_response_time
FROM integration_health_log
WHERE
  success = true AND
  check_time > NOW() - INTERVAL '24 hours'
GROUP BY integration_name
ORDER BY avg_response_time DESC;
```

## Troubleshooting

### Integration Shows "Unknown" Status

**Possible causes:**
- Integration not enabled
- Endpoint URL not configured
- Service credentials missing
- Health check hasn't run yet

**Solutions:**
1. Check `enabled` column in database
2. Verify `endpoint_url` is set correctly
3. Ensure environment variables are configured
4. Manually trigger health check

### Alerts Not Being Sent

**Possible causes:**
- `alert_on_failure` set to false
- Alert throttling (sent within last hour)
- Consecutive failures below threshold
- Email service not configured

**Solutions:**
1. Check `alert_on_failure` column
2. Check `alert_sent_at` timestamp
3. Review `alert_threshold` setting
4. Verify notification system configuration

### High Response Times

**Possible causes:**
- Network latency
- Service under load
- Database slow queries
- Timeout issues

**Solutions:**
1. Check service provider status
2. Review database query performance
3. Increase timeout if appropriate
4. Consider caching strategies

### Stale Checks

A check is considered "stale" if it hasn't run in 2x the configured interval.

**Possible causes:**
- Cron job not running
- Cron secret incorrect
- Application deployment issues
- Database connection issues

**Solutions:**
1. Verify cron job configuration
2. Check cron job logs
3. Verify CRON_SECRET environment variable
4. Test endpoint manually

## Best Practices

1. **Set Appropriate Intervals**: Don't check too frequently (5 mins is good)
2. **Configure Alerts Wisely**: Set thresholds to avoid false alarms
3. **Monitor the Monitors**: Check that health checks are running
4. **Review Metrics Regularly**: Look for patterns and trends
5. **Test Integrations**: Manually verify critical integrations periodically
6. **Keep Logs**: 90-day retention provides good historical data
7. **Document Changes**: Track when integrations are added/modified
8. **Test Failover**: Verify alerts work when services actually fail

## Performance Considerations

- Health checks run every 5 minutes (configurable)
- Each check typically completes in < 1 second
- Logs are automatically cleaned up after 90 days
- Database indexes optimize query performance
- Views provide fast access to aggregated data

## Security

- Health endpoints are public (for monitoring)
- Sensitive data not exposed in health responses
- Cron endpoints protected with secret token
- Admin-only access to dashboard
- RLS policies enforce data access controls
- Alerts sent only to configured recipients

## Future Enhancements

Potential improvements:

- [ ] Webhook notifications to Slack/Teams
- [ ] Custom health check scripts
- [ ] Multi-region monitoring
- [ ] SLA tracking and reporting
- [ ] Predictive failure detection
- [ ] Integration dependency mapping
- [ ] Mobile app for monitoring
- [ ] Public status page
- [ ] Historical trend charts
- [ ] Anomaly detection using ML

## Support

For issues or questions:
- Review this documentation
- Check SQL migration: `sql/20-integration-health-monitoring.sql`
- Review health utilities: `src/lib/monitoring/integration-health.ts`
- Check cron jobs: `src/app/api/cron/check-integration-health/`
- View dashboard code: `src/app/(dashboard)/dashboard/monitoring/integrations/`

## Monitoring the Monitoring System

Yes, you should monitor your monitoring system!

**Key indicators:**
- Are health checks running on schedule?
- Is the cleanup job running daily?
- Are logs growing unbounded?
- Are alerts being delivered?
- Is the dashboard loading quickly?

**Verification queries:**
```sql
-- Check latest health check run
SELECT MAX(check_time) as last_check
FROM integration_health_log;

-- Check log growth
SELECT COUNT(*), DATE(check_time) as day
FROM integration_health_log
WHERE check_time > NOW() - INTERVAL '7 days'
GROUP BY DATE(check_time)
ORDER BY day DESC;

-- Check alert delivery
SELECT
  integration_name,
  alert_sent_at,
  consecutive_failures
FROM integration_health
WHERE alert_sent_at IS NOT NULL
ORDER BY alert_sent_at DESC
LIMIT 10;
```

---

## Quick Start Checklist

- [ ] Run SQL migration (`sql/20-integration-health-monitoring.sql`)
- [ ] Update integration endpoint URLs in database
- [ ] Configure alert email addresses
- [ ] Set up cron jobs (health check + cleanup)
- [ ] Set `CRON_SECRET` environment variable
- [ ] Test health endpoint (`/api/health`)
- [ ] Test health check cron manually
- [ ] Verify dashboard loads (`/dashboard/monitoring/integrations`)
- [ ] Test alert system (manually trigger failure)
- [ ] Document any custom integrations added

The system is production-ready and will keep your Dirt Free ecosystem healthy! 🎉
