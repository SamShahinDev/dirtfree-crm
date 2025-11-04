-- Create loyalty rewards catalog
CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_name VARCHAR(255) NOT NULL,
  reward_description TEXT,
  reward_type VARCHAR(30) NOT NULL CHECK (reward_type IN ('discount', 'free_service', 'upgrade', 'gift_card', 'merchandise', 'priority_access')),
  points_required INTEGER NOT NULL CHECK (points_required > 0),
  reward_value DECIMAL(10,2),
  quantity_available INTEGER, -- NULL for unlimited
  quantity_redeemed INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  terms_conditions TEXT,
  expiry_days INTEGER DEFAULT 90,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loyalty redemptions tracking
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES loyalty_rewards(id),
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  redemption_code VARCHAR(50) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  applied_to_job_id UUID REFERENCES jobs(id),
  voided BOOLEAN DEFAULT false,
  voided_reason TEXT,
  voided_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for better query performance
CREATE INDEX idx_loyalty_rewards_active ON loyalty_rewards(active);
CREATE INDEX idx_loyalty_rewards_type ON loyalty_rewards(reward_type);
CREATE INDEX idx_loyalty_rewards_points ON loyalty_rewards(points_required);

CREATE INDEX idx_loyalty_redemptions_customer ON loyalty_redemptions(customer_id);
CREATE INDEX idx_loyalty_redemptions_reward ON loyalty_redemptions(reward_id);
CREATE INDEX idx_loyalty_redemptions_code ON loyalty_redemptions(redemption_code);
CREATE INDEX idx_loyalty_redemptions_expires ON loyalty_redemptions(expires_at);
CREATE INDEX idx_loyalty_redemptions_used ON loyalty_redemptions(used);

-- Add RLS policies for loyalty_rewards
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active rewards
CREATE POLICY "Anyone can view active rewards"
  ON loyalty_rewards
  FOR SELECT
  TO authenticated
  USING (active = true);

-- Staff can view all rewards
CREATE POLICY "Staff can view all rewards"
  ON loyalty_rewards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Only admins and managers can modify rewards
CREATE POLICY "Admins and managers can insert rewards"
  ON loyalty_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update rewards"
  ON loyalty_rewards
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete rewards"
  ON loyalty_rewards
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Add RLS policies for loyalty_redemptions
ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- Customers can view their own redemptions
CREATE POLICY "Customers can view own redemptions"
  ON loyalty_redemptions
  FOR SELECT
  TO authenticated
  USING (customer_id IN (
    SELECT id FROM customers WHERE email = auth.jwt() ->> 'email'
  ));

-- Staff can view all redemptions
CREATE POLICY "Staff can view all redemptions"
  ON loyalty_redemptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- System can insert redemptions (handled via service role in API)
CREATE POLICY "System can insert redemptions"
  ON loyalty_redemptions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Staff can update redemptions (mark as used, void, etc)
CREATE POLICY "Staff can update redemptions"
  ON loyalty_redemptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Function to generate unique redemption code
CREATE OR REPLACE FUNCTION generate_redemption_code()
RETURNS VARCHAR(50) AS $$
DECLARE
  code VARCHAR(50);
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code: RWD-XXXXXXXX (8 random alphanumeric characters)
    code := 'RWD-' || upper(substring(md5(random()::text) from 1 for 8));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM loyalty_redemptions WHERE redemption_code = code) INTO exists;

    -- Exit loop if code is unique
    EXIT WHEN NOT exists;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Seed default rewards
INSERT INTO loyalty_rewards (reward_name, reward_description, reward_type, points_required, reward_value, terms_conditions, expiry_days, active) VALUES
  (
    '$10 Off Any Service',
    'Get $10 off your next carpet cleaning service',
    'discount',
    100,
    10.00,
    'Valid on any service. Cannot be combined with other offers. One per transaction.',
    90,
    true
  ),
  (
    'Free Room Scotchgard',
    'Free Scotchgard protection for one room (up to 200 sq ft)',
    'free_service',
    150,
    25.00,
    'Must be applied during a regular carpet cleaning service. Room size limit applies.',
    90,
    true
  ),
  (
    '$25 Off Any Service',
    'Save $25 on your next carpet cleaning service',
    'discount',
    250,
    25.00,
    'Valid on any service. Minimum $100 service required. Cannot be combined with other offers.',
    90,
    true
  ),
  (
    'Free Upholstery Cleaning',
    'Free cleaning for one piece of upholstered furniture',
    'free_service',
    400,
    75.00,
    'Valid for standard size sofa or loveseat. Larger items may require additional points.',
    90,
    true
  ),
  (
    '$50 Off Any Service',
    'Save $50 on your next carpet cleaning service',
    'discount',
    500,
    50.00,
    'Valid on any service. Minimum $150 service required. Cannot be combined with other offers.',
    90,
    true
  ),
  (
    'Priority Scheduling - 1 Year',
    'Get priority access to preferred appointment times for one full year',
    'priority_access',
    1000,
    NULL,
    'Priority scheduling benefits last for 365 days from redemption. Subject to availability.',
    365,
    true
  );

-- Add comments
COMMENT ON TABLE loyalty_rewards IS 'Catalog of rewards that customers can redeem with loyalty points';
COMMENT ON TABLE loyalty_redemptions IS 'Tracks customer redemptions of loyalty rewards';
COMMENT ON FUNCTION generate_redemption_code() IS 'Generates unique redemption codes in format RWD-XXXXXXXX';
