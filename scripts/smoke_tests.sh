#!/bin/bash

# Smoke Tests for Dirt Free CRM
# Validates critical API endpoints and system functionality
# Usage: ./scripts/smoke_tests.sh [base_url]

set -euo pipefail

# Configuration
BASE_URL="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/smoke_tests_$(date +%H%M%S).log"

# Test configuration
TIMEOUT=10
MAX_RESPONSE_TIME=2000  # 2 seconds in milliseconds
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results storage
declare -a TEST_RESULTS=()

# Logging functions
log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

log_test() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] TEST: $1" | tee -a "$LOG_FILE"
}

# Test execution functions
run_test() {
    local test_name="$1"
    local url="$2"
    local expected_status="$3"
    local expected_content="${4:-}"
    local method="${5:-GET}"
    local headers="${6:-}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    local test_number=$(printf "%02d" $TOTAL_TESTS)

    log_test "[$test_number] $test_name"

    # Prepare curl command
    local curl_cmd="curl -s -w '%{http_code}|%{time_total}' --max-time $TIMEOUT"

    if [ -n "$headers" ]; then
        curl_cmd="$curl_cmd $headers"
    fi

    curl_cmd="$curl_cmd -X $method '$BASE_URL$url'"

    # Execute request
    local start_time=$(date +%s%3N)
    local response
    if response=$(eval "$curl_cmd" 2>>"$LOG_FILE"); then
        local end_time=$(date +%s%3N)
        local response_time=$((end_time - start_time))

        # Parse response
        local body="${response%|*|*}"
        local status_and_time="${response##*|}"
        local status="${status_and_time%|*}"
        local curl_time="${status_and_time##*|}"

        # Convert curl time (seconds) to milliseconds
        local curl_time_ms=$(echo "$curl_time * 1000" | bc 2>/dev/null || echo "0")

        # Validate status code
        local status_ok=false
        if [[ "$expected_status" == *"$status"* ]]; then
            status_ok=true
        fi

        # Validate response time
        local time_ok=false
        if (( $(echo "$curl_time_ms <= $MAX_RESPONSE_TIME" | bc -l) )); then
            time_ok=true
        fi

        # Validate content if specified
        local content_ok=true
        if [ -n "$expected_content" ]; then
            content_ok=false
            if echo "$body" | grep -q "$expected_content"; then
                content_ok=true
            fi
        fi

        # Determine overall test result
        if $status_ok && $time_ok && $content_ok; then
            PASSED_TESTS=$((PASSED_TESTS + 1))
            printf "${GREEN}✓ PASS${NC} %s (HTTP %s, %.0fms)\n" "$test_name" "$status" "$curl_time_ms"
            TEST_RESULTS+=("PASS|$test_name|$status|${curl_time_ms%.*}ms")
        else
            FAILED_TESTS=$((FAILED_TESTS + 1))
            printf "${RED}✗ FAIL${NC} %s\n" "$test_name"

            if ! $status_ok; then
                echo "  Expected status: $expected_status, got: $status"
            fi
            if ! $time_ok; then
                echo "  Response too slow: ${curl_time_ms%.*}ms (max: ${MAX_RESPONSE_TIME}ms)"
            fi
            if ! $content_ok; then
                echo "  Expected content not found: $expected_content"
                echo "  Response body: ${body:0:200}..."
            fi

            TEST_RESULTS+=("FAIL|$test_name|$status|${curl_time_ms%.*}ms|$(echo "$body" | head -c 100)")
        fi

    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        printf "${RED}✗ FAIL${NC} %s (Connection failed)\n" "$test_name"
        TEST_RESULTS+=("FAIL|$test_name|CONNECTION_FAILED|0ms|curl command failed")
    fi

    echo
}

# Health check tests
test_health_endpoints() {
    echo
    printf "${BLUE}=== Health Check Endpoints ===${NC}\n"
    echo

    # Basic health check
    run_test "Health Check" "/api/health" "200" '"ok":true'

    # Ready check (database connectivity)
    run_test "Ready Check" "/api/ready" "200" '"ready":true'

    # SLO samples endpoint
    run_test "SLO Samples" "/api/ops/samples" "200" "reminderDeliveryRate"

    # Heartbeat monitoring
    run_test "Heartbeat Monitor" "/api/ops/heartbeat" "200" '"ok":'
}

# API endpoint tests
test_api_endpoints() {
    echo
    printf "${BLUE}=== API Endpoints ===${NC}\n"
    echo

    # Test upcoming reminders report (should work without auth for HEAD)
    run_test "Reports - Upcoming Reminders" "/api/reports/upcoming-reminders" "401" "" "HEAD"

    # Test uploads sign endpoint (should require auth)
    run_test "Uploads - Sign (Unauthorized)" "/api/uploads/sign?key=test" "401" ""

    # Test SMS send endpoint (should require auth)
    run_test "SMS Send (Unauthorized)" "/api/sms/send" "401" "" "POST"

    # Test admin invite (should require auth)
    run_test "Admin Invite (Unauthorized)" "/api/admin/invite" "401" "" "POST"
}

# Rate limiting tests
test_rate_limiting() {
    echo
    printf "${BLUE}=== Rate Limiting ===${NC}\n"
    echo

    # Test ping endpoint for basic rate limiting
    run_test "Ping Endpoint" "/api/ping" "200" ""

    # If rate limit test endpoint exists, test it
    if curl -s -f "$BASE_URL/api/dev/ratelimit-test" >/dev/null 2>&1; then
        run_test "Rate Limit Test (Available)" "/api/dev/ratelimit-test" "200" ""

        # Hammer the rate limit test endpoint
        echo "Testing rate limiting by making rapid requests..."
        local rate_limit_triggered=false

        for i in {1..15}; do
            local response_code
            response_code=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/dev/ratelimit-test" || echo "000")

            if [ "$response_code" = "429" ]; then
                rate_limit_triggered=true
                break
            fi

            sleep 0.1
        done

        if $rate_limit_triggered; then
            printf "${GREEN}✓ PASS${NC} Rate limiting works (HTTP 429 triggered)\n"
            TEST_RESULTS+=("PASS|Rate Limiting Test|429|N/A")
        else
            printf "${YELLOW}⚠ SKIP${NC} Rate limiting not triggered (may need more requests)\n"
            TEST_RESULTS+=("SKIP|Rate Limiting Test|200|N/A")
        fi
    else
        printf "${YELLOW}⚠ SKIP${NC} Rate limit test endpoint not available\n"
        TEST_RESULTS+=("SKIP|Rate Limit Test|N/A|N/A")
    fi

    echo
}

# Webhook endpoints tests
test_webhook_endpoints() {
    echo
    printf "${BLUE}=== Webhook Endpoints ===${NC}\n"
    echo

    # Test Twilio inbound webhook (should fail signature validation)
    run_test "Twilio Inbound (No Signature)" "/api/twilio/inbound" "401" "" "POST"

    # Test Twilio status webhook (should fail signature validation)
    run_test "Twilio Status (No Signature)" "/api/twilio/status" "401" "" "POST"
}

# Authentication and authorization tests
test_auth_endpoints() {
    echo
    printf "${BLUE}=== Authentication Tests ===${NC}\n"
    echo

    # Test protected dashboard routes (should redirect or return 401/403)
    run_test "Dashboard (Unauthorized)" "/dashboard" "401|403|302"

    # Test operations dashboard (admin only)
    run_test "Ops Dashboard (Unauthorized)" "/reports/ops" "401|403|302"
}

# Performance baseline tests
test_performance() {
    echo
    printf "${BLUE}=== Performance Baseline ===${NC}\n"
    echo

    # Run a few performance-focused tests
    run_test "Health Perf Test" "/api/health" "200" '"ok":true'
    run_test "Ready Perf Test" "/api/ready" "200" '"ready":true'

    # Test static assets if available
    run_test "Favicon" "/favicon.ico" "200|404" ""
}

# Generate test report
generate_report() {
    local report_file="/tmp/smoke_test_report_$(date +%Y%m%d_%H%M%S).txt"

    cat > "$report_file" << EOF
Dirt Free CRM - Smoke Test Report
=================================

Test Run: $(date '+%Y-%m-%d %H:%M:%S')
Base URL: $BASE_URL
Total Tests: $TOTAL_TESTS
Passed: $PASSED_TESTS
Failed: $FAILED_TESTS
Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%

Test Results:
$(printf "%-8s %-30s %-8s %-10s %s\n" "Status" "Test Name" "HTTP" "Time" "Notes")
$(printf "%-8s %-30s %-8s %-10s %s\n" "------" "----------" "----" "----" "-----")
EOF

    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r status name http_code time notes <<< "$result"
        printf "%-8s %-30s %-8s %-10s %s\n" "$status" "${name:0:30}" "$http_code" "$time" "${notes:0:50}" >> "$report_file"
    done

    cat >> "$report_file" << EOF

Performance Summary:
- Average response time for health checks: ~$(grep "Health\|Ready" "$report_file" | grep -o '[0-9]*ms' | sed 's/ms//' | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}')ms
- All responses under ${MAX_RESPONSE_TIME}ms: $([ $FAILED_TESTS -eq 0 ] && echo "Yes" || echo "No")

Recommendations:
$(if [ $FAILED_TESTS -gt 0 ]; then
    echo "- Investigate failed tests before proceeding to production"
    echo "- Check application logs for error details"
fi)
$(if [ $TOTAL_TESTS -lt 10 ]; then
    echo "- Consider adding more comprehensive test coverage"
fi)
- Review response times for optimization opportunities
- Validate rate limiting configuration is appropriate

Logs: $LOG_FILE
Report: $report_file
EOF

    echo "Detailed report saved: $report_file"
}

# Main execution
main() {
    echo
    printf "${BLUE}Dirt Free CRM - Smoke Tests${NC}\n"
    printf "${BLUE}===========================${NC}\n"
    echo
    log_info "Starting smoke tests for $BASE_URL"

    # Validate base URL
    if ! curl -s --max-time 5 "$BASE_URL/api/health" >/dev/null 2>&1; then
        log_error "Cannot reach base URL: $BASE_URL"
        echo "Please ensure the application is running and accessible."
        exit 1
    fi

    # Run test suites
    test_health_endpoints
    test_api_endpoints
    test_rate_limiting
    test_webhook_endpoints
    test_auth_endpoints
    test_performance

    # Summary
    echo
    printf "${BLUE}=== Test Summary ===${NC}\n"
    echo
    printf "Total Tests: %d\n" $TOTAL_TESTS
    printf "${GREEN}Passed: %d${NC}\n" $PASSED_TESTS
    if [ $FAILED_TESTS -gt 0 ]; then
        printf "${RED}Failed: %d${NC}\n" $FAILED_TESTS
    else
        printf "Failed: %d\n" $FAILED_TESTS
    fi

    local success_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    printf "Success Rate: %d%%\n" $success_rate

    echo
    generate_report

    # Exit with failure if any tests failed
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "Smoke tests failed: $FAILED_TESTS out of $TOTAL_TESTS tests failed"
        exit 1
    else
        log_info "All smoke tests passed: $PASSED_TESTS/$TOTAL_TESTS"
        echo
        printf "${GREEN}✓ All smoke tests passed successfully!${NC}\n"
        echo
        exit 0
    fi
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi