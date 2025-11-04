-- ==============================================================================
-- Enable Supabase Realtime for Customer Portal
-- ==============================================================================
--
-- This migration enables real-time subscriptions for tables that need to sync
-- between the CRM and Customer Portal.
--
-- Run this in Supabase SQL Editor or via migration
--

-- ==============================================================================
-- Enable Realtime Publication for Tables
-- ==============================================================================

-- Customers table - for profile updates
ALTER PUBLICATION supabase_realtime ADD TABLE customers;

-- Jobs table - for appointment updates
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;

-- Invoices table - for billing updates
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;

-- Messages table - for instant messaging
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Loyalty transactions table - for points updates
ALTER PUBLICATION supabase_realtime ADD TABLE loyalty_transactions;

-- Notifications table - for system notifications (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ==============================================================================
-- Ensure Row Level Security (RLS) is Enabled
-- ==============================================================================

-- Enable RLS on all tables if not already enabled
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- RLS Policies for Realtime (Portal Users)
-- ==============================================================================

-- Customers: Portal users can only see their own data
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "portal_users_select_own_data" ON customers;

CREATE POLICY "portal_users_select_own_data" ON customers
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text IN (
      SELECT portal_user_id::text FROM customers WHERE id = customers.id
    )
  );

-- Jobs: Portal users can only see their own jobs
DROP POLICY IF EXISTS "portal_users_select_own_jobs" ON jobs;

CREATE POLICY "portal_users_select_own_jobs" ON jobs
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE portal_user_id = auth.uid()
    )
  );

-- Invoices: Portal users can only see their own invoices
DROP POLICY IF EXISTS "portal_users_select_own_invoices" ON invoices;

CREATE POLICY "portal_users_select_own_invoices" ON invoices
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE portal_user_id = auth.uid()
    )
  );

-- Messages: Portal users can only see messages for them
DROP POLICY IF EXISTS "portal_users_select_own_messages" ON messages;

CREATE POLICY "portal_users_select_own_messages" ON messages
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE portal_user_id = auth.uid()
    )
  );

-- Loyalty Transactions: Portal users can only see their own transactions
DROP POLICY IF EXISTS "portal_users_select_own_loyalty" ON loyalty_transactions;

CREATE POLICY "portal_users_select_own_loyalty" ON loyalty_transactions
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM customers WHERE portal_user_id = auth.uid()
    )
  );

-- ==============================================================================
-- Optional: Enable Realtime for Additional Tables
-- ==============================================================================

-- If you want to add more tables to realtime in the future, use:
-- ALTER PUBLICATION supabase_realtime ADD TABLE your_table_name;

-- ==============================================================================
-- Verification Queries
-- ==============================================================================

-- Run these to verify realtime is enabled:

-- Check which tables have realtime enabled
SELECT
  schemaname,
  tablename
FROM
  pg_publication_tables
WHERE
  pubname = 'supabase_realtime'
ORDER BY
  schemaname,
  tablename;

-- Check RLS policies for portal users
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM
  pg_policies
WHERE
  schemaname = 'public'
  AND policyname LIKE '%portal%'
ORDER BY
  tablename,
  policyname;

-- ==============================================================================
-- Troubleshooting
-- ==============================================================================

-- If realtime is not working, check:
--
-- 1. Is the table in the publication?
--    SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
--
-- 2. Is RLS enabled?
--    SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--
-- 3. Do portal users have SELECT permission?
--    SELECT grantee, table_name, privilege_type
--    FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND grantee = 'authenticated';
--
-- 4. Are there any RLS policies blocking access?
--    SELECT * FROM pg_policies WHERE schemaname = 'public';

-- ==============================================================================
-- Performance Considerations
-- ==============================================================================

-- Realtime uses Postgres logical replication, which has some overhead.
-- Consider these best practices:
--
-- 1. Only enable realtime on tables that actually need it
-- 2. Use filters in subscriptions to reduce data transfer
-- 3. Monitor Supabase realtime connections in dashboard
-- 4. Consider using presence/broadcast for ephemeral data
-- 5. Implement reconnection logic in client code

-- ==============================================================================
-- Security Notes
-- ==============================================================================

-- IMPORTANT: Realtime respects RLS policies!
--
-- - Portal users can only receive updates for data they have SELECT permission for
-- - Always test RLS policies before enabling realtime in production
-- - Use filters in subscriptions to further limit data exposure
-- - Monitor subscription patterns for unusual activity

-- ==============================================================================
-- Rollback (if needed)
-- ==============================================================================

-- To disable realtime for a table:
-- ALTER PUBLICATION supabase_realtime DROP TABLE table_name;

-- To remove RLS policies:
-- DROP POLICY "policy_name" ON table_name;
