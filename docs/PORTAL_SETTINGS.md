# Portal Settings & Preferences API

Complete documentation for the customer portal settings and preferences system.

## Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Settings Sync Utilities](#settings-sync-utilities)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Security Considerations](#security-considerations)

---

## Overview

The Portal Settings & Preferences system allows customers to manage their portal experience through:

- **Notification Preferences**: Email, SMS, and push notifications
- **Communication Preferences**: Preferred contact methods and marketing opt-out
- **Auto-booking Preferences**: Enable automatic appointment confirmation
- **Payment Methods**: Manage saved payment methods via Stripe
- **Preferred Technician**: Select a preferred technician for all jobs
- **Portal Preferences**: Language and timezone settings

### Key Features

1. **Unified Settings API**: Single endpoint for all customer settings
2. **Payment Method Management**: Full CRUD operations for payment methods
3. **Settings Synchronization**: Automatic sync between CRM and portal
4. **Conflict Resolution**: Intelligent handling of simultaneous changes
5. **Audit Logging**: Complete history of all settings changes
6. **Real-time Updates**: Changes immediately reflected in both systems

---

## Database Schema

### Customer Settings (customers table extensions)

```sql
-- Portal-specific columns added to customers table
ALTER TABLE customers
ADD COLUMN auto_booking_enabled boolean DEFAULT false NOT NULL,
ADD COLUMN preferred_technician_id uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN portal_language text DEFAULT 'en' CHECK (portal_language IN ('en', 'es')) NOT NULL,
ADD COLUMN timezone text DEFAULT 'America/Los_Angeles' NOT NULL;
```

### Portal Settings History

```sql
CREATE TABLE portal_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by text NOT NULL CHECK (changed_by IN ('customer', 'staff', 'system')),
  changed_via text NOT NULL CHECK (changed_via IN ('portal', 'crm', 'api', 'migration')),
  changed_at timestamptz DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text,
  notes text
);

-- Indexes for efficient queries
CREATE INDEX idx_portal_settings_history_customer
ON portal_settings_history(customer_id, changed_at DESC);

CREATE INDEX idx_portal_settings_history_setting
ON portal_settings_history(setting_key, changed_at DESC);
```

### Database Functions

#### get_portal_settings(p_customer_id uuid)

Returns comprehensive portal settings for a customer.

```sql
SELECT get_portal_settings('customer-uuid-here');
```

**Returns:**
```json
{
  "customerId": "uuid",
  "notifications": {
    "email": true,
    "sms": true,
    "push": true
  },
  "communication": {
    "preferredMethod": "email",
    "marketingOptOut": false
  },
  "autoBooking": {
    "enabled": false
  },
  "preferredTechnician": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234"
  },
  "preferences": {
    "language": "en",
    "timezone": "America/Los_Angeles"
  }
}
```

#### record_portal_settings_change()

Automatically triggered when customer settings are updated. Records all changes to `portal_settings_history` table.

---

## API Endpoints

### Portal Settings

#### GET /api/portal/settings

Retrieve comprehensive customer portal settings.

**Authentication:** Portal Access Token

**Headers:**
```
Authorization: Bearer {access_token}
X-Portal-Token: {portal_token}
```

