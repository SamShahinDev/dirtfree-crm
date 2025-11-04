#!/bin/bash

# Production Backup Script for Dirt Free CRM
# Exports database and storage manifests for disaster recovery
# Usage: ./scripts/backup_prod.sh

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DATE=$(date +%F)
BACKUP_TIME=$(date +%H%M%S)
BACKUP_DIR="$PROJECT_ROOT/backups/$BACKUP_DATE"
LOG_FILE="$BACKUP_DIR/backup_$BACKUP_TIME.log"

# Required environment variables
REQUIRED_VARS=(
    "PROD_PROJECT_REF"
    "PROD_DB_URL"
    "SUPABASE_ACCESS_TOKEN"
)

# Storage buckets to backup (manifests only)
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
        log_error "Backup failed with exit code $exit_code"
        log_error "Check logs at: $LOG_FILE"
    fi
    # Clean up any temporary files
    rm -f /tmp/storage_manifest_*.json 2>/dev/null || true
    exit $exit_code
}

trap cleanup EXIT

# Validate environment
validate_environment() {
    log_info "Validating environment variables and dependencies"

    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done

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

    # Test database connectivity
    if ! pg_isready -d "$PROD_DB_URL" &> /dev/null; then
        log_error "Cannot connect to production database"
        exit 1
    fi

    log_info "Environment validation completed"
}

# Create backup directory structure
setup_backup_directory() {
    log_info "Setting up backup directory: $BACKUP_DIR"

    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/database"
    mkdir -p "$BACKUP_DIR/storage"
    mkdir -p "$BACKUP_DIR/metadata"

    # Create backup metadata
    cat > "$BACKUP_DIR/metadata/backup_info.json" << EOF
{
    "backup_date": "$BACKUP_DATE",
    "backup_time": "$BACKUP_TIME",
    "script_version": "1.0",
    "project_ref": "$PROD_PROJECT_REF",
    "database_url_host": "$(echo "$PROD_DB_URL" | sed 's|.*@\([^/]*\)/.*|\1|')",
    "buckets": [$(printf '"%s",' "${STORAGE_BUCKETS[@]}" | sed 's/,$//')],
    "created_by": "backup_prod.sh",
    "retention_days": 7
}
EOF

    log_info "Backup directory structure created"
}

# Backup database
backup_database() {
    log_info "Starting database backup"

    local dump_file="$BACKUP_DIR/database/prod_dump_$BACKUP_TIME.sql"
    local start_time=$(date +%s)

    # Use pg_dump with optimized settings for large databases
    if pg_dump \
        --dbname="$PROD_DB_URL" \
        --file="$dump_file" \
        --format=custom \
        --compress=9 \
        --no-owner \
        --no-privileges \
        --verbose \
        2>> "$LOG_FILE"; then

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        local file_size=$(du -h "$dump_file" | cut -f1)

        log_info "Database backup completed in ${duration}s, size: $file_size"

        # Verify backup integrity
        if pg_restore --list "$dump_file" &> /dev/null; then
            log_info "Backup integrity verified"
        else
            log_error "Backup integrity check failed"
            return 1
        fi

        # Store backup metadata
        cat > "$BACKUP_DIR/metadata/database_info.json" << EOF
{
    "dump_file": "database/prod_dump_$BACKUP_TIME.sql",
    "format": "custom",
    "compression": 9,
    "size_bytes": $(stat -f%z "$dump_file" 2>/dev/null || stat -c%s "$dump_file"),
    "size_human": "$file_size",
    "duration_seconds": $duration,
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "pg_dump_version": "$(pg_dump --version | head -n1)"
}
EOF

    else
        log_error "Database backup failed"
        return 1
    fi
}

# Backup storage manifests
backup_storage_manifests() {
    log_info "Starting storage manifests backup"

    local total_objects=0
    local total_size=0

    for bucket in "${STORAGE_BUCKETS[@]}"; do
        log_info "Backing up manifest for bucket: $bucket"

        local manifest_file="$BACKUP_DIR/storage/${bucket}_manifest_$BACKUP_TIME.json"
        local temp_file="/tmp/storage_manifest_${bucket}.json"

        # Get bucket objects via Supabase CLI
        if supabase storage ls --project-ref "$PROD_PROJECT_REF" "$bucket" --format json > "$temp_file" 2>> "$LOG_FILE"; then

            # Process and enhance manifest
            local bucket_objects=$(jq length "$temp_file")
            local bucket_size=$(jq '[.[] | .metadata.size // 0] | add' "$temp_file")

            # Create enhanced manifest with metadata
            jq --arg bucket "$bucket" \
               --arg date "$BACKUP_DATE" \
               --arg time "$BACKUP_TIME" \
               --argjson object_count "$bucket_objects" \
               --argjson total_size "$bucket_size" \
               '{
                   bucket: $bucket,
                   backup_date: $date,
                   backup_time: $time,
                   object_count: $object_count,
                   total_size_bytes: $total_size,
                   objects: .
               }' "$temp_file" > "$manifest_file"

            total_objects=$((total_objects + bucket_objects))
            total_size=$((total_size + bucket_size))

            log_info "Bucket $bucket: $bucket_objects objects, $(numfmt --to=iec $bucket_size) total"

        else
            log_warn "Failed to backup manifest for bucket: $bucket"
            # Create empty manifest to maintain consistency
            cat > "$manifest_file" << EOF
{
    "bucket": "$bucket",
    "backup_date": "$BACKUP_DATE",
    "backup_time": "$BACKUP_TIME",
    "object_count": 0,
    "total_size_bytes": 0,
    "error": "Failed to retrieve bucket contents",
    "objects": []
}
EOF
        fi

        rm -f "$temp_file"
    done

    # Create storage summary
    cat > "$BACKUP_DIR/metadata/storage_info.json" << EOF
{
    "total_objects": $total_objects,
    "total_size_bytes": $total_size,
    "total_size_human": "$(numfmt --to=iec $total_size)",
    "bucket_count": ${#STORAGE_BUCKETS[@]},
    "buckets": [$(printf '"%s",' "${STORAGE_BUCKETS[@]}" | sed 's/,$//')],
    "backup_type": "manifest_only",
    "note": "File contents not backed up, only metadata for structure recreation"
}
EOF

    log_info "Storage manifests backup completed: $total_objects objects, $(numfmt --to=iec $total_size) total"
}

