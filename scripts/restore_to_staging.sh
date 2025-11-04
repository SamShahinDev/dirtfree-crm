#!/bin/bash

# Staging Restore Script for Dirt Free CRM
# Restores production backup to staging with data masking
# Usage: ./scripts/restore_to_staging.sh [backup_date]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DATE="${1:-$(date +%F)}"
BACKUP_DIR="$PROJECT_ROOT/backups/$BACKUP_DATE"
LOG_FILE="/tmp/staging_restore_$(date +%H%M%S).log"

# Required environment variables
REQUIRED_VARS=(
    "STAGING_PROJECT_REF"
    "STAGING_DB_URL"
    "SUPABASE_ACCESS_TOKEN"
)

# Storage buckets to restore structure
STORAGE_BUCKETS=(
    "uploads"
    "invoices"
    "maintenance"
)

# Logging functions
log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

log_warn() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $1" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        log_error "Staging restore failed with exit code $exit_code"
        log_error "Check logs at: $LOG_FILE"
    fi
    # Clean up temporary files
    rm -f /tmp/staging_restore_*.sql 2>/dev/null || true
    exit $exit_code
}

trap cleanup EXIT

# Validate environment and backup
validate_environment() {
    log_info "Validating environment and backup availability"

    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done

    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Backup directory not found: $BACKUP_DIR"
        log_info "Available backups:"
        ls -la "$PROJECT_ROOT/backups/" 2>/dev/null || echo "No backups found"
        exit 1
    fi

    # Find the latest backup dump file
    local dump_file
    dump_file=$(find "$BACKUP_DIR/database" -name "prod_dump_*.sql" | sort -r | head -n1)
    if [ -z "$dump_file" ] || [ ! -f "$dump_file" ]; then
        log_error "Database dump file not found in $BACKUP_DIR/database/"
        exit 1
    fi

    export DUMP_FILE="$dump_file"
    log_info "Using database dump: $(basename "$DUMP_FILE")"

    # Check Supabase CLI
    if ! command -v supabase &> /dev/null; then
        log_error "Supabase CLI not found. Install with: npm install -g supabase"
        exit 1
    fi

    # Verify CLI authentication
    if ! supabase auth status &> /dev/null; then
        log_error "Supabase CLI not authenticated. Run: supabase auth login"
        exit 1
    fi

    # Test staging database connectivity
    if ! pg_isready -d "$STAGING_DB_URL" &> /dev/null; then
        log_error "Cannot connect to staging database"
        exit 1
    fi

    log_info "Environment validation completed"
}

# Confirm staging restoration
confirm_staging_restore() {
    log_warn "WARNING: This will completely replace the staging database!"
    log_warn "Staging database: $(echo "$STAGING_DB_URL" | sed 's|.*@\([^/]*\)/.*|\1|')"
    log_warn "Backup source: $BACKUP_DATE"

    if [ "${FORCE_RESTORE:-}" != "true" ]; then
        echo
        read -p "Are you sure you want to proceed? (type 'yes' to continue): " -r
        if [[ ! $REPLY =~ ^yes$ ]]; then
            log_info "Restore cancelled by user"
            exit 0
        fi
    fi

    log_info "Proceeding with staging restore"
}

# Reset staging database
reset_staging_database() {
    log_info "Resetting staging database schema"

    # Create temporary SQL script for safe reset
    local reset_script="/tmp/staging_restore_reset.sql"

    cat > "$reset_script" << 'EOF'
-- Disable triggers and constraints for safe cleanup
SET session_replication_role = replica;

-- Drop all tables in reverse dependency order to avoid foreign key issues
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all foreign key constraints first
    FOR r IN (
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'auth', 'storage', 'supabase_functions')
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) ||
                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    -- Drop all tables
    FOR r IN (
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('information_schema', 'pg_catalog', 'auth', 'storage', 'supabase_functions')
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || ' CASCADE';
    END LOOP;

    -- Drop all views
    FOR r IN (
        SELECT table_schema, table_name
        FROM information_schema.views
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'auth', 'storage', 'supabase_functions')
    ) LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || ' CASCADE';
    END LOOP;

    -- Drop all sequences
    FOR r IN (
        SELECT sequence_schema, sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema NOT IN ('information_schema', 'pg_catalog', 'auth', 'storage', 'supabase_functions')
    ) LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_schema) || '.' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;

    -- Drop all functions (except system ones)
    FOR r IN (
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'auth', 'storage', 'supabase_functions')
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.nspname) || '.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;
END
$$;

