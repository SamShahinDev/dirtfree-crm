# Authentication Examples

This directory contains example API routes demonstrating how to use the authentication and authorization middleware.

## Available Examples

### 1. Basic Authentication (`/api/examples/auth/basic`)

Requires authentication but no specific permissions. Any authenticated user can access.

```typescript
import { requireAuth } from '@/middleware/api-auth'

export const GET = requireAuth(async (req, { user }) => {
  // User is authenticated
  return NextResponse.json({ user })
})
```

### 2. Single Permission (`/api/examples/auth/single-permission`)

Requires a specific permission to access.

```typescript
import { withAuth } from '@/middleware/api-auth'

export const POST = withAuth(
  async (req, { user }) => {
    // User has 'customers:write' permission
    return NextResponse.json({ success: true })
  },
  { requirePermission: 'customers:write' }
)
```

### 3. Any Permission (`/api/examples/auth/any-permission`)

Requires at least ONE of the specified permissions.

```typescript
export const POST = withAuth(
  handler,
  {
    requireAnyPermission: ['opportunities:write', 'opportunities:approve']
  }
)
```

### 4. All Permissions (`/api/examples/auth/all-permissions`)

Requires ALL of the specified permissions.

```typescript
export const GET = withAuth(
  handler,
  {
    requireAllPermissions: ['customers:read', 'analytics:view_all']
  }
)
```

### 5. Admin Only (`/api/examples/auth/admin-only`)

Requires admin role.

```typescript
import { requireAdminAuth } from '@/middleware/api-auth'

export const DELETE = requireAdminAuth(async (req, { user }) => {
  // Only admins can access
  return NextResponse.json({ success: true })
})
```

### 6. Custom Check (`/api/examples/auth/custom-check`)

Uses custom role checking logic with audit logging.

```typescript
export const POST = withAuth(
  handler,
  {
    customRoleCheck: (user) => {
      return user.role === 'admin' || user.role === 'dispatcher'
    },
    enableAuditLog: true,
    errorMessages: {
      forbidden: 'This action requires admin or dispatcher role'
    }
  }
)
```

## Converting Existing Routes

### Before (No Auth)

```typescript
export async function POST(request: Request) {
  const body = await request.json()

  // Process request
  const result = await createCustomer(body)

  return NextResponse.json(result)
}
```

### After (With Auth)

```typescript
import { withAuth } from '@/middleware/api-auth'

export const POST = withAuth(
  async (req, { user }) => {
    const body = await req.json()

    // User is authenticated and has required permission
    const result = await createCustomer(body, user.id)

    return NextResponse.json(result)
  },
  { requirePermission: 'customers:write' }
)

export const dynamic = 'force-dynamic'
```

## Error Responses

### 401 Unauthorized
User is not authenticated.

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
User is authenticated but lacks required permissions.

```json
{
  "error": "Forbidden",
  "message": "Permission required: customers:write"
}
```

## Available Permissions

See `/src/lib/auth/rbac.ts` for the complete list of permissions and role mappings.

Common permissions:
- `customers:read` - View customer information
- `customers:write` - Create and edit customers
- `customers:delete` - Delete customers
- `opportunities:read` - View opportunities
- `opportunities:write` - Create and edit opportunities
- `opportunities:approve` - Approve opportunities
- `analytics:view_all` - View all analytics
- `settings:manage` - Manage system settings
- `users:manage` - Manage users

## Testing

You can test these endpoints using:

### cURL

```bash
# Get auth token first (from Supabase)
TOKEN="your-supabase-jwt-token"

# Test basic auth
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/examples/auth/basic

# Test permission check
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe"}' \
  http://localhost:3000/api/examples/auth/single-permission
```

### Postman

1. Set Authorization type to "Bearer Token"
2. Add your Supabase JWT token
3. Make requests to the example endpoints

## Best Practices

1. **Always use the middleware** - Don't manually check permissions in route handlers
2. **Use specific permissions** - Prefer `customers:write` over broader permissions
3. **Add audit logging** - For sensitive operations, enable `enableAuditLog: true`
4. **Custom error messages** - Provide clear error messages for better UX
5. **Type safety** - TypeScript will ensure you use valid permissions
6. **Force dynamic** - Add `export const dynamic = 'force-dynamic'` for auth routes

## Migration Guide

1. Import the middleware: `import { withAuth } from '@/middleware/api-auth'`
2. Wrap your handler with `withAuth()`
3. Add permission requirements in options
4. Update handler signature to receive `{ user, params }`
5. Add `export const dynamic = 'force-dynamic'`

## Related Files

- `/src/lib/auth/rbac.ts` - Role and permission definitions
- `/src/middleware/api-auth.ts` - Authentication middleware
- `/src/components/auth/PermissionGuard.tsx` - Client-side permission guards
- `/src/components/auth/usePermissions.tsx` - Permission hooks
