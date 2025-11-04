# Portal Analytics System Documentation

## Overview

The Portal Analytics System provides comprehensive tracking and reporting of customer portal usage, enabling data-driven decisions about portal features, ROI measurement, and customer engagement insights.

## Features

✅ **Complete Implementation**
- Real-time event tracking
- Daily aggregation for fast reporting
- 19+ tracked event types
- Portal adoption metrics
- Booking & payment conversion tracking
- Session duration analysis
- Feature usage breakdown
- Monthly active users (MAU)
- Automatic daily aggregation via cron
- Admin dashboard metrics API

## Architecture

### Components

1. **Event Tracking** (`portal_analytics` table)
   - Raw event storage
   - Customer association
   - Session tracking
   - Metadata support

2. **Daily Aggregations** (`portal_analytics_daily` table)
   - Pre-calculated metrics
   - Fast reporting queries
   - Historical trends

3. **Tracking API** (`/api/portal/analytics/track`)
   - Event submission
   - Optional authentication
   - IP & user agent capture

4. **Stats API** (`/api/portal/analytics/stats`)
   - Admin-only access
   - Configurable periods
   - Comprehensive metrics

5. **Aggregation Cron** (`/api/cron/aggregate-portal-analytics`)
   - Daily at midnight
   - Yesterday's data aggregation
   - Automatic rollup

6. **Client Library** (`portal-tracker.ts`)
   - TypeScript SDK
   - Convenient methods
   - Automatic retry

## Event Types

The system tracks 19 event types across 6 categories:

### Authentication
- `login` - User logged in
- `logout` - User logged out

### Navigation
- `page_view` - Page viewed
- `feature_usage` - Feature used

### Bookings
- `booking_initiated` - Started booking process
- `booking_completed` - Completed booking
- `booking_cancelled` - Cancelled booking

### Payments
- `payment_initiated` - Started payment
- `payment_completed` - Completed payment
- `payment_failed` - Payment failed

### Invoices
- `invoice_viewed` - Viewed invoice
- `invoice_downloaded` - Downloaded invoice PDF

### Communication
- `message_sent` - Sent message to staff
- `message_viewed` - Viewed message thread

### Engagement
- `notification_clicked` - Clicked notification
- `profile_updated` - Updated profile
- `preferences_updated` - Updated preferences
- `search` - Performed search

### System
- `error` - Error occurred

## Database Schema

### portal_analytics Table

Raw event tracking table.

**Columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `customer_id` | uuid | Customer (nullable for anonymous) |
| `session_id` | uuid | Portal session reference |
| `event_type` | text | Event type (enum) |
| `page` | text | Page path/name |
| `feature` | text | Feature identifier |
| `metadata` | jsonb | Additional event data |
| `ip_address` | inet | Client IP |
| `user_agent` | text | Browser/device info |
| `referrer` | text | HTTP referrer |
| `value_amount` | numeric | Monetary value (bookings/payments) |
| `created_at` | timestamptz | Event timestamp |

**Indexes:**
- `idx_portal_analytics_customer` - Customer + created_at
- `idx_portal_analytics_event_type` - Event type + created_at
- `idx_portal_analytics_session` - Session lookup
- `idx_portal_analytics_created_at` - Time-based queries
- `idx_portal_analytics_date` - Daily queries
- `idx_portal_analytics_page` - Page analytics
- `idx_portal_analytics_feature` - Feature usage

### portal_analytics_daily Table

Aggregated daily metrics.

**Columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `date` | date | Aggregation date (unique) |
| `new_registrations` | integer | New portal sign-ups |
| `total_active_users` | integer | Distinct users with events |
| `unique_visitors` | integer | Distinct customers or sessions |
| `total_sessions` | integer | Session count |
| `total_page_views` | integer | Page views |
| `avg_pages_per_session` | numeric | Pages / sessions |
| `avg_session_duration_minutes` | numeric | Average session length |
| `bookings_initiated` | integer | Booking starts |
| `bookings_completed` | integer | Bookings completed |
| `bookings_cancelled` | integer | Bookings cancelled |
| `booking_conversion_rate` | numeric | Completion % |
| `payments_initiated` | integer | Payment attempts |
| `payments_completed` | integer | Successful payments |
| `payments_failed` | integer | Failed payments |
| `payment_conversion_rate` | numeric | Success % |
| `total_payment_amount` | numeric | Total revenue |
| `messages_sent` | integer | Messages sent |
| `messages_viewed` | integer | Messages read |
| `invoices_viewed` | integer | Invoices opened |
| `invoices_downloaded` | integer | Invoice PDFs downloaded |
| `notifications_clicked` | integer | Notifications clicked |
| `total_errors` | integer | Error events |
| `metadata` | jsonb | Extra metrics |
| `created_at` | timestamptz | Creation time |
| `updated_at` | timestamptz | Last update |