**Response:**
```json
{
  "success": true,
  "version": "v1",
  "timestamp": "2025-10-22T12:00:00Z",
  "data": {
    "customerId": "uuid",
    "notifications": {
      "email": true,
      "sms": true,
      "push": true
    },
    "communication": {
      "preferredMethod": "email",
      "marketingOptOut": false
    },
    "autoBooking": {
      "enabled": false
    },
    "preferredTechnician": {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "555-1234"
    },
    "preferences": {
      "language": "en",
      "timezone": "America/Los_Angeles"
    },
    "paymentMethods": [
      {
        "id": "pm_xxx",
        "type": "card",
        "card": {
          "brand": "visa",
          "last4": "4242",
          "expMonth": 12,
          "expYear": 2025,
          "funding": "credit"
        },
        "isDefault": true,
        "createdAt": "2025-10-22T12:00:00Z"
      }
    ]
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | authentication_required | No token provided |
| 401 | unauthorized | Invalid or expired token |
| 404 | customer_not_found | Customer not found |
| 500 | server_error | Internal server error |

---

#### PATCH /api/portal/settings

Update customer portal settings.

**Authentication:** Portal Access Token

**Headers:**
```
Authorization: Bearer {access_token}
X-Portal-Token: {portal_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "notifications": {
    "email": true,
    "sms": false
  },
  "communication": {
    "preferredMethod": "phone",
    "marketingOptOut": true
  },
  "autoBooking": {
    "enabled": true
  },
  "preferredTechnician": {
    "id": "technician-uuid"
  },
  "preferences": {
    "language": "es",
    "timezone": "America/New_York"
  }
}
```

**Response:**

Returns updated settings (same format as GET endpoint).

**Validation Rules:**

- `notifications.email`: boolean
- `notifications.sms`: boolean
- `communication.preferredMethod`: "email" | "phone" | "both"
- `communication.marketingOptOut`: boolean
- `autoBooking.enabled`: boolean
- `preferredTechnician.id`: valid UUID or null
- `preferences.language`: "en" | "es"
- `preferences.timezone`: valid IANA timezone string

**Side Effects:**

1. Updates customer record in database
2. Records change in `portal_settings_history`
3. Creates audit log entry
4. Triggers settings history function

---

### Payment Methods

#### GET /api/portal/settings/payment-methods

List customer's saved payment methods.

**Authentication:** Portal Access Token

**Response:**
```json
{
  "success": true,
  "version": "v1",
  "timestamp": "2025-10-22T12:00:00Z",
  "data": {
    "paymentMethods": [
      {
        "id": "pm_xxx",
        "type": "card",
        "card": {
          "brand": "visa",
          "last4": "4242",
          "expMonth": 12,
          "expYear": 2025,
          "funding": "credit"
        },
        "billingDetails": {
          "name": "John Doe",
          "email": "john@example.com",
          "phone": "555-1234",
          "address": {
            "line1": "123 Main St",
            "city": "San Francisco",
            "state": "CA",
            "postal_code": "94111",
            "country": "US"
          }
        },
        "isDefault": true,
        "createdAt": "2025-10-22T12:00:00Z"
      }
    ],
    "defaultPaymentMethodId": "pm_xxx"
  }
}
```

---

#### POST /api/portal/settings/payment-methods

Add new payment method to customer.

**Authentication:** Portal Access Token

**Request Body:**
```json
{
  "paymentMethodId": "pm_xxx",
  "setAsDefault": true
}
```

**Response:**
```json
{
  "success": true,
  "version": "v1",
  "timestamp": "2025-10-22T12:00:00Z",
  "data": {
    "paymentMethod": {
      "id": "pm_xxx",
      "type": "card",
      "card": {
        "brand": "visa",
        "last4": "4242",
        "expMonth": 12,
        "expYear": 2025
      },
      "isDefault": true,
      "createdAt": "2025-10-22T12:00:00Z"
    },
    "message": "Payment method added successfully"
  }
}
```

**Process:**

1. Validates payment method ID
2. Retrieves/creates Stripe customer ID
3. Attaches payment method to customer
4. Optionally sets as default
5. Records audit log entry

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | validation_failed | Invalid payment method ID |
| 400 | stripe_error | Stripe API error |
| 401 | unauthorized | Invalid token |
| 404 | customer_not_found | Customer not found |
| 500 | server_error | Internal server error |

---

#### DELETE /api/portal/settings/payment-methods/[id]

Remove payment method from customer.

**Authentication:** Portal Access Token

**Response:**
```json
{
  "success": true,
  "version": "v1",
  "timestamp": "2025-10-22T12:00:00Z",
  "data": {
    "message": "Payment method removed successfully",
    "paymentMethodId": "pm_xxx"
  }
}
```

**Process:**

1. Validates payment method belongs to customer
2. Detaches payment method from Stripe customer
3. Records audit log entry

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 403 | forbidden | Payment method doesn't belong to customer |
| 404 | payment_method_not_found | Payment method not found |
| 500 | server_error | Internal server error |

---

#### PATCH /api/portal/settings/payment-methods/[id]/default

Set payment method as default.

**Authentication:** Portal Access Token

**Response:**
```json
{
  "success": true,
  "version": "v1",
  "timestamp": "2025-10-22T12:00:00Z",
  "data": {
    "message": "Default payment method updated successfully",
    "paymentMethodId": "pm_xxx"
  }
}
```

**Process:**

1. Validates payment method belongs to customer
2. Updates Stripe customer's default payment method
3. Records audit log entry

---

## Settings Sync Utilities

Located in `/src/lib/portal/settings-sync.ts`

### Key Functions

#### recordSettingChange

Record a settings change in history.

```typescript
import { recordSettingChange } from '@/lib/portal/settings-sync'