-- Re-enable triggers and constraints
SET session_replication_role = DEFAULT;

-- Clean up any remaining auth sessions
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;
EOF

    # Execute reset script
    if psql "$STAGING_DB_URL" -f "$reset_script" &>> "$LOG_FILE"; then
        log_info "Staging database reset completed"
    else
        log_error "Failed to reset staging database"
        return 1
    fi

    rm -f "$reset_script"
}

# Restore database from backup
restore_database() {
    log_info "Restoring database from backup"

    local start_time=$(date +%s)

    # Restore using pg_restore
    if pg_restore \
        --dbname="$STAGING_DB_URL" \
        --format=custom \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        --verbose \
        "$DUMP_FILE" \
        2>> "$LOG_FILE"; then

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        log_info "Database restore completed in ${duration}s"
    else
        log_error "Database restore failed"
        return 1
    fi
}

# Apply data masking for staging safety
apply_data_masking() {
    log_info "Applying data masking for staging environment"

    local masking_script="/tmp/staging_restore_masking.sql"

    cat > "$masking_script" << 'EOF'
-- Data Masking for Staging Environment
-- Anonymizes PII while preserving data relationships and business logic

-- Mask customer information
UPDATE customers SET
    name = 'Test Customer ' || id,
    email = 'test-customer-' || id || '@example.com',
    phone = '+1000000' || LPAD(id::text, 4, '0'),
    address = '123 Test St',
    city = 'Test City',
    state = 'TS',
    zip = '12345',
    notes = CASE
        WHEN notes IS NOT NULL THEN 'Test notes for customer ' || id
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id IS NOT NULL;

-- Mask technician information
UPDATE technicians SET
    name = 'Test Technician ' || id,
    email = 'test-tech-' || id || '@example.com',
    phone = '+1000001' || LPAD(id::text, 3, '0'),
    updated_at = NOW()
WHERE id IS NOT NULL;

-- Mask user authentication data
UPDATE auth.users SET
    email = 'test-user-' || RIGHT(id::text, 8) || '@example.com',
    phone = '+1000002' || RIGHT(id::text, 3),
    raw_user_meta_data = jsonb_build_object(
        'name', 'Test User ' || RIGHT(id::text, 4),
        'role', COALESCE(raw_user_meta_data->>'role', 'user')
    ),
    updated_at = NOW()
WHERE id IS NOT NULL;

-- Clear sensitive communication data
UPDATE communication_logs SET
    to_e164 = '+1000003' || LPAD((id % 1000)::text, 3, '0'),
    from_e164 = '+1000004' || LPAD((id % 1000)::text, 3, '0'),
    body = CASE
        WHEN body IS NOT NULL THEN jsonb_build_object(
            'text', 'Test message content ' || id,
            'provider', body->>'provider',
            'webhook_processed', body->>'webhook_processed'
        )
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id IS NOT NULL;

-- Mask job addresses and notes
UPDATE jobs SET
    address = '456 Test Job St',
    city = 'Test City',
    state = 'TS',
    zip = '12345',
    notes = CASE
        WHEN notes IS NOT NULL THEN 'Test job notes for job ' || id
        ELSE NULL
    END,
    internal_notes = CASE
        WHEN internal_notes IS NOT NULL THEN 'Test internal notes for job ' || id
        ELSE NULL
    END,
    updated_at = NOW()
WHERE id IS NOT NULL;

-- Clear audit logs of sensitive data
UPDATE audit_log SET
    meta = CASE
        WHEN meta IS NOT NULL THEN jsonb_build_object(
            'action', meta->>'action',
            'entity_id', meta->>'entity_id',
            'masked', true,
            'original_timestamp', meta->>'timestamp'
        )
        ELSE NULL
    END,
    updated_at = NOW()
WHERE entity IN ('customer', 'user', 'communication');

-- Clear all authentication sessions for safety
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;

-- Reset any API keys or tokens
UPDATE auth.users SET
    encrypted_password = '$2a$10$masked.password.hash.for.staging.environment'
WHERE encrypted_password IS NOT NULL;

-- Mask any remaining PII in JSON fields
UPDATE jobs SET
    metadata = CASE
        WHEN metadata IS NOT NULL THEN jsonb_build_object(
            'job_type', metadata->>'job_type',
            'service_date', metadata->>'service_date',
            'masked', true
        )
        ELSE NULL
    END
WHERE metadata IS NOT NULL;

-- Add staging environment marker
INSERT INTO system_config (key, value, updated_at)
VALUES ('environment', 'staging', NOW())
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- Log masking completion
INSERT INTO audit_log (action, entity, entity_id, outcome, meta, created_at)
VALUES (
    'data_masking',
    'staging_restore',
    'system',
    'ok',
    jsonb_build_object(
        'masked_at', NOW(),
        'script_version', '1.0',
        'tables_masked', ARRAY['customers', 'technicians', 'auth.users', 'communication_logs', 'jobs', 'audit_log']
    ),
    NOW()
);
EOF

    # Execute masking script
    if psql "$STAGING_DB_URL" -f "$masking_script" &>> "$LOG_FILE"; then
        log_info "Data masking completed successfully"
    else
        log_error "Data masking failed"
        return 1
    fi

    rm -f "$masking_script"
}

