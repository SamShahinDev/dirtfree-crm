# Portal Notifications API Documentation

## Overview

The Portal Notifications API provides a complete multi-channel notification system for the customer portal. It supports in-app notifications, email alerts, and SMS messages, with delivery tracking and comprehensive notification management.

## Features

✅ **Complete Implementation**
- In-app notifications with read/unread tracking
- Email notifications via Resend
- SMS notifications via Twilio
- Multi-channel delivery with tracking
- Priority levels (low, normal, high, urgent)
- Automatic expiration and cleanup
- Pagination and filtering
- Batch operations (mark all as read)
- 15+ notification types
- Action buttons with deep links

## Architecture

### Components

1. **Database Layer** (`portal_notifications` table)
   - Stores in-app notifications
   - Tracks delivery status (email/SMS sent)
   - Supports expiration dates
   - Row-level security for customer access

2. **API Endpoints** (`/api/portal/notifications/*`)
   - List notifications with filtering
   - Mark individual notifications as read
   - Mark all notifications as read

3. **Notification Service** (`portal-notifier.ts`)
   - Unified notification sending
   - Multi-channel delivery
   - Convenience functions for common types
   - Automatic delivery tracking

## API Endpoints

### 1. GET /api/portal/notifications

Lists all notifications for the authenticated customer.

**Authentication:** Required (X-Portal-Token or Authorization header)

**Query Parameters:**
- `type` (optional): Filter by notification type
- `unread` (optional): Set to `true` to show only unread notifications
- `priority` (optional): Filter by priority level
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Notification Types:**
- `appointment_reminder` - Upcoming appointment reminder
- `appointment_confirmed` - Appointment confirmation
- `appointment_rescheduled` - Appointment rescheduled
- `appointment_cancelled` - Appointment cancelled
- `technician_on_way` - Technician is en route
- `service_completed` - Service completed
- `invoice_created` - New invoice created
- `invoice_due` - Invoice due soon
- `invoice_overdue` - Invoice overdue
- `payment_received` - Payment confirmation
- `message_reply` - Staff replied to message
- `promotion_available` - Special promotion
- `loyalty_reward` - Loyalty points/reward
- `survey_request` - Feedback survey request
- `general` - General notification

**Priority Levels:**
- `low` - Low priority
- `normal` - Normal priority (default)
- `high` - High priority
- `urgent` - Urgent, requires immediate attention

**Example Request:**
```bash
GET /api/portal/notifications?unread=true&page=1&limit=20
X-Portal-Token: your-portal-token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "appointment_reminder",
        "title": "Appointment Reminder",
        "message": "Your carpet cleaning appointment is scheduled for tomorrow at 10:00 AM.",
        "priority": "high",
        "isRead": false,
        "readAt": null,
        "actionUrl": "https://portal.example.com/appointments",
        "actionLabel": "View Appointment",
        "jobId": "uuid",
        "invoiceId": null,
        "threadId": null,
        "createdAt": "2025-10-21T10:00:00Z",
        "expiresAt": "2025-10-22T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    },
    "summary": {
      "unreadCount": 8,
      "totalCount": 45,
      "priorityCount": 3
    }
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

### 2. PATCH /api/portal/notifications/[id]/read

Marks a single notification as read.

**Authentication:** Required

**Path Parameters:**
- `id`: Notification UUID

**Example Request:**
```bash
PATCH /api/portal/notifications/123e4567-e89b-12d3-a456-426614174000/read
X-Portal-Token: your-portal-token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notificationId": "123e4567-e89b-12d3-a456-426614174000",
    "message": "Notification marked as read"
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

**Error Responses:**
- `404` - Notification not found or already read
- `401` - Authentication required
- `429` - Rate limit exceeded

### 3. POST /api/portal/notifications/mark-all-read

Marks all customer notifications as read.

**Authentication:** Required

