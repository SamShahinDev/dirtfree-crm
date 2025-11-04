# Fix Jobs Relationship Error

## Problem
The `/jobs` page is throwing this error:
```
Failed to fetch jobs: Could not find a relationship between 'jobs' and 'user_profiles' in the schema cache
```

## Root Cause
In `src/app/(dashboard)/jobs/actions.ts`, the `listJobs` function (line ~69) is trying to use a foreign key relationship that doesn't exist:

```typescript
technician:user_profiles!jobs_technician_id_fkey(
  id,
  display_name
)
```

The database schema shows:
- `jobs.technician_id` → references `auth.users.id` (NOT user_profiles)
- `user_profiles.user_id` → references `auth.users.id`
- There is NO direct foreign key between `jobs` and `user_profiles`

## Solution
Use the **two-step query pattern** that's already working in `src/app/(dashboard)/schedule/actions.ts` (see the `listJobEvents` function around line 132).

## Tasks

### 1. Fix `listJobs` function
In `src/app/(dashboard)/jobs/actions.ts` (starting around line 69):

**Remove the incorrect join:**
```typescript
technician:user_profiles!jobs_technician_id_fkey(
  id,
  display_name
)
```

**Replace with two-step query pattern:**
1. Query jobs with customers only (remove technician join)
2. Collect unique technician IDs from results
3. Separately query user_profiles for those IDs
4. Create a technicianMap
5. Merge technician data back into the job rows

**Reference the working pattern from `schedule/actions.ts` lines 132-196** - copy that exact pattern.

### 2. Fix `getJob` function  
In the same file, around line 314, the `getJob` function has the same issue:

```typescript
technician:user_profiles!jobs_technician_id_fkey(
  id,
  display_name,
  phone_e164,
  zone
)
```

Apply the same two-step pattern here.

### 3. Check other functions
Search the entire `actions.ts` file for any other occurrences of `user_profiles!jobs_technician_id_fkey` and fix them using the same pattern.

### 4. Update TypeScript types
The response types already expect the technician structure, so those should be fine. Just ensure the merged data matches the expected shape:
```typescript
technician?: {
  id: string
  display_name?: string | null
}
```

## Expected Result
After the fix:
- Jobs page loads without errors
- Customer names display correctly
- Technician names appear for assigned jobs
- All filters and pagination work
- The query follows the proven pattern from schedule/actions.ts

## Key Pattern to Follow
Look at `src/app/(dashboard)/schedule/actions.ts` line 132-196 for the exact working implementation of this pattern. Copy that approach.