## API Endpoints

### 1. POST /api/portal/analytics/track

Tracks a portal event.

**Authentication:** Optional (X-Portal-Token header)

**Request:**
```bash
POST /api/portal/analytics/track
Content-Type: application/json
X-Portal-Token: <optional-access-token>

{
  "eventType": "page_view",
  "page": "/dashboard",
  "metadata": {
    "referrer": "/login"
  }
}
```

**Request Body:**
```typescript
{
  eventType: EventType        // Required
  page?: string              // Page/route
  feature?: string           // Feature identifier
  metadata?: Record<string, any>  // Additional data
  valueAmount?: number       // For bookings/payments
  referrer?: string          // HTTP referrer
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "message": "Event tracked successfully",
    "eventType": "page_view"
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

**Status Codes:**
- `200` - Success
- `400` - Validation error
- `500` - Server error

**Notes:**
- Works with or without authentication
- Automatically captures IP and user agent
- Non-blocking (doesn't fail portal functionality)
- Async recommended for client calls

### 2. GET /api/portal/analytics/stats

Retrieves portal analytics statistics (admin only).

**Authentication:** Required (Bearer token with admin role)

**Request:**
```bash
GET /api/portal/analytics/stats?period=30
Authorization: Bearer <admin-access-token>
```

**Query Parameters:**
- `period` (optional): Number of days to include (default: 30)

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "period": {
      "days": 30,
      "startDate": "2025-09-21",
      "endDate": "2025-10-21"
    },
    "adoption": {
      "totalCustomers": 1500,
      "registeredPortalUsers": 750,
      "adoptionRate": 50.00
    },
    "engagement": {
      "monthlyActiveUsers": 450,
      "avgDailyActiveUsers": 89,
      "totalSessions": 2670,
      "avgSessionDurationMinutes": 8.5,
      "totalPageViews": 15420,
      "avgDailyPageViews": 514
    },
    "bookings": {
      "initiated": 320,
      "completed": 256,
      "cancelled": 18,
      "conversionRate": 80.00
    },
    "payments": {
      "initiated": 220,
      "completed": 198,
      "failed": 22,
      "conversionRate": 90.00,
      "totalAmount": 45670.50
    },
    "communication": {
      "messagesSent": 145,
      "messagesViewed": 423
    },
    "invoices": {
      "viewed": 567,
      "downloaded": 234
    },
    "notifications": {
      "clicked": 890
    },
    "featureUsage": {
      "feature_usage": 1250
    },
    "dailyStats": [
      {
        "date": "2025-10-20",
        "total_active_users": 92,
        "total_page_views": 523,
        // ... more metrics
      }
      // ... more days
    ]
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `403` - Forbidden (not admin)
- `500` - Server error

### 3. GET /api/cron/aggregate-portal-analytics

Aggregates analytics data (cron job only).

**Authentication:** Required (CRON_SECRET or INTERNAL_CRON_SECRET)

**Request:**
```bash
GET /api/cron/aggregate-portal-analytics?date=2025-10-20
Authorization: Bearer <cron-secret>
```

**Query Parameters:**
- `date` (optional): Date to aggregate (YYYY-MM-DD), defaults to yesterday

**Response (Success):**
```json
{
  "success": true,
  "message": "Analytics aggregated for 2025-10-20",
  "date": "2025-10-20",
  "data": {
    "date": "2025-10-20",
    "total_active_users": 92,
    "total_page_views": 523,
    // ... all daily metrics
  }
}
```

**Cron Schedule:**
- Runs daily at midnight (00:00 UTC)
- Aggregates previous day's data
- Configured in `vercel.json`

## Client Integration

### TypeScript SDK

**Installation:**
```typescript
import { createPortalTracker, initializeAnalytics } from '@/lib/analytics/portal-tracker'
```

**Basic Setup:**
```typescript
// Initialize once at app startup
import { initializeAnalytics } from '@/lib/analytics/portal-tracker'

