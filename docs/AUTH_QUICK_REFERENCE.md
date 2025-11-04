# Authentication Quick Reference

Fast reference guide for common authentication and authorization tasks.

## Table of Contents

- [Roles](#roles)
- [Common Permissions](#common-permissions)
- [API Routes](#api-routes)
- [UI Components](#ui-components)
- [React Hooks](#react-hooks)
- [Database](#database)

---

## Roles

| Role | Permissions Count | Common Use |
|------|-------------------|------------|
| admin | 40 | System administrators |
| dispatcher | 13 | Office staff |
| marketing | 8 | Marketing team |
| accountant | 8 | Finance team |
| technician | 5 | Field workers |
| viewer | 8 | Read-only users |

---

## Common Permissions

```typescript
// Customer
'customers:read'
'customers:write'
'customers:delete'

// Jobs
'jobs:read'
'jobs:write'
'jobs:assign'

// Opportunities
'opportunities:read'
'opportunities:write'
'opportunities:approve'

// Invoices
'invoices:read'
'invoices:write'
'invoices:approve'

// Analytics
'analytics:view_all'
'analytics:view_own'

// Settings
'settings:manage'
'users:manage'
```

---

## API Routes

### Basic Auth (Any User)

```typescript
import { requireAuth } from '@/middleware/api-auth'

export const GET = requireAuth(async (req, { user }) => {
  return NextResponse.json({ user })
})
```

### Single Permission

```typescript
import { withAuth } from '@/middleware/api-auth'

export const POST = withAuth(
  async (req, { user }) => {
    // Handler
  },
  { requirePermission: 'customers:write' }
)

export const dynamic = 'force-dynamic'
```

### Any Permission (OR)

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

### All Permissions (AND)

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

```typescript
import { requireAdminAuth } from '@/middleware/api-auth'

export const DELETE = requireAdminAuth(async (req, { user }) => {
  // Handler
})
```

### With Audit Logging

```typescript
export const POST = withAuth(
  handler,
  {
    requirePermission: 'customers:delete',
    enableAuditLog: true
  }
)
```

---

## UI Components

### Permission Guard

```tsx
import { PermissionGuard } from '@/components/auth'

{/* Single permission */}
<PermissionGuard permission="customers:write">
  <EditButton />
</PermissionGuard>

{/* With fallback */}
<PermissionGuard
  permission="customers:write"
  fallback={<p>Access denied</p>}
>
  <EditButton />
</PermissionGuard>

{/* Any permission (OR) */}
<PermissionGuard anyPermission={['customers:write', 'customers:delete']}>
  <ActionMenu />
</PermissionGuard>

{/* All permissions (AND) */}
<PermissionGuard allPermissions={['customers:read', 'analytics:view_all']}>
  <Analytics />
</PermissionGuard>
```

### Role Guard

```tsx
import { RoleGuard, AdminOnly } from '@/components/auth'

{/* Specific roles */}
<RoleGuard roles={['admin', 'dispatcher']}>
  <ManagementPanel />
</RoleGuard>

{/* Admin only */}
<AdminOnly>
  <AdminPanel />
</AdminOnly>
```

### Resource Guard

```tsx
import { ResourceGuard } from '@/components/auth'

<ResourceGuard resource="customers">
  <CustomerSection />
</ResourceGuard>
```

### Auth Status Guards

```tsx
import { AuthenticatedOnly, UnauthenticatedOnly } from '@/components/auth'

{/* Authenticated users only */}
<AuthenticatedOnly fallback={<LoginPrompt />}>
  <Dashboard />
</AuthenticatedOnly>

{/* Unauthenticated users only */}
<UnauthenticatedOnly>
  <LoginForm />
</UnauthenticatedOnly>
```

---

## React Hooks

### useAuth

```tsx
import { useAuth } from '@/components/auth'

function MyComponent() {
  const { user, isLoading, isAuthenticated, signOut } = useAuth()

  if (isLoading) return <div>Loading...</div>
  if (!isAuthenticated) return <div>Please log in</div>

  return (
    <div>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

### usePermissions

```tsx
import { usePermissions } from '@/components/auth'

function Toolbar() {
  const { can, canAny, canAll, canAccess } = usePermissions()

  return (
    <div>
      {can('customers:write') && <EditButton />}
      {canAny(['customers:write', 'customers:delete']) && <ActionMenu />}
      {canAll(['customers:read', 'analytics:view_all']) && <Analytics />}
      {canAccess('customers') && <CustomerLink />}
    </div>
  )
}
```

### Individual Hooks

```tsx
import {
  useUser,
  useRole,
  useIsAdmin,
  useHasRole,
  useHasPermission,
  useHasAnyPermission,
  useHasAllPermissions
} from '@/components/auth'

function MyComponent() {
  const user = useUser()
  const role = useRole()
  const isAdmin = useIsAdmin()
  const canManage = useHasRole(['admin', 'dispatcher'])
  const canEdit = useHasPermission('customers:write')
  const canTakeAction = useHasAnyPermission(['customers:write', 'customers:delete'])
  const hasFullAccess = useHasAllPermissions(['customers:read', 'analytics:view_all'])

  // Use the hooks...
}
```

---

## Database

### Assign Role

```sql
-- Update user role
UPDATE user_profiles
SET role = 'admin'
WHERE user_id = 'user-uuid';
```

### Check User Role

```sql
-- Get user role
SELECT role
FROM user_profiles
WHERE user_id = 'user-uuid';

-- Or use helper function
SELECT get_user_role('user-uuid');
```

### Check Permission

```sql
-- Check if user has permission
SELECT has_permission('user-uuid', 'customers:write');
```

### View All Users & Roles

```sql
SELECT
  u.email,
  up.role,
  up.display_name,
  up.zone
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
ORDER BY up.role, u.email;
```

### View Audit Logs

```sql
-- Recent audit logs
SELECT
  al.timestamp,
  u.email,
  al.action,
  al.resource,
  al.metadata
FROM audit_logs al
LEFT JOIN auth.users u ON u.id = al.user_id
ORDER BY al.timestamp DESC
LIMIT 100;

-- Audit logs for specific user
SELECT *
FROM audit_logs
WHERE user_id = 'user-uuid'
ORDER BY timestamp DESC;
```

### Log Audit Event

```sql
-- Manually log an event
SELECT log_audit_event(
  'user-uuid',           -- user_id
  'POST',                -- action
  '/api/customers',      -- resource
  '{"name": "John"}'::jsonb,  -- metadata
  '192.168.1.1'::inet,   -- ip_address
  'Mozilla/5.0...'       -- user_agent
);
```

---

## Cheat Sheet

### API Route Template

```typescript
import { withAuth } from '@/middleware/api-auth'
import { NextResponse } from 'next/server'

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json()

    // Your logic here
    // user.id and user.role are available

    return NextResponse.json({ success: true })
  },
  {
    requirePermission: 'customers:write',
    enableAuditLog: true,
    errorMessages: {
      unauthorized: 'Please log in',
      forbidden: 'Permission denied'
    }
  }
)

export const dynamic = 'force-dynamic'
```

### Component Template

```tsx
import { PermissionGuard, usePermissions } from '@/components/auth'

function MyComponent() {
  const { can } = usePermissions()

  return (
    <div>
      {/* Conditional rendering with hook */}
      {can('customers:write') && <EditButton />}

      {/* Conditional rendering with component */}
      <PermissionGuard permission="customers:write">
        <EditButton />
      </PermissionGuard>
    </div>
  )
}
```

### Root Layout Setup

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

---

## Common Patterns

### Protect Admin Route

```typescript
import { requireAdminAuth } from '@/middleware/api-auth'

export const POST = requireAdminAuth(async (req, { user }) => {
  // Only admins can access
})
```

### Show/Hide Based on Role

```tsx
import { useRole } from '@/components/auth'

function Navigation() {
  const role = useRole()

  return (
    <nav>
      <Link href="/">Home</Link>
      {role === 'admin' && <Link href="/admin">Admin</Link>}
      {['admin', 'dispatcher'].includes(role) && (
        <Link href="/management">Management</Link>
      )}
    </nav>
  )
}
```

### Multi-Level Permission Check

```tsx
import { usePermissions } from '@/components/auth'

function CustomerActions() {
  const { can } = usePermissions()

  const canEdit = can('customers:write')
  const canDelete = can('customers:delete')
  const canExport = can('customers:export')

  return (
    <div>
      {canEdit && <button>Edit</button>}
      {canDelete && <button>Delete</button>}
      {canExport && <button>Export</button>}
    </div>
  )
}
```

### Error Handling

```typescript
export const POST = withAuth(
  async (req, { user }) => {
    try {
      // Your logic
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Error:', error)
      return NextResponse.json(
        { error: 'Failed to process request' },
        { status: 500 }
      )
    }
  },
  { requirePermission: 'customers:write' }
)
```

---

## Testing

### Test API Endpoint with cURL

```bash
# Get auth token from Supabase
TOKEN="your-jwt-token"

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/examples/auth/basic

# Test with permission check
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}' \
  http://localhost:3000/api/examples/auth/single-permission
```

### Test in Browser Console

```javascript
// Get current user
const { data: { user } } = await supabase.auth.getUser()
console.log('User:', user)

// Test API call
const response = await fetch('/api/examples/auth/basic', {
  headers: {
    'Authorization': `Bearer ${user.access_token}`
  }
})
const data = await response.json()
console.log('Response:', data)
```

---

## Migration Checklist

- [ ] Run database migration: `npx supabase migration up`
- [ ] Assign roles to users in `user_profiles` table
- [ ] Wrap app with `<AuthProvider>`
- [ ] Update API routes with `withAuth()`
- [ ] Add `export const dynamic = 'force-dynamic'`
- [ ] Add permission guards to UI components
- [ ] Test permissions for each role
- [ ] Enable audit logging for sensitive operations
- [ ] Update RLS policies if needed
- [ ] Document custom permissions if added

---

**See also:** [Full Documentation](./AUTHENTICATION.md)
