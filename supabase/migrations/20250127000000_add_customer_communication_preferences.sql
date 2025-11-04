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