const tracker = initializeAnalytics({
  accessToken: 'user-access-token',
  debug: process.env.NODE_ENV === 'development',
  enabled: true
})
```

**Track Page Views:**
```typescript
import { trackPageView } from '@/lib/analytics/portal-tracker'

// Automatic on route change
useEffect(() => {
  trackPageView(window.location.pathname)
}, [pathname])
```

**Track Events:**
```typescript
import { getGlobalTracker } from '@/lib/analytics/portal-tracker'

const tracker = getGlobalTracker()

// Login
await tracker.trackLogin()

// Feature usage
await tracker.trackFeatureUsage('appointment-scheduler', {
  selectedDate: '2025-10-25',
  serviceType: 'carpet-cleaning'
})

// Booking flow
await tracker.trackBookingInitiated(250.00)
// ... booking steps ...
await tracker.trackBookingCompleted(250.00, {
  appointmentId: 'uuid',
  serviceType: 'carpet-cleaning'
})

// Payment
await tracker.trackPaymentInitiated(250.00)
// ... payment processing ...
await tracker.trackPaymentCompleted(250.00, {
  invoiceId: 'uuid',
  paymentMethod: 'card'
})

// Errors
await tracker.trackError('Failed to load appointments', {
  errorCode: 'LOAD_ERROR',
  component: 'AppointmentList'
})
```

### React Hook Example

```typescript
// hooks/useAnalytics.ts
import { useEffect } from 'react'
import { getGlobalTracker } from '@/lib/analytics/portal-tracker'

export function usePageTracking() {
  useEffect(() => {
    const tracker = getGlobalTracker()
    tracker.trackPageView(window.location.pathname)
  }, [])
}

export function useAnalytics() {
  const tracker = getGlobalTracker()

  return {
    trackFeature: (feature: string, metadata?: Record<string, any>) => {
      tracker.trackFeatureUsage(feature, metadata)
    },
    trackBooking: async (amount: number, metadata?: Record<string, any>) => {
      await tracker.trackBookingCompleted(amount, metadata)
    },
    trackPayment: async (amount: number, metadata?: Record<string, any>) => {
      await tracker.trackPaymentCompleted(amount, metadata)
    }
  }
}
```

**Usage in Component:**
```typescript
import { usePageTracking, useAnalytics } from '@/hooks/useAnalytics'

export default function AppointmentPage() {
  usePageTracking()
  const { trackFeature, trackBooking } = useAnalytics()

  const handleSchedule = async (appointment) => {
    // ... schedule logic ...
    await trackBooking(appointment.total, {
      appointmentId: appointment.id,
      serviceType: appointment.service
    })
  }

  return (
    <div>
      <button
        onClick={() => {
          trackFeature('calendar-view-toggle')
          setViewMode('calendar')
        }}
      >
        Calendar View
      </button>
    </div>
  )
}
```

### Vanilla JavaScript

```javascript
// Track page view
fetch('/api/portal/analytics/track', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Token': localStorage.getItem('accessToken')
  },
  body: JSON.stringify({
    eventType: 'page_view',
    page: window.location.pathname
  })
})

// Track booking
fetch('/api/portal/analytics/track', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Portal-Token': localStorage.getItem('accessToken')
  },
  body: JSON.stringify({
    eventType: 'booking_completed',
    valueAmount: 250.00,
    metadata: {
      appointmentId: 'uuid',
      serviceType: 'carpet-cleaning'
    }
  })
})
```

## Database Functions

### aggregate_portal_analytics(p_date)

Aggregates all analytics for a specific date.

**Usage:**
```sql
SELECT aggregate_portal_analytics('2025-10-20');
```

**What It Does:**
1. Counts new registrations
2. Calculates unique active users
3. Computes session metrics
4. Calculates conversion rates
5. Sums payment amounts
6. Updates `portal_analytics_daily` table

**Called By:**
- Cron job (daily at midnight)
- Manual execution for backfilling

### get_portal_adoption_rate()

Returns portal adoption metrics.

**Usage:**
```sql
SELECT * FROM get_portal_adoption_rate();
```

**Returns:**
```
total_customers | registered_portal_users | adoption_rate
1500           | 750                     | 50.00
```

### calculate_session_duration(p_session_id)

Calculates duration of a session in minutes.

**Usage:**
```sql
SELECT calculate_session_duration('session-uuid');
```

**Returns:** numeric (minutes)

## Metrics Definitions

### Portal Adoption Rate
```
(Registered Portal Users / Total Active Customers) × 100
```

Measures what percentage of your customer base has used the portal.

### Booking Conversion Rate
```
(Bookings Completed / Bookings Initiated) × 100
```

Measures how many started bookings are completed.

### Payment Conversion Rate
```
(Payments Completed / Payments Initiated) × 100
```

Measures payment success rate.

### Average Session Duration
```
SUM(session_durations) / COUNT(sessions)
```

Average time customers spend in portal per session.

### Monthly Active Users (MAU)
```
COUNT(DISTINCT customer_id WHERE last_30_days)
```

Unique customers who used portal in last 30 days.

### Average Pages Per Session
```
Total Page Views / Total Sessions
```

How many pages customers view per visit.

## Reporting Queries

### Daily Active Users Trend

```sql
SELECT
  date,
  total_active_users,
  total_sessions,
  avg_session_duration_minutes
