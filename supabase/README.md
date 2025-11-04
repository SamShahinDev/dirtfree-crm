# Dirt Free CRM Database Migrations

This directory contains SQL migrations for the Dirt Free CRM Supabase database schema.

## Prerequisites

Before applying migrations, ensure your Supabase project has the following extensions enabled:

- `uuid-ossp` - For UUID generation
- `pg_trgm` - For trigram similarity search

These can be enabled in the Supabase Dashboard under Database > Extensions.

## Migration Files

The migrations are numbered sequentially and should be applied in order:

1. **20250918000000_000_init_extensions.sql** - Extensions and shared functions
2. **20250918000001_010_core_tables.sql** - All business tables with constraints
3. **20250918000002_020_indexes.sql** - Performance indexes including trigram search
4. **20250918000003_030_rls_policies.sql** - Row Level Security policies
5. **20250918000004_040_seeds.sql** - Initial seed data (trucks, sample customers)

## How to Apply

### Using Supabase CLI (Recommended)

```bash
# Apply all pending migrations
supabase db push

# Or apply migrations individually
supabase migration up
```

### Generate TypeScript Types

After applying migrations, update your TypeScript types:

```bash
# Generate types from your local database
supabase gen types typescript --local > src/types/supabase.ts

# Or from remote (if using hosted Supabase)
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
```

## Security Model

The database implements comprehensive Row Level Security (RLS):

### Role Hierarchy
- **Admin**: Full access to all data including audit logs
- **Dispatcher**: Full access except audit log reads (admin-only)
- **Technician**: Scoped access to assigned jobs and related data only

### Key Security Features
- All tables have RLS enabled
- Technicians can only see customers they have jobs with
- Audit logs are admin-read-only but all users can insert (for action logging)
- Phone numbers enforced as E.164 format (+1...)
- Comprehensive audit trail for all actions

## Data Model Highlights

### Core Entities
- **user_profiles** - Extends auth.users with role and zone
- **customers** - Customer data with address search optimization
- **jobs** - Service appointments with technician assignments
- **service_history** - Completed service records
- **reminders** - Task reminders and follow-ups
- **trucks** - Fleet vehicles with tool inventory
- **audit_log** - Complete action audit trail

### Search Capabilities
- Fast address search using trigram similarity
- Phone number lookup optimization
- Name-based customer search

## Seeded Data

The migrations include initial seed data:
- 3 trucks: Alpha (01), Bravo (02), Charlie (03)
- Basic tool inventory for each truck
- Sample customers and reminders (remove in production)

## Troubleshooting

### Common Issues

1. **Extensions not enabled**: Enable `uuid-ossp` and `pg_trgm` in Supabase Dashboard
2. **Permission errors**: Ensure your database user has sufficient privileges
3. **Type generation fails**: Check your Supabase project connection and authentication

### Verification Commands

```sql
-- Check if extensions are enabled
SELECT * FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm');

-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;

-- Check seed data
SELECT number, name FROM trucks ORDER BY number;
```

## Development Notes

- All tables include `created_at` and `updated_at` timestamps
- Updated timestamps are automatically managed via triggers
- Foreign key relationships use appropriate CASCADE/SET NULL strategies
- Indexes are optimized for common query patterns
- Phone numbers must be stored in E.164 format when provided

For questions or issues, refer to the main project documentation or Supabase documentation.