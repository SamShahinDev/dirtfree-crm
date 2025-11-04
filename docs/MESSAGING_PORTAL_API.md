# Messaging Portal API Documentation

## Overview

The Messaging Portal API provides a complete customer-staff communication system through the customer portal. Customers can create message threads, send replies, attach images, and communicate securely with staff members.

## Features

✅ **Complete Implementation**
- Customer message thread creation
- Thread listing with pagination and filtering
- Reply functionality with file attachments
- Image upload support (up to 5MB per file, max 5 attachments)
- Automatic staff notifications via email
- Real-time read/unread tracking
- Job-related messaging support
- Urgent message flagging
- Audit logging for all actions
- Rate limiting and authentication
- CORS support for external portals

## API Endpoints

### 1. GET /api/portal/messages

Lists all message threads for the authenticated customer.

**Authentication:** Required (X-Portal-Token or Authorization header)

**Query Parameters:**
- `status` (optional): Filter by status (`open`, `in_progress`, `resolved`, `closed`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 25, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "threads": [
      {
        "id": "uuid",
        "subject": "Need help with carpet stain",
        "status": "open",
        "statusLabel": "Open",
        "isUrgent": false,
        "unreadCount": 2,
        "messageCount": 5,
        "lastMessageAt": "2025-10-21T10:30:00Z",
        "lastStaffReplyAt": "2025-10-21T09:15:00Z",
        "createdAt": "2025-10-20T14:00:00Z",
        "jobId": "uuid-or-null",
        "jobDate": "2025-10-25",
        "jobServiceType": "carpet-cleaning"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 42,
      "totalPages": 2
    },
    "summary": {
      "unreadCount": 5,
      "openCount": 12,
      "totalCount": 42
    }
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

### 2. POST /api/portal/messages

Creates a new message thread.

**Authentication:** Required

**Request Body:**
```json
{
  "subject": "Question about service",
  "message": "I have a question about...",
  "jobId": "uuid-optional",
  "isUrgent": false
}
```

**Validation:**
- `subject`: 1-200 characters, required
- `message`: 1-5000 characters, required
- `jobId`: Valid UUID (must belong to customer)
- `isUrgent`: Boolean, defaults to false

**Response:**
```json
{
  "success": true,
  "data": {
    "threadId": "uuid",
    "subject": "Question about service",
    "status": "open",
    "message": "Message thread created successfully"
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

**Staff Notification:**
- Automatically notifies all staff with admin, dispatcher, or manager roles
- Email includes message content, customer info, and direct link to thread
- Urgent messages are highlighted in email subject and body

### 3. GET /api/portal/messages/[id]

Fetches a complete message thread with all messages.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "subject": "Question about service",
    "status": "open",
    "statusLabel": "Open",
    "isUrgent": false,
    "unreadCount": 0,
    "messages": [
      {
        "id": "uuid",
        "content": "I have a question...",
        "attachments": [],
        "isFromStaff": false,
        "createdAt": "2025-10-20T14:00:00Z",
        "isRead": true
      },
      {
        "id": "uuid",
        "content": "Happy to help! Here's what...",
        "attachments": [],
        "isFromStaff": true,
        "staffName": "John Smith",
        "createdAt": "2025-10-20T15:30:00Z",
        "isRead": true
      }
    ],
    "createdAt": "2025-10-20T14:00:00Z",
    "updatedAt": "2025-10-21T10:30:00Z",
    "resolvedAt": null,
    "jobId": "uuid-or-null",
    "jobDate": "2025-10-25",
    "jobServiceType": "carpet-cleaning"
  }
}
```

**Side Effects:**
- Automatically marks all unread staff messages in the thread as read
- Resets the thread's unread count to 0

### 4. POST /api/portal/messages/[id]/reply

Adds a reply to an existing message thread.

**Authentication:** Required

**Content-Type:**
- `application/json` - For text-only replies
- `multipart/form-data` - For replies with file attachments

**Request Body (JSON):**
```json
{
  "message": "Thank you for the help!"
}
```

**Request Body (Form Data):**
```
message: "Thank you! Here are some photos..."
attachment0: File
attachment1: File
```

**File Upload Constraints:**
- Maximum 5 attachments per reply
- Each file must be ≤ 5MB
- Allowed types: JPEG, PNG, GIF, WebP
- Files stored in Supabase Storage bucket: `uploads`
- Path format: `portal-messages/{customerId}/{threadId}/{timestamp}-{random}.{ext}`

**Response:**
```json
{
  "success": true,
  "data": {
    "postId": "uuid",
    "threadId": "uuid",
    "attachments": [
      "https://storage.url/portal-messages/...",
      "https://storage.url/portal-messages/..."
    ],
    "message": "Reply sent successfully"
  }
}
```

**Side Effects:**
- If thread was `resolved`, it will be reopened to `open` status
- Staff members are automatically notified via email
- Creates audit log entry

## Database Schema

### Tables Used

#### truck_threads
Primary table for message threads.

**Key Columns:**
- `id`: UUID primary key
- `customer_id`: References customers table (for customer-initiated threads)
- `job_id`: Optional reference to jobs table
- `truck_id`: Optional reference to trucks table (nullable for customer threads)
- `title`: Thread subject
- `status`: `open`, `acknowledged`, `resolved`, `closed`
- `urgent`: Boolean flag for urgent messages
- `unread_count`: Number of unread staff messages (for customer)
- `last_message_at`: Timestamp of most recent message
- `created_at`, `updated_at`, `resolved_at`, `resolved_by`

#### truck_posts
Messages/replies within threads.

**Key Columns:**
- `id`: UUID primary key
- `thread_id`: References truck_threads
- `kind`: Message type (`message`, `reply`, `note`, etc.)
- `body`/`content`: Message text
- `image_urls`: Array of attachment URLs
- `author_id`: References customers (for customer posts)
- `created_by`: References auth.users (for staff posts)
- `read_at`, `read_by`: Read tracking
- `status`, `urgent`, `created_at`, `updated_at`

### Database Functions

#### mark_thread_messages_as_read(p_thread_id, p_user_id)
Marks all unread messages in a thread as read. Called automatically when customer views a thread.

#### update_thread_on_new_post()
Trigger function that updates thread metadata when a new post is added:
- Updates `last_message_at`
- Increments `unread_count` for staff-to-customer messages

### Views

#### customer_message_threads
Portal-friendly view aggregating thread data with message counts, customer info, and job details.

## Authentication & Security

### Portal Token Validation
All endpoints require a valid portal token passed via:
- `X-Portal-Token` header (preferred)
- `Authorization: Bearer {token}` header

Token validation extracts:
- `customerId`: Used to filter threads/messages
- `userId`: Used for audit logging

### Rate Limiting
- Applied per customer ID
- Uses Redis-backed rate limiter
- Returns `429 Too Many Requests` when exceeded
- Rate limit headers included in all responses

### Row-Level Security (RLS)
Database policies ensure:
- Customers can only access their own threads and messages
- Customers can only create threads (not assign to trucks)
- Staff can access all threads via service role

### CORS Configuration
Configurable allowed origins via:
- `ALLOWED_PORTAL_ORIGINS` (comma-separated)
- `NEXT_PUBLIC_PORTAL_URL`
- `NEXT_PUBLIC_APP_URL`
- Development localhost URLs

## Staff Notifications

### Notification System
Location: `src/lib/portal/message-notifications.ts`

### Who Gets Notified
Staff members with the following roles:
- `admin`
- `dispatcher`
- `manager`

### Notification Types

#### New Thread Notification
Triggered when a customer creates a new message thread.

**Email Includes:**
- Customer name and email
- Message subject
- Full message content
- URGENT badge (if flagged)
- Job indicator (if job-related)
- Direct link to view and reply
- Clear formatting with professional design

#### Reply Notification
Triggered when a customer replies to an existing thread.

**Email Includes:**
- Customer name
- Thread subject
- Reply content
- Attachment indicator
- Direct link to thread
- URGENT badge (if thread is urgent)

### Error Handling
- Notifications are non-blocking (won't fail the API request)
- Errors logged to console
- Returns success if at least one staff member notified
- Gracefully handles missing email configuration

## File Storage

### Supabase Storage Bucket
- Bucket name: `uploads`
- Public access for authenticated users
- Organized by customer and thread

### File Path Structure
```
uploads/portal-messages/{customerId}/{threadId}/{timestamp}-{random}.{extension}
```

Example:
```
uploads/portal-messages/123e4567-e89b-12d3-a456-426614174000/
  └─ 987fcdeb-51a2-12d3-a456-426614174001/
      ├─ 1729503600000-a1b2c3.jpg
      └─ 1729503605000-d4e5f6.png
```

### File Validation
Function: `validateAttachment()`

**Checks:**
- File type (JPEG, PNG, GIF, WebP only)
- File size (≤ 5MB)
- Returns validation object with error message

### Filename Generation
Function: `generateAttachmentFilename()`

**Format:**
- Timestamp (milliseconds)
- Random 6-character string
- Original file extension
- Prevents collisions and organizes by date

## Audit Logging

All message actions are logged via `createPortalAuditLog()`:

### New Thread Creation
```typescript
{
  actorId: auth.userId,
  action: 'CREATE',
  entity: 'customer',
  entityId: thread.id,
  meta: {
    action: 'message_thread_created',
    subject,
    jobId,
    isUrgent
  }
}
```

### Reply Creation
```typescript
{
  actorId: auth.userId,
  action: 'CREATE',
  entity: 'customer',
  entityId: post.id,
  meta: {
    action: 'message_reply_created',
    threadId,
    threadTitle,
    hasAttachments,
    attachmentCount
  }
}
```

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": "error_code",
  "message": "Human-readable error message",
  "version": "v1"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `authentication_required` | 401 | Missing or invalid portal token |
| `rate_limit_exceeded` | 429 | Too many requests |
| `validation_error` | 400 | Invalid request body |
| `invalid_job` | 404 | Job not found or access denied |
| `thread_not_found` | 404 | Thread not found or access denied |
| `thread_closed` | 400 | Cannot reply to closed thread |
| `too_many_attachments` | 400 | More than 5 attachments |
| `invalid_attachment` | 400 | Invalid file type or size |
| `upload_failed` | 500 | File upload to storage failed |
| `create_failed` | 500 | Database operation failed |
| `server_error` | 500 | Unexpected server error |

## Testing

### Manual Testing Checklist

#### Create New Thread
- [ ] Create thread without job ID
- [ ] Create thread with valid job ID
- [ ] Create urgent thread
- [ ] Verify staff receives email notification
- [ ] Check urgent emails have proper formatting
- [ ] Verify audit log entry created

#### List Threads
- [ ] List all threads (no filter)
- [ ] Filter by status: open, in_progress, resolved, closed
- [ ] Test pagination (page 1, 2, etc.)
- [ ] Test limit parameter (10, 25, 50)
- [ ] Verify summary counts (unread, open, total)
- [ ] Check sorting (most recent first)

#### View Thread Details
- [ ] View thread with multiple messages
- [ ] Verify messages sorted chronologically
- [ ] Check staff messages show staff name
- [ ] Confirm unread count resets after viewing
- [ ] Verify attachment URLs are accessible

#### Reply to Thread
- [ ] Reply with text only (JSON)
- [ ] Reply with text + 1 image (form-data)
- [ ] Reply with multiple images (up to 5)
- [ ] Test file type validation (reject PDF, accept PNG)
- [ ] Test file size validation (reject >5MB)
- [ ] Verify staff receives reply notification
- [ ] Check resolved threads reopen on reply
- [ ] Confirm attachments uploaded to correct path

#### Security Testing
- [ ] Test without authentication (should fail)
- [ ] Test with invalid token (should fail)
- [ ] Try accessing another customer's thread (should fail)
- [ ] Try replying to another customer's thread (should fail)
- [ ] Verify rate limiting kicks in after many requests
- [ ] Test CORS with allowed/disallowed origins

#### Error Handling
- [ ] Submit invalid data (check error messages)
- [ ] Upload invalid file type
- [ ] Upload oversized file
- [ ] Test with missing required fields
- [ ] Verify graceful handling of notification failures

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
ALLOWED_PORTAL_ORIGINS=https://portal.yourdomain.com,https://portal2.yourdomain.com

# Email Service (Resend)
RESEND_API_KEY=re_your_api_key
INVOICE_FROM_EMAIL=noreply@yourdomain.com
COMPANY_EMAIL=support@yourdomain.com

# Company Info
COMPANY_NAME=Your Company Name
COMPANY_PHONE=(555) 123-4567
```

### Storage Bucket Setup

Ensure the `uploads` bucket exists in Supabase Storage:

```sql
-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT DO NOTHING;

-- Set storage policies
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'uploads');
```

## Future Enhancements

### Potential Features
- [ ] SMS notifications for urgent messages
- [ ] In-app notifications for staff dashboard
- [ ] Message search functionality
- [ ] Customer satisfaction ratings
- [ ] Scheduled message reminders
- [ ] Rich text formatting support
- [ ] Voice message attachments
- [ ] Real-time updates via WebSocket
- [ ] Message templates for common responses
- [ ] Automatic language translation

## Support

For issues or questions about the Messaging Portal API:
1. Check the error logs in `/var/log/crm/portal-api.log`
2. Review Supabase dashboard for database issues
3. Verify email service (Resend) is operational
4. Check storage bucket permissions and quotas
5. Review rate limiter Redis connection

## API Version

Current Version: **v1**

All responses include a `version` field indicating the API version used.

## Changelog

### v1.0.0 (2025-10-21)
- Initial implementation
- Complete CRUD operations for message threads
- File upload support
- Staff email notifications
- Rate limiting and authentication
- Audit logging
- RLS policies
- Database triggers and functions
