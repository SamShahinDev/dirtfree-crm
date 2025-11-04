-- Create loyalty point adjustments table for tracking manual point changes
CREATE TABLE IF NOT EXISTS loyalty_point_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points_change INTEGER NOT NULL,
  adjustment_type VARCHAR(30) NOT NULL CHECK (adjustment_type IN ('bonus', 'correction', 'promotion', 'compensation', 'other', 'tier_override', 'reset')),
  reason TEXT NOT NULL,
  notes TEXT,
  adjusted_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX idx_loyalty_adjustments_customer ON loyalty_point_adjustments(customer_id);
CREATE INDEX idx_loyalty_adjustments_adjusted_by ON loyalty_point_adjustments(adjusted_by_user_id);
CREATE INDEX idx_loyalty_adjustments_created_at ON loyalty_point_adjustments(created_at DESC);
CREATE INDEX idx_loyalty_adjustments_type ON loyalty_point_adjustments(adjustment_type);

-- Add RLS policies
ALTER TABLE loyalty_point_adjustments ENABLE ROW LEVEL SECURITY;

-- Staff can view all adjustments
CREATE POLICY "Staff can view all adjustments"
  ON loyalty_point_adjustments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager', 'dispatcher')
    )
  );

-- Only admins and managers can create adjustments
CREATE POLICY "Admins and managers can create adjustments"
  ON loyalty_point_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Add comment
COMMENT ON TABLE loyalty_point_adjustments IS 'Tracks manual loyalty point adjustments made by staff';