**Example Request:**
```bash
POST /api/portal/notifications/mark-all-read
X-Portal-Token: your-portal-token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 8,
    "message": "8 notifications marked as read"
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

## Database Schema

### portal_notifications Table

**Columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `customer_id` | uuid | Customer reference (FK) |
| `type` | text | Notification type (enum) |
| `title` | text | Notification title |
| `message` | text | Notification message |
| `priority` | text | Priority level (enum) |
| `is_read` | boolean | Read status |
| `read_at` | timestamptz | When marked as read |
| `action_url` | text | Action button URL |
| `action_label` | text | Action button label |
| `job_id` | uuid | Related job (optional) |
| `invoice_id` | uuid | Related invoice (optional) |
| `thread_id` | uuid | Related message thread (optional) |
| `email_sent` | boolean | Email delivery status |
| `email_sent_at` | timestamptz | Email sent timestamp |
| `sms_sent` | boolean | SMS delivery status |
| `sms_sent_at` | timestamptz | SMS sent timestamp |
| `metadata` | jsonb | Additional metadata |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |
| `expires_at` | timestamptz | Expiration date (optional) |

**Indexes:**
- `idx_portal_notifications_customer_id` - Customer + created_at
- `idx_portal_notifications_unread` - Unread notifications
- `idx_portal_notifications_type` - By type
- `idx_portal_notifications_job` - By job
- `idx_portal_notifications_invoice` - By invoice
- `idx_portal_notifications_priority` - High/urgent priority
- `idx_portal_notifications_expires` - Expiring notifications

### Database Functions

#### mark_notification_as_read(p_notification_id, p_customer_id)
Marks a single notification as read.

**Returns:** boolean (true if updated, false if not found/already read)

#### mark_all_notifications_as_read(p_customer_id)
Marks all customer notifications as read.

**Returns:** integer (count of notifications marked)

#### get_unread_notification_count(p_customer_id)
Gets unread notification count for a customer.

**Returns:** integer

#### cleanup_expired_notifications()
Deletes expired notifications (should be run via cron).

**Returns:** integer (count of deleted notifications)

### Views

#### notification_summary
Aggregates notification statistics per customer.

**Columns:**
- `customer_id`
- `total_notifications`
- `unread_count`
- `priority_count`
- `appointment_reminders`
- `invoice_notifications`
- `message_replies`
- `last_notification_at`

## Portal Notifier Service

Location: `src/lib/notifications/portal-notifier.ts`

### Core Function: sendPortalNotification

Main entry point for sending notifications across all channels.

**Parameters:**
```typescript
interface NotificationOptions {
  customerId: string
  type: NotificationType
  title: string
  message: string
  priority?: NotificationPriority
  actionUrl?: string
  actionLabel?: string
  jobId?: string
  invoiceId?: string
  threadId?: string
  channels?: DeliveryChannel[]  // ['in_app', 'email', 'sms', 'all']
  sendEmail?: boolean
  sendSms?: boolean
  expiresInDays?: number
  metadata?: Record<string, any>
}
```

**Example Usage:**
```typescript
import { sendPortalNotification } from '@/lib/notifications/portal-notifier'

const result = await sendPortalNotification({
  customerId: '123e4567-e89b-12d3-a456-426614174000',
  type: 'invoice_due',
  title: 'Invoice Due Soon',
  message: 'Your invoice #INV-1234 for $250.00 is due on Oct 25.',
  priority: 'high',
  actionUrl: 'https://portal.example.com/invoices/inv-123',
  actionLabel: 'Pay Now',
  invoiceId: 'inv-123',
  channels: ['in_app', 'email'],
  expiresInDays: 30
})

