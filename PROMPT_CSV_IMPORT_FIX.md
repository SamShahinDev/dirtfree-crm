# Fix CSV Import RLS Policy Error

## Problem
When importing customers via CSV, getting this error:
```
Database error - new row violates row-level security policy for table "customers"
```

## Root Cause
In `src/app/api/customers/import/route.ts`, the import is using `getServerSupabase()` which creates a client that respects RLS policies. 

The RLS policy in `supabase/migrations/20250918000003_030_rls_policies.sql` (line ~89) requires:
```sql
create policy "customers_insert" on customers for insert with check (
  exists (
    select 1 from v_current_user_role r
    where r.role in ('admin', 'dispatcher')
  )
);
```

However, the API route does NOT verify user permissions before attempting the insert.

## Solution
The import route needs to:
1. Verify the user is authenticated
2. Check the user has 'admin' or 'dispatcher' role
3. Use the service role client to bypass RLS for bulk inserts (after permission check)

## Tasks

### 1. Add permission check at the start of the route
In `src/app/api/customers/import/route.ts`, after line 62 (`const supabase = await getServerSupabase()`):

```typescript
// Check authentication
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError || !user) {
  return NextResponse.json(
    { error: 'Unauthorized - authentication required' },
    { status: 401 }
  )
}

// Check role permission (must be dispatcher or admin)
const { data: userProfile, error: profileError } = await supabase
  .from('user_profiles')
  .select('role')
  .eq('user_id', user.id)
  .single()

if (profileError || !userProfile) {
  return NextResponse.json(
    { error: 'Unable to verify user permissions' },
    { status: 403 }
  )
}

if (!['admin', 'dispatcher'].includes(userProfile.role)) {
  return NextResponse.json(
    { error: 'Forbidden - dispatcher or admin role required' },
    { status: 403 }
  )
}
```

### 2. Use service role client for inserts
After the permission check, replace the insert section (around line 157) to use service role:

```typescript
// Batch insert customers using service role to bypass RLS
// (permissions already verified above)
if (customersToInsert.length > 0) {
  const batchSize = 100
  for (let i = 0; i < customersToInsert.length; i += batchSize) {
    const batch = customersToInsert.slice(i, i + batchSize)

    // Use service role client for the insert to bypass RLS
    const { error } = await supabase
      .from('customers')
      .insert(batch)

    if (error) {
      result.errors += batch.length
      result.details.push(`Batch ${Math.floor(i / batchSize) + 1}: Database error - ${error.message}`)
    } else {
      result.imported += batch.length
    }
  }
}
```

**Note:** If `getServerSupabase()` doesn't support service role, you may need to create a separate function like `getServiceRoleSupabase()` in `/src/lib/supabase/server.ts` using:
```typescript
createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key
  { auth: { persistSession: false } }
)
```

### 3. Add audit log entry
After successful import (line ~180), log the import action:

```typescript
// Log the import action
if (result.imported > 0) {
  await supabase
    .from('audit_log')
    .insert({
      actor_id: user.id,
      action: 'BULK_IMPORT',
      entity: 'customer',
      entity_id: null,
      meta: {
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
        filename: file.name
      }
    })
}
```

## Alternative Solution (Simpler)
If service role is too complex, you can modify the RLS policy to allow inserts through a specific condition. However, the permission check + service role approach is more secure and follows best practices.

## Expected Result
After the fix:
- User authentication and role are verified before import
- Only admin/dispatcher users can import
- CSV import completes successfully
- Import action is logged in audit_log
- Clear error messages for unauthorized access

## Files to Modify
1. `src/app/api/customers/import/route.ts` - Add auth check and use service role
2. Possibly `src/lib/supabase/server.ts` - Add service role client function if needed
