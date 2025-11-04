# Customer Communication Preferences Migration

## ✅ Migration File Created

**File:** `supabase/migrations/20250127000000_add_customer_communication_preferences.sql`

## What This Fixes

The error: `Could not find the 'email_notifications' column of 'customers' in the schema cache`

This migration adds 4 missing columns to the `customers` table:
1. `email_notifications` (boolean, default: true)
2. `sms_notifications` (boolean, default: false)
3. `preferred_communication` (text: 'email', 'sms', or 'phone', default: 'email')
4. `marketing_opt_out` (boolean, default: false)

## What You Need To Do

### Step 1: Run the Migration in Supabase

1. Go to your **Supabase Dashboard**
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the SQL below:

```sql
-- Add customer communication preference columns
-- These columns control how customers receive notifications and marketing
-- Migration created: 2025-01-27

-- Add the missing columns to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS sms_notifications boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_communication text CHECK (preferred_communication IN ('email', 'sms', 'phone')) DEFAULT 'email',
ADD COLUMN IF NOT EXISTS marketing_opt_out boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN customers.email_notifications IS 'Whether customer wants to receive email notifications';
COMMENT ON COLUMN customers.sms_notifications IS 'Whether customer wants to receive SMS notifications';
COMMENT ON COLUMN customers.preferred_communication IS 'Preferred method of communication: email, sms, or phone';
COMMENT ON COLUMN customers.marketing_opt_out IS 'Whether customer has opted out of marketing communications';

-- Create index for marketing campaigns (to easily find opted-in customers)
CREATE INDEX IF NOT EXISTS idx_customers_marketing_opt_out ON customers(marketing_opt_out) WHERE marketing_opt_out = false;

-- Add index for email notification lookups
CREATE INDEX IF NOT EXISTS idx_customers_email_notifications ON customers(email_notifications) WHERE email_notifications = true;
```

5. Click **Run** (or press Ctrl/Cmd + Enter)
6. You should see "Success. No rows returned."

### Step 2: Verify the Columns Were Added

Run this query to verify:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
  AND column_name IN ('email_notifications', 'sms_notifications', 'preferred_communication', 'marketing_opt_out')
ORDER BY column_name;
```

You should see all 4 columns listed.

### Step 3: Test Customer Creation

Go back to your CRM and try creating a new customer again. It should work now! ✅

## What These Columns Do

- **email_notifications**: Controls whether customer receives email notifications (appointment reminders, completion notices, etc.)
- **sms_notifications**: Controls whether customer receives SMS text messages
- **preferred_communication**: Customer's preferred method of contact (email, sms, or phone)
- **marketing_opt_out**: Whether customer has opted out of marketing/promotional communications

## Default Values for Existing Customers

All existing customers in your database will automatically get these defaults:
- ✅ Email notifications: ON
- ❌ SMS notifications: OFF
- 📧 Preferred communication: email
- ❌ Marketing opt-out: OFF (they're opted IN by default)