console.log(result)
// {
//   success: true,
//   notificationId: 'uuid',
//   errors: [],
//   deliveryStatus: {
//     inApp: true,
//     email: true,
//     sms: false
//   }
// }
```

### Convenience Functions

Pre-configured functions for common notification types.

#### sendAppointmentReminder
```typescript
await sendAppointmentReminder({
  customerId: 'uuid',
  jobId: 'uuid',
  appointmentDate: '2025-10-25',
  appointmentTime: '10:00 AM',
  serviceType: 'Carpet Cleaning',
  sendEmail: true,
  sendSms: true
})
```

#### sendInvoiceDue
```typescript
await sendInvoiceDue({
  customerId: 'uuid',
  invoiceId: 'uuid',
  invoiceNumber: 'INV-1234',
  amount: 250.00,
  dueDate: '2025-10-25',
  sendEmail: true
})
```

#### sendMessageReply
```typescript
await sendMessageReply({
  customerId: 'uuid',
  threadId: 'uuid',
  threadTitle: 'Question about service',
  staffName: 'John Smith',
  sendEmail: true
})
```

#### sendPromotionAvailable
```typescript
await sendPromotionAvailable({
  customerId: 'uuid',
  promotionTitle: '20% Off Fall Cleaning',
  promotionDetails: 'Get 20% off all carpet cleaning services this fall!',
  expiresInDays: 30
})
```

## Multi-Channel Delivery

### In-App Notifications
- Always created in database
- Visible in customer portal
- Supports read/unread tracking
- Can have action buttons
- Auto-expires based on `expiresInDays`

### Email Notifications
- Sent via Resend email service
- Professional HTML templates
- Includes action buttons
- Company branding
- Tracks delivery status in database

**Email Template Features:**
- Responsive design
- Clear hierarchy
- Customer name personalization
- Action buttons with deep links
- Company information footer

### SMS Notifications
- Sent via Twilio
- Character-optimized messages
- Includes action URLs when space permits
- Rate limited per phone number
- Delivery status tracked

**SMS Format:**
```
Company Name: Notification Title

Message content...

https://portal.example.com/link
```

## Delivery Tracking

Each notification tracks its delivery status across all channels:

```typescript
{
  deliveryStatus: {
    inApp: true,    // Always true if notification created
    email: boolean, // True if email sent successfully
    sms: boolean    // True if SMS sent successfully
  }
}
```

Database columns updated:
- `email_sent` - Boolean flag
- `email_sent_at` - Timestamp
- `sms_sent` - Boolean flag
- `sms_sent_at` - Timestamp

## Error Handling

### Non-Blocking Delivery
- In-app notification always created first
- Email/SMS failures don't fail the entire operation
- Errors collected and returned in `errors` array
- Partial success is still considered successful

**Example with Partial Failure:**
```typescript
{
  success: true,
  notificationId: 'uuid',
  errors: [
    'SMS: Invalid phone number'
  ],
  deliveryStatus: {
    inApp: true,
    email: true,
    sms: false  // SMS failed, but notification still sent
  }
}
```

### Standard Error Responses

| Code | Status | Description |
|------|--------|-------------|
| `authentication_required` | 401 | Missing/invalid portal token |
| `rate_limit_exceeded` | 429 | Too many requests |
| `validation_error` | 400 | Invalid request parameters |
| `notification_not_found` | 404 | Notification not found or access denied |
| `query_failed` | 500 | Database query error |
| `update_failed` | 500 | Update operation failed |
| `server_error` | 500 | Unexpected server error |

## Notification Expiration

Notifications can automatically expire and be cleaned up:

### Setting Expiration
```typescript
await sendPortalNotification({
  // ...other options
  expiresInDays: 7  // Expires in 7 days
})
```

### Cleanup Process
Run the cleanup function periodically (e.g., via cron job):

```sql
SELECT cleanup_expired_notifications();
-- Returns: count of deleted notifications
```

**Recommended Schedule:** Daily at midnight

### Expired Notification Behavior
- Not returned in API list queries
- Not counted in summary statistics
- Can be permanently deleted by cleanup function
- Customer cannot access expired notifications

## Best Practices

### When to Send Notifications

**Always Send:**
- Appointment confirmations and reminders
- Invoice due/overdue notices
- Payment confirmations
- Message replies from staff

**Sometimes Send:**
- Promotions (respect customer preferences)
- Loyalty rewards
- Survey requests

**Consider Customer Preferences:**
- Check notification settings before sending
- Respect opt-out preferences
- Use appropriate channels (in-app vs email vs SMS)

### Priority Levels Guide

**Urgent:**
- Service delays or cancellations
- Payment issues
- Emergency communications

**High:**
- Appointment reminders (< 24 hours)
- Invoice due soon
- Important message replies

**Normal:**
- Appointment confirmations
- Service completions
- Regular updates

**Low:**
- Promotions
- Tips and recommendations
- Non-time-sensitive updates

### Message Content Guidelines

**Title:**
- Keep under 50 characters
- Clear and actionable
- No emoji (unless promotions)

**Message:**
- Under 200 characters for SMS compatibility
- Clear call to action
- Include relevant details (date, time, amount)
- Professional tone

**Action Button:**
- Clear label ("View Invoice", "Pay Now")
- Deep link to relevant portal page
- Always include when possible

## Integration Examples

### From Job Scheduling System

```typescript
import { sendAppointmentReminder } from '@/lib/notifications/portal-notifier'

