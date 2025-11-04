### Cross-Platform Notifications System

## Overview

The Cross-Platform Notifications System provides a unified notification infrastructure that works seamlessly across all three Dirt Free platforms: CRM, Customer Portal, and Website. It supports multiple delivery channels including in-app notifications, email, SMS, and push notifications (coming soon).

## Features

- **Multi-Channel Delivery**: Send notifications via portal, CRM, email, SMS, and push
- **Unified API**: Single interface for all platforms
- **Template System**: Reusable notification templates with variable substitution
- **Scheduling**: Schedule notifications for future delivery
- **Priority Levels**: Low, normal, high, and urgent priorities
- **Real-time Updates**: Live notification updates using Supabase real-time
- **Read Tracking**: Track which notifications have been read
- **Delivery Tracking**: Monitor successful and failed deliveries per channel
- **Role-Based Targeting**: Send to all staff, specific roles, or individuals
- **Expiration**: Set expiration dates for time-sensitive notifications
- **Audit Trail**: Complete history of all notifications

## Database Structure

### Main Tables

#### `cross_platform_notifications`
Stores all notifications across all platforms:
- **Targeting**: recipient_type, recipient_id, recipient_role
- **Content**: title, message, notification_type, priority
- **Delivery**: channels (array), delivery tracking
- **Channel-specific content**: email_subject, email_body, sms_body
- **Actions**: action_url, action_label
- **Metadata**: metadata (JSON), related entity info
- **Tracking**: read status, sent_at, delivered_channels, failed_channels
- **Scheduling**: scheduled_for, expires_at

####`notification_templates`
Reusable templates with variable substitution:
- Template content with {{placeholders}}
- Default channels configuration
- Template versioning
- Available variables documentation

## Setup Instructions

### 1. Database Setup

Run the SQL migration:

```bash
# In Supabase SQL Editor
psql -h your-supabase-url -U postgres -d postgres -f sql/19-cross-platform-notifications.sql
```

Or execute in Supabase Dashboard SQL Editor.

### 2. Enable Real-time

**In Supabase Dashboard:**
1. Go to **Database** → **Replication**
2. Find `cross_platform_notifications` table
3. Enable replication
4. Or run: `ALTER PUBLICATION supabase_realtime ADD TABLE cross_platform_notifications;`

### 3. Configure Environment Variables

Add to `.env.local`:

```env
# Email (Resend)
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM="Dirt Free Carpet <notifications@dirtfreecarpet.com>"

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Cron Secret (for scheduled jobs)
CRON_SECRET=your_random_secret_string

# Portal URL (for SMS links)
NEXT_PUBLIC_PORTAL_URL=https://portal.dirtfreecarpet.com
```

### 4. Set Up Cron Jobs

Configure cron jobs in your hosting platform (Vercel, etc.):

#### Process Scheduled Notifications
- **Endpoint**: `/api/cron/process-scheduled-notifications`
- **Schedule**: `*/5 * * * *` (every 5 minutes)
- **Header**: `Authorization: Bearer ${CRON_SECRET}`

#### Cleanup Old Notifications
- **Endpoint**: `/api/cron/cleanup-notifications`
- **Schedule**: `0 2 * * *` (daily at 2 AM)
- **Header**: `Authorization: Bearer ${CRON_SECRET}`

