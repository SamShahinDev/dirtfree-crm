-- ================================================================
-- Enhance Truck Threads for Customer Messaging
-- ================================================================
-- Extends truck_threads system to support customer-staff messaging
-- Makes truck_id optional to allow customer-initiated general threads
-- Adds customer_id, job_id, and message-specific features
-- ================================================================

-- Add customer messaging fields to truck_threads
ALTER TABLE truck_threads
ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS urgent boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS unread_count integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();

-- Make truck_id nullable for customer-initiated threads
ALTER TABLE truck_threads
ALTER COLUMN truck_id DROP NOT NULL;

-- Add check constraint: must have either truck_id or customer_id
ALTER TABLE truck_threads
ADD CONSTRAINT truck_threads_has_context CHECK (
  truck_id IS NOT NULL OR customer_id IS NOT NULL
);

-- Add attachments support to truck_posts
ALTER TABLE truck_posts
ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT ARRAY[]::text[];

-- Update truck_posts kind/type enum to include 'message' and 'reply'
ALTER TABLE truck_posts
DROP CONSTRAINT IF EXISTS truck_posts_kind_check;

ALTER TABLE truck_posts
ADD CONSTRAINT truck_posts_kind_check CHECK (
  kind IN ('need', 'issue', 'note', 'update', 'message', 'reply', 'photo', 'status_change')
);

-- Add author_id field to track who wrote the post (customer vs staff)
ALTER TABLE truck_posts
ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES customers(id) ON DELETE SET NULL;

-- Drop old created_by constraint if it exists and recreate as nullable
ALTER TABLE truck_posts
ALTER COLUMN created_by DROP NOT NULL;

-- Add check: must have either created_by (staff) or author_id (customer)
ALTER TABLE truck_posts
ADD CONSTRAINT truck_posts_has_author CHECK (
  created_by IS NOT NULL OR author_id IS NOT NULL
);

-- Add read tracking to truck_posts
ALTER TABLE truck_posts
ADD COLUMN IF NOT EXISTS read_at timestamptz,
ADD COLUMN IF NOT EXISTS read_by uuid REFERENCES auth.users(id);

-- Create indexes for customer messaging queries
CREATE INDEX IF NOT EXISTS idx_truck_threads_customer_id ON truck_threads(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_truck_threads_job_id ON truck_threads(job_id);
CREATE INDEX IF NOT EXISTS idx_truck_threads_unread ON truck_threads(customer_id, unread_count) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_truck_threads_urgent ON truck_threads(urgent, status) WHERE urgent = true;
CREATE INDEX IF NOT EXISTS idx_truck_posts_author_id ON truck_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_truck_posts_unread ON truck_posts(read_at) WHERE read_at IS NULL;

-- Function to update thread's last_message_at and unread_count
CREATE OR REPLACE FUNCTION update_thread_on_new_post()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_message_at
  UPDATE truck_threads
  SET
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at,
    -- Increment unread_count if post is from staff (created_by) and thread has customer
    unread_count = CASE
      WHEN NEW.created_by IS NOT NULL AND customer_id IS NOT NULL THEN unread_count + 1
      ELSE unread_count
    END
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update thread on new post
DROP TRIGGER IF EXISTS trigger_update_thread_on_new_post ON truck_posts;
CREATE TRIGGER trigger_update_thread_on_new_post
  AFTER INSERT ON truck_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_on_new_post();

-- Function to mark thread messages as read
CREATE OR REPLACE FUNCTION mark_thread_messages_as_read(
  p_thread_id uuid,
  p_user_id uuid
)
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  -- Update posts in thread that haven't been read
  UPDATE truck_posts
  SET
    read_at = now(),
    read_by = p_user_id
  WHERE
    thread_id = p_thread_id
    AND read_at IS NULL
    AND created_by != p_user_id  -- Don't mark own posts as read
    AND author_id IS NULL;  -- Only mark staff posts as read (from customer perspective)

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Reset unread_count for thread
  UPDATE truck_threads
  SET unread_count = 0
  WHERE id = p_thread_id;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for customer access

-- Customers can view their own threads
CREATE POLICY "Customers can view own threads"
  ON truck_threads FOR SELECT
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE email = auth.email()
    )
  );