const result = await recordSettingChange('customer-uuid', {
  key: 'email_notifications',
  oldValue: true,
  newValue: false,
  changedBy: 'customer',
  changedVia: 'portal',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  notes: 'Disabled via portal settings page'
})
```

---

#### getSettingHistory

Retrieve settings change history.

```typescript
import { getSettingHistory } from '@/lib/portal/settings-sync'

// Get all settings history
const { history } = await getSettingHistory('customer-uuid')

// Get history for specific setting
const { history } = await getSettingHistory('customer-uuid', 'email_notifications', 20)
```

---

#### detectSettingConflicts

Detect conflicts between portal and CRM settings.

```typescript
import { detectSettingConflicts } from '@/lib/portal/settings-sync'

const { conflicts } = await detectSettingConflicts('customer-uuid')

conflicts.forEach(conflict => {
  console.log(`Conflict in ${conflict.key}`)
  console.log(`Portal value: ${conflict.portalValue}`)
  console.log(`CRM value: ${conflict.crmValue}`)
  console.log(`Portal modified: ${conflict.portalLastModified}`)
  console.log(`CRM modified: ${conflict.crmLastModified}`)
})
```

**Conflict Detection Logic:**

- Compares recent changes from portal vs CRM
- Identifies settings modified from both sources
- Flags conflicts if changes occurred within 5 minutes

---

#### resolveSettingConflicts

Resolve detected conflicts using a strategy.

```typescript
import { resolveSettingConflicts } from '@/lib/portal/settings-sync'

const { resolved, errors } = await resolveSettingConflicts(
  'customer-uuid',
  conflicts,
  'latest_wins' // or 'portal_wins', 'crm_wins', 'manual'
)

console.log(`Resolved ${resolved} conflicts`)
```

**Resolution Strategies:**

| Strategy | Description |
|----------|-------------|
| `portal_wins` | Always use portal value |
| `crm_wins` | Always use CRM value |
| `latest_wins` | Use most recent change (default) |
| `manual` | Skip - requires manual intervention |

---

#### syncPortalToCRM

Sync settings from portal to CRM.

```typescript
import { syncPortalToCRM } from '@/lib/portal/settings-sync'

const result = await syncPortalToCRM('customer-uuid', {
  email_notifications: false,
  auto_booking_enabled: true,
  portal_language: 'es'
})

console.log(`Synced: ${result.synced.join(', ')}`)
console.log(`Conflicts: ${result.conflicts.length}`)
console.log(`Errors: ${result.errors.join(', ')}`)
```

---

#### bulkSyncSettings

Sync settings for multiple customers.

```typescript
import { bulkSyncSettings } from '@/lib/portal/settings-sync'

const result = await bulkSyncSettings(
  ['customer-1', 'customer-2', 'customer-3'],
  'latest_wins'
)

console.log(`Synced ${result.synced} settings`)
console.log(`Resolved ${result.conflicts} conflicts`)
```

---

## Usage Examples

### Example 1: Customer Updates Notification Preferences

```typescript
// Frontend code
const response = await fetch('/api/portal/settings', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    notifications: {
      email: true,
      sms: false
    }
  })
})

const { data } = await response.json()
console.log('Settings updated:', data)
```

**What happens:**

1. API validates token and customer
2. Updates `customers` table
3. Trigger records change in `portal_settings_history`
4. Audit log entry created
5. Updated settings returned

---

### Example 2: Customer Adds Payment Method

```typescript
// Step 1: Create payment method with Stripe.js
const { paymentMethod } = await stripe.createPaymentMethod({
  type: 'card',
  card: cardElement,
  billing_details: {
    name: 'John Doe',
    email: 'john@example.com'
  }
})

