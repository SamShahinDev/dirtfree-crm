-- Vehicle Board Database Tables
-- Run this script in your Supabase SQL editor to create the required tables
--
-- IMPORTANT NOTES:
-- 1. This script assumes you are using Supabase Auth (not a separate users table)
-- 2. User IDs are stored as UUIDs that reference auth.users.id
-- 3. RLS policies expect JWT metadata to include a 'role' claim
-- 4. Make sure your app authentication sets user roles in JWT metadata
-- 5. RLS policies use simplified access control (no truck_assignments table required)
-- 6. Technicians can access all threads/posts; implement app-level restrictions if needed

-- Create truck_threads table
CREATE TABLE IF NOT EXISTS truck_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Create truck_posts table
CREATE TABLE IF NOT EXISTS truck_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES truck_threads(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('need', 'issue', 'note', 'update')),
  body TEXT NOT NULL,
  photo_key VARCHAR(255),
  image_urls JSONB,
  urgent BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  reminder_id UUID REFERENCES reminders(id)
);

-- Create view for thread summaries
CREATE OR REPLACE VIEW truck_thread_summaries AS
SELECT
  t.id,
  t.truck_id,
  t.title,
  t.status,
  t.created_by,
  NULL as created_by_name,
  t.created_at,
  t.updated_at,
  GREATEST(t.updated_at, COALESCE(MAX(p.updated_at), t.updated_at)) as last_activity,
  COUNT(p.id) as post_count,
  COUNT(CASE WHEN p.urgent = true AND p.status != 'resolved' THEN 1 END) as urgent_count
FROM truck_threads t
LEFT JOIN truck_posts p ON t.id = p.thread_id
GROUP BY t.id, t.truck_id, t.title, t.status, t.created_by, t.created_at, t.updated_at;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_truck_threads_truck_id ON truck_threads(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_threads_status ON truck_threads(status);
CREATE INDEX IF NOT EXISTS idx_truck_threads_created_by ON truck_threads(created_by);

CREATE INDEX IF NOT EXISTS idx_truck_posts_thread_id ON truck_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_truck_posts_status ON truck_posts(status);
CREATE INDEX IF NOT EXISTS idx_truck_posts_urgent ON truck_posts(urgent);
CREATE INDEX IF NOT EXISTS idx_truck_posts_created_by ON truck_posts(created_by);

-- Update function for truck_threads updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic updated_at handling
DROP TRIGGER IF EXISTS update_truck_threads_updated_at ON truck_threads;
CREATE TRIGGER update_truck_threads_updated_at
    BEFORE UPDATE ON truck_threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_truck_posts_updated_at ON truck_posts;
CREATE TRIGGER update_truck_posts_updated_at
    BEFORE UPDATE ON truck_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Set up Row Level Security (RLS)
-- Note: These policies assume you have user roles stored in JWT metadata
-- Make sure your application sets the 'role' claim in the JWT when authenticating users
ALTER TABLE truck_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_posts ENABLE ROW LEVEL SECURITY;

-- RLS policies for truck_threads (simplified - no truck_assignments table required)
CREATE POLICY "Users can view threads" ON truck_threads
  FOR SELECT USING (
    -- Admin and dispatcher can see all
    auth.jwt() ->> 'role' IN ('admin', 'dispatcher') OR
    -- Authenticated technicians can see all threads (simplified access)
    (auth.jwt() ->> 'role' = 'technician' AND auth.uid() IS NOT NULL)
  );

CREATE POLICY "Users can create threads" ON truck_threads
  FOR INSERT WITH CHECK (
    -- Admin and dispatcher can create for any truck
    auth.jwt() ->> 'role' IN ('admin', 'dispatcher') OR
    -- Authenticated technicians can create threads (simplified access)
    (auth.jwt() ->> 'role' = 'technician' AND auth.uid() IS NOT NULL)
  );

CREATE POLICY "Users can update threads" ON truck_threads
  FOR UPDATE USING (
    -- Admin and dispatcher can update any
    auth.jwt() ->> 'role' IN ('admin', 'dispatcher') OR
    -- Technicians can update threads they created
    (auth.jwt() ->> 'role' = 'technician' AND created_by = auth.uid())
  );

-- RLS policies for truck_posts (simplified - no truck_assignments table required)
CREATE POLICY "Users can view posts" ON truck_posts
  FOR SELECT USING (
    -- Admin and dispatcher can see all posts
    auth.jwt() ->> 'role' IN ('admin', 'dispatcher') OR
    -- Authenticated technicians can see all posts (simplified access)
    (auth.jwt() ->> 'role' = 'technician' AND auth.uid() IS NOT NULL)
  );

CREATE POLICY "Users can create posts" ON truck_posts
  FOR INSERT WITH CHECK (
    -- Admin and dispatcher can create posts on any thread
    auth.jwt() ->> 'role' IN ('admin', 'dispatcher') OR
    -- Authenticated technicians can create posts (simplified access)
    (auth.jwt() ->> 'role' = 'technician' AND auth.uid() IS NOT NULL)
  );

CREATE POLICY "Users can update posts" ON truck_posts
  FOR UPDATE USING (
    -- Admin and dispatcher can update any post
    auth.jwt() ->> 'role' IN ('admin', 'dispatcher') OR
    -- Technicians can update posts they created
    (auth.jwt() ->> 'role' = 'technician' AND created_by = auth.uid())
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON truck_threads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON truck_posts TO anon, authenticated;
GRANT SELECT ON truck_thread_summaries TO anon, authenticated;

-- Sample data (optional - remove if not needed)
-- This creates a sample thread for testing
-- Note: You'll need to replace 'your-user-id-here' with an actual user ID from auth.users
/*
INSERT INTO truck_threads (truck_id, title, created_by, status)
SELECT
  t.id,
  'Sample Vehicle Board Thread',
  'your-user-id-here'::uuid,
  'open'
FROM trucks t
LIMIT 1;

INSERT INTO truck_posts (thread_id, kind, body, urgent, created_by, status)
SELECT
  t.id,
  'note',
  'This is a sample post to test the Vehicle Board functionality.',
  false,
  'your-user-id-here'::uuid,
  'open'
FROM truck_threads t
WHERE t.title = 'Sample Vehicle Board Thread'
LIMIT 1;
*/