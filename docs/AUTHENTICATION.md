# Authentication & Authorization System

Comprehensive guide to the Role-Based Access Control (RBAC) system for Dirt Free CRM.

## Table of Contents

1. [Overview](#overview)
2. [Roles & Permissions](#roles--permissions)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Database Setup](#database-setup)
6. [API Protection](#api-protection)
7. [UI Protection](#ui-protection)
8. [Examples](#examples)
9. [Migration Guide](#migration-guide)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The authentication system provides:

- **Role-Based Access Control (RBAC)** - 6 predefined roles with specific permissions
- **Permission-Based Authorization** - 36 fine-grained permissions
- **API Middleware** - Protect routes with permission checks
- **UI Components** - Conditionally render based on permissions
- **React Hooks** - Check permissions in components
- **Audit Logging** - Track all authentication events
- **Type Safety** - Full TypeScript support

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Authentication                   │
│                   (Supabase Auth)                        │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Role Assignment                        │
│         (user_profiles.role or user_metadata)           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 Permission Mapping                       │
│           (rolePermissions in rbac.ts)                   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
┌───────────────┐        ┌───────────────┐
│  API Routes   │        │  UI Components │
│  (Middleware) │        │   (Guards)     │
└───────────────┘        └───────────────┘
```

---

## Roles & Permissions

### Available Roles

| Role | Description | Use Case |
|------|-------------|----------|
| **admin** | Full system access (40 permissions) | System administrators |
| **dispatcher** | Manage customers, jobs, opportunities (13 permissions) | Office staff, schedulers |
| **marketing** | Manage promotions, view analytics (8 permissions) | Marketing team |
| **accountant** | Manage invoices, finances (8 permissions) | Accounting team |
| **technician** | View jobs and customers (5 permissions) | Field technicians |
| **viewer** | Read-only access (8 permissions) | External stakeholders, clients |

### Permission Format

Permissions follow the format: `resource:action`

Example: `customers:write`, `invoices:approve`

### Complete Permission List

#### Customer Permissions
- `customers:read` - View customer information
- `customers:write` - Create and edit customers
- `customers:delete` - Delete customers
- `customers:export` - Export customer data

#### Opportunity Permissions
- `opportunities:read` - View opportunities
- `opportunities:write` - Create and edit opportunities
- `opportunities:delete` - Delete opportunities
- `opportunities:approve` - Approve opportunities

#### Promotion Permissions
- `promotions:read` - View promotions
- `promotions:write` - Create and edit promotions
- `promotions:delete` - Delete promotions
- `promotions:approve` - Approve promotions

#### Job Permissions
- `jobs:read` - View jobs
- `jobs:write` - Create and edit jobs
- `jobs:delete` - Delete jobs
- `jobs:assign` - Assign jobs to technicians

#### Invoice Permissions
- `invoices:read` - View invoices
- `invoices:write` - Create and edit invoices
- `invoices:delete` - Delete invoices
- `invoices:approve` - Approve invoices

#### Analytics Permissions
- `analytics:view_all` - View all analytics
- `analytics:view_own` - View own analytics only
- `analytics:export` - Export analytics data

#### Settings Permissions
- `settings:manage` - Manage system settings
- `settings:view` - View system settings

#### User Permissions
- `users:manage` - Manage user accounts
- `users:view` - View user information

#### Report Permissions
- `reports:view` - View reports
- `reports:export` - Export reports

#### System Permissions
- `system:admin` - System administration
- `jobs:manage` - Manage background jobs

### Role Permission Matrix

| Permission | Admin | Dispatcher | Marketing | Accountant | Technician | Viewer |
|------------|-------|------------|-----------|------------|------------|--------|
| customers:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| customers:write | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| customers:delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| opportunities:write | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| promotions:write | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| invoices:approve | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| analytics:view_all | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| settings:manage | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| users:manage | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Backend Setup

### 1. Install Dependencies

Already included in the project:
- `@supabase/supabase-js`
- `@supabase/ssr`

### 2. Environment Variables

Ensure these are set in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
CRON_SECRET=your-cron-secret
```

### 3. File Structure

```
src/
├── lib/
│   └── auth/
│       └── rbac.ts                 # Role & permission definitions
├── middleware/
│   └── api-auth.ts                 # API authentication middleware
└── app/
    └── api/
        └── examples/
            └── auth/               # Example API routes
```

---

## Frontend Setup

### 1. Wrap App with AuthProvider

In your root layout or `_app.tsx`:

```tsx
import { AuthProvider } from '@/components/auth'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

### 2. File Structure

```
src/
└── components/
    └── auth/
        ├── index.ts                # Barrel exports
        ├── PermissionGuard.tsx     # Permission guard components
        ├── useAuth.tsx             # Auth hooks
        └── usePermissions.tsx      # Permission hooks
```

---

## Database Setup

### 1. Run Migrations

```bash
# Apply the RBAC migration
npx supabase db push

# Or if using migration files:
npx supabase migration up
```

The migration creates:
- Updated `user_profiles` table with new roles
- `audit_logs` table for security logging
- Helper functions: `get_user_role()`, `has_permission()`
- RLS policies for audit logs
- Trigger to sync roles to user metadata

### 2. Assign Roles to Users

```sql
-- Option 1: Update user_profiles table
UPDATE user_profiles
SET role = 'admin'
WHERE user_id = 'user-uuid';

-- Option 2: Use the seed file
-- Edit sql/seed_roles.sql and run it
```

### 3. Verify Setup

```sql
-- View all users and their roles
SELECT
  u.email,
  up.role,
  up.display_name
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id;

-- Test permission checking
SELECT has_permission('user-uuid', 'customers:write');
```

---

## API Protection

### Basic Authentication

Require authentication but no specific permissions:

```typescript
import { requireAuth } from '@/middleware/api-auth'

export const GET = requireAuth(async (req, { user }) => {
  // User is authenticated
  return NextResponse.json({ userId: user.id })
})
```

### Single Permission

Require a specific permission:

```typescript
import { withAuth } from '@/middleware/api-auth'

export const POST = withAuth(
  async (req, { user }) => {
    // User has 'customers:write' permission
    const body = await req.json()
    return NextResponse.json({ success: true })
  },
  { requirePermission: 'customers:write' }
)

export const dynamic = 'force-dynamic'
```

### Multiple Permissions (Any)

User must have at least ONE permission:

```typescript
export const POST = withAuth(
  handler,
  {
    requireAnyPermission: [
      'opportunities:write',
      'opportunities:approve'
    ]
  }
)
```

### Multiple Permissions (All)

User must have ALL permissions:

```typescript
export const GET = withAuth(
  handler,
  {
    requireAllPermissions: [
      'customers:read',
      'analytics:view_all'
    ]
  }
)
```

### Admin Only

Require admin role:

```typescript
import { requireAdminAuth } from '@/middleware/api-auth'

export const DELETE = requireAdminAuth(async (req, { user }) => {
  // Only admins can access
  return NextResponse.json({ success: true })
})
```

### Custom Role Check

Use custom logic:

```typescript
export const POST = withAuth(
  handler,
  {
    customRoleCheck: (user) => {
      return user.role === 'admin' || user.role === 'dispatcher'
    },
    errorMessages: {
      forbidden: 'Admin or dispatcher role required'
    }
  }
)
```

### With Audit Logging

Enable audit logging for sensitive operations:

```typescript
export const POST = withAuth(
  handler,
  {
    requirePermission: 'customers:delete',
    enableAuditLog: true
  }
)
```

### Error Responses

**401 Unauthorized** - User not authenticated:
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**403 Forbidden** - Missing permission:
```json
{
  "error": "Forbidden",
  "message": "Permission required: customers:write"
}
```

---

## UI Protection

### Permission Guard Component

Conditionally render based on permission:

```tsx
import { PermissionGuard } from '@/components/auth'

function CustomerPage() {
  return (
    <div>
      <h1>Customers</h1>

      <PermissionGuard permission="customers:write">
        <button>Add Customer</button>
      </PermissionGuard>

      <PermissionGuard
        permission="customers:delete"
        fallback={<p>You cannot delete customers</p>}
      >
        <button>Delete</button>
      </PermissionGuard>
    </div>
  )
}
```

### Multiple Permissions

```tsx
{/* User needs at least ONE permission */}
<PermissionGuard anyPermission={['customers:write', 'customers:delete']}>
  <ActionMenu />
</PermissionGuard>

{/* User needs ALL permissions */}
<PermissionGuard allPermissions={['customers:read', 'analytics:view_all']}>
  <AdvancedAnalytics />
</PermissionGuard>
```

### Role Guard

Render based on role:

```tsx
import { RoleGuard } from '@/components/auth'

<RoleGuard roles={['admin', 'dispatcher']}>
  <ManagementPanel />
</RoleGuard>
```

### Admin Only

```tsx
import { AdminOnly } from '@/components/auth'

<AdminOnly>
  <AdminPanel />
</AdminOnly>
```

### Resource Access

Show content if user has ANY permission for a resource:

```tsx
import { ResourceGuard } from '@/components/auth'

<ResourceGuard resource="customers">
  <CustomerSection />
</ResourceGuard>
```

### Authentication Guards

```tsx
import { AuthenticatedOnly, UnauthenticatedOnly } from '@/components/auth'

{/* Only show to authenticated users */}
<AuthenticatedOnly fallback={<LoginPrompt />}>
  <Dashboard />
</AuthenticatedOnly>

{/* Only show to unauthenticated users */}
<UnauthenticatedOnly>
  <LoginForm />
</UnauthenticatedOnly>
```

### Using Hooks

```tsx
import { usePermissions, useAuth, useRole } from '@/components/auth'

function MyComponent() {
  const { user, isLoading } = useAuth()
  const role = useRole()
  const { can, canAny, canAll } = usePermissions()

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <p>Role: {role}</p>

      {can('customers:write') && <AddButton />}
      {canAny(['customers:write', 'customers:delete']) && <ActionMenu />}
      {canAll(['customers:read', 'analytics:view_all']) && <Analytics />}
    </div>
  )
}
```

### Individual Permission Hooks

```tsx
import {
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions,
  useIsAdmin
} from '@/components/auth'

function Toolbar() {
  const canEdit = useHasPermission('customers:write')
  const canTakeAction = useHasAnyPermission(['customers:write', 'customers:delete'])
  const hasFullAccess = useHasAllPermissions(['customers:read', 'analytics:view_all'])
  const isAdmin = useIsAdmin()

  return (
    <div>
      {canEdit && <EditButton />}
      {canTakeAction && <ActionMenu />}
      {hasFullAccess && <AdvancedFeatures />}
      {isAdmin && <AdminTools />}
    </div>
  )
}
```

---

## Examples

See the `/src/app/api/examples/auth/` directory for complete examples:

1. **Basic Authentication** - `/api/examples/auth/basic`
2. **Single Permission** - `/api/examples/auth/single-permission`
3. **Multiple Permissions (Any)** - `/api/examples/auth/any-permission`
4. **Multiple Permissions (All)** - `/api/examples/auth/all-permissions`
5. **Admin Only** - `/api/examples/auth/admin-only`
6. **Custom Check** - `/api/examples/auth/custom-check`

---

## Migration Guide

### Updating Existing API Routes

**Before:**
```typescript
export async function POST(request: Request) {
  const body = await request.json()
  const result = await createCustomer(body)
  return NextResponse.json(result)
}
```

**After:**
```typescript
import { withAuth } from '@/middleware/api-auth'

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json()
    const result = await createCustomer(body, user.id)
    return NextResponse.json(result)
  },
  { requirePermission: 'customers:write' }
)

export const dynamic = 'force-dynamic'
```

### Updating UI Components

**Before:**
```tsx
function CustomerList() {
  return (
    <div>
      <button>Add Customer</button>
      <button>Delete Customer</button>
    </div>
  )
}
```

**After:**
```tsx
import { PermissionGuard } from '@/components/auth'

function CustomerList() {
  return (
    <div>
      <PermissionGuard permission="customers:write">
        <button>Add Customer</button>
      </PermissionGuard>

      <PermissionGuard permission="customers:delete">
        <button>Delete Customer</button>
      </PermissionGuard>
    </div>
  )
}
```

---

## Best Practices

### 1. Use Specific Permissions

❌ Bad:
```typescript
{ requirePermission: 'admin' }  // No such permission
```

✅ Good:
```typescript
{ requirePermission: 'customers:write' }
```

### 2. Add Audit Logging for Sensitive Operations

```typescript
export const DELETE = withAuth(
  handler,
  {
    requirePermission: 'customers:delete',
    enableAuditLog: true  // ✅ Log deletions
  }
)
```

### 3. Provide Clear Error Messages

```typescript
export const POST = withAuth(
  handler,
  {
    requirePermission: 'settings:manage',
    errorMessages: {
      unauthorized: 'Please log in to continue',
      forbidden: 'Only administrators can modify settings'
    }
  }
)
```

### 4. Always Force Dynamic for Auth Routes

```typescript
export const POST = withAuth(handler, options)

export const dynamic = 'force-dynamic'  // ✅ Important!
```

### 5. Use Fallbacks in UI Guards

```tsx
<PermissionGuard
  permission="customers:write"
  fallback={<p>You don't have permission to edit customers</p>}  // ✅
>
  <EditForm />
</PermissionGuard>
```

### 6. Check Permissions on Both Frontend and Backend

```tsx
{/* Frontend check (UX) */}
<PermissionGuard permission="customers:write">
  <EditButton />
</PermissionGuard>
```

```typescript
// Backend check (Security) ✅
export const POST = withAuth(
  handler,
  { requirePermission: 'customers:write' }
)
```

### 7. Use Type Safety

```typescript
// TypeScript will error if permission doesn't exist
{ requirePermission: 'invalid:permission' }  // ❌ Type error
{ requirePermission: 'customers:write' }     // ✅ Valid
```

---

## Troubleshooting

### User Always Gets 401 Unauthorized

**Check:**
1. Is the user logged in via Supabase Auth?
2. Is the Supabase client configured correctly?
3. Are cookies being sent with the request?

**Solution:**
```typescript
// Verify authentication
const { data: { user } } = await supabase.auth.getUser()
console.log('User:', user)
```

### User Has Wrong Permissions

**Check:**
1. User's role in `user_profiles` table
2. Role permission mapping in `rbac.ts`

**Solution:**
```sql
-- Verify role
SELECT role FROM user_profiles WHERE user_id = 'user-uuid';

-- Update role
UPDATE user_profiles SET role = 'admin' WHERE user_id = 'user-uuid';
```

### Permission Guard Not Working

**Check:**
1. Is the app wrapped with `<AuthProvider>`?
2. Is the permission name correct?

**Solution:**
```tsx
// Wrap app with AuthProvider
<AuthProvider>
  <YourApp />
</AuthProvider>
```

### Audit Logs Not Working

**Check:**
1. Does the `audit_logs` table exist?
2. Is `enableAuditLog: true` set?

**Solution:**
```bash
# Run migration
npx supabase migration up
```

### TypeScript Errors

**Check:**
1. Import from correct paths
2. Use valid Permission types

**Solution:**
```typescript
import { Permission } from '@/lib/auth/rbac'

const permission: Permission = 'customers:write'  // ✅ Type-safe
```

---

## Related Files

- `/src/lib/auth/rbac.ts` - Role and permission definitions
- `/src/middleware/api-auth.ts` - Authentication middleware
- `/src/components/auth/PermissionGuard.tsx` - UI guards
- `/src/components/auth/useAuth.tsx` - Auth hooks
- `/src/components/auth/usePermissions.tsx` - Permission hooks
- `/supabase/migrations/20251024000000_rbac_roles_and_audit.sql` - Database migration
- `/sql/seed_roles.sql` - Role seed data
- `/src/app/api/examples/auth/` - Example API routes

---

## Support

For questions or issues:
1. Check the example files in `/src/app/api/examples/auth/`
2. Review the database migration in `/supabase/migrations/`
3. Refer to the RBAC source code in `/src/lib/auth/rbac.ts`

---

**Last Updated:** 2025-10-24