// Step 2: Add to customer via API
const response = await fetch('/api/portal/settings/payment-methods', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    paymentMethodId: paymentMethod.id,
    setAsDefault: true
  })
})

const { data } = await response.json()
console.log('Payment method added:', data.paymentMethod)
```

---

### Example 3: Set Preferred Technician

```typescript
// Frontend: Display technician list, customer selects one
const response = await fetch('/api/portal/settings', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    preferredTechnician: {
      id: 'technician-uuid'
    }
  })
})

const { data } = await response.json()
console.log('Preferred technician:', data.preferredTechnician)
```

---

### Example 4: Enable Auto-booking

```typescript
const response = await fetch('/api/portal/settings', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    autoBooking: {
      enabled: true
    }
  })
})

const { data } = await response.json()
console.log('Auto-booking enabled:', data.autoBooking.enabled)
```

**Impact:**

- All new bookings from this customer automatically confirmed
- No manual staff approval required
- Booking confirmation emails sent immediately

---

### Example 5: Detect and Resolve Conflicts

```typescript
import {
  detectSettingConflicts,
  resolveSettingConflicts
} from '@/lib/portal/settings-sync'

// Detect conflicts
const { conflicts } = await detectSettingConflicts('customer-uuid')

if (conflicts && conflicts.length > 0) {
  console.log(`Found ${conflicts.length} conflicts`)

  // Resolve using latest_wins strategy
  const { resolved, errors } = await resolveSettingConflicts(
    'customer-uuid',
    conflicts,
    'latest_wins'
  )

  console.log(`Resolved ${resolved} conflicts`)
  if (errors.length > 0) {
    console.error('Errors:', errors)
  }
}
```

---

## Best Practices

### 1. Always Validate Tokens

```typescript
// Good
const { customerId, error } = await authenticatePortalRequest(request)
if (error) {
  return error
}

// Bad - don't skip authentication
const customerId = request.headers.get('x-customer-id')
```

### 2. Handle Stripe Errors Gracefully

```typescript
try {
  const paymentMethod = await stripe.paymentMethods.attach(pmId, { customer: stripeId })
} catch (error) {
  if (error instanceof Stripe.errors.StripeCardError) {
    // Card declined
    return createErrorResponse('card_declined', error.message, 400)
  } else if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    // Invalid parameters
    return createErrorResponse('invalid_request', error.message, 400)
  } else {
    // Other error
    return createErrorResponse('stripe_error', 'Payment processing failed', 500)
  }
}
```

### 3. Record All Settings Changes

```typescript
// Good - manually record if trigger doesn't catch it
await recordSettingChange(customerId, {
  key: 'preferred_technician_id',
  oldValue: null,
  newValue: technicianId,
  changedBy: 'customer',
  changedVia: 'portal',
  ipAddress,
  userAgent
})

// Bad - don't skip history
await supabase.from('customers').update({ preferred_technician_id: technicianId })
```

### 4. Use Conflict Resolution Wisely

```typescript
// Good - check for conflicts before syncing
const { conflicts } = await detectSettingConflicts(customerId)
if (conflicts && conflicts.length > 0) {
  await resolveSettingConflicts(customerId, conflicts, 'latest_wins')
}
await syncPortalToCRM(customerId, settings)

// Bad - don't blindly sync without checking
await syncPortalToCRM(customerId, settings)
```

### 5. Provide Clear Error Messages

```typescript
// Good
return createErrorResponse(
  'payment_method_required',
  'Please add a payment method before enabling auto-booking',
  400
)

// Bad
return createErrorResponse('error', 'Something went wrong', 500)
```

### 6. Audit Critical Actions

```typescript
// Good - log payment method changes
await supabase.from('audit_logs').insert({
  user_id: null,
  action: 'payment_method_added',
  resource_type: 'customer',
  resource_id: customerId,
  metadata: { paymentMethodId, ipAddress }
})