**Example Vercel cron config** (vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/cron/process-scheduled-notifications",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/cleanup-notifications",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### 5. Add Notification Bell to UI

#### For CRM (already created):
```tsx
import { StaffNotifications } from '@/components/StaffNotifications'

// In your navigation/header component
<StaffNotifications />
```

#### For Customer Portal:
Create similar component at `/dirt-free-portal/src/components/NotificationBell.tsx` (use StaffNotifications as template)

## Usage

### Sending Notifications

#### 1. Using the API

```typescript
// Send direct notification
await fetch('/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    recipientType: 'customer',
    recipientId: customerId,
    title: 'Payment Received',
    message: 'Your payment of $150.00 has been received.',
    notificationType: 'payment',
    priority: 'normal',
    channels: ['portal', 'email', 'sms'],
    emailSubject: 'Payment Confirmation',
    emailBody: '<p>Thank you for your payment...</p>',
    smsBody: 'Payment received. Thank you!',
    actionUrl: '/invoices/123',
    actionLabel: 'View Receipt',
  }),
})
```

#### 2. Using the Service Functions

```typescript
import {
  sendNotification,
  notifyPaymentReceived,
  notifyMessageReply,
  notifyNewBooking,
  notifyAppointmentReminder,
} from '@/lib/notifications/unified-service'

// Use convenience functions
await notifyPaymentReceived(customerId, invoiceId, 150.00, 'INV-001')

// Or send custom notification
await sendNotification({
  recipientType: 'customer',
  recipientId: customerId,
  title: 'Service Complete',
  message: 'Your carpet cleaning is complete!',
  notificationType: 'alert',
  channels: ['portal', 'email'],
  emailSubject: 'Service Completed',
  emailBody: '<p>Your service is complete...</p>',
})
```

#### 3. Using Templates

```typescript
import { sendNotificationFromTemplate } from '@/lib/notifications/unified-service'

// Send using predefined template
await sendNotificationFromTemplate(
  'booking_confirmation',
  'customer',
  customerId,
  {
    customer_name: 'John Doe',
    date: 'March 15, 2024',
    time: '2:00 PM',
    service_name: 'Carpet Cleaning',
    address: '123 Main St',
  },
  {
    actionUrl: `/jobs/${jobId}`,
    actionLabel: 'View Appointment',
  }
)
```

### Notification Types

- `booking` - New bookings, confirmations
- `payment` - Payment confirmations, receipts
- `message` - Message replies, new messages
- `alert` - Important alerts, warnings
- `promotion` - Special offers, promotions
- `system` - System notifications, updates
- `reminder` - Appointment reminders, follow-ups

### Priority Levels

- `low` - Non-urgent information
- `normal` - Standard notifications (default)
- `high` - Important notifications
- `urgent` - Critical alerts

### Recipient Types

- `customer` - Single customer (requires `recipientId`)
- `staff` - Single staff member (requires `recipientId`)
- `all_staff` - All active staff members
- `role` - All staff with specific role (requires `recipientRole`)

### Delivery Channels

- `portal` - In-app notification in customer portal
- `crm` - In-app notification in CRM
- `email` - Email via Resend
- `sms` - SMS via Twilio
- `push` - Web push notifications (coming soon)

## Common Scenarios

### 1. Notify Customer of New Message

```typescript
import { notifyMessageReply } from '@/lib/notifications/unified-service'

await notifyMessageReply(
  customerId,
  messageId,
  'Sarah (Customer Service)',
  'Thank you for contacting us...'
)
```

### 2. Notify Dispatchers of New Booking

```typescript
import { notifyNewBooking } from '@/lib/notifications/unified-service'

await notifyNewBooking(customerId, jobId, {
  customerName: 'John Doe',
  service: 'Carpet Cleaning',
  date: 'March 15, 2024',
  time: '2:00 PM',
})
```

### 3. Send Appointment Reminder (Scheduled)

```typescript
import { notifyAppointmentReminder } from '@/lib/notifications/unified-service'

const appointmentDate = new Date('2024-03-15T14:00:00')

await notifyAppointmentReminder(
  customerId,
  jobId,
  appointmentDate,
  'Carpet Cleaning',
  '123 Main Street'
)
// This automatically schedules for 24 hours before appointment
```

### 4. Broadcast System Alert to All Staff

```typescript
import { notifySystemAlert } from '@/lib/notifications/unified-service'

await notifySystemAlert(
  'System Maintenance Scheduled',
  'The CRM will be offline for maintenance on Saturday from 2-4 AM.',
  'normal' // priority
)
```

### 5. Notify Specific Role

```typescript
await sendNotification({
  recipientType: 'role',
  recipientRole: 'technician',
  title: 'New Training Available',
  message: 'New product training video is now available',
  notificationType: 'system',
  channels: ['crm', 'email'],
})
```

## Creating Custom Templates

### 1. Add Template to Database

```sql
INSERT INTO notification_templates (
  template_key,
  template_name,
  notification_type,
  default_channels,
  title_template,
  message_template,
  email_subject_template,
  email_body_template,
  sms_body_template,
  variables
) VALUES (
  'job_completed',
  'Job Completed',
  'alert',
  '["portal", "email", "sms"]',
  'Service Completed',
  'Your {{service_name}} service has been completed.',
  'Service Completed - {{service_name}}',
  '<p>Hi {{customer_name}},</p><p>Your {{service_name}} service has been completed.</p><p>Total: ${{total}}</p>',
  'Your {{service_name}} service is complete. Total: ${{total}}. Thank you!',
  '{"customer_name": "Customer name", "service_name": "Service name", "total": "Total amount"}'
);
```

### 2. Use Template in Code

```typescript
await sendNotificationFromTemplate(
  'job_completed',
  'customer',
  customerId,
  {
    customer_name: 'John Doe',
    service_name: 'Carpet Cleaning',
    total: '150.00',
  }
)
```

## API Reference

### GET /api/notifications

Get notifications for current user.

**Query Parameters:**
- `limit` (number, default: 50) - Max notifications to return
- `unread_only` (boolean) - Only return unread notifications
- `type` (string) - Filter by notification type

**Response:**
```json
{
  "notifications": [...],
  "unreadCount": 5
}
```

### POST /api/notifications/send

Send a notification (admin/manager only).

**Body:**
```json
{
  "recipientType": "customer",
  "recipientId": "uuid",
  "title": "Notification Title",
  "message": "Notification message",
  "notificationType": "alert",
  "channels": ["portal", "email"],
  "emailSubject": "Email Subject",
  "emailBody": "<p>Email HTML</p>"
}
```

### POST /api/notifications/mark-read

Mark notification(s) as read.

**Body:**
```json
{
  "notificationId": "uuid" // For single notification
}
```

Or:
```json
{
  "markAll": true // For all user's notifications
}
```

## Testing

### Test Notification Sending

```bash
# Send test notification via API
curl -X POST http://localhost:3001/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "recipientType": "staff",
    "recipientId": "YOUR_USER_ID",
    "title": "Test Notification",
    "message": "This is a test",
    "notificationType": "system",
    "channels": ["crm"]
  }'
```

### Test Scheduled Processing

```bash
# Trigger scheduled notification processor
curl -X POST http://localhost:3001/api/cron/process-scheduled-notifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Cleanup

```bash
# Trigger cleanup
curl -X POST http://localhost:3001/api/cron/cleanup-notifications \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitoring

### Check Delivery Status

Query notifications with delivery tracking:

```sql
SELECT
  id,
  title,
  channels,
  delivered_channels,
  failed_channels,
  sent_at
FROM cross_platform_notifications
WHERE sent_at IS NOT NULL
ORDER BY sent_at DESC
LIMIT 100;
```

### Monitor Failed Deliveries

```sql
SELECT
  notification_type,
  channels,
  failed_channels,
  COUNT(*) as failed_count
FROM cross_platform_notifications
WHERE array_length(failed_channels, 1) > 0
GROUP BY notification_type, channels, failed_channels
ORDER BY failed_count DESC;
```

### Check Unread Counts

```sql
SELECT
  recipient_type,
  notification_type,
  COUNT(*) as unread_count
FROM cross_platform_notifications
WHERE read = false
GROUP BY recipient_type, notification_type;
```

## Troubleshooting

### Notifications Not Appearing

1. Check RLS policies are enabled
2. Verify real-time is enabled for table
3. Check user has correct authentication
4. Review browser console for errors
5. Verify recipient_id matches customer/user id

### Email Not Sending

1. Verify RESEND_API_KEY is set
2. Check EMAIL_FROM domain is verified in Resend
3. Review email_subject and email_body are provided
4. Check recipient email is valid
5. Review Resend dashboard for errors

### SMS Not Sending

1. Verify Twilio credentials are set
2. Check TWILIO_PHONE_NUMBER is correct
3. Verify recipient has SMS opt-in enabled
4. Check recipient phone number format
5. Review Twilio console for errors

### Scheduled Notifications Not Processing

1. Verify cron job is configured correctly
2. Check CRON_SECRET matches
3. Verify scheduled_for is in the past
4. Check cron job logs for errors
5. Test endpoint manually

## Security

- All RLS policies enforce proper access control
- Service role required for sending notifications
- Admin/manager role required for API send endpoint
- Cron endpoints protected with secret token
- Customer emails verified before sending
- SMS opt-in respected

## Performance

- Indexes optimize queries for recipients and unread status
- Real-time subscriptions for instant updates
- Automatic cleanup of old notifications
- Batch processing for role-based notifications
- Efficient delivery tracking

## Best Practices

1. **Use Templates**: Create reusable templates for common notifications
2. **Appropriate Channels**: Choose channels based on urgency and content
3. **Clear Titles**: Use descriptive, concise titles
4. **Action URLs**: Always provide action URLs when relevant
5. **Priority Levels**: Use appropriate priority levels
6. **Scheduling**: Schedule reminders appropriately (24h before, etc.)
7. **Expiration**: Set expiration for time-sensitive notifications
8. **Testing**: Test notifications before deploying to production
9. **Monitoring**: Regularly check delivery status and failed deliveries
10. **Opt-in**: Respect customer communication preferences

## Future Enhancements

- [ ] Web push notifications
- [ ] Notification preferences per user
- [ ] Digest emails (daily/weekly summaries)
- [ ] In-app notification sounds
- [ ] Rich media support (images, videos)
- [ ] Notification groups/threading
- [ ] A/B testing for notification content
- [ ] Analytics dashboard
- [ ] WhatsApp integration
- [ ] Slack/Teams integration for staff

## Support

For issues or questions about the notification system:
- Review this documentation
- Check SQL migration: `sql/19-cross-platform-notifications.sql`
- Review service: `src/lib/notifications/unified-service.ts`
- Check API routes: `src/app/api/notifications/`
- Review component: `src/components/StaffNotifications.tsx`
