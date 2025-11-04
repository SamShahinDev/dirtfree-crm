# API Reference

Complete API documentation for Dirt Free CRM.

## Table of Contents

1. [Authentication](#authentication)
2. [Portal APIs](#portal-apis)
3. [Opportunities APIs](#opportunities-apis)
4. [Promotions APIs](#promotions-apis)
5. [Reviews APIs](#reviews-apis)
6. [Loyalty APIs](#loyalty-apis)
7. [Referrals APIs](#referrals-apis)
8. [Chatbot APIs](#chatbot-apis)
9. [Analytics APIs](#analytics-apis)
10. [Admin APIs](#admin-apis)
11. [Cron Job APIs](#cron-job-apis)
12. [Monitoring APIs](#monitoring-apis)
13. [Health Check APIs](#health-check-apis)
14. [Reports APIs](#reports-apis)

---

## Authentication

All API endpoints require authentication unless otherwise specified.

### Authentication Methods

**1. Session Cookie (Browser)**
- Automatic after login
- Managed by Supabase Auth
- Used for web application

**2. Bearer Token (API)**
```bash
Authorization: Bearer <access_token>
```

**3. Cron Secret (Cron Jobs)**
```bash
Authorization: Bearer <CRON_SECRET>
```

### Permissions

APIs use role-based access control (RBAC):

**Roles:**
- `admin`: Full system access
- `manager`: Operational access
- `staff`: Limited access
- `customer`: Portal access only

**Permission Format:** `resource:action`

**Examples:**
- `opportunities:view`
- `opportunities:create`
- `opportunities:edit`
- `promotions:manage`
- `analytics:view_all`

### Common Headers

```http
Content-Type: application/json
Authorization: Bearer <token>
```

### Common Response Format

**Success:**
```json
{
  "success": true,
  "data": { /* response data */ }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## Portal APIs

Customer portal endpoints for authenticated customers.

### Get Customer Profile

**GET** `/api/portal/customer`

Get logged-in customer's profile information.

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "tier": "gold",
    "points_balance": 1500,
    "lifetime_points": 5000,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### Update Customer Profile

**PATCH** `/api/portal/customer`

Update customer profile information.

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "phone": "+1987654321",
  "preferences": {
    "email_notifications": true,
    "sms_notifications": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "customer": { /* updated customer */ }
}
```

### Get Service History

**GET** `/api/portal/jobs`

Get customer's service history.

**Query Parameters:**
- `limit` (number): Results per page (default: 50)
- `offset` (number): Pagination offset
- `status` (string): Filter by status

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": "uuid",
      "service_type": "Carpet Cleaning",
      "service_date": "2025-01-15T10:00:00Z",
      "status": "completed",
      "total_amount": 250.00,
      "notes": "Living room and bedroom"
    }
  ],
  "total": 45,
  "limit": 50,
  "offset": 0
}
```

### Get Invoices

**GET** `/api/portal/invoices`

Get customer's invoices.

**Query Parameters:**
- `limit` (number): Results per page
- `status` (string): Filter by status (paid, pending, overdue)

**Response:**
```json
{
  "success": true,
  "invoices": [
    {
      "id": "uuid",
      "invoice_number": "INV-2025-001",
      "amount": 250.00,
      "status": "paid",
      "due_date": "2025-01-20",
      "paid_at": "2025-01-18T14:30:00Z"
    }
  ]
}
```

### Get Available Promotions

**GET** `/api/portal/promotions`

Get active promotions available to customer.

**Response:**
```json
{
  "success": true,
  "promotions": [
    {
      "id": "uuid",
      "name": "Spring Cleaning Special",
      "description": "20% off carpet cleaning",
      "discount_type": "percentage",
      "discount_value": 20,
      "valid_until": "2025-04-30",
      "restrictions": "First-time customers only"
    }
  ]
}
```

### Claim Promotion

**POST** `/api/portal/promotions/[id]/claim`

Claim a promotion code.

**Response:**
```json
{
  "success": true,
  "promotion_code": "SPRING20-ABC123",
  "message": "Promotion claimed successfully"
}
```

### Send Message

**POST** `/api/portal/messages`

Send a message to support.

**Request:**
```json
{
  "subject": "Question about service",
  "message": "I have a question about my recent service...",
  "priority": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "ticket_id": "uuid",
  "message": "Message sent successfully"
}
```

---

## Opportunities APIs

Missed opportunity management.

### Create Opportunity

**POST** `/api/opportunities`

Create a new missed opportunity.

**Request:**
```json
{
  "customer_id": "uuid",
  "opportunity_type": "missed_appointment",
  "estimated_value": 250.00,
  "notes": "Customer canceled last-minute"
}
```

**Response:**
```json
{
  "success": true,
  "opportunity": {
    "id": "uuid",
    "customer_id": "uuid",
    "opportunity_type": "missed_appointment",
    "status": "new",
    "estimated_value": 250.00,
    "created_at": "2025-01-24T10:00:00Z"
  }
}
```

### List Opportunities

**GET** `/api/opportunities`

Get all opportunities with filtering.

**Query Parameters:**
- `status` (string): Filter by status (new, contacted, converted, lost)
- `type` (string): Filter by type
- `startDate` (string): ISO date
- `endDate` (string): ISO date
- `limit` (number): Results per page
- `offset` (number): Pagination

**Response:**
```json
{
  "success": true,
  "opportunities": [
    {
      "id": "uuid",
      "customer": {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com"
      },
      "opportunity_type": "missed_appointment",
      "status": "new",
      "estimated_value": 250.00,
      "created_at": "2025-01-24T10:00:00Z"
    }
  ],
  "summary": {
    "total": 45,
    "byStatus": {
      "new": 12,
      "contacted": 20,
      "converted": 10,
      "lost": 3
    },
    "totalValue": 11250.00
  }
}
```

### Update Opportunity

**PATCH** `/api/opportunities/[id]`

Update opportunity details.

**Request:**
```json
{
  "status": "contacted",
  "notes": "Called customer, interested in rebooking"
}
```

### Convert Opportunity

**POST** `/api/opportunities/[id]/convert`

Mark opportunity as converted.

**Request:**
```json
{
  "actual_value": 275.00,
  "notes": "Booked for next week"
}
```

**Response:**
```json
{
  "success": true,
  "opportunity": { /* updated opportunity */ },
  "message": "Opportunity converted successfully"
}
```

### Send Follow-up

**POST** `/api/opportunities/[id]/follow-up`

Send follow-up communication.

**Request:**
```json
{
  "method": "email",
  "template_id": "uuid",
  "scheduled_for": "2025-01-25T10:00:00Z"
}
```

---

## Promotions APIs

Promotion creation and management.

### Create Promotion

**POST** `/api/promotions`

Create a new promotion.

**Request:**
```json
{
  "name": "Spring Cleaning Special",
  "description": "20% off all carpet cleaning services",
  "promotion_type": "seasonal",
  "discount_type": "percentage",
  "discount_value": 20,
  "valid_from": "2025-03-01",
  "valid_until": "2025-04-30",
  "target_tiers": ["bronze", "silver"],
  "restrictions": "First-time customers only"
}
```

**Response:**
```json
{
  "success": true,
  "promotion": {
    "id": "uuid",
    "name": "Spring Cleaning Special",
    "code": "SPRING20",
    "created_at": "2025-01-24T10:00:00Z"
  }
}
```

### List Promotions

**GET** `/api/promotions`

Get all promotions.

**Query Parameters:**
- `status` (string): active, scheduled, expired
- `type` (string): Filter by promotion type

**Response:**
```json
{
  "success": true,
  "promotions": [
    {
      "id": "uuid",
      "name": "Spring Cleaning Special",
      "status": "active",
      "discount_type": "percentage",
      "discount_value": 20,
      "valid_until": "2025-04-30"
    }
  ]
}
```

### Deliver Promotion

**POST** `/api/promotions/[id]/deliver`

Queue promotion for delivery.

**Request:**
```json
{
  "customer_ids": ["uuid1", "uuid2"],
  "delivery_method": "email",
  "scheduled_for": "2025-01-25T09:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "queued": 2,
  "message": "Promotion queued for delivery"
}
```

### Get Promotion Analytics

**GET** `/api/promotions/[id]/analytics`

Get promotion performance metrics.

**Response:**
```json
{
  "success": true,
  "analytics": {
    "delivered": 150,
    "viewed": 120,
    "claimed": 45,
    "used": 30,
    "viewRate": 80.0,
    "claimRate": 30.0,
    "useRate": 20.0,
    "revenue": 7500.00,
    "roi": 15.0
  }
}
```

---

## Reviews APIs

Review request and management.

### Send Review Request

**POST** `/api/reviews/request`

Send a review request to customer.

**Request:**
```json
{
  "customer_id": "uuid",
  "job_id": "uuid",
  "delivery_method": "email"
}
```

**Response:**
```json
{
  "success": true,
  "request_id": "uuid",
  "message": "Review request sent"
}
```

### Get Review Requests

**GET** `/api/reviews/requests`

Get all review requests.

**Query Parameters:**
- `status` (string): pending, completed, expired
- `startDate`, `endDate`: Date range

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "id": "uuid",
      "customer": { /* customer info */ },
      "status": "pending",
      "sent_at": "2025-01-24T10:00:00Z",
      "expires_at": "2025-02-24T10:00:00Z"
    }
  ]
}
```

### Submit Review Response

**POST** `/api/reviews/respond/[requestId]`

Customer submits review response.

**Request:**
```json
{
  "rating": 5,
  "feedback": "Excellent service! Very professional.",
  "would_recommend": true
}
```

**Response:**
```json
{
  "success": true,
  "response_id": "uuid",
  "points_earned": 50
}
```

### Get Google Reviews

**GET** `/api/reviews/google`

Get synced Google reviews.

**Response:**
```json
{
  "success": true,
  "reviews": [
    {
      "id": "uuid",
      "author_name": "John Doe",
      "rating": 5,
      "text": "Great service!",
      "time": "2025-01-24T10:00:00Z"
    }
  ]
}
```

---

## Loyalty APIs

Loyalty program management.

### Get Loyalty Balance

**GET** `/api/loyalty/balance/[customerId]`

Get customer's loyalty points balance.

**Response:**
```json
{
  "success": true,
  "balance": {
    "current_points": 1500,
    "lifetime_points": 5000,
    "tier": "gold",
    "next_tier": "platinum",
    "points_to_next_tier": 2500
  }
}
```

### Get Transactions

**GET** `/api/loyalty/transactions/[customerId]`

Get loyalty transaction history.

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "transaction_type": "earned",
      "points": 100,
      "description": "Carpet cleaning service",
      "created_at": "2025-01-24T10:00:00Z"
    }
  ]
}
```

### Award Points

**POST** `/api/loyalty/award`

Award points to customer.

**Request:**
```json
{
  "customer_id": "uuid",
  "points": 100,
  "description": "Service completion bonus",
  "source": "service_completion"
}
```

**Response:**
```json
{
  "success": true,
  "transaction_id": "uuid",
  "new_balance": 1600
}
```

### Redeem Points

**POST** `/api/loyalty/redeem`

Redeem points for reward.

**Request:**
```json
{
  "customer_id": "uuid",
  "reward_id": "uuid",
  "points": 500
}
```

**Response:**
```json
{
  "success": true,
  "redemption_id": "uuid",
  "redemption_code": "REWARD-ABC123",
  "new_balance": 1000
}
```

### Get Achievements

**GET** `/api/loyalty/achievements/[customerId]`

Get customer's achievements.

**Response:**
```json
{
  "success": true,
  "achievements": {
    "earned": [
      {
        "id": "uuid",
        "name": "First Service",
        "description": "Completed first service",
        "points_awarded": 50,
        "earned_at": "2025-01-24T10:00:00Z"
      }
    ],
    "available": [
      {
        "id": "uuid",
        "name": "Fifth Service",
        "description": "Complete 5 services",
        "points_reward": 100,
        "progress": "3/5"
      }
    ]
  }
}
```

---

## Referrals APIs

Referral tracking and management.

### Create Referral

**POST** `/api/referrals`

Customer refers a friend.

**Request:**
```json
{
  "referrer_id": "uuid",
  "referred_email": "friend@example.com",
  "referred_name": "Jane Smith",
  "referred_phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "referral": {
    "id": "uuid",
    "referral_code": "REF-ABC123",
    "status": "pending"
  }
}
```

### Get Referrals

**GET** `/api/referrals/[customerId]`

Get customer's referrals.

**Response:**
```json
{
  "success": true,
  "referrals": [
    {
      "id": "uuid",
      "referred_name": "Jane Smith",
      "status": "converted",
      "points_earned": 500,
      "created_at": "2025-01-20T10:00:00Z",
      "converted_at": "2025-01-24T10:00:00Z"
    }
  ],
  "summary": {
    "total": 5,
    "pending": 2,
    "converted": 3,
    "total_points_earned": 1500
  }
}
```

### Track Referral Conversion

**POST** `/api/referrals/[id]/convert`

Mark referral as converted.

**Request:**
```json
{
  "customer_id": "uuid",
  "job_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "points_awarded": {
    "referrer": 500,
    "referred": 250
  }
}
```

---

## Chatbot APIs

AI chatbot interactions.

### Send Message

**POST** `/api/chatbot/message`

Send message to chatbot.

**Request:**
```json
{
  "customer_id": "uuid",
  "message": "What services do you offer?",
  "context": {
    "previous_messages": []
  }
}
```

**Response:**
```json
{
  "success": true,
  "interaction_id": "uuid",
  "response": "We offer carpet cleaning, tile & grout cleaning, and water damage restoration.",
  "suggested_actions": [
    {
      "label": "Book Service",
      "action": "book_service"
    }
  ]
}
```

### Get Conversation History

**GET** `/api/chatbot/history/[customerId]`

Get customer's chat history.

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "uuid",
      "customer_message": "What services do you offer?",
      "bot_response": "We offer...",
      "created_at": "2025-01-24T10:00:00Z"
    }
  ]
}
```

---

## Analytics APIs

Business intelligence and metrics.

### Get Portal Analytics

**GET** `/api/analytics/portal`

Get customer portal usage analytics.

**Query Parameters:**
- `period` (string): 24h, 7d, 30d, 90d

**Response:**
```json
{
  "success": true,
  "analytics": {
    "period": "30d",
    "metrics": {
      "unique_visitors": 450,
      "total_sessions": 1250,
      "avg_session_duration": 180,
      "promotions_claimed": 45,
      "reviews_submitted": 30
    },
    "timeline": [
      {
        "date": "2025-01-24",
        "visitors": 15,
        "sessions": 42
      }
    ]
  }
}
```

### Get Opportunity Analytics

**GET** `/api/analytics/opportunities`

Get opportunity pipeline metrics.

**Response:**
```json
{
  "success": true,
  "analytics": {
    "total_opportunities": 120,
    "conversion_rate": 25.5,
    "avg_days_to_convert": 7.5,
    "total_value": 30000.00,
    "converted_value": 7650.00,
    "by_type": {
      "missed_appointment": 45,
      "no_show": 30,
      "declined_service": 25,
      "price_shopping": 20
    }
  }
}
```

---

## Admin APIs

Administrative functions.

### Cron Jobs Management

**GET** `/api/admin/cron-jobs`

Get all cron jobs with statistics.

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalJobs": 18,
    "enabledJobs": 17,
    "runningJobs": 1
  },
  "jobs": [
    {
      "name": "health-check",
      "schedule": "*/5 * * * *",
      "enabled": true,
      "stats": {
        "successRate": 99.5,
        "lastRun": "2025-01-24T10:00:00Z"
      }
    }
  ]
}
```

**POST** `/api/admin/cron-jobs/[jobName]/toggle`

Enable/disable a cron job.

**POST** `/api/admin/cron-jobs/[jobName]/run`

Manually trigger a cron job.

### Scheduled Reports

**GET** `/api/admin/reports/scheduled`

Get all scheduled reports.

**POST** `/api/admin/reports/scheduled`

Create a new scheduled report.

**Request:**
```json
{
  "name": "Daily Revenue Summary",
  "reportType": "revenue_summary",
  "schedule": "0 6 * * *",
  "recipients": ["admin@example.com"],
  "format": "pdf"
}
```

---

## Cron Job APIs

Automated task execution endpoints.

### Execute Cron Job

**POST** `/api/cron/execute/[jobName]`

Execute a specific cron job.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "success": true,
  "jobName": "health-check",
  "execution": {
    "startedAt": "2025-01-24T10:00:00Z",
    "completedAt": "2025-01-24T10:00:05Z",
    "duration": 5234,
    "status": "success"
  }
}
```

### List Available Jobs

**GET** `/api/cron/jobs`

Get all registered cron jobs.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "total": 18,
  "jobs": [
    {
      "name": "health-check",
      "schedule": "*/5 * * * *",
      "description": "Monitor system health",
      "category": "monitoring"
    }
  ]
}
```

---

## Monitoring APIs

System health and monitoring.

### Get Monitoring Metrics

**GET** `/api/monitoring/metrics`

Get current system metrics.

**Query Parameters:**
- `period` (string): 1h, 24h, 7d, 30d

**Response:**
```json
{
  "success": true,
  "metrics": {
    "currentStatus": {
      "status": "healthy",
      "uptime": 3600,
      "services": {
        "database": {
          "status": "healthy",
          "responseTime": 45
        }
      }
    },
    "uptimeStats": {
      "periods": {
        "24h": 99.5,
        "7d": 99.8,
        "30d": 99.9
      }
    }
  }
}
```

---

## Health Check APIs

Service health verification.

### Basic Health Check

**GET** `/api/health`

Simple health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-24T10:00:00Z",
  "uptime": 3600
}
```

### Detailed Health Check

**GET** `/api/health/detailed`

Comprehensive health check of all services.

**Response:**
```json
{
  "timestamp": "2025-01-24T10:00:00Z",
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 45
    },
    "stripe": {
      "status": "healthy",
      "responseTime": 234
    },
    "memory": {
      "status": "healthy",
      "details": {
        "heapUsedMB": 128,
        "heapTotalMB": 256
      }
    }
  }
}
```

---

## Reports APIs

Scheduled report management.

### Generate Report

**POST** `/api/admin/reports/scheduled/[reportId]/generate`

Manually generate and send a report.

**Response:**
```json
{
  "success": true,
  "message": "Report generation started"
}
```

### Test Report

**POST** `/api/admin/reports/scheduled/[reportId]/test`

Generate test report without sending.

**Request:**
```json
{
  "reportType": "revenue_summary",
  "format": "pdf",
  "filters": {}
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "fileName": "revenue_summary-2025-01-24.pdf",
    "fileSize": 45678,
    "fileSizeKB": "44.61"
  }
}
```

---

## Error Codes

Common error codes returned by the API:

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid authentication |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

---

## Rate Limiting

API endpoints are rate limited:

- **Portal APIs**: 100 requests per minute
- **Admin APIs**: 1000 requests per minute
- **Cron APIs**: No limit (authenticated with CRON_SECRET)

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706097600
```

---

**Last Updated:** 2025-01-24

**API Version:** 1.0.0
