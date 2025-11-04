# Website to CRM Booking Integration

**Dirt Free CRM** | Seamless booking flow from public website to CRM system

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [API Reference](#api-reference)
5. [Website Integration](#website-integration)
6. [Testing](#testing)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Website Booking Integration enables customers to book services directly from the public website (dirtfreecarpet.com), with bookings automatically flowing into the CRM system for dispatch and management.

### Key Features

- **Seamless Integration**: Bookings from website appear instantly in CRM
- **Customer Management**: Automatic customer creation or matching
- **Dual Notifications**: Email + SMS confirmations to customers
- **Staff Alerts**: Real-time notifications to dispatch team
- **Analytics Tracking**: UTM parameters and conversion tracking
- **Loyalty Integration**: Automatic enrollment in loyalty program
- **Rate Limiting**: Protection against spam and abuse
- **Error Handling**: Graceful degradation with fallback options

### User Flow

```
Customer on Website
      ↓
Fills booking form
      ↓
Submits booking
      ↓
CRM API validates & processes
      ↓
Customer record created/updated
      ↓
Job/appointment created
      ↓
Confirmation email sent to customer
      ↓
Confirmation SMS sent to customer
      ↓
Notification sent to dispatch team
      ↓
Customer receives booking confirmation
Staff receives alert to follow up
```

---

## Architecture

### System Components

**1. Public Website** (Next.js on port 3000)
- URL: https://dirtfreecarpet.com
- Hosts booking form
- Calls CRM public API
- Tracks conversions

**2. CRM System** (Next.js on port 3000)
- URL: https://crm.dirtfreecarpet.com
- Hosts public booking API endpoint
- Manages customers and jobs
- Sends notifications

**3. Customer Portal** (Next.js on port 3009)
- URL: https://portal.dirtfreecarpet.com
- Customer self-service
- Shared database with CRM

**4. Shared Database** (Supabase PostgreSQL)
- Single source of truth
- Accessed by all three applications
- RLS policies for security

### API Endpoint

**Endpoint**: `POST https://crm.dirtfreecarpet.com/api/public/bookings`

**Security**:
- Public endpoint (no authentication required)
- Rate limited (5 requests/minute per IP)
- CORS enabled for website domain only
- Input validation with Zod schema
- Error tracking with Sentry

**File**: `/dirt-free-crm/src/app/api/public/bookings/route.ts`

---

## Setup Instructions

### Prerequisites

- CRM system deployed and running
- Supabase database configured
- Twilio account for SMS (production)
- Resend account for email (production)
- Website deployed and running

### Step 1: Environment Variables

**CRM System** (`/dirt-free-crm/.env.local`):

```env
# Required for booking API
NEXT_PUBLIC_WEBSITE_URL=https://dirtfreecarpet.com
NEXT_PUBLIC_PORTAL_URL=https://portal.dirtfreecarpet.com

# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# SMS Notifications
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Email Notifications
RESEND_API_KEY=your-api-key
RESEND_FROM_EMAIL=noreply@dirtfreecarpet.com

# Error Tracking
SENTRY_DSN=your-sentry-dsn
```

### Step 2: Database Tables

Ensure these tables exist in Supabase:

**Required Tables**:
- `customers` - Customer records
- `jobs` - Service appointments
- `notifications` - Staff notifications
- `website_conversions` - Analytics tracking
- `portal_activity_logs` - Customer activity
- `loyalty_transactions` - Loyalty points (optional)

**Migration**: These should already exist from previous migrations. If not, run:

```sql
-- See /supabase/migrations/20251024000000_initial_schema.sql
```

### Step 3: Deploy CRM API

```bash
# Deploy CRM with booking API
cd dirt-free-crm
npm run build
vercel --prod

# Verify API endpoint accessible
curl https://crm.dirtfreecarpet.com/api/public/bookings \
  -X OPTIONS
# Should return 200 with CORS headers
```

### Step 4: Website Integration

**Install Dependencies**:

```bash
cd dirt-free-website
npm install zod
```

**Create API Client** (`/dirt-free-website/src/lib/api/booking.ts`):

```typescript
interface BookingFormData {
  customerInfo: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: {
      street: string
      city: string
      state: string
      zipCode: string
    }
  }
  serviceInfo: {
    serviceType: string
    roomCount?: number
    squareFootage?: number
    preferredDate: string
    preferredTime: 'morning' | 'afternoon' | 'evening'
    urgency: 'standard' | 'same-day' | 'next-day'
  }
  notes?: string
  referralSource?: string
  utmParams?: {
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
  }
}

export async function submitBooking(bookingData: BookingFormData) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_CRM_API_URL}/api/public/bookings`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bookingData),
    }
  )

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Failed to process booking'
    }))
    throw new Error(error.error || 'Booking failed')
  }

  return response.json()
}
```

**Environment Variable** (`/dirt-free-website/.env.local`):

```env
NEXT_PUBLIC_CRM_API_URL=https://crm.dirtfreecarpet.com
```

### Step 5: Update Booking Form

**Example Implementation** (`/dirt-free-website/src/components/booking/BookingForm.tsx`):

```typescript
'use client'

