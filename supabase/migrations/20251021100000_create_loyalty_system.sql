-- ================================================================
-- Loyalty System Migration
-- ================================================================
-- Creates loyalty points tracking system for customer rewards
-- Adds loyalty_points to customers and loyalty_transactions table
-- ================================================================

-- Add loyalty_points column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS loyalty_points integer DEFAULT 0 NOT NULL;

-- Add index for loyalty points queries
CREATE INDEX IF NOT EXISTS idx_customers_loyalty_points ON customers(loyalty_points DESC);

-- Create loyalty_transactions table to track all point changes
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Transaction details
  points_earned integer DEFAULT 0 NOT NULL CHECK (points_earned >= 0),
  points_redeemed integer DEFAULT 0 NOT NULL CHECK (points_redeemed >= 0),
  points_balance_after integer NOT NULL,

  -- Transaction type and reference
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'invoice_payment',
    'job_completion',
    'referral_bonus',
    'manual_adjustment',
    'points_redemption',
    'birthday_bonus',
    'anniversary_bonus',
    'welcome_bonus'
  )),
  reference_id uuid, -- References invoice, job, or other entity
  reference_number text, -- Invoice number, job number, etc.

  -- Description and metadata
  description text NOT NULL,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,

  -- Processing info
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamptz DEFAULT now() NOT NULL,

  -- Expiration (optional - for point expiry)
  expires_at timestamptz,

  -- Audit timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for loyalty_transactions
CREATE INDEX idx_loyalty_transactions_customer_id ON loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_transactions_created_at ON loyalty_transactions(created_at DESC);
CREATE INDEX idx_loyalty_transactions_transaction_type ON loyalty_transactions(transaction_type);
CREATE INDEX idx_loyalty_transactions_reference_id ON loyalty_transactions(reference_id);
CREATE INDEX idx_loyalty_transactions_expires_at ON loyalty_transactions(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS on loyalty_transactions
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loyalty_transactions

-- Customers can view only their own loyalty transactions
CREATE POLICY "Customers can view own loyalty transactions"
  ON loyalty_transactions FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE email = auth.email()
    )
  );

-- Only authenticated staff can insert loyalty transactions
CREATE POLICY "Staff can insert loyalty transactions"
  ON loyalty_transactions FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'role' IN ('admin', 'manager', 'technician')
    )
  );

-- Only admins can update loyalty transactions
CREATE POLICY "Admins can update loyalty transactions"
  ON loyalty_transactions FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Only admins can delete loyalty transactions
CREATE POLICY "Admins can delete loyalty transactions"
  ON loyalty_transactions FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM auth.users
      WHERE raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create function to automatically update customer loyalty points balance
CREATE OR REPLACE FUNCTION update_customer_loyalty_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer's total loyalty points
  UPDATE customers
  SET
    loyalty_points = NEW.points_balance_after,
    updated_at = now()
  WHERE id = NEW.customer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update customer loyalty balance on transaction insert
CREATE TRIGGER trigger_update_customer_loyalty_balance
  AFTER INSERT ON loyalty_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_loyalty_balance();

-- Create function to award loyalty points (helper for API/backend use)
CREATE OR REPLACE FUNCTION award_loyalty_points(
  p_customer_id uuid,
  p_points integer,
  p_transaction_type text,
  p_reference_id uuid DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_description text DEFAULT '',
  p_processed_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_transaction_id uuid;
BEGIN
  -- Get current loyalty points balance
  SELECT loyalty_points INTO v_current_balance
  FROM customers
  WHERE id = p_customer_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance + p_points;

  -- Ensure balance doesn't go negative
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient loyalty points balance';
  END IF;

  -- Insert loyalty transaction
  INSERT INTO loyalty_transactions (
    customer_id,
    points_earned,
    points_redeemed,
    points_balance_after,
    transaction_type,
    reference_id,
    reference_number,
    description,
    notes,
    metadata,
    processed_by,
    processed_at
  ) VALUES (
    p_customer_id,
    CASE WHEN p_points > 0 THEN p_points ELSE 0 END,
    CASE WHEN p_points < 0 THEN ABS(p_points) ELSE 0 END,
    v_new_balance,
    p_transaction_type,
    p_reference_id,
    p_reference_number,
    p_description,
    p_notes,
    p_metadata,
    p_processed_by,
    now()
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on tables and functions
COMMENT ON TABLE loyalty_transactions IS 'Tracks all loyalty points transactions for customers';
COMMENT ON COLUMN customers.loyalty_points IS 'Current loyalty points balance for customer';
COMMENT ON FUNCTION award_loyalty_points IS 'Award or deduct loyalty points for a customer';
COMMENT ON FUNCTION update_customer_loyalty_balance IS 'Automatically updates customer loyalty points balance when transaction is created';

-- Grant necessary permissions
GRANT SELECT, INSERT ON loyalty_transactions TO authenticated;
GRANT SELECT, UPDATE ON customers TO authenticated;
GRANT EXECUTE ON FUNCTION award_loyalty_points TO authenticated;
