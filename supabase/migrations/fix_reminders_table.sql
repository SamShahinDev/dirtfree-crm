-- =====================================================
-- FIX REMINDERS TABLE
-- Drops and recreates the reminders table cleanly
-- Fixes column naming inconsistencies
-- =====================================================

-- Drop existing table and dependencies
DROP TABLE IF EXISTS reminder_comments CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;

-- Create reminders table with clean structure
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  type TEXT NOT NULL, -- 'customer', 'job', 'truck', 'tool', 'follow_up'
  origin TEXT, -- 'manual', 'tech_post_complete', 'automated'
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'snoozed', 'complete', 'canceled'

  -- Scheduling
  scheduled_date DATE NOT NULL,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Relationships (using consistent naming)
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Tracking
  attempt_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_reminders_customer_id ON reminders(customer_id);
CREATE INDEX idx_reminders_job_id ON reminders(job_id);
CREATE INDEX idx_reminders_assigned_to ON reminders(assigned_to);
CREATE INDEX idx_reminders_status ON reminders(status);
CREATE INDEX idx_reminders_scheduled_date ON reminders(scheduled_date);
CREATE INDEX idx_reminders_type ON reminders(type);

-- Create reminder_comments table
CREATE TABLE reminder_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reminder_comments_reminder_id ON reminder_comments(reminder_id);
CREATE INDEX idx_reminder_comments_author_id ON reminder_comments(author_id);

-- Enable RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reminders
CREATE POLICY "Users can view reminders based on role"
  ON reminders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'dispatcher', 'technician')
    )
  );

CREATE POLICY "Dispatchers and admins can insert reminders"
  ON reminders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'dispatcher')
    )
  );

CREATE POLICY "Dispatchers and admins can update reminders"
  ON reminders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'dispatcher')
    )
  );

CREATE POLICY "Dispatchers and admins can delete reminders"
  ON reminders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'dispatcher')
    )
  );

-- RLS Policies for reminder_comments
CREATE POLICY "Users can view comments on reminders they can see"
  ON reminder_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reminders
      WHERE reminders.id = reminder_comments.reminder_id
    )
  );

CREATE POLICY "Users can insert comments"
  ON reminder_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'dispatcher', 'technician')
    )
  );

-- Add updated_at trigger for reminders
CREATE OR REPLACE FUNCTION update_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reminders_updated_at_trigger
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_reminders_updated_at();

-- Add updated_at trigger for reminder_comments
CREATE OR REPLACE FUNCTION update_reminder_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reminder_comments_updated_at_trigger
  BEFORE UPDATE ON reminder_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_reminder_comments_updated_at();