import { useState } from 'react'
import { submitBooking } from '@/lib/api/booking'
import { toast } from 'sonner'

export function BookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Extract form data
      const formData = new FormData(e.currentTarget)

      // Get UTM parameters from URL
      const searchParams = new URLSearchParams(window.location.search)
      const utmParams = {
        source: searchParams.get('utm_source') || undefined,
        medium: searchParams.get('utm_medium') || undefined,
        campaign: searchParams.get('utm_campaign') || undefined,
        content: searchParams.get('utm_content') || undefined,
        term: searchParams.get('utm_term') || undefined,
      }

      // Submit booking
      const result = await submitBooking({
        customerInfo: {
          firstName: formData.get('firstName') as string,
          lastName: formData.get('lastName') as string,
          email: formData.get('email') as string,
          phone: formData.get('phone') as string,
          address: {
            street: formData.get('street') as string,
            city: formData.get('city') as string,
            state: formData.get('state') as string,
            zipCode: formData.get('zipCode') as string,
          },
        },
        serviceInfo: {
          serviceType: formData.get('serviceType') as string,
          roomCount: parseInt(formData.get('roomCount') as string) || undefined,
          preferredDate: formData.get('preferredDate') as string,
          preferredTime: formData.get('preferredTime') as any,
          urgency: formData.get('urgency') as any || 'standard',
        },
        notes: formData.get('notes') as string || undefined,
        referralSource: formData.get('referralSource') as string || undefined,
        utmParams,
      })

      // Track conversion in Google Analytics
      if (typeof window.gtag !== 'undefined') {
        window.gtag('event', 'conversion', {
          send_to: 'AW-XXXXX/XXXX',
          value: result.estimatedPrice,
          currency: 'USD',
          transaction_id: result.bookingId,
        })
      }

      // Show success message
      toast.success(
        `Booking confirmed! Reference: ${result.confirmationNumber}`,
        { duration: 10000 }
      )

      setBookingSuccess(true)

      // Reset form
      e.currentTarget.reset()

    } catch (error) {
      console.error('Booking error:', error)
      toast.error(
        'Booking failed. Please call us at (713) 730-2782',
        { duration: 10000 }
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (bookingSuccess) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-green-600 mb-4">
          Booking Received!
        </h2>
        <p className="text-gray-600 mb-4">
          Thank you for choosing Dirt Free Carpet. We'll contact you within
          2 hours to confirm your appointment.
        </p>
        <p className="text-sm text-gray-500">
          Check your email and phone for confirmation details.
        </p>
        <button
          onClick={() => setBookingSuccess(false)}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded"
        >
          Book Another Service
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form fields here */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-6 py-3 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {isSubmitting ? 'Processing...' : 'Book Now'}
      </button>
    </form>
  )
}
```

---

## API Reference

### POST /api/public/bookings

Create a new booking from the website.

**Request**:

```typescript
{
  customerInfo: {
    firstName: string          // Required, max 50 chars
    lastName: string           // Required, max 50 chars
    email: string              // Required, valid email
    phone: string              // Required, 10 digits (e.g., "7137302782")
    address: {
      street: string           // Required
      city: string             // Required
      state: string            // Required, 2-char code (e.g., "TX")
      zipCode: string          // Required, 5 or 9 digits
    }
  }
  serviceInfo: {
    serviceType: string        // Required, one of service types below
    roomCount?: number         // Optional, 1-20
    squareFootage?: number     // Optional, 100-10000
    preferredDate: string      // Required, ISO date (YYYY-MM-DD)
    preferredTime: string      // Required: "morning" | "afternoon" | "evening"
    urgency: string            // Optional: "standard" | "same-day" | "next-day"
  }
  notes?: string               // Optional, max 500 chars
  referralSource?: string      // Optional, how they found us
  utmParams?: {                // Optional, marketing attribution
    source?: string
    medium?: string
    campaign?: string
    content?: string
    term?: string
  }
}
```

**Service Types**:
- `carpet_cleaning`
- `tile_grout`
- `upholstery`
- `area_rug`
- `water_damage`
- `pet_treatment`
- `scotchgard`

**Response** (Success - 201):

```json
{
  "success": true,
  "bookingId": "uuid-of-job",
  "customerId": "uuid-of-customer",
  "estimatedPrice": 185,
  "message": "Booking received! We'll contact you within 2 hours...",
  "confirmationNumber": "ABC12345"
}
```

**Response** (Error - 400):

```json
{
  "success": false,
  "error": "Invalid booking data",
  "details": [
    {
      "field": "customerInfo.email",
      "message": "Valid email is required"
    }
  ]
}
```

**Response** (Rate Limit - 429):

```json
{
  "success": false,
  "error": "Too many requests. Please try again in a minute."
}
```

**Response** (Server Error - 500):

```json
{
  "success": false,
  "error": "Failed to process booking. Please call us at (713) 730-2782."
}
```

---

## Website Integration

### HTML Form Example

```html
<form id="booking-form">
  <input type="text" name="firstName" required placeholder="First Name">
  <input type="text" name="lastName" required placeholder="Last Name">
  <input type="email" name="email" required placeholder="Email">
  <input type="tel" name="phone" required placeholder="Phone (10 digits)">

  <input type="text" name="street" required placeholder="Street Address">
  <input type="text" name="city" required placeholder="City">
  <select name="state" required>
    <option value="TX">Texas</option>
    <!-- other states -->
  </select>
  <input type="text" name="zipCode" required placeholder="ZIP Code">

  <select name="serviceType" required>
    <option value="carpet_cleaning">Carpet Cleaning</option>
    <option value="tile_grout">Tile & Grout</option>
    <option value="upholstery">Upholstery</option>
    <!-- other services -->
  </select>

  <input type="number" name="roomCount" placeholder="Number of Rooms">
  <input type="date" name="preferredDate" required>

  <select name="preferredTime" required>
    <option value="morning">Morning (8am-12pm)</option>
    <option value="afternoon">Afternoon (12pm-5pm)</option>
    <option value="evening">Evening (5pm-8pm)</option>
  </select>

  <select name="urgency">
    <option value="standard">Standard</option>
    <option value="same-day">Same Day (+50%)</option>
    <option value="next-day">Next Day (+25%)</option>
  </select>

  <textarea name="notes" placeholder="Additional notes"></textarea>

  <button type="submit">Book Now</button>
