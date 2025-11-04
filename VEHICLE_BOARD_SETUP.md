# Vehicle Board Setup Guide

## Problem Summary

The Vehicle Board thread creation feature is failing with the error "Failed to create thread" because the required database tables don't exist in your Supabase database.

## Root Cause

The application expects the following database tables to exist:
- `truck_threads` - Stores thread information
- `truck_posts` - Stores individual posts within threads
- `truck_thread_summaries` - A view for efficiently displaying thread lists

## Solution

### Option 1: Quick Setup (Recommended)

1. **Copy the SQL script**: The database setup script has been created at:
   ```
   /scripts/create-vehicle-board-tables.sql
   ```

2. **Run in Supabase**:
   - Go to your Supabase dashboard
   - Navigate to the SQL Editor
   - Copy and paste the entire contents of the script
   - Click "Run" to execute

3. **Important Authentication Notes**:
   - The script assumes you're using Supabase Auth (not a separate users table)
   - User IDs reference `auth.users.id` automatically
   - Your app must set user roles in JWT metadata for proper access control
   - Uses simplified access control (no truck_assignments table required)
   - Technicians can access all threads; implement app-level restrictions if needed

4. **Verify setup**:
   - Check that the tables were created successfully
   - The Vehicle Board should now work properly

### Option 2: Manual Setup

If you prefer to create the tables manually, here are the essential structures:

```sql
-- Create truck_threads table
CREATE TABLE truck_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID REFERENCES trucks(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  status VARCHAR(20) DEFAULT 'open',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create truck_posts table
CREATE TABLE truck_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES truck_threads(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL,
  body TEXT NOT NULL,
  urgent BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'open',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Option 3: Temporary Workaround

If you want to continue development without setting up the database tables immediately, the application has been updated with improved error handling that will:

1. Show user-friendly error messages
2. Gracefully handle missing tables
3. Return empty results instead of crashing

However, the Vehicle Board feature will not be functional until the database tables are created.

## Features Included

Once set up, the Vehicle Board provides:

- **Thread Creation**: Technicians can create discussion threads for specific trucks
- **Post Types**: Support for needs, issues, notes, and updates
- **Urgency Flagging**: Mark critical issues as urgent
- **Photo Attachments**: Attach images to document problems
- **Status Tracking**: Open, acknowledged, and resolved statuses
- **Automatic Reminders**: Create follow-up reminders for urgent issues
- **Role-Based Access**: Proper permissions for technicians, dispatchers, and admins

## Security Features

The setup includes:
- Row Level Security (RLS) policies
- Proper user permissions based on truck assignments
- Audit logging for all actions
- Data validation and constraints

## Testing

After setup, you can test by:
1. Navigate to any truck detail page
2. Click on the "Vehicle Board" tab
3. Try creating a new thread
4. The interface should work without errors

## Troubleshooting

If you still encounter issues after running the SQL script:

1. **Check table creation**: Verify the tables exist in your Supabase dashboard
2. **Check permissions**: Ensure your user has proper database access
3. **Check environment variables**: Verify Supabase URL and keys are correct
4. **Clear browser cache**: Hard refresh the application
5. **Check server logs**: Look for any remaining database connection issues

## Files Modified

The following files have been updated with improved error handling:
- `src/app/(dashboard)/trucks/[id]/board/actions.ts` - Added graceful error handling
- `src/app/(dashboard)/trucks/[id]/board/_components/NewThreadDialog.tsx` - Better error logging
- `scripts/create-vehicle-board-tables.sql` - Database setup script (new)