-- Truck assignments and Vehicle Board system
-- Enables technician assignment to trucks and thread-based communication

-- Create truck_assignments table
CREATE TABLE IF NOT EXISTS truck_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(truck_id, user_id)
);

-- Create truck_threads table
CREATE TABLE IF NOT EXISTS truck_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text CHECK (status IN ('open', 'acknowledged', 'resolved')) DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

-- Create truck_posts table
CREATE TABLE IF NOT EXISTS truck_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES truck_threads(id) ON DELETE CASCADE,
  kind text CHECK (kind IN ('need', 'issue', 'note', 'update')) NOT NULL,
  body text NOT NULL,
  photo_key text,
  urgent boolean DEFAULT false,
  status text CHECK (status IN ('open', 'acknowledged', 'resolved')) DEFAULT 'open',
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  reminder_id uuid REFERENCES reminders(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_truck_assignments_user ON truck_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_truck_assignments_truck ON truck_assignments(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_threads_truck ON truck_threads(truck_id, status);
CREATE INDEX IF NOT EXISTS idx_truck_threads_status ON truck_threads(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_truck_posts_thread ON truck_posts(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_truck_posts_urgent ON truck_posts(urgent, status) WHERE urgent = true AND status = 'open';
CREATE INDEX IF NOT EXISTS idx_truck_posts_reminder ON truck_posts(reminder_id) WHERE reminder_id IS NOT NULL;

-- Enable RLS on all tables
ALTER TABLE truck_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_posts ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is assigned to a truck
CREATE OR REPLACE FUNCTION is_assigned_to_truck(truck_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM truck_assignments
    WHERE truck_id = truck_uuid
    AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has admin or dispatcher role
CREATE OR REPLACE FUNCTION has_elevated_role(user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
    AND role IN ('admin', 'dispatcher')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for truck_assignments

-- Admin/dispatcher can view all assignments
CREATE POLICY "Admin/dispatcher view all assignments"
  ON truck_assignments FOR SELECT
  USING (has_elevated_role(auth.uid()));

-- Technicians can view assignments for trucks they're assigned to
CREATE POLICY "Technicians view own assignments"
  ON truck_assignments FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM truck_assignments ta
      WHERE ta.truck_id = truck_assignments.truck_id
      AND ta.user_id = auth.uid()
    )
  );

-- Only admin/dispatcher can insert assignments
CREATE POLICY "Admin/dispatcher create assignments"
  ON truck_assignments FOR INSERT
  WITH CHECK (has_elevated_role(auth.uid()));

-- Only admin/dispatcher can delete assignments
CREATE POLICY "Admin/dispatcher delete assignments"
  ON truck_assignments FOR DELETE
  USING (has_elevated_role(auth.uid()));

-- RLS Policies for truck_threads

-- Admin/dispatcher can view all threads
CREATE POLICY "Admin/dispatcher view all threads"
  ON truck_threads FOR SELECT
  USING (has_elevated_role(auth.uid()));

-- Technicians can view threads for trucks they're assigned to
CREATE POLICY "Technicians view assigned truck threads"
  ON truck_threads FOR SELECT
  USING (is_assigned_to_truck(truck_id, auth.uid()));

-- Admin/dispatcher can create threads on any truck
CREATE POLICY "Admin/dispatcher create threads"
  ON truck_threads FOR INSERT
  WITH CHECK (
    has_elevated_role(auth.uid())
    AND created_by = auth.uid()
  );

-- Technicians can create threads on assigned trucks
CREATE POLICY "Technicians create threads on assigned trucks"
  ON truck_threads FOR INSERT
  WITH CHECK (
    is_assigned_to_truck(truck_id, auth.uid())
    AND created_by = auth.uid()
  );

-- Admin/dispatcher can update any thread
CREATE POLICY "Admin/dispatcher update threads"
  ON truck_threads FOR UPDATE
  USING (has_elevated_role(auth.uid()));

-- Technicians cannot directly update threads (status updates via posts)
-- No technician update policy

-- RLS Policies for truck_posts

-- Admin/dispatcher can view all posts
CREATE POLICY "Admin/dispatcher view all posts"
  ON truck_posts FOR SELECT
  USING (has_elevated_role(auth.uid()));

-- Technicians can view posts in threads for trucks they're assigned to
CREATE POLICY "Technicians view posts in assigned truck threads"
  ON truck_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM truck_threads tt
      JOIN truck_assignments ta ON ta.truck_id = tt.truck_id
      WHERE tt.id = truck_posts.thread_id
      AND ta.user_id = auth.uid()
    )
  );

-- Admin/dispatcher can create posts in any thread
CREATE POLICY "Admin/dispatcher create posts"
  ON truck_posts FOR INSERT
  WITH CHECK (
    has_elevated_role(auth.uid())
    AND created_by = auth.uid()
  );

-- Technicians can create posts in threads for assigned trucks
CREATE POLICY "Technicians create posts in assigned truck threads"
  ON truck_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM truck_threads tt
      JOIN truck_assignments ta ON ta.truck_id = tt.truck_id
      WHERE tt.id = truck_posts.thread_id
      AND ta.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Admin/dispatcher can update any post
CREATE POLICY "Admin/dispatcher update posts"
  ON truck_posts FOR UPDATE
  USING (has_elevated_role(auth.uid()));

-- Technicians can update their own posts (for acknowledgment)
CREATE POLICY "Technicians acknowledge own posts"
  ON truck_posts FOR UPDATE
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM truck_threads tt
      JOIN truck_assignments ta ON ta.truck_id = tt.truck_id
      WHERE tt.id = truck_posts.thread_id
      AND ta.user_id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE truck_assignments IS 'Maps technicians to trucks they can access';
COMMENT ON TABLE truck_threads IS 'Communication threads for truck-specific issues';
COMMENT ON TABLE truck_posts IS 'Individual posts within truck threads';
COMMENT ON FUNCTION is_assigned_to_truck IS 'Helper to check truck assignment for RLS';
COMMENT ON FUNCTION has_elevated_role IS 'Helper to check admin/dispatcher role for RLS';

-- Create a view for thread summaries with post counts
CREATE OR REPLACE VIEW truck_thread_summaries AS
SELECT
  tt.id,
  tt.truck_id,
  tt.title,
  tt.status,
  tt.created_by,
  tt.created_at,
  tt.updated_at,
  COUNT(tp.id) AS post_count,
  MAX(tp.created_at) AS last_activity,
  COUNT(CASE WHEN tp.urgent = true AND tp.status = 'open' THEN 1 END) AS urgent_count,
  u.name AS created_by_name
FROM truck_threads tt
LEFT JOIN truck_posts tp ON tp.thread_id = tt.id
LEFT JOIN users u ON u.id = tt.created_by
GROUP BY tt.id, tt.truck_id, tt.title, tt.status, tt.created_by, tt.created_at, tt.updated_at, u.name;

-- Grant access to the view
GRANT SELECT ON truck_thread_summaries TO authenticated;