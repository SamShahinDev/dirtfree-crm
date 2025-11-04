# Customer Portal Account Provisioning

This document describes the automatic portal account provisioning system that creates customer portal accounts when customers are added to the CRM.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Automatic Provisioning](#automatic-provisioning)
- [Manual Provisioning](#manual-provisioning)
- [API Reference](#api-reference)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Overview

The portal provisioning system automatically creates customer portal accounts for new customers added to the CRM. This gives customers immediate access to:

- Service history
- Online booking
- Loyalty rewards
- Payment history
- Account management
- Before/after photos

## Features

### Automatic Provisioning

- **Triggered on Customer Creation**: Portal accounts are automatically created when new customers are added via:
  - Website booking form
  - Manual customer creation in CRM
  - API customer creation

- **Welcome Email**: Customers receive an email with:
  - Login credentials (email + temporary password)
  - Portal URL
  - Password reset link
  - Instructions for first login

- **Secure Password Generation**:
  - 12-character minimum
  - Mix of uppercase, lowercase, numbers, and special characters
  - Excludes ambiguous characters (0, O, l, 1, I)

### Manual Provisioning

- **CRM UI**: Staff can manually provision accounts from customer detail pages
- **View Status**: Check if a customer has an active portal account
- **Send Password Reset**: Send password reset emails to customers
- **Revoke Access**: Disable portal access if needed

### Account Management

- **Check Status**: Verify if customer has portal account
- **Last Login Tracking**: See when customer last accessed portal
- **Account Creation Date**: Track when account was created
- **Batch Provisioning**: Create accounts for multiple customers at once

## Architecture

### Components

```
src/lib/portal/
├── provisioning.ts          # Core provisioning logic

src/app/api/customers/[id]/provision-portal/
├── route.ts                 # Provisioning API endpoints

src/app/(dashboard)/dashboard/customers/[id]/portal/
├── page.tsx                 # Manual provisioning UI

src/lib/email/
├── resend.ts                # Email templates (portal_welcome)
```

### Database Schema

Portal accounts use Supabase Auth with the following fields in the `customers` table:

```sql
customers
├── portal_account_created   boolean
├── portal_user_id           uuid (references auth.users)
└── updated_at               timestamp
```

### User Metadata

Auth accounts include metadata for customer linkage:

```typescript
{
  customer_id: string;
  first_name: string;
  last_name: string;
  phone: string;
}
```

## Automatic Provisioning

### Website Booking Flow

When a customer books a service via the website:

1. **Customer Creation**: Customer record is created in `customers` table
2. **Portal Provisioning**: `provisionPortalAccount()` is called asynchronously
3. **Auth Account**: User account created in Supabase Auth
4. **Welcome Email**: Customer receives portal welcome email
5. **Audit Log**: Account creation is logged

```typescript
// In src/app/api/public/bookings/route.ts
const { data: newCustomer } = await supabase
  .from('customers')
  .insert(customerData)
  .select()
  .single();

// Provision portal account in background
provisionPortalAccount(newCustomer.id, {
  sendWelcomeEmail: true,
  autoConfirmEmail: true,
}).catch(err => {
  console.error('Portal provisioning failed:', err);
  // Don't fail customer creation if portal provisioning fails
});
```

### Error Handling

Portal provisioning failures **do not** block customer creation:
- Customer record is created successfully
- Provisioning errors are logged to Sentry
- Staff can manually provision account later via CRM UI

## Manual Provisioning

### CRM Interface

Staff can provision accounts from: `/dashboard/customers/[id]/portal`

**Features:**
- View portal account status
- Create portal account manually
- View temporary password (shown once)
- Send password reset email
- Revoke portal access
- View account creation date
- View last login date

### Usage

1. **Navigate** to customer detail page
2. **Click** "Portal" tab in sidebar
3. **Check** account status
4. **Click** "Create Portal Account" if no account exists
5. **Copy** temporary password (shown once)
6. **Share** credentials with customer

### Screenshot Guide

**No Account:**
```
┌─────────────────────────────────────┐
│ Customer Portal Access        [⚠️]  │
├─────────────────────────────────────┤
│ ⚠️ This customer doesn't have a     │
│    portal account yet               │
│                                     │
│ Creating a portal account will:    │
│ • Generate secure temp password    │
│ • Send welcome email               │
│ • Grant portal access              │
│                                     │
│ Customer Email: john@example.com   │
│                                     │
│ [🔑 Create Portal Account]         │
└─────────────────────────────────────┘
```

**Account Exists:**
```
┌─────────────────────────────────────┐
│ Customer Portal Access        [✓]   │
├─────────────────────────────────────┤
│ ✓ Portal account is active         │
│                                     │
│ Portal Email: john@example.com     │
│ User ID: abc123...                 │
│ Account Created: Oct 25, 2025      │
│ Last Login: Oct 25, 2025 3:45 PM  │
│                                     │
│ [📧 Send Password Reset]           │
│ [🔗 Open Portal]                   │
│ [❌ Revoke Access]                 │
└─────────────────────────────────────┘
```

## API Reference

### GET /api/customers/[id]/provision-portal

Get portal account status for a customer.

**Response:**
```json
{
  "accountExists": true,
  "email": "john@example.com",
  "userId": "abc123-def456-...",
  "createdAt": "2025-10-25T15:30:00Z",
  "lastLogin": "2025-10-25T19:45:00Z"
}
```

### POST /api/customers/[id]/provision-portal

Create a portal account for a customer.

**Request Body:**
```json
{
  "sendWelcomeEmail": true,
  "autoConfirmEmail": true
}
```

**Response (New Account):**
```json
{
  "success": true,
  "message": "Portal account created successfully",
  "accountExists": false,
  "userId": "abc123-def456-...",
  "email": "john@example.com",
  "tempPassword": "Xy9$mK2pL5qR",
  "status": {
    "accountExists": true,
    "email": "john@example.com",
    "userId": "abc123-def456-...",
    "createdAt": "2025-10-25T15:30:00Z"
  }
}
```

**Response (Existing Account):**
```json
{
  "success": true,
  "message": "Portal account already exists",
  "accountExists": true,
  "userId": "abc123-def456-...",
  "email": "john@example.com"
}
```

### PATCH /api/customers/[id]/provision-portal

Send password reset email.

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

### DELETE /api/customers/[id]/provision-portal

Revoke portal access (disable account).

**Response:**
```json
{
  "success": true,
  "message": "Portal access revoked"
}
```

## Security

### Password Generation

Passwords are generated using a cryptographically secure method:

```typescript
function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%^&*';

  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining characters
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
```

### Email Auto-Confirmation

Portal accounts are created with `email_confirm: true` to skip email verification:
- Customers can log in immediately
- No verification email required
- Temporary password serves as initial authentication

### Password Reset

Customers can reset their password:
- Via password reset link in welcome email
- Via "Forgot Password" on portal login page
- Via staff sending password reset email from CRM

### Account Revocation

Portal access can be revoked:
- Account is banned (not deleted)
- Customer cannot log in
- Data is preserved in CRM
- Can be re-enabled if needed

## Email Template

### Welcome Email

The `portal_welcome` email template includes:

**Subject:** "Welcome to Your Dirt Free Customer Portal!"

**Content:**
- Personalized greeting
- Portal features overview
- Login credentials (email + temp password)
- Portal URL button
- Password change reminder
- Password reset link
- Support contact info

**Example:**
```
Welcome to Your Customer Portal!

Hi John,

We've created a customer portal account for you! Your portal gives you 24/7 access to:

• View your complete service history
• Book and manage appointments online
• Track your loyalty rewards and redeem points
• Access invoices and payment history
• Update your account information
• View before/after photos of your services

Your Login Credentials
Email: john@example.com
Temporary Password: Xy9$mK2pL5qR

⚠️ For security, please change your password after your first login.

[Access Your Portal Now]

Need Help?
If you're having trouble logging in or need to reset your password, click here:
Reset Password

Or contact us at (713) 730-2782 or info@dirtfreecarpet.com

Best regards,
The Dirt Free Team
```

## Troubleshooting

### Account Creation Fails

**Problem:** Portal account creation returns error

**Common Causes:**
1. Customer email is invalid or missing
2. Supabase Auth is misconfigured
3. Email already exists in auth system

**Solution:**
1. Verify customer email is valid
2. Check Supabase Auth settings
3. Use "Check Status" to see if account already exists
4. Check server logs for detailed error

### Welcome Email Not Received

**Problem:** Customer doesn't receive welcome email

**Common Causes:**
1. Email went to spam folder
2. Resend API key is invalid
3. Email sending failed

**Solution:**
1. Check customer's spam folder
2. Verify RESEND_API_KEY is set correctly
3. Check server logs for email errors
4. Manually send password reset email

### Temporary Password Not Shown

**Problem:** Temporary password disappeared after account creation

**Why:** Temporary password is only shown once for security

**Solution:**
1. Send password reset email to customer
2. Customer can reset password and create their own

### Cannot Revoke Access

**Problem:** "Revoke Access" button fails

**Common Causes:**
1. Customer doesn't have portal account
2. User ID is missing from customer record
3. Supabase Auth permission issue

**Solution:**
1. Check portal status first
2. Verify `portal_user_id` field exists
3. Check Supabase service role key

### Customer Cannot Log In

**Problem:** Customer reports they can't log in to portal

**Common Causes:**
1. Using wrong email address
2. Typing password incorrectly
3. Account was revoked
4. Account doesn't exist

**Solution:**
1. Verify email address matches customer record
2. Send password reset email
3. Check account status in CRM
4. Create account if it doesn't exist

## Best Practices

### When to Manually Provision

Manually provision accounts when:
- Customer was created before auto-provisioning was enabled
- Automatic provisioning failed
- Customer requests portal access
- Re-enabling access after revocation

### Communication

When sharing credentials with customers:
- Call customer and provide credentials verbally
- Or copy password and send via secure channel
- Remind customer to change password on first login
- Don't include password in regular emails

### Account Hygiene

Regularly review and maintain portal accounts:
- Disable accounts for inactive customers
- Re-enable accounts when customers return
- Clean up accounts for deleted customers
- Monitor failed login attempts

### Audit Trail

All provisioning actions are logged:
- Account creation
- Password resets
- Access revocation
- Access restoration

View audit logs in CRM for compliance and troubleshooting.

## Related Documentation

- [Website Booking Integration](./docs/WEBSITE_BOOKING_INTEGRATION.md)
- [Customer Portal User Guide](../dirt-free-portal/USER_MANUAL.md)
- [Email Templates](./src/lib/email/resend.ts)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)

## Support

For technical support or questions:
- Check server logs in Vercel/hosting dashboard
- Review Sentry error tracking
- Check Supabase Auth logs
- Contact development team
