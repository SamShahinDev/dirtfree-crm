-- Seed Data: RBAC Role Examples
-- Example role assignments for testing the RBAC system

-- ============================================================================
-- Instructions:
-- ============================================================================
-- 1. Replace the UUIDs below with actual user IDs from your auth.users table
-- 2. Run this script to assign roles to users
-- 3. Users will automatically get permissions based on their role
--
-- To get user IDs:
-- SELECT id, email FROM auth.users;
--
-- ============================================================================

-- ============================================================================
-- Example Role Assignments
-- ============================================================================

-- Assign admin role
-- Full system access
-- UPDATE user_profiles
-- SET role = 'admin'
-- WHERE user_id = 'YOUR-ADMIN-USER-ID';

-- Assign dispatcher role
-- Can manage customers, jobs, and opportunities
-- UPDATE user_profiles
-- SET role = 'dispatcher'
-- WHERE user_id = 'YOUR-DISPATCHER-USER-ID';

-- Assign marketing role
-- Can manage promotions and view analytics
-- UPDATE user_profiles
-- SET role = 'marketing'
-- WHERE user_id = 'YOUR-MARKETING-USER-ID';

-- Assign accountant role
-- Can manage invoices and view financial data
-- UPDATE user_profiles
-- SET role = 'accountant'
-- WHERE user_id = 'YOUR-ACCOUNTANT-USER-ID';

-- Assign technician role
-- Can view jobs and customers (limited access)
-- UPDATE user_profiles
-- SET role = 'technician'
-- WHERE user_id = 'YOUR-TECHNICIAN-USER-ID';

-- Assign viewer role (default, most restrictive)
-- Read-only access to most resources
-- UPDATE user_profiles
-- SET role = 'viewer'
-- WHERE user_id = 'YOUR-VIEWER-USER-ID';

-- ============================================================================
-- Verify Role Assignments
-- ============================================================================

-- View all users and their roles
-- SELECT
--   u.id,
--   u.email,
--   up.role,
--   up.display_name,
--   up.zone
-- FROM auth.users u
-- LEFT JOIN user_profiles up ON up.user_id = u.id
-- ORDER BY up.role, u.email;

-- ============================================================================
-- Test Permission Checking
-- ============================================================================

-- Test if a user has a specific permission
-- SELECT has_permission('YOUR-USER-ID', 'customers:write');

-- Get a user's role
-- SELECT get_user_role('YOUR-USER-ID');

-- ============================================================================
-- Role Permission Summary
-- ============================================================================

/*
ADMIN - Full system access (40 permissions)
  - All permissions across all resources
  - Can manage users and system settings

DISPATCHER - Manage customers, jobs, and opportunities (13 permissions)
  - customers: read, write, export
  - opportunities: read, write
  - jobs: read, write, assign
  - analytics: view_all
  - invoices: read
  - promotions: read
  - reports: view

MARKETING - Manage promotions and analytics (8 permissions)
  - customers: read, export
  - opportunities: read
  - promotions: read, write, delete
  - analytics: view_all, export

ACCOUNTANT - Manage finances (8 permissions)
  - customers: read
  - jobs: read
  - invoices: read, write, approve, delete
  - analytics: view_all
  - reports: view, export

TECHNICIAN - Field work (5 permissions)
  - customers: read
  - opportunities: read
  - jobs: read, write
  - analytics: view_own

VIEWER - Read-only access (8 permissions)
  - customers: read
  - opportunities: read
  - promotions: read
  - jobs: read
  - invoices: read
  - analytics: view_all
  - reports: view
  - settings: view
*/

-- ============================================================================
-- Bulk Role Updates (if needed)
-- ============================================================================

-- Set all users without a role to viewer (default)
-- UPDATE user_profiles
-- SET role = 'viewer'
-- WHERE role IS NULL;

-- Upgrade all technicians to dispatchers (example)
-- UPDATE user_profiles
-- SET role = 'dispatcher'
-- WHERE role = 'technician';

-- ============================================================================
-- Audit Log Examples
-- ============================================================================

-- View recent audit logs
-- SELECT
--   al.timestamp,
--   u.email,
--   al.action,
--   al.resource,
--   al.metadata
-- FROM audit_logs al
-- LEFT JOIN auth.users u ON u.id = al.user_id
-- ORDER BY al.timestamp DESC
-- LIMIT 100;

-- View audit logs for a specific user
-- SELECT
--   timestamp,
--   action,
--   resource,
--   metadata
-- FROM audit_logs
-- WHERE user_id = 'YOUR-USER-ID'
-- ORDER BY timestamp DESC;

-- View audit logs for a specific resource
-- SELECT
--   al.timestamp,
--   u.email,
--   al.action,
--   al.metadata
-- FROM audit_logs al
-- LEFT JOIN auth.users u ON u.id = al.user_id
-- WHERE al.resource LIKE '/api/customers%'
-- ORDER BY al.timestamp DESC;