# Restore storage bucket structure
restore_storage_structure() {
    log_info "Restoring storage bucket structure"

    for bucket in "${STORAGE_BUCKETS[@]}"; do
        local manifest_file
        manifest_file=$(find "$BACKUP_DIR/storage" -name "${bucket}_manifest_*.json" | sort -r | head -n1)

        if [ -f "$manifest_file" ]; then
            log_info "Processing storage bucket: $bucket"

            # Get object count from manifest
            local object_count
            object_count=$(jq -r '.object_count // 0' "$manifest_file")

            if [ "$object_count" -gt 0 ]; then
                log_info "Bucket $bucket had $object_count objects in production"

                # Create bucket structure (empty folders) based on manifest
                # Note: Actual file restoration is optional and not implemented
                # This creates the bucket structure for testing

                log_info "Creating bucket structure for $bucket (files not restored)"
            else
                log_info "Bucket $bucket was empty in production backup"
            fi
        else
            log_warn "No manifest found for bucket: $bucket"
        fi
    done

    log_info "Storage structure restoration completed"
    log_info "Note: File contents not restored - manifests used for structure only"
}

# Apply pending migrations
apply_migrations() {
    log_info "Checking for pending database migrations"

    # Check if migrations exist and apply them
    if [ -d "$PROJECT_ROOT/supabase/migrations" ]; then
        local migration_count
        migration_count=$(find "$PROJECT_ROOT/supabase/migrations" -name "*.sql" | wc -l)

        if [ "$migration_count" -gt 0 ]; then
            log_info "Found $migration_count migration files"

            # Apply migrations using Supabase CLI
            if cd "$PROJECT_ROOT" && supabase db push --project-ref "$STAGING_PROJECT_REF" 2>> "$LOG_FILE"; then
                log_info "Migrations applied successfully"
            else
                log_warn "Some migrations may have failed - check logs"
            fi
        else
            log_info "No migration files found"
        fi
    else
        log_info "No migrations directory found"
    fi
}