-- Customers can create threads (for support requests)
CREATE POLICY "Customers can create threads"
  ON truck_threads FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT id FROM customers
      WHERE email = auth.email()
    )
    AND truck_id IS NULL  -- Customers can only create non-truck threads
  );

-- Customers can update their own threads (mark as resolved, etc.)
CREATE POLICY "Customers can update own threads"
  ON truck_threads FOR UPDATE
  USING (
    customer_id IN (
      SELECT id FROM customers
      WHERE email = auth.email()
    )
  );

-- Customers can view posts in their own threads
CREATE POLICY "Customers can view posts in own threads"
  ON truck_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM truck_threads tt
      JOIN customers c ON c.id = tt.customer_id
      WHERE tt.id = truck_posts.thread_id
      AND c.email = auth.email()
    )
  );

-- Customers can create posts in their own threads
CREATE POLICY "Customers can create posts in own threads"
  ON truck_posts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM truck_threads tt
      JOIN customers c ON c.id = tt.customer_id
      WHERE tt.id = truck_posts.thread_id
      AND c.email = auth.email()
    )
    AND author_id IN (
      SELECT id FROM customers
      WHERE email = auth.email()
    )
  );

-- Create view for customer message threads (portal-friendly)
CREATE OR REPLACE VIEW customer_message_threads AS
SELECT
  tt.id,
  tt.customer_id,
  tt.job_id,
  tt.title,
  tt.status,
  tt.urgent,
  tt.unread_count,
  tt.created_at,
  tt.updated_at,
  tt.last_message_at,
  tt.resolved_at,
  COUNT(tp.id) AS message_count,
  MAX(tp.created_at) FILTER (WHERE tp.created_by IS NOT NULL) AS last_staff_reply_at,
  c.name AS customer_name,
  c.email AS customer_email,
  j.scheduled_date AS job_date,
  j.service_type AS job_service_type
FROM truck_threads tt
LEFT JOIN truck_posts tp ON tp.thread_id = tt.id
LEFT JOIN customers c ON c.id = tt.customer_id
LEFT JOIN jobs j ON j.id = tt.job_id
WHERE tt.customer_id IS NOT NULL  -- Only customer threads
GROUP BY tt.id, tt.customer_id, tt.job_id, tt.title, tt.status, tt.urgent,
         tt.unread_count, tt.created_at, tt.updated_at, tt.last_message_at,
         tt.resolved_at, c.name, c.email, j.scheduled_date, j.service_type;

-- Grant access to view
GRANT SELECT ON customer_message_threads TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN truck_threads.customer_id IS 'Customer who owns this thread (for customer support messages)';
COMMENT ON COLUMN truck_threads.job_id IS 'Related job if thread is job-specific';
COMMENT ON COLUMN truck_threads.urgent IS 'Whether thread requires urgent attention';
COMMENT ON COLUMN truck_threads.unread_count IS 'Number of unread staff messages for customer';
COMMENT ON COLUMN truck_threads.last_message_at IS 'Timestamp of last message in thread';
COMMENT ON COLUMN truck_posts.author_id IS 'Customer who authored post (mutually exclusive with created_by)';
COMMENT ON COLUMN truck_posts.image_urls IS 'Array of image attachment URLs';
COMMENT ON COLUMN truck_posts.read_at IS 'When message was marked as read';
COMMENT ON VIEW customer_message_threads IS 'Customer-friendly view of message threads for portal API';
COMMENT ON FUNCTION mark_thread_messages_as_read IS 'Mark all unread messages in a thread as read';
COMMENT ON FUNCTION update_thread_on_new_post IS 'Update thread metadata when new post is added';