FROM portal_analytics_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;
```

### Conversion Funnel

```sql
SELECT
  date,
  bookings_initiated,
  bookings_completed,
  booking_conversion_rate,
  payments_initiated,
  payments_completed,
  payment_conversion_rate
FROM portal_analytics_daily
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

### Revenue Analytics

```sql
SELECT
  date,
  payments_completed,
  total_payment_amount,
  ROUND(total_payment_amount / NULLIF(payments_completed, 0), 2) as avg_payment_value
FROM portal_analytics_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;
```

### Feature Usage

```sql
SELECT
  feature,
  COUNT(*) as usage_count,
  COUNT(DISTINCT customer_id) as unique_users
FROM portal_analytics
WHERE event_type = 'feature_usage'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY feature
ORDER BY usage_count DESC
LIMIT 10;
```

### Customer Engagement Score

```sql
SELECT
  customer_id,
  COUNT(DISTINCT DATE(created_at)) as days_active,
  COUNT(*) as total_events,
  COUNT(DISTINCT event_type) as event_types_used,
  MAX(created_at) as last_activity
FROM portal_analytics
WHERE customer_id IS NOT NULL
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY customer_id
ORDER BY total_events DESC
LIMIT 100;
```

## Configuration

### Required Environment Variables

```bash
# Cron job authentication
CRON_SECRET=your-vercel-cron-secret
INTERNAL_CRON_SECRET=your-internal-secret-for-testing
```

### Optional Configuration

```bash
# Analytics API URL (for self-hosted)
ANALYTICS_API_URL=/api/portal/analytics/track

# Enable/disable tracking
ANALYTICS_ENABLED=true

# Debug mode
ANALYTICS_DEBUG=false
```

