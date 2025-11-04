# Website Analytics Integration

Track website performance and conversions directly in the CRM with comprehensive analytics and attribution tracking.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Website Integration](#website-integration)
- [CRM Dashboard](#crm-dashboard)
- [Event Types](#event-types)
- [UTM Tracking](#utm-tracking)
- [Usage Examples](#usage-examples)
- [Setup Instructions](#setup-instructions)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The Website Analytics Integration provides a complete solution for tracking website visitor behavior, conversions, and marketing attribution. It captures detailed analytics events from the website and stores them in the CRM for analysis.

### Key Features

- **Automatic Page View Tracking**: Track all page views automatically
- **Conversion Funnel**: Monitor how users move through the booking process
- **UTM Attribution**: Track marketing campaign effectiveness
- **Session Tracking**: Track user sessions with duration and page counts
- **Device & Browser Detection**: Understand your audience's technology
- **Real-Time Data**: Events are sent and stored immediately
- **Privacy-Friendly**: No third-party analytics cookies required

## Features

### Analytics Tracking

- **Page Views**: Automatic tracking on every route change
- **Events**: Custom events (clicks, form submissions, bookings)
- **Sessions**: Complete session tracking with attribution
- **Conversions**: Track booking completions and link to customers
- **Scroll Depth**: Track how far users scroll on pages
- **Time on Page**: Measure engagement time

### Marketing Attribution

- **UTM Parameters**: Track source, medium, campaign, content, term
- **Referrer Tracking**: See where traffic comes from
- **Session Persistence**: UTM data persists throughout session
- **Conversion Attribution**: Link bookings back to original source

### Analytics Dashboard

- **KPI Cards**: Page views, sessions, conversions, conversion rate
- **Conversion Funnel**: Visual funnel showing drop-off rates
- **Top Pages**: Most visited pages on the website
- **Traffic Sources**: Top UTM sources with conversion data
- **Recent Conversions**: Latest bookings with full attribution

## Architecture

```
┌─────────────────────────────────────────┐
│         Website (Next.js)               │
│  - Analytics Tracker (client-side)     │
│  - Automatic page view tracking         │
│  - Event tracking (clicks, forms, etc.) │
└──────────────┬──────────────────────────┘
               │ HTTPS POST
               │ /api/public/analytics/track
               ↓
┌─────────────────────────────────────────┐
│         CRM API Endpoint                │
│  - Receives analytics events            │
│  - Validates and processes data         │
│  - Stores in database                   │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│         Database Tables                 │
│  - website_analytics (events)           │
│  - website_sessions (sessions)          │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│         CRM Analytics Dashboard         │
│  - Visualize data                       │
│  - View conversion funnel               │
│  - Track marketing ROI                  │
└─────────────────────────────────────────┘
```

## Database Schema

### website_analytics

Stores individual analytics events.

```sql
CREATE TABLE website_analytics (
  id UUID PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,        -- page_view, booking_started, etc.
  page_path VARCHAR(255),                  -- /services/carpet-cleaning
  referrer VARCHAR(255),                   -- Where user came from
  utm_source VARCHAR(100),                 -- google, facebook, email
  utm_medium VARCHAR(100),                 -- cpc, social, email
  utm_campaign VARCHAR(100),               -- summer_sale_2024
  utm_content VARCHAR(100),                -- ad_variant_a
  utm_term VARCHAR(100),                   -- carpet cleaning houston
  session_id VARCHAR(100),                 -- Unique session identifier
  visitor_id VARCHAR(100),                 -- Unique visitor identifier
  customer_id UUID REFERENCES customers,   -- Linked customer (if known)
  job_id UUID REFERENCES jobs,             -- Linked booking (if converted)
  metadata JSONB,                          -- Additional event data
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `idx_website_analytics_event` - Fast queries by event type and date
- `idx_website_analytics_customer` - Fast customer lookups
- `idx_website_analytics_session` - Fast session queries
- `idx_website_analytics_utm` - Fast UTM attribution queries

### website_sessions

Tracks complete user sessions with attribution.

```sql
CREATE TABLE website_sessions (
  id UUID PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  visitor_id VARCHAR(100),                 -- Persistent visitor ID
  first_page VARCHAR(255),                 -- Landing page
  last_page VARCHAR(255),                  -- Exit page
  pages_visited INTEGER DEFAULT 1,         -- Total pages in session
  duration_seconds INTEGER,                -- Session duration
  converted BOOLEAN DEFAULT false,         -- Did they book?
  conversion_type VARCHAR(50),             -- booking, email_capture, etc.
  customer_id UUID REFERENCES customers,   -- Linked customer
  job_id UUID REFERENCES jobs,             -- Linked booking
  utm_source VARCHAR(100),                 -- Attribution
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  referrer VARCHAR(255),                   -- Original referrer
  device_type VARCHAR(50),                 -- desktop, mobile, tablet
  browser VARCHAR(50),                     -- chrome, safari, firefox
  started_at TIMESTAMP DEFAULT NOW(),      -- Session start
  ended_at TIMESTAMP                       -- Last activity
);
```

**Indexes:**
- `idx_website_sessions_visitor` - Track returning visitors
- `idx_website_sessions_converted` - Fast conversion queries
- `idx_website_sessions_customer` - Customer session history

## Website Integration

### Analytics Tracker

The analytics tracker is automatically initialized and tracks page views on every route change.

**File**: `/dirt-free-website/src/lib/analytics/tracker.ts`

```typescript
import { analytics } from '@/lib/analytics/tracker';

// Automatic page view tracking (already set up in layout)
// Page views are tracked automatically on route changes

// Manual event tracking
analytics.trackBookingStarted();
analytics.trackServiceSelected('carpet_cleaning');
analytics.trackPhoneClick('713-555-0100');
analytics.trackFormSubmitted('contact_form');
analytics.trackButtonClick('Get Quote', 'header');
```

### Automatic Tracking

The `AnalyticsProvider` component automatically tracks:

1. **Page Views**: Every route change
2. **Scroll Depth**: 25%, 50%, 75%, 100% milestones
3. **Time on Page**: When user leaves or switches tabs

**File**: `/dirt-free-website/src/components/AnalyticsProvider.tsx`

### Session & Visitor IDs

- **Session ID**: Stored in `sessionStorage`, cleared when tab closes
- **Visitor ID**: Stored in `localStorage`, persists across sessions
- Both are automatically generated and included in all events

### UTM Parameters

UTM parameters are automatically captured from the URL and stored in `sessionStorage` to persist throughout the session:

```
https://dirtfreecarpet.com?utm_source=google&utm_medium=cpc&utm_campaign=carpet_cleaning_2024
```

The tracker will automatically extract and include these parameters in all events.

## CRM Dashboard

Access the analytics dashboard at: `/dashboard/analytics/website`

**File**: `/dirt-free-crm/src/app/(dashboard)/dashboard/analytics/website/page.tsx`

### Dashboard Sections

1. **KPI Cards**
   - Page Views (total + avg per session)
   - Sessions (total + avg duration)
   - Conversions (total bookings)
   - Conversion Rate (%)

2. **Conversion Funnel**
   - Page Views
   - Booking Started
   - Service Selected
   - Form Submitted
   - Booking Completed

3. **Top Pages**
   - Most visited pages (last 7 days)
   - View counts

4. **Traffic Sources**
   - UTM source breakdown (last 30 days)
   - Sessions and conversions per source

5. **Recent Conversions**
   - Latest bookings with full details
   - Customer information
   - Service type and price
   - Attribution (source, medium, campaign)

## Event Types

### Standard Events

| Event Type | Description | When to Track |
|------------|-------------|---------------|
| `page_view` | User views a page | Automatic on route change |
| `booking_started` | User begins booking flow | Click "Book Now" button |
| `service_selected` | User selects a service | Service selection in booking form |
| `form_submitted` | User submits a form | Any form submission |
| `booking_completed` | Booking finalized | After successful booking creation |
| `phone_clicked` | User clicks phone number | Click-to-call interaction |
| `button_clicked` | User clicks a button | Important CTA buttons |
| `service_viewed` | User views service details | Service page view |
| `promo_clicked` | User clicks promotion | Promotional banner clicks |
| `email_captured` | Email collected | Newsletter signups |
| `scroll_depth` | User scrolls to milestone | 25%, 50%, 75%, 100% |
| `time_on_page` | Time spent on page | Page unload/visibility change |

### Custom Events

You can track custom events using:

```typescript
analytics.trackEvent('custom_event_name', {
  custom_field_1: 'value1',
  custom_field_2: 'value2',
});
```

## UTM Tracking

### UTM Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `utm_source` | Traffic source | google, facebook, email |
| `utm_medium` | Marketing medium | cpc, social, email, organic |
| `utm_campaign` | Campaign name | summer_sale_2024 |
| `utm_content` | Ad variation | banner_a, link_red |
| `utm_term` | Keyword | carpet cleaning houston |

### Example URLs

**Google Ads Campaign:**
```
https://dirtfreecarpet.com?utm_source=google&utm_medium=cpc&utm_campaign=carpet_cleaning_2024&utm_term=carpet+cleaning+houston
```

**Facebook Ad:**
```
https://dirtfreecarpet.com?utm_source=facebook&utm_medium=social&utm_campaign=summer_sale&utm_content=carousel_ad
```

**Email Newsletter:**
```
https://dirtfreecarpet.com?utm_source=newsletter&utm_medium=email&utm_campaign=monthly_tips
```

### Attribution Flow

1. User clicks ad with UTM parameters
2. Website captures UTM parameters on landing
3. UTM parameters stored in `sessionStorage`
4. All events in session include UTM parameters
5. If user converts, booking is attributed to original UTM source

## Usage Examples

### Track Booking Flow

```typescript
// In booking form component
'use client';

import { analytics } from '@/lib/analytics/tracker';
import { useState } from 'react';

export function BookingForm() {
  const [step, setStep] = useState(1);

  const handleStart = () => {
    analytics.trackBookingStarted();
    setStep(2);
  };

  const handleServiceSelect = (service: string) => {
    analytics.trackServiceSelected(service);
    setStep(3);
  };

  const handleSubmit = async (data) => {
    analytics.trackFormSubmitted('booking_form', {
      service: data.service,
      rooms: data.rooms,
    });

    const result = await createBooking(data);

    if (result.success) {
      analytics.trackBookingCompleted(
        result.bookingId,
        result.customerId
      );
    }
  };

  // ... rest of component
}
```

### Track Phone Clicks

```typescript
// In header/contact component
import { analytics } from '@/lib/analytics/tracker';

export function ContactButton() {
  const handlePhoneClick = () => {
    analytics.trackPhoneClick('713-555-0100');
  };

  return (
    <a
      href="tel:7135550100"
      onClick={handlePhoneClick}
      className="..."
    >
      Call (713) 555-0100
    </a>
  );
}
```

### Track Service Interest

```typescript
// In service page
'use client';

import { analytics } from '@/lib/analytics/tracker';
import { useEffect } from 'react';

export function ServicePage({ serviceName }: { serviceName: string }) {
  useEffect(() => {
    analytics.trackServiceViewed(serviceName);
  }, [serviceName]);

  // ... rest of component
}
```

## Setup Instructions

### 1. Run Database Migration

```bash
cd dirt-free-crm
npx supabase migration up
```

This creates the `website_analytics` and `website_sessions` tables and SQL functions.

### 2. Configure Environment Variables

Add to `/dirt-free-website/.env.local`:

```bash
NEXT_PUBLIC_CRM_URL=https://crm.dirtfreecarpet.com
```

### 3. Deploy Website Changes

The analytics tracking is automatically enabled via the `AnalyticsProvider` in the layout. No additional setup needed.

### 4. Verify Tracking

1. Visit your website
2. Navigate to a few pages
3. Check the CRM dashboard at `/dashboard/analytics/website`
4. Verify page views and sessions are being tracked

### 5. Test Conversions

1. Complete a booking on the website
2. Check the "Recent Conversions" section in the analytics dashboard
3. Verify the booking is linked with correct attribution

## Best Practices

### 1. Use Consistent UTM Parameters

Create a standardized naming convention:

```
utm_source: lowercase, no spaces (google, facebook, email)
utm_medium: lowercase, no spaces (cpc, social, email)
utm_campaign: descriptive, lowercase with underscores (summer_sale_2024)
```

### 2. Track Important Events

Focus on events that indicate user intent:
- Service interest (view service pages)
- Engagement (scroll depth, time on page)
- Actions (click phone, start booking)
- Conversions (complete booking)

### 3. Monitor Conversion Funnel

Regularly review the funnel to identify drop-off points:
- If many start bookings but don't select services → simplify service selection
- If many select services but don't submit → reduce form friction
- If many submit but don't complete → check confirmation flow

### 4. Analyze Traffic Sources

Compare conversion rates by source:
- Which sources drive the most conversions?
- Which have the best conversion rate?
- Are there sources with high traffic but low conversions?

### 5. Privacy Compliance

The analytics system is privacy-friendly:
- No third-party cookies
- No personal data in visitor/session IDs
- Customer data only linked after booking (with consent)
- Compliant with GDPR/CCPA

### 6. Regular Monitoring

Set up a routine to check analytics:
- Daily: Quick review of conversion rate
- Weekly: Deep dive into traffic sources and top pages
- Monthly: Comprehensive analysis of campaign performance

## Troubleshooting

### Events Not Showing in Dashboard

**Symptoms**: Website events not appearing in CRM

**Causes & Solutions**:

1. **CORS Issues**
   ```bash
   # Check browser console for CORS errors
   # Verify CRM_URL in .env.local is correct
   NEXT_PUBLIC_CRM_URL=https://crm.dirtfreecarpet.com
   ```

2. **Database Not Migrated**
   ```bash
   # Run migration
   cd dirt-free-crm
   npx supabase migration up
   ```

3. **API Endpoint Not Accessible**
   ```bash
   # Test endpoint directly
   curl -X POST https://crm.dirtfreecarpet.com/api/public/analytics/track \
     -H "Content-Type: application/json" \
     -d '{"eventType":"test","sessionId":"test","visitorId":"test"}'
   ```

### Conversions Not Linking to Customers

**Symptoms**: Bookings show in dashboard but no customer info

**Causes**:
- `customerId` not passed to `trackBookingCompleted()`
- Customer record not created before tracking

**Solution**:
```typescript
// Ensure customer is created first
const customer = await createCustomer(data);

// Then track with IDs
analytics.trackBookingCompleted(booking.id, customer.id);
```

### UTM Parameters Not Persisting

**Symptoms**: UTM params not showing in conversion attribution

**Causes**:
- User lands on non-UTM page first
- Session storage cleared

**Solution**:
- Ensure all marketing links include UTM parameters
- UTM parameters persist throughout session automatically

### Session Duration Always 0

**Symptoms**: `duration_seconds` always shows 0 in database

**Cause**: Only one event per session (no subsequent page views)

**Solution**: This is normal for single-page visits. Duration is calculated from first to last event.

### Duplicate Sessions

**Symptoms**: Multiple sessions for same visitor in short time

**Causes**:
- User opened multiple tabs
- Session ID cleared (browser storage cleared)

**Solution**: This is expected behavior. Each tab creates a new session.

## SQL Queries for Analysis

### Top Converting Sources (Last 30 Days)

```sql
SELECT
  utm_source,
  utm_medium,
  utm_campaign,
  COUNT(*) as sessions,
  COUNT(*) FILTER (WHERE converted = true) as conversions,
  ROUND(COUNT(*) FILTER (WHERE converted = true)::NUMERIC / COUNT(*)::NUMERIC * 100, 2) as conversion_rate
FROM website_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY utm_source, utm_medium, utm_campaign
HAVING COUNT(*) >= 10  -- At least 10 sessions
ORDER BY conversion_rate DESC
LIMIT 10;
```

### Average Time to Conversion

```sql
SELECT
  AVG(duration_seconds) as avg_seconds,
  AVG(duration_seconds) / 60 as avg_minutes
FROM website_sessions
WHERE converted = true
AND duration_seconds > 0;
```

### Conversion by Device Type

```sql
SELECT
  device_type,
  COUNT(*) as sessions,
  COUNT(*) FILTER (WHERE converted = true) as conversions,
  ROUND(COUNT(*) FILTER (WHERE converted = true)::NUMERIC / COUNT(*)::NUMERIC * 100, 2) as conversion_rate
FROM website_sessions
WHERE started_at >= NOW() - INTERVAL '7 days'
GROUP BY device_type
ORDER BY sessions DESC;
```

### Hourly Conversion Pattern

```sql
SELECT
  EXTRACT(HOUR FROM started_at) as hour,
  COUNT(*) as sessions,
  COUNT(*) FILTER (WHERE converted = true) as conversions
FROM website_sessions
WHERE started_at >= NOW() - INTERVAL '30 days'
GROUP BY hour
ORDER BY hour;
```

## Related Documentation

- [Website Booking Integration](./WEBSITE_BOOKING_INTEGRATION.md)
- [Portal Account Linking](../dirt-free-customer-portal/ACCOUNT_LINKING.md)
- [Real-Time Sync](../dirt-free-customer-portal/REALTIME_SYNC.md)

## Support

For questions or issues:
- Check browser console for JavaScript errors
- Verify database migration ran successfully
- Check CRM API logs for endpoint errors
- Review this documentation for common solutions