# Validate backup completeness
validate_backup() {
    log_info "Validating backup completeness"

    local errors=0

    # Check database dump exists and has content
    local dump_file="$BACKUP_DIR/database/prod_dump_$BACKUP_TIME.sql"
    if [ ! -f "$dump_file" ] || [ ! -s "$dump_file" ]; then
        log_error "Database dump missing or empty"
        errors=$((errors + 1))
    else
        local dump_size=$(stat -f%z "$dump_file" 2>/dev/null || stat -c%s "$dump_file")
        if [ "$dump_size" -lt 1048576 ]; then  # Less than 1MB
            log_warn "Database dump size seems small: $(numfmt --to=iec $dump_size)"
        fi
    fi

    # Check storage manifests
    for bucket in "${STORAGE_BUCKETS[@]}"; do
        local manifest_file="$BACKUP_DIR/storage/${bucket}_manifest_$BACKUP_TIME.json"
        if [ ! -f "$manifest_file" ]; then
            log_error "Storage manifest missing for bucket: $bucket"
            errors=$((errors + 1))
        elif ! jq empty "$manifest_file" 2>/dev/null; then
            log_error "Invalid JSON in manifest for bucket: $bucket"
            errors=$((errors + 1))
        fi
    done

    # Check metadata files
    local metadata_files=("backup_info.json" "database_info.json" "storage_info.json")
    for file in "${metadata_files[@]}"; do
        if [ ! -f "$BACKUP_DIR/metadata/$file" ]; then
            log_error "Metadata file missing: $file"
            errors=$((errors + 1))
        fi
    done

    if [ $errors -eq 0 ]; then
        log_info "Backup validation passed"
        return 0
    else
        log_error "Backup validation failed with $errors errors"
        return 1
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: 7 days)"

    local backup_root="$PROJECT_ROOT/backups"
    local cutoff_date=$(date -d '7 days ago' +%F 2>/dev/null || date -v-7d +%F)

    if [ -d "$backup_root" ]; then
        find "$backup_root" -maxdepth 1 -type d -name "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]" | while read -r backup_dir; do
            local backup_name=$(basename "$backup_dir")
            if [[ "$backup_name" < "$cutoff_date" ]]; then
                log_info "Removing old backup: $backup_name"
                rm -rf "$backup_dir"
            fi
        done
    fi
}

# Generate backup summary
generate_summary() {
    log_info "Generating backup summary"

    local backup_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')

    cat > "$BACKUP_DIR/BACKUP_SUMMARY.txt" << EOF
Dirt Free CRM - Production Backup Summary
=========================================

Backup Date: $BACKUP_DATE
Backup Time: $BACKUP_TIME
Completion Time: $end_time
Backup Directory: $BACKUP_DIR
Total Size: $backup_size

Components Backed Up:
- Database: PostgreSQL dump (custom format, compressed)
- Storage: Manifests for buckets: ${STORAGE_BUCKETS[*]}
- Metadata: Backup information and validation data

Files Created:
$(find "$BACKUP_DIR" -type f | sed "s|$BACKUP_DIR/||" | sort)

Verification:
- Database dump integrity: $(pg_restore --list "$BACKUP_DIR/database/prod_dump_$BACKUP_TIME.sql" &>/dev/null && echo "PASSED" || echo "FAILED")
- Manifest JSON validity: PASSED
- Required files present: PASSED

Next Steps:
1. Verify backup in staging: make restore-staging
2. Run smoke tests: make smoke
3. Archive backup if needed

For restore procedures, see: docs/dr-runbook.md
EOF

    log_info "Backup summary generated: $BACKUP_DIR/BACKUP_SUMMARY.txt"

    # Display summary
    echo
    echo "=== BACKUP COMPLETED SUCCESSFULLY ==="
    echo "Location: $BACKUP_DIR"
    echo "Size: $backup_size"
    echo "Duration: $(($(date +%s) - $(date -d "$BACKUP_DATE $BACKUP_TIME" +%s 2>/dev/null || echo 0))) seconds"
    echo "Summary: $BACKUP_DIR/BACKUP_SUMMARY.txt"
    echo
}

# Main execution
main() {
    log_info "Starting production backup for Dirt Free CRM"
    log_info "Backup date: $BACKUP_DATE, time: $BACKUP_TIME"

    validate_environment
    setup_backup_directory
    backup_database
    backup_storage_manifests
    validate_backup
    cleanup_old_backups
    generate_summary

    log_info "Production backup completed successfully"
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi