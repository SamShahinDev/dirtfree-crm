#!/bin/bash

# =====================================================
# Database Optimization Script
# =====================================================
# This script runs database migrations and verifies
# performance improvements.
#
# Usage:
#   ./scripts/optimize-database.sh
#
# Requirements:
#   - psql command-line tool
#   - DATABASE_URL environment variable set
# =====================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check for psql
    if ! command -v psql &> /dev/null; then
        print_error "psql command not found. Please install PostgreSQL client tools."
        exit 1
    fi
    print_success "psql found"

    # Check for DATABASE_URL
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable not set"
        echo "Please set DATABASE_URL to your Supabase database connection string"
        echo "Example: export DATABASE_URL='postgresql://user:pass@host:5432/database'"
        exit 1
    fi
    print_success "DATABASE_URL configured"
}

# Backup current index state
backup_indexes() {
    print_header "Backing Up Current Index State"

    psql "$DATABASE_URL" -c "
        SELECT
            schemaname,
            tablename,
            indexname,
            pg_size_pretty(pg_relation_size(indexrelid)) as size
        INTO TEMP TABLE index_backup_$(date +%Y%m%d)
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public';
    " > /dev/null

    print_success "Index state backed up"
}

# Run performance indexes migration
run_performance_migration() {
    print_header "Running Performance Indexes Migration"

    echo "Applying 16-performance-indexes.sql..."

    psql "$DATABASE_URL" -f sql/16-performance-indexes.sql

    print_success "Performance indexes created"
}

# Run query analyzer migration
run_analyzer_migration() {
    print_header "Running Query Analyzer Migration"

    echo "Applying 17-query-analyzer-schema.sql..."

    psql "$DATABASE_URL" -f sql/17-query-analyzer-schema.sql

    print_success "Query analyzer infrastructure created"
}

# Verify indexes were created
verify_indexes() {
    print_header "Verifying Index Creation"

    local index_count=$(psql "$DATABASE_URL" -t -c "
        SELECT COUNT(*)
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND indexrelname LIKE 'idx_%';
    " | tr -d ' ')

    echo "Total indexes created: $index_count"

    # List new indexes
    echo -e "\nNew indexes:"
    psql "$DATABASE_URL" -c "
        SELECT
            tablename,
            indexname,
            pg_size_pretty(pg_relation_size(indexrelid)) as size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND indexrelname LIKE 'idx_%'
        ORDER BY tablename, indexname;
    "

    print_success "Index verification complete"
}

# Check query analyzer setup
verify_analyzer() {
    print_header "Verifying Query Analyzer Setup"

    # Check slow_query_log table
    local table_exists=$(psql "$DATABASE_URL" -t -c "
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'slow_query_log'
        );
    " | tr -d ' ')

    if [ "$table_exists" = "t" ]; then
        print_success "slow_query_log table created"
    else
        print_error "slow_query_log table not found"
    fi

    # Check functions
    echo -e "\nVerifying functions:"
    local functions=(
        "get_index_usage_stats"
        "find_unused_indexes"
        "get_table_bloat_stats"
        "get_slow_query_summary"
        "get_top_slow_queries"
        "cleanup_old_slow_query_logs"
    )

    for func in "${functions[@]}"; do
        local func_exists=$(psql "$DATABASE_URL" -t -c "
            SELECT EXISTS (
                SELECT FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public'
                AND p.proname = '$func'
            );
        " | tr -d ' ')

        if [ "$func_exists" = "t" ]; then
            print_success "$func() created"
        else
            print_warning "$func() not found"
        fi
    done

    # Check views
    echo -e "\nVerifying views:"
    local views=(
        "recent_slow_queries"
        "slow_queries_by_endpoint"
        "slow_query_trends"
    )

    for view in "${views[@]}"; do
        local view_exists=$(psql "$DATABASE_URL" -t -c "
            SELECT EXISTS (
                SELECT FROM information_schema.views
                WHERE table_schema = 'public'
                AND table_name = '$view'
            );
        " | tr -d ' ')

        if [ "$view_exists" = "t" ]; then
            print_success "$view created"
        else
            print_warning "$view not found"
        fi
    done
}

# Performance benchmark
run_benchmark() {
    print_header "Running Performance Benchmark"

    echo "Testing query performance..."

    # Test customer query
    echo -e "\n1. Customer list query:"
    psql "$DATABASE_URL" -c "
        EXPLAIN ANALYZE
        SELECT *
        FROM customers
        WHERE deleted != true
        ORDER BY created_at DESC
        LIMIT 100;
    " | grep "Execution Time"

    # Test job query
    echo -e "\n2. Jobs by customer query:"
    psql "$DATABASE_URL" -c "
        EXPLAIN ANALYZE
        SELECT j.*, c.name
        FROM jobs j
        JOIN customers c ON c.id = j.customer_id
        WHERE j.status = 'scheduled'
        ORDER BY j.scheduled_date
        LIMIT 100;
    " | grep "Execution Time"

    # Test invoice query
    echo -e "\n3. Pending invoices query:"
    psql "$DATABASE_URL" -c "
        EXPLAIN ANALYZE
        SELECT *
        FROM invoices
        WHERE status = 'pending'
        ORDER BY due_date
        LIMIT 100;
    " | grep "Execution Time"

    print_success "Benchmark complete"
}

# Generate performance report
generate_report() {
    print_header "Generating Performance Report"

    # Table sizes
    echo "Table sizes with indexes:"
    psql "$DATABASE_URL" -c "
        SELECT
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
            pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
            pg_size_pretty(
                pg_total_relation_size(schemaname||'.'||tablename) -
                pg_relation_size(schemaname||'.'||tablename)
            ) AS indexes_size,
            ROUND(
                ((pg_total_relation_size(schemaname||'.'||tablename)::numeric -
                  pg_relation_size(schemaname||'.'||tablename)::numeric) /
                  NULLIF(pg_total_relation_size(schemaname||'.'||tablename), 0)) * 100,
                2
            ) AS index_ratio
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 15;
    "

    # Index usage statistics
    echo -e "\nTop 10 most-used indexes:"
    psql "$DATABASE_URL" -c "
        SELECT * FROM get_index_usage_stats()
        LIMIT 10;
    "

    print_success "Report generated"
}

# Cleanup and optimization
cleanup_database() {
    print_header "Database Cleanup and Optimization"

    echo "Running VACUUM ANALYZE on all tables..."

    psql "$DATABASE_URL" -c "VACUUM ANALYZE;"

    print_success "Database optimized"
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════╗"
    echo "║   Database Optimization Script             ║"
    echo "║   Dirt Free CRM                            ║"
    echo "╚════════════════════════════════════════════╝"
    echo -e "${NC}"

    check_prerequisites
    backup_indexes
    run_performance_migration
    run_analyzer_migration
    verify_indexes
    verify_analyzer
    cleanup_database
    run_benchmark
    generate_report

    print_header "Optimization Complete! 🎉"

    echo "Next steps:"
    echo "1. Review the performance report above"
    echo "2. Monitor slow queries using the query analyzer"
    echo "3. Check the usage guide: src/lib/db/query-analyzer-usage.md"
    echo ""
    echo "Performance monitoring endpoints:"
    echo "- Slow query log: SELECT * FROM slow_query_log;"
    echo "- Index usage: SELECT * FROM get_index_usage_stats();"
    echo "- Unused indexes: SELECT * FROM find_unused_indexes();"
    echo ""

    print_success "All done!"
}

# Run main function
main