// When job is scheduled
async function onJobScheduled(job: Job) {
  await sendAppointmentReminder({
    customerId: job.customer_id,
    jobId: job.id,
    appointmentDate: job.scheduled_date,
    appointmentTime: job.scheduled_time,
    serviceType: job.service_type,
    sendEmail: true,
    sendSms: true
  })
}
```

### From Invoice System

```typescript
import { sendInvoiceDue } from '@/lib/notifications/portal-notifier'

// When invoice becomes due
async function onInvoiceDue(invoice: Invoice) {
  await sendInvoiceDue({
    customerId: invoice.customer_id,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    amount: invoice.total_amount,
    dueDate: invoice.due_date,
    sendEmail: true
  })
}
```

### From Messaging System

```typescript
import { sendMessageReply } from '@/lib/notifications/portal-notifier'

// When staff replies to customer message
async function onStaffReply(thread: Thread, post: Post, staff: User) {
  await sendMessageReply({
    customerId: thread.customer_id,
    threadId: thread.id,
    threadTitle: thread.title,
    staffName: staff.name,
    sendEmail: true
  })
}
```

### Custom Notifications

```typescript
import { sendPortalNotification } from '@/lib/notifications/portal-notifier'

// Custom notification
await sendPortalNotification({
  customerId: customer.id,
  type: 'general',
  title: 'Welcome to Our VIP Program',
  message: 'Thank you for being a loyal customer! You now have access to exclusive benefits.',
  priority: 'normal',
  actionUrl: 'https://portal.example.com/vip',
  actionLabel: 'Explore Benefits',
  channels: ['in_app', 'email'],
  expiresInDays: 90,
  metadata: {
    vip_tier: 'gold',
    enrollment_date: new Date().toISOString()
  }
})
```

## Configuration

### Required Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Portal URLs
NEXT_PUBLIC_PORTAL_URL=https://portal.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
ALLOWED_PORTAL_ORIGINS=https://portal.yourdomain.com

# Email Service (Resend)
RESEND_API_KEY=re_your_api_key

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Company Info
COMPANY_NAME=Your Company Name
```

### Optional Configuration

```bash
# Notification settings
NOTIFICATION_EXPIRY_DAYS=30  # Default expiration
MAX_NOTIFICATIONS_PER_CUSTOMER=1000  # Cleanup threshold
```

## Testing

### Testing Checklist

#### API Endpoints
- [ ] List all notifications
- [ ] Filter by type (appointment, invoice, message)
- [ ] Filter by unread status
- [ ] Filter by priority
- [ ] Test pagination (page 1, 2, etc.)
- [ ] Mark single notification as read
- [ ] Mark all notifications as read
- [ ] Verify summary counts
- [ ] Test with no notifications
- [ ] Test with expired notifications

#### Notification Service
- [ ] Send in-app only notification
- [ ] Send email + in-app notification
- [ ] Send SMS + in-app notification
- [ ] Send all channels notification
- [ ] Test appointment reminder
- [ ] Test invoice due notification
- [ ] Test message reply notification
- [ ] Test promotion notification
- [ ] Verify delivery tracking
- [ ] Test with missing email
- [ ] Test with missing phone number

#### Security
- [ ] Test without authentication (should fail)
- [ ] Test with invalid token (should fail)
- [ ] Try accessing another customer's notifications (should fail)
- [ ] Verify rate limiting
- [ ] Test CORS headers

#### Database
- [ ] Verify RLS policies work
- [ ] Test mark_notification_as_read function
- [ ] Test mark_all_notifications_as_read function
- [ ] Test get_unread_notification_count function
- [ ] Test cleanup_expired_notifications function
- [ ] Verify triggers update timestamps
- [ ] Test notification expiration

## Monitoring

### Key Metrics to Track

1. **Delivery Success Rates**
   - In-app: Should be ~100%
   - Email: Target > 95%
   - SMS: Target > 90%

2. **Read Rates**
   - Track what % of notifications are read
   - By type, by priority
   - Time to read

3. **Notification Volume**
   - Daily notification count
   - Per customer average
   - By type distribution

4. **Response Times**
   - API response times
   - Email delivery time
   - SMS delivery time

### SQL Queries for Monitoring

```sql
-- Unread notification count per customer
SELECT customer_id, COUNT(*) as unread_count
FROM portal_notifications
WHERE is_read = false
  AND (expires_at IS NULL OR expires_at > now())
GROUP BY customer_id
ORDER BY unread_count DESC
LIMIT 10;

-- Delivery success rates
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE email_sent) as emails_sent,
  COUNT(*) FILTER (WHERE sms_sent) as sms_sent,
  ROUND(100.0 * COUNT(*) FILTER (WHERE email_sent) / NULLIF(COUNT(*), 0), 2) as email_rate,
  ROUND(100.0 * COUNT(*) FILTER (WHERE sms_sent) / NULLIF(COUNT(*), 0), 2) as sms_rate
FROM portal_notifications
WHERE created_at > now() - interval '7 days';

-- Notifications by type (last 7 days)
SELECT type, COUNT(*) as count
FROM portal_notifications
WHERE created_at > now() - interval '7 days'
GROUP BY type
ORDER BY count DESC;

-- Average time to read
SELECT
  type,
  AVG(EXTRACT(EPOCH FROM (read_at - created_at)) / 60) as avg_minutes_to_read
FROM portal_notifications
WHERE is_read = true
  AND created_at > now() - interval '30 days'
GROUP BY type
ORDER BY avg_minutes_to_read;
```

## Troubleshooting

### Notifications Not Appearing

1. Check customer_id is correct
2. Verify notification not expired
3. Check RLS policies
4. Confirm database insert succeeded

### Emails Not Sending

1. Verify `RESEND_API_KEY` configured
2. Check customer email is valid
3. Review Resend dashboard for errors
4. Check `email_sent` flag in database

### SMS Not Sending

1. Verify Twilio credentials
2. Check customer has valid phone number
3. Verify phone number format
4. Check rate limits
5. Review Twilio logs

### Slow API Response

1. Check database indexes
2. Review query execution plans
3. Consider pagination limits
4. Check rate limiter performance

## API Version

Current Version: **v1**

All responses include `version: "v1"` field.

## Changelog

### v1.0.0 (2025-10-21)
- Initial implementation
- Multi-channel delivery (in-app, email, SMS)
- 15+ notification types
- Priority levels
- Delivery tracking
- Auto-expiration
- Batch mark-as-read
- Convenience functions
- Comprehensive documentation