// Don't skip audit logs for sensitive operations
```

---

## Security Considerations

### Authentication

- All endpoints require valid portal access token
- Tokens verified via `portal_sessions` table
- Session expiry enforced (7 days for access tokens)
- Token hashing (SHA-256) for database storage

### Authorization

- Customers can only access their own settings
- Row Level Security (RLS) policies enforce customer isolation
- Payment methods verified to belong to customer
- Preferred technician must be valid user

### Data Validation

- All inputs validated with Zod schemas
- SQL injection prevented via parameterized queries
- XSS prevention via JSON responses
- CORS restrictions on API endpoints

### Stripe Integration

- Secure API key management via environment variables
- Payment method verification before operations
- Customer ID validation
- Error handling for all Stripe operations

### Audit Trail

- All settings changes recorded
- IP address and user agent captured
- Change source and origin tracked
- Complete history maintained

### Rate Limiting

Recommended rate limits:

```
GET /api/portal/settings: 60 req/min
PATCH /api/portal/settings: 30 req/min
POST /api/portal/settings/payment-methods: 10 req/min
DELETE /api/portal/settings/payment-methods/[id]: 10 req/min
```

### Data Privacy

- Payment method details never stored in database
- Only Stripe IDs stored
- Sensitive data encrypted in transit (HTTPS)
- GDPR compliance through data deletion cascade

---

## Migration Guide

### From Legacy Preferences to Portal Settings

If migrating from the old `/api/portal/customer/preferences` endpoint:

1. **Data Migration**: No migration needed - same database columns
2. **API Migration**: Update frontend to use new endpoints
3. **Feature Additions**: New endpoints include payment methods, preferred technician, etc.

**Old Endpoint:**
```
GET /api/portal/customer/preferences
```

**New Endpoint:**
```
GET /api/portal/settings
```

**Mapping:**

| Old Field | New Field |
|-----------|-----------|
| `emailNotifications` | `notifications.email` |
| `smsNotifications` | `notifications.sms` |
| `preferredCommunication` | `communication.preferredMethod` |
| `marketingOptOut` | `communication.marketingOptOut` |
| N/A | `autoBooking.enabled` (new) |
| N/A | `preferredTechnician` (new) |
| N/A | `preferences.language` (new) |
| N/A | `preferences.timezone` (new) |
| N/A | `paymentMethods` (new) |

---

## Troubleshooting

### "Customer not found" error

**Cause:** Invalid customer ID or token

**Solution:**
1. Verify token is valid and not expired
2. Check customer exists in database
3. Ensure token belongs to correct customer

### "Payment method does not belong to customer" error

**Cause:** Attempting to modify another customer's payment method

**Solution:**
1. Verify payment method ID is correct
2. Check Stripe customer ID matches
3. Ensure no ID mixup in frontend

### Settings changes not syncing

**Cause:** Conflict between portal and CRM changes

**Solution:**
1. Run conflict detection: `detectSettingConflicts(customerId)`
2. Resolve conflicts: `resolveSettingConflicts(customerId, conflicts, 'latest_wins')`
3. Re-attempt sync

### Stripe errors

**Cause:** Various Stripe API issues

**Solution:**
1. Check Stripe API keys are correct
2. Verify Stripe customer exists
3. Check payment method is valid
4. Review Stripe dashboard for details

---

## API Rate Limits

| Endpoint | Rate Limit | Window |
|----------|-----------|--------|
| GET /api/portal/settings | 60 requests | 1 minute |
| PATCH /api/portal/settings | 30 requests | 1 minute |
| GET /api/portal/settings/payment-methods | 60 requests | 1 minute |
| POST /api/portal/settings/payment-methods | 10 requests | 1 minute |
| DELETE /api/portal/settings/payment-methods/[id] | 10 requests | 1 minute |
| PATCH /api/portal/settings/payment-methods/[id]/default | 10 requests | 1 minute |

---

## Support

For issues or questions:

1. Check this documentation
2. Review audit logs for settings changes
3. Check Stripe dashboard for payment issues
4. Review `portal_settings_history` table for change history
5. Contact development team

---

## Changelog

### v1.0.0 (2025-10-22)

- Initial release
- Portal settings API
- Payment methods management
- Settings synchronization
- Conflict resolution
- Complete audit trail