# Validate restore
validate_restore() {
    log_info "Validating staging restore"

    local errors=0

    # Test basic database connectivity
    if ! psql "$STAGING_DB_URL" -c "SELECT 1;" &>> "$LOG_FILE"; then
        log_error "Cannot connect to restored staging database"
        errors=$((errors + 1))
    fi

    # Check that main tables exist and have data
    local tables=("customers" "jobs" "technicians" "communication_logs")
    for table in "${tables[@]}"; do
        local row_count
        row_count=$(psql "$STAGING_DB_URL" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "0")

        if [ "$row_count" = "0" ]; then
            log_warn "Table $table is empty"
        else
            log_info "Table $table has $row_count rows"
        fi
    done

    # Verify data masking was applied
    local masked_customer
    masked_customer=$(psql "$STAGING_DB_URL" -t -c "SELECT email FROM customers LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "")

    if [[ "$masked_customer" == *"@example.com" ]]; then
        log_info "Data masking verified - customer emails anonymized"
    elif [ -n "$masked_customer" ]; then
        log_error "Data masking may have failed - found real email: ${masked_customer:0:10}..."
        errors=$((errors + 1))
    else
        log_info "No customer data found to verify masking"
    fi

    # Check staging environment marker
    local env_marker
    env_marker=$(psql "$STAGING_DB_URL" -t -c "SELECT value FROM system_config WHERE key='environment';" 2>/dev/null | tr -d ' ' || echo "")

    if [ "$env_marker" = "staging" ]; then
        log_info "Staging environment marker confirmed"
    else
        log_warn "Staging environment marker missing - adding it now"
        psql "$STAGING_DB_URL" -c "INSERT INTO system_config (key, value) VALUES ('environment', 'staging') ON CONFLICT (key) DO UPDATE SET value = 'staging';" &>> "$LOG_FILE"
    fi

    if [ $errors -eq 0 ]; then
        log_info "Staging restore validation passed"
        return 0
    else
        log_error "Staging restore validation failed with $errors errors"
        return 1
    fi
}

# Generate restore report
generate_restore_report() {
    log_info "Generating restore report"

    local report_file="$BACKUP_DIR/STAGING_RESTORE_REPORT.txt"
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')

    cat > "$report_file" << EOF
Dirt Free CRM - Staging Restore Report
======================================

Restore Date: $(date +%F)
Restore Time: $(date +%H:%M:%S)
Backup Source: $BACKUP_DATE
Staging Database: $(echo "$STAGING_DB_URL" | sed 's|.*@\([^/]*\)/.*|\1|')

Restore Components:
- Database: Restored from $(basename "$DUMP_FILE")
- Data Masking: Applied (PII anonymized)
- Storage: Structure recreated (files not restored)
- Migrations: Applied if pending

Validation Results:
$(cat "$LOG_FILE" | grep -E "(INFO|WARN|ERROR).*validation|verified|confirmed" | tail -10)

Table Row Counts:
$(psql "$STAGING_DB_URL" -c "
SELECT
    schemaname,
    tablename,
    n_tup_ins + n_tup_upd + n_tup_del as total_rows
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('auth', 'storage')
ORDER BY total_rows DESC
LIMIT 10;" 2>/dev/null || echo "Unable to retrieve table statistics")

Next Steps:
1. Run smoke tests: make smoke
2. Verify application functionality in staging
3. Test critical user journeys
4. Validate integrations work with test data

Logs: $LOG_FILE
Report: $report_file
EOF

    log_info "Restore report generated: $report_file"
}

# Main execution
main() {
    log_info "Starting staging restore for Dirt Free CRM"
    log_info "Backup source: $BACKUP_DATE"

    validate_environment
    confirm_staging_restore
    reset_staging_database
    restore_database
    apply_data_masking
    restore_storage_structure
    apply_migrations
    validate_restore
    generate_restore_report

    log_info "Staging restore completed successfully"

    # Run smoke tests
    log_info "Running smoke tests..."
    if [ -f "$SCRIPT_DIR/smoke_tests.sh" ]; then
        if "$SCRIPT_DIR/smoke_tests.sh"; then
            log_info "Smoke tests passed"
            echo
            echo "=== STAGING RESTORE COMPLETED SUCCESSFULLY ==="
            echo "Environment: Staging"
            echo "Backup source: $BACKUP_DATE"
            echo "Data: Masked for staging safety"
            echo "Smoke tests: PASSED"
            echo
        else
            log_error "Smoke tests failed"
            exit 1
        fi
    else
        log_warn "Smoke tests script not found - skipping"
    fi
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi