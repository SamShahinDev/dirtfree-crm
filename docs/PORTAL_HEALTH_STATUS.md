# Portal Health & Status API

Complete documentation for the portal health monitoring, status reporting, and feature flag system.

## Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [Feature Flags](#feature-flags)
- [Health Check API](#health-check-api)
- [Status API](#status-api)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Monitoring & Alerting](#monitoring--alerting)

---

## Overview

The Portal Health & Status system provides:

1. **Health Monitoring**: Real-time health checks of system components
2. **Status Reporting**: Maintenance windows and known issues
3. **Feature Flags**: Controlled feature releases and A/B testing
4. **Incident Tracking**: Historical incident logging

### Key Features

- **Multi-Component Health Checks**: Database, Stripe, Twilio, Email (Resend)
- **Response Time Tracking**: Performance monitoring for each component
- **Feature Flag Management**: Enable/disable features remotely with gradual rollouts
- **Maintenance Mode**: Schedule and manage maintenance windows
- **Public Endpoints**: No authentication required for monitoring

---

## Database Schema

### Feature Flags Table

```sql
CREATE TABLE feature_flags (
  id uuid PRIMARY KEY,
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean DEFAULT false,
  rollout_percentage integer DEFAULT 100 CHECK (0-100),
  user_ids uuid[],
  customer_ids uuid[],
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid,
  updated_by uuid
);
```

**Fields:**
- `key`: Unique identifier (e.g., 'portal_dark_mode')
- `enabled`: Master on/off switch
- `rollout_percentage`: Percentage of users who see the feature (0-100)
- `user_ids`: Whitelisted user IDs (always get feature)
- `customer_ids`: Whitelisted customer IDs (always get feature)
- `metadata`: Additional configuration

### System Status Table

```sql
CREATE TABLE system_status (
  id uuid PRIMARY KEY,
  status text CHECK (status IN ('operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance')),
  component text CHECK (component IN ('api', 'database', 'stripe', 'twilio', 'email', 'portal', 'crm')),
  message text,
  started_at timestamptz,
  resolved_at timestamptz,
  created_by uuid,
  metadata jsonb
);
```

**Status Levels:**
- `operational`: All systems functioning normally
- `degraded`: Slow performance but functional
- `partial_outage`: Some features unavailable
- `major_outage`: Critical functionality down
- `maintenance`: Scheduled maintenance in progress

### Maintenance Windows Table

```sql
CREATE TABLE maintenance_windows (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  status text CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  affects_portal boolean DEFAULT true,
  affects_crm boolean DEFAULT false,
  created_at timestamptz,
  created_by uuid,
  metadata jsonb
);
```

### Health Check Logs Table

```sql
CREATE TABLE health_check_logs (
  id uuid PRIMARY KEY,
  component text NOT NULL,
  status text CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  response_time_ms integer,
  error_message text,
  checked_at timestamptz,
  metadata jsonb
);
```

---

## Feature Flags

### Library: `/src/lib/portal/feature-flags.ts`

#### Check if Feature is Enabled

```typescript
import { isFeatureEnabled } from '@/lib/portal/feature-flags'

const enabled = await isFeatureEnabled('portal_dark_mode', {
  userId: 'user-uuid',
  customerId: 'customer-uuid'
})

if (enabled) {
  // Show dark mode toggle
}
```

#### Get Detailed Feature Status

```typescript
import { checkFeatureFlag } from '@/lib/portal/feature-flags'

const result = await checkFeatureFlag('portal_ai_chat', {
  customerId: 'customer-uuid'
})

console.log(result.enabled) // true/false
console.log(result.reason) // 'whitelist_customer', 'rollout', 'disabled'
```

#### Get All Enabled Features

```typescript
import { getEnabledFeatures } from '@/lib/portal/feature-flags'

const features = await getEnabledFeatures({
  customerId: 'customer-uuid'
})

console.log(features) // ['portal_analytics', 'portal_messaging', ...]
```

#### Update Feature Flag

```typescript
import { updateFeatureFlag } from '@/lib/portal/feature-flags'

await updateFeatureFlag('portal_dark_mode', {
  enabled: true,
  rolloutPercentage: 50, // 50% of users
}, 'admin-user-id')
```

#### Create New Feature Flag

```typescript
import { createFeatureFlag } from '@/lib/portal/feature-flags'

await createFeatureFlag({
  key: 'portal_new_feature',
  name: 'New Feature',
  description: 'Description of the feature',
  enabled: false,
  rolloutPercentage: 0
}, 'admin-user-id')
```

#### Whitelist Users/Customers

```typescript
import { addUserToWhitelist, addCustomerToWhitelist } from '@/lib/portal/feature-flags'

// Add user to beta test
await addUserToWhitelist('portal_ai_chat', 'user-uuid')

// Add VIP customer
await addCustomerToWhitelist('portal_ai_chat', 'customer-uuid')
```

#### Gradual Rollout

```typescript
import { gradualRollout } from '@/lib/portal/feature-flags'

// Gradually increase from 0% to 100% over 7 days
await gradualRollout('portal_new_feature', {
  startPercentage: 0,
  endPercentage: 100,
  durationHours: 168, // 7 days
  intervalHours: 24 // Increase every 24 hours
})
```

### Feature Flag Algorithm

Feature evaluation follows this order:

1. **Is Enabled?** If `enabled = false`, feature is disabled for everyone
2. **User Whitelist**: If user ID is in `user_ids` array, feature is enabled
3. **Customer Whitelist**: If customer ID is in `customer_ids` array, feature is enabled
4. **Rollout Percentage**: Use deterministic hash of user/customer ID to assign to bucket

**Example:**
```
Feature: portal_dark_mode
Enabled: true
Rollout: 50%

User A (hash: 23) -> 23 < 50 -> Enabled
User B (hash: 67) -> 67 >= 50 -> Disabled
User C (in whitelist) -> Enabled (bypass rollout)
```

---

## Health Check API

### GET /api/portal/health

Returns comprehensive system health status.

**Authentication:** None required (public endpoint)

**Response:**

```json
{
  "success": true,
  "version": "v1",
  "data": {
    "status": "operational",
    "components": {
      "api": {
        "status": "healthy",
        "responseTime": 45,
        "lastChecked": "2025-10-22T12:00:00Z"
      },
      "database": {
        "status": "healthy",
        "responseTime": 123,
        "lastChecked": "2025-10-22T12:00:00Z"
      },
      "stripe": {
        "status": "healthy",
        "responseTime": 456,
        "lastChecked": "2025-10-22T12:00:00Z"
      },
      "twilio": {
        "status": "healthy",
        "responseTime": 234,
        "lastChecked": "2025-10-22T12:00:00Z"
      },
      "email": {
        "status": "healthy",
        "responseTime": 189,
        "lastChecked": "2025-10-22T12:00:00Z"
      }
    },
    "lastIncident": {
      "component": "stripe",
      "status": "degraded",
      "message": "Slow API responses",
      "timestamp": "2025-10-21T14:30:00Z"
    },
    "timestamp": "2025-10-22T12:00:00Z"
  }
}
```

**Component Status:**
- `healthy`: Component functioning normally
- `degraded`: Slow performance (response time > thresholds)
- `unhealthy`: Component unavailable or erroring

**Overall System Status:**
- `operational`: All components healthy
- `degraded`: 1+ components degraded
- `partial_outage`: 1 component unhealthy
- `major_outage`: 2+ components unhealthy

**HTTP Status Codes:**
- `200`: System operational or degraded
- `503`: Partial outage or major outage

### Health Check Thresholds

| Component | Healthy | Degraded | Unhealthy |
|-----------|---------|----------|-----------|
| Database  | < 1s    | 1-2s     | > 2s or error |
| Stripe    | < 2s    | 2-5s     | > 5s or error |
| Twilio    | < 2s    | 2-5s     | > 5s or error |
| Email     | < 2s    | 2-5s     | > 5s or error |

### Health Check Process

1. **Database**: SELECT query on customers table
2. **Stripe**: Retrieve account balance
3. **Twilio**: Fetch account details
4. **Email**: Fetch domains from Resend API

All checks run in parallel for speed.

---

## Status API

### GET /api/portal/status

Returns portal operational status, maintenance windows, and feature flags.

**Authentication:** None required (public endpoint)

**Response:**

```json
{
  "success": true,
  "version": "v1",
  "data": {
    "maintenanceMode": false,
    "currentMaintenance": null,
    "upcomingMaintenance": [
      {
        "id": "uuid",
        "title": "Database Upgrade",
        "description": "Upgrading to PostgreSQL 15",
        "scheduledStart": "2025-10-25T02:00:00Z",
        "scheduledEnd": "2025-10-25T04:00:00Z",
        "status": "scheduled",
        "affectsPortal": true,
        "affectsCRM": false
      }
    ],
    "featureFlags": {
      "portal_analytics": true,
      "portal_messaging": true,
      "portal_dark_mode": false,
      "portal_ai_chat": false
    },
    "version": {
      "app": "1.5.2",
      "api": "v1",
      "build": "a3c2d1f",
      "deployedAt": "2025-10-22T10:00:00Z"
    },
    "knownIssues": [],
    "systemStatus": "operational",
    "timestamp": "2025-10-22T12:00:00Z"
  }
}
```

**Fields:**

- `maintenanceMode`: Boolean indicating if portal is currently in maintenance
- `currentMaintenance`: Active maintenance window (if any)
- `upcomingMaintenance`: Scheduled maintenance in next 7 days
- `featureFlags`: Key-value map of all features (100% rollout only)
- `version`: Application version information
- `knownIssues`: Active component issues
- `systemStatus`: Overall system health

---

## Usage Examples

### Example 1: Check System Health from CRM Admin Panel

```typescript
// Admin dashboard component
async function SystemHealthWidget() {
  const response = await fetch('/api/portal/health')
  const { data } = await response.json()

  return (
    <div className="health-widget">
      <h3>System Health: {data.status}</h3>
      <ul>
        {Object.entries(data.components).map(([name, component]) => (
          <li key={name}>
            {name}: {component.status}
            {component.responseTime && ` (${component.responseTime}ms)`}
          </li>
        ))}
      </ul>
      {data.lastIncident && (
        <div className="last-incident">
          Last incident: {data.lastIncident.component} - {data.lastIncident.message}
        </div>
      )}
    </div>
  )
}
```

### Example 2: Display Maintenance Banner in Portal

```typescript
// Portal layout component
async function MaintenanceBanner() {
  const response = await fetch('/api/portal/status')
  const { data } = await response.json()

  if (data.maintenanceMode) {
    return (
      <div className="maintenance-banner">
        <strong>Maintenance in Progress</strong>
        <p>{data.currentMaintenance?.description}</p>
        <p>Expected to complete at {new Date(data.currentMaintenance.scheduledEnd).toLocaleString()}</p>
      </div>
    )
  }

  if (data.upcomingMaintenance.length > 0) {
    const next = data.upcomingMaintenance[0]
    return (
      <div className="upcoming-maintenance-banner">
        Scheduled maintenance: {next.title} on {new Date(next.scheduledStart).toLocaleString()}
      </div>
    )
  }

  return null
}
```

### Example 3: Conditional Feature Rendering

```typescript
// Portal component with feature flag
import { isFeatureEnabled } from '@/lib/portal/feature-flags'

async function PortalDashboard({ customerId }: { customerId: string }) {
  const darkModeEnabled = await isFeatureEnabled('portal_dark_mode', {
    customerId
  })

  const aiChatEnabled = await isFeatureEnabled('portal_ai_chat', {
    customerId
  })

  return (
    <div>
      {darkModeEnabled && <DarkModeToggle />}
      {aiChatEnabled && <AIChatWidget />}
      <MainContent />
    </div>
  )
}
```

### Example 4: A/B Testing

```typescript
// Test two different booking flows
import { checkFeatureFlag } from '@/lib/portal/feature-flags'

async function BookingPage({ customerId }: { customerId: string }) {
  const result = await checkFeatureFlag('portal_new_booking_flow', {
    customerId
  })

  if (result.enabled) {
    return <NewBookingFlow />
  } else {
    return <OldBookingFlow />
  }
}
```

### Example 5: Beta Program

```typescript
// Add user to beta program
import { addUserToWhitelist } from '@/lib/portal/feature-flags'

async function enrollInBeta(userId: string) {
  await addUserToWhitelist('portal_ai_chat', userId)
  await addUserToWhitelist('portal_dark_mode', userId)

  console.log('User enrolled in beta program')
}
```

### Example 6: Schedule Maintenance Window

```typescript
// Admin panel - schedule maintenance
async function scheduleMaintenance() {
  const supabase = getServiceSupabase()

  await supabase.from('maintenance_windows').insert({
    title: 'System Upgrade',
    description: 'Upgrading backend infrastructure',
    scheduled_start: '2025-10-25T02:00:00Z',
    scheduled_end: '2025-10-25T04:00:00Z',
    status: 'scheduled',
    affects_portal: true,
    affects_crm: false,
    created_by: adminUserId
  })
}
```

### Example 7: Log System Incident

```typescript
// Log a degraded service
async function logIncident() {
  const supabase = getServiceSupabase()

  await supabase.from('system_status').insert({
    status: 'degraded',
    component: 'stripe',
    message: 'Stripe API experiencing slow response times',
    started_at: new Date().toISOString(),
    created_by: adminUserId,
    metadata: {
      avgResponseTime: 3500,
      threshold: 2000
    }
  })
}
```

### Example 8: Gradual Feature Rollout

```typescript
// Gradually roll out new feature over 1 week
import { gradualRollout } from '@/lib/portal/feature-flags'

async function rolloutNewFeature() {
  await gradualRollout('portal_new_dashboard', {
    startPercentage: 0,
    endPercentage: 100,
    durationHours: 168, // 7 days
    intervalHours: 24   // Increase 14.3% per day
  })
}
```

---

## Best Practices

### Feature Flags

1. **Naming Convention**
   - Use `portal_` prefix for portal features
   - Use snake_case: `portal_dark_mode`, not `portalDarkMode`
   - Be descriptive: `portal_ai_chat` not `portal_chat`

2. **Rollout Strategy**
   - Start at 0% for new features
   - Beta test with whitelist first
   - Gradually increase to 10%, 25%, 50%, 75%, 100%
   - Monitor errors and performance at each step

3. **Cleanup**
   - Remove feature flags once at 100% for 2+ weeks
   - Delete deprecated flags
   - Keep flags table under 50 entries

4. **Documentation**
   - Document what each feature does
   - Note dependencies between features
   - Track when feature was fully released

### Health Monitoring

1. **Response Time Thresholds**
   - Set realistic thresholds based on baseline
   - Review and adjust quarterly
   - Alert on sustained degradation, not spikes

2. **Health Check Frequency**
   - External monitoring: Every 1-5 minutes
   - Internal checks: Every 30-60 seconds
   - Log aggregation: Daily cleanup of old logs

3. **Incident Response**
   - Create system_status entry for known issues
   - Update with resolution time
   - Post-mortem for major outages

### Maintenance Windows

1. **Scheduling**
   - Schedule during low-traffic periods
   - Provide 48+ hours notice
   - Allow 50% buffer time (2hr job = 3hr window)

2. **Communication**
   - Display banner 24 hours before
   - Send email notification
   - Update status page

3. **Testing**
   - Test maintenance procedures in staging
   - Have rollback plan ready
   - Monitor closely during window

---

## Monitoring & Alerting

### Recommended Alerts

#### Critical Alerts (PagerDuty/On-Call)

```yaml
Database Unhealthy:
  condition: database.status == 'unhealthy'
  duration: 2 minutes
  action: Page on-call engineer

Major Outage:
  condition: status == 'major_outage'
  duration: 1 minute
  action: Page on-call team

Payment Processing Down:
  condition: stripe.status == 'unhealthy'
  duration: 5 minutes
  action: Page on-call engineer
```

#### Warning Alerts (Slack/Email)

```yaml
Degraded Performance:
  condition: ANY component.status == 'degraded'
  duration: 10 minutes
  action: Notify #ops-alerts

Partial Outage:
  condition: status == 'partial_outage'
  duration: 5 minutes
  action: Notify #incident-response

Slow Database:
  condition: database.responseTime > 1000ms
  duration: 15 minutes
  action: Notify #database-team
```

### Monitoring Dashboard

Recommended metrics to track:

1. **Uptime**
   - Overall system uptime (%)
   - Per-component uptime
   - Target: 99.9% (< 43 minutes downtime/month)

2. **Response Times**
   - P50, P95, P99 response times per component
   - Track trends over time
   - Alert on degradation

3. **Error Rates**
   - Health check failures per component
   - API error rates
   - Target: < 0.1% error rate

4. **Feature Adoption**
   - % of customers using each feature
   - Feature flag rollout progress
   - Feature-specific error rates

### Health Check Automation

```bash
# Cron job to check health every minute
* * * * * curl -f https://your-app.com/api/portal/health || echo "Health check failed"

# Daily health report
0 9 * * * node scripts/daily-health-report.js

# Weekly feature flag audit
0 9 * * 1 node scripts/audit-feature-flags.js
```

### Log Retention

```sql
-- Clean up health check logs older than 30 days
DELETE FROM health_check_logs
WHERE checked_at < NOW() - INTERVAL '30 days';

-- Archive resolved incidents older than 90 days
-- Move to archive table or export to S3
```

---

## Database Functions

### is_feature_enabled(feature_key, user_id, customer_id)

Check if a feature is enabled for a user or customer.

```sql
SELECT is_feature_enabled('portal_dark_mode', 'user-uuid', 'customer-uuid');
-- Returns: true/false
```

### get_system_status()

Get current status of all components with unresolved issues.

```sql
SELECT * FROM get_system_status();
-- Returns: component, status, message, since
```

### get_upcoming_maintenance(hours_ahead)

Get upcoming maintenance windows.

```sql
SELECT * FROM get_upcoming_maintenance(168); -- Next 7 days
-- Returns: id, title, description, scheduled_start, scheduled_end, status, affects_portal, affects_crm
```

### log_health_check(component, status, response_time_ms, error_message, metadata)

Log a health check result.

```sql
SELECT log_health_check(
  'database',
  'healthy',
  145,
  NULL,
  '{"query": "SELECT 1"}'::jsonb
);
-- Returns: log_id (uuid)
```

---

## API Rate Limits

| Endpoint | Rate Limit | Window |
|----------|-----------|--------|
| GET /api/portal/health | 60 requests | 1 minute |
| GET /api/portal/status | 60 requests | 1 minute |

Note: These are public endpoints with no authentication, so rate limiting is essential.

---

## Troubleshooting

### Health Check Returns Unhealthy

**Database Unhealthy:**
1. Check database connection string
2. Verify database is running
3. Check firewall rules
4. Review database logs

**Stripe Unhealthy:**
1. Verify API key is correct
2. Check Stripe dashboard for incidents
3. Test API key manually with curl
4. Review rate limits

**Twilio Unhealthy:**
1. Verify account SID and auth token
2. Check Twilio status page
3. Review account balance
4. Check API logs

**Email Unhealthy:**
1. Verify Resend API key
2. Check domain verification
3. Review sending limits
4. Check Resend status page

### Feature Flag Not Working

**Feature Appears Disabled:**
1. Check if flag `enabled = true`
2. Verify rollout percentage
3. Check if user/customer is in rollout bucket
4. Review whitelist arrays

**Inconsistent Behavior:**
1. Ensure using consistent user/customer ID
2. Check for caching issues
3. Verify database values
4. Review rollout hash function

### Maintenance Mode Issues

**Maintenance Banner Not Showing:**
1. Check maintenance window status is 'in_progress'
2. Verify `affects_portal = true`
3. Check scheduled times
4. Review portal status API response

**Can't Exit Maintenance:**
1. Update maintenance window status to 'completed'
2. Set `actual_end` timestamp
3. Verify no other active windows
4. Clear cache if applicable

---

## Security Considerations

### Public Endpoints

Both `/api/portal/health` and `/api/portal/status` are public:

- **Why**: Needed for uptime monitoring, status pages
- **Risks**: Information disclosure, DDoS target
- **Mitigations**:
  - Rate limiting (60 req/min)
  - No sensitive data in responses
  - CDN caching
  - DDoS protection (Cloudflare/Vercel)

### Feature Flags

- Feature flags visible to all authenticated users
- Whitelist IDs (user_ids, customer_ids) visible in DB
- Use RLS to restrict modifications to admins only
- Audit all feature flag changes

### Health Check Logs

- May contain error messages with sensitive info
- Review error messages before logging
- Sanitize stack traces
- Auto-delete after 30 days

---

## Changelog

### v1.0.0 (2025-10-22)

- Initial release
- Health check API
- Status API
- Feature flags system
- Maintenance windows
- Incident tracking

---

## Support

For issues or questions:

1. Check this documentation
2. Review health check logs
3. Check system_status table
4. Review maintenance windows
5. Contact development team

---

## Quick Reference

### Feature Flag Checklist

- [ ] Create feature flag with `enabled: false`, `rollout: 0`
- [ ] Test with whitelist users/customers
- [ ] Gradually increase rollout (10%, 25%, 50%, 75%, 100%)
- [ ] Monitor errors and performance
- [ ] Remove flag after 2+ weeks at 100%

### Health Check Checklist

- [ ] All components return `healthy`
- [ ] Response times under thresholds
- [ ] No active incidents
- [ ] Health logs being recorded
- [ ] Monitoring alerts configured

### Maintenance Window Checklist

- [ ] Schedule during low-traffic period
- [ ] 48+ hours advance notice
- [ ] Email notification sent
- [ ] Status banner displayed
- [ ] Rollback plan ready
- [ ] Team on standby

### Incident Response Checklist

- [ ] Create system_status entry
- [ ] Update portal status banner
- [ ] Notify customers via email
- [ ] Investigate root cause
- [ ] Implement fix
- [ ] Mark incident as resolved
- [ ] Post-mortem writeup