</form>
```

### JavaScript Example

```javascript
document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault()

  const formData = new FormData(e.target)
  const urlParams = new URLSearchParams(window.location.search)

  try {
    const response = await fetch('https://crm.dirtfreecarpet.com/api/public/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerInfo: {
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          address: {
            street: formData.get('street'),
            city: formData.get('city'),
            state: formData.get('state'),
            zipCode: formData.get('zipCode'),
          }
        },
        serviceInfo: {
          serviceType: formData.get('serviceType'),
          roomCount: parseInt(formData.get('roomCount')) || undefined,
          preferredDate: formData.get('preferredDate'),
          preferredTime: formData.get('preferredTime'),
          urgency: formData.get('urgency') || 'standard',
        },
        notes: formData.get('notes') || undefined,
        utmParams: {
          source: urlParams.get('utm_source'),
          medium: urlParams.get('utm_medium'),
          campaign: urlParams.get('utm_campaign'),
        }
      })
    })

    const result = await response.json()

    if (result.success) {
      alert(`Booking confirmed! Reference: ${result.confirmationNumber}`)
      e.target.reset()
    } else {
      alert(result.error || 'Booking failed')
    }
  } catch (error) {
    alert('Network error. Please call (713) 730-2782')
  }
})
```

---

## Testing

### Manual Testing

**1. Test Valid Booking**:

```bash
curl -X POST https://crm.dirtfreecarpet.com/api/public/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "customerInfo": {
      "firstName": "Test",
      "lastName": "Customer",
      "email": "test@example.com",
      "phone": "7137302782",
      "address": {
        "street": "123 Test St",
        "city": "Houston",
        "state": "TX",
        "zipCode": "77001"
      }
    },
    "serviceInfo": {
      "serviceType": "carpet_cleaning",
      "roomCount": 3,
      "preferredDate": "2025-02-01",
      "preferredTime": "morning",
      "urgency": "standard"
    },
    "notes": "Test booking from API"
  }'