### Vercel Cron Configuration

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/aggregate-portal-analytics",
      "schedule": "0 0 * * *"
    }
  ],
  "functions": {
    "app/api/cron/aggregate-portal-analytics/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**Schedule Format:** Cron expression
- `0 0 * * *` - Daily at midnight UTC
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday

## Best Practices

### When to Track

**Always Track:**
- Page views (on every route change)
- Login/logout events
- Booking completions
- Payment completions
- Message sending

**Consider Tracking:**
- Feature usage (buttons, filters, views)
- Search queries
- Profile updates
- Errors (for debugging)

**Don't Track:**
- Sensitive form data
- Passwords or credentials
- Personal identification data (beyond customer_id)

### Performance

**Client-Side:**
- Track events asynchronously (don't await)
- Use fire-and-forget pattern
- Batch events if high frequency

```typescript
// Good: Non-blocking
tracker.trackFeatureUsage('button-click').catch(console.error)

// Bad: Blocking
await tracker.trackFeatureUsage('button-click')
```

**Server-Side:**
- Aggregation runs off-hours (midnight)
- Queries use indexed columns
- Daily aggregations for fast reporting

### Privacy

**Compliant Tracking:**
- No PII in metadata (unless necessary)
- IP addresses for security only
- Aggregate data for reporting
- Allow opt-out mechanism

**User Consent:**
```typescript
// Check user consent before tracking
const tracker = createPortalTracker({
  enabled: userConsent.analytics
})
```

### Data Retention

**Raw Events:**
- Keep 90 days minimum
- Archive older data if needed

**Daily Aggregations:**
- Keep indefinitely
- Historical trends valuable

**Cleanup Query:**
```sql
-- Delete events older than 90 days
DELETE FROM portal_analytics
WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
```

## Monitoring

### Check Tracking Health

```sql
-- Events in last hour
SELECT COUNT(*) as events_last_hour
FROM portal_analytics
WHERE created_at >= now() - INTERVAL '1 hour';

-- Events by type (last 24 hours)
SELECT event_type, COUNT(*) as count
FROM portal_analytics
WHERE created_at >= now() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY count DESC;
```

### Verify Aggregation

```sql
-- Check if yesterday was aggregated
SELECT *
FROM portal_analytics_daily
WHERE date = CURRENT_DATE - INTERVAL '1 day';

-- Check aggregation lag
SELECT
  MAX(date) as latest_aggregated_date,
  CURRENT_DATE - MAX(date) as days_behind
FROM portal_analytics_daily;
```

### Alert on Low Activity

```sql
-- Alert if daily active users dropped significantly
SELECT
  date,
  total_active_users,
  LAG(total_active_users) OVER (ORDER BY date) as previous_day,
  total_active_users - LAG(total_active_users) OVER (ORDER BY date) as change
FROM portal_analytics_daily
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

## Troubleshooting

### Events Not Being Tracked

**Symptoms:**
- No events in `portal_analytics` table
- Tracking endpoint returns 500

**Solutions:**
1. Check network requests in browser DevTools
2. Verify API endpoint is accessible
3. Check RLS policies on table
4. Review server logs for errors

### Aggregation Not Running

**Symptoms:**
- `portal_analytics_daily` missing recent dates
- Cron logs show errors

**Solutions:**
1. Check Vercel cron logs
2. Verify CRON_SECRET is set
3. Manually trigger: `GET /api/cron/aggregate-portal-analytics`
4. Check function timeout (increase if needed)

### Incorrect Metrics

**Symptoms:**
- Conversion rates seem wrong
- User counts don't match expectations

**Solutions:**
1. Re-run aggregation: `SELECT aggregate_portal_analytics('2025-10-20');`
2. Check for duplicate events
3. Verify event type spelling
4. Review calculation logic in aggregation function

## ROI Metrics

### Portal Value Calculation

```sql
-- Calculate portal-driven revenue
SELECT
  SUM(total_payment_amount) as portal_revenue,
  COUNT(DISTINCT date) as days_active,
  ROUND(SUM(total_payment_amount) / COUNT(DISTINCT date), 2) as avg_daily_revenue
FROM portal_analytics_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days';
```

### Customer Acquisition Cost (CAC) Payback

```
Portal Development Cost / (Monthly Portal Revenue × Profit Margin)
```

### Support Cost Reduction

Track messages sent through portal vs. phone calls:

```sql
SELECT
  SUM(messages_sent) as portal_messages,
  -- Compare to phone logs
FROM portal_analytics_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days';
```

Estimate: Portal message costs $0.10 vs. phone call $5.00

### Efficiency Gains

```sql
-- Bookings made online vs. manually
SELECT
  SUM(bookings_completed) as online_bookings,
  -- Time saved: ~10 minutes per booking
  SUM(bookings_completed) * 10 as minutes_saved
FROM portal_analytics_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days';
```

## Dashboard Widgets

### Example Admin Dashboard

```typescript
const AnalyticsDashboard = () => {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/portal/analytics/stats?period=30', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    })
      .then(res => res.json())
      .then(data => setStats(data.data))
  }, [])

  if (!stats) return <Loading />

  return (
    <div className="grid grid-cols-4 gap-4">
      <StatCard
        title="Portal Adoption"
        value={`${stats.adoption.adoptionRate}%`}
        subtitle={`${stats.adoption.registeredPortalUsers} of ${stats.adoption.totalCustomers} customers`}
      />

      <StatCard
        title="Monthly Active Users"
        value={stats.engagement.monthlyActiveUsers}
        subtitle={`${stats.engagement.avgDailyActiveUsers} avg daily`}
      />

      <StatCard
        title="Booking Conversion"
        value={`${stats.bookings.conversionRate}%`}
        subtitle={`${stats.bookings.completed} completed`}
      />

      <StatCard
        title="Portal Revenue"
        value={`$${stats.payments.totalAmount.toLocaleString()}`}
        subtitle={`${stats.payments.conversionRate}% success rate`}
      />
    </div>
  )
}
```

## API Version

Current Version: **v1**

## Changelog

### v1.0.0 (2025-10-21)
- Initial implementation
- 19 tracked event types
- Daily aggregation system
- Admin stats API
- Client SDK
- Cron job automation
- Comprehensive documentation