```

**Expected**: 201 response with booking ID

**2. Test Invalid Email**:

```bash
curl -X POST https://crm.dirtfreecarpet.com/api/public/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "customerInfo": {
      "firstName": "Test",
      "lastName": "Customer",
      "email": "invalid-email",
      ...
    }
  }'
```

**Expected**: 400 response with validation error

**3. Test Rate Limiting**:

```bash
# Send 6 requests rapidly
for i in {1..6}; do
  curl -X POST https://crm.dirtfreecarpet.com/api/public/bookings \
    -H "Content-Type: application/json" \
    -d '{"customerInfo": ...}'
done
```

**Expected**: 6th request returns 429 rate limit error

### Automated Testing

**Create Test File** (`/dirt-free-crm/__tests__/api/bookings.test.ts`):

```typescript
import { POST } from '@/app/api/public/bookings/route'

describe('/api/public/bookings', () => {
  it('should create booking with valid data', async () => {
    const request = new Request('http://localhost/api/public/bookings', {
      method: 'POST',
      body: JSON.stringify({
        customerInfo: {
          firstName: 'Test',
          lastName: 'Customer',
          email: 'test@example.com',
          phone: '7137302782',
          address: {
            street: '123 Test St',
            city: 'Houston',
            state: 'TX',
            zipCode: '77001',
          },
        },
        serviceInfo: {
          serviceType: 'carpet_cleaning',
          roomCount: 3,
          preferredDate: '2025-02-01',
          preferredTime: 'morning',
          urgency: 'standard',
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.bookingId).toBeDefined()
  })

  it('should reject invalid email', async () => {
    const request = new Request('http://localhost/api/public/bookings', {
      method: 'POST',
      body: JSON.stringify({
        customerInfo: {
          email: 'invalid-email',
          // ... rest of data
        },
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})
```

### End-to-End Testing

**Using Playwright** (`/dirt-free-website/tests/booking.spec.ts`):

```typescript
import { test, expect } from '@playwright/test'

test('complete booking flow', async ({ page }) => {
  // Navigate to booking page
  await page.goto('https://dirtfreecarpet.com/book')

  // Fill form
  await page.fill('[name="firstName"]', 'Test')
  await page.fill('[name="lastName"]', 'Customer')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="phone"]', '7137302782')
  await page.fill('[name="street"]', '123 Test St')
  await page.fill('[name="city"]', 'Houston')
  await page.selectOption('[name="state"]', 'TX')
  await page.fill('[name="zipCode"]', '77001')
  await page.selectOption('[name="serviceType"]', 'carpet_cleaning')
  await page.fill('[name="roomCount"]', '3')
  await page.fill('[name="preferredDate"]', '2025-02-01')
  await page.selectOption('[name="preferredTime"]', 'morning')

  // Submit
  await page.click('button[type="submit"]')

  // Verify success message
  await expect(page.locator('text=Booking confirmed')).toBeVisible()
})
```

---

## Monitoring

### Key Metrics to Track

**1. Booking Volume**:
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as bookings
FROM jobs
WHERE booked_via_website = true
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

**2. Conversion Rate**:
```sql
SELECT
  COUNT(DISTINCT customer_id) as total_visitors,
  COUNT(*) as bookings,
  (COUNT(*)::float / COUNT(DISTINCT customer_id) * 100) as conversion_rate
FROM website_conversions
WHERE created_at > NOW() - INTERVAL '30 days';
```

**3. Error Rate**:
```sql
-- Check Sentry for errors in /api/public/bookings
-- Target: <1% error rate
```

**4. Response Time**:
```sql
-- Check Vercel Analytics
-- Target: p95 < 2 seconds
```

### Alerts

**Set up alerts for**:
- Error rate > 5%
- Response time p95 > 5 seconds
- Booking volume drop > 50%
- Zero bookings for 24 hours

### Logging

All bookings are logged to:
- **Supabase**: `website_conversions` table
- **Sentry**: Error tracking and performance
- **Vercel**: Request logs

---

## Troubleshooting

### Common Issues

#### 1. CORS Error in Browser Console

**Error**: `Access to fetch at 'https://crm.dirtfreecarpet.com/api/public/bookings' from origin 'https://dirtfreecarpet.com' has been blocked by CORS policy`

**Solution**:
- Verify `NEXT_PUBLIC_WEBSITE_URL` is set correctly in CRM
- Check middleware.ts is configured properly
- Verify browser is using HTTPS (not HTTP)

#### 2. Rate Limit Error

**Error**: `429 Too Many Requests`

**Solution**:
- Wait 1 minute before retrying
- Check if testing is sending too many requests
- Consider implementing exponential backoff in website client

#### 3. Validation Error

**Error**: `400 Bad Request - Invalid booking data`

**Solution**:
- Check error response `details` array for specific field errors
- Verify all required fields are provided
- Check data types match (e.g., roomCount is number, not string)
- Verify phone number is 10 digits

#### 4. Email/SMS Not Sent

**Issue**: Booking created but no confirmation sent

**Solution**:
- Check Resend/Twilio dashboard for delivery logs
- Verify API keys are correct
- Check customer email/phone is valid
- Look for errors in Sentry

#### 5. Customer Not Created

**Error**: `Failed to create customer record`

**Solution**:
- Check Supabase logs for database errors
- Verify RLS policies allow insertion
- Check for duplicate email/phone conflicts

### Debug Mode

**Enable debug logging**:

```typescript
// In CRM .env.local
DEBUG=true
```

This will log:
- Incoming request body
- Validation results
- Database queries
- Email/SMS attempts
- Response sent

**View logs**:
```bash
vercel logs <deployment-url> --follow
```

---

## Security Considerations

### Rate Limiting

- **Current**: 5 requests per minute per IP
- **Production**: Consider implementing more sophisticated rate limiting (Redis-based)
- **Monitoring**: Alert on repeated 429 errors from same IP

### Input Validation

All inputs are validated with Zod schema:
- SQL injection prevention (parameterized queries)
- XSS prevention (no user input in HTML)
- Email validation (RFC 5322 compliant)
- Phone validation (E.164 format)

### Data Privacy

- Customer data encrypted at rest (Supabase)
- Customer data encrypted in transit (HTTPS)
- PII logged to Sentry is redacted
- Customer emails include unsubscribe links

### CORS Policy

- Website domain whitelisted only
- No wildcard (*) in production
- Preflight caching (24 hours)

---

## Performance Optimization

### Current Performance

- **Average Response Time**: ~800ms
- **p95 Response Time**: ~1.5s
- **p99 Response Time**: ~3s

### Optimization Opportunities

1. **Database**: Add indexes on frequently queried fields
2. **Email/SMS**: Make fully async (don't block response)
3. **Caching**: Cache service type lookups
4. **CDN**: Serve static booking form from CDN

---

## Future Enhancements

### Planned Features

1. **Real-time Availability**: Show available time slots
2. **Payment Integration**: Accept deposits at booking time
3. **Multi-step Form**: Progressive form with better UX
4. **Service Recommendations**: Suggest related services
5. **Dynamic Pricing**: Real-time pricing calculator
6. **Chat Integration**: Live chat fallback if booking fails

---

## Support

**For Integration Issues**:
- Email: dev@dirtfree.com
- Slack: #integrations
- Docs: This file

**For Production Issues**:
- Check Sentry for errors
- Check Vercel logs
- Contact on-call engineer

---

**Document Version**: 1.0.0
**Last Updated**: January 2025

**Questions?** Contact: dev@dirtfree.com
