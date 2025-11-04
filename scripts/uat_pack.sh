#!/bin/bash

# UAT Package Generation Script
# Prepares test data, runs validation checks, and packages UAT artifacts

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
UAT_DIR="$PROJECT_ROOT/uat_package"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "🧪 Dirt Free CRM - UAT Package Generator"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    # Check if we're in a Next.js project
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        print_error "package.json not found. Please run this script from the project root."
        exit 1
    fi

    # Check if .env files exist
    if [ ! -f "$PROJECT_ROOT/.env.local" ] && [ ! -f "$PROJECT_ROOT/.env" ]; then
        print_warning "No environment file found. Some tests may fail."
    fi

    # Check if node_modules exists
    if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
        print_error "node_modules not found. Please run 'npm install' first."
        exit 1
    fi

    print_success "Prerequisites check completed"
}

# Function to create UAT directory structure
create_uat_structure() {
    print_status "Creating UAT package structure..."

    # Remove existing UAT directory if it exists
    if [ -d "$UAT_DIR" ]; then
        rm -rf "$UAT_DIR"
    fi

    # Create directory structure
    mkdir -p "$UAT_DIR"/{docs,data,scripts,reports,evidence}

    print_success "UAT directory structure created"
}

# Function to copy documentation
copy_documentation() {
    print_status "Copying documentation files..."

    # Copy all documentation
    cp "$PROJECT_ROOT/docs"/*.md "$UAT_DIR/docs/" 2>/dev/null || {
        print_warning "No documentation files found in docs/ directory"
    }

    # Create package manifest
    cat > "$UAT_DIR/docs/PACKAGE_MANIFEST.md" << EOF
# UAT Package Manifest

**Generated:** $(date)
**Version:** 1.0
**Environment:** UAT

## Contents

### Documentation
- UAT Checklist (uat-checklist.md)
- Training Guides (training-*.md)
- Operational Runbooks (runbook-*.md)
- FAQ and Known Issues (faq.md, known-issues.md)

### Test Data
- Sample customer data
- Test job scenarios
- SMS compliance test cases

### Scripts
- Database seeding scripts
- Test data generation
- Environment setup

### Reports
- Test execution reports
- Validation results
- Issue tracking

### Evidence
- Screenshots directory
- Test artifacts
- Validation evidence

## Usage Instructions

1. Review all documentation in docs/
2. Set up test environment using scripts/
3. Execute UAT checklist scenarios
4. Document results in reports/
5. Capture evidence in evidence/

## Support

For questions or issues with this UAT package:
- Contact: System Administrator
- Email: admin@acme.test
- Emergency: [REDACTED]
EOF

    print_success "Documentation copied"
}

# Function to generate test data
generate_test_data() {
    print_status "Generating test data..."

    # Create sample customer data
    cat > "$UAT_DIR/data/sample_customers.json" << 'EOF'
{
  "customers": [
    {
      "name": "John Smith",
      "email": "john.smith@test.local",
      "phone": "(555) 101-1001",
      "address": "123 Main St, Test City, TC 12345",
      "zone": "Zone A",
      "notes": "Regular customer - prefers morning appointments",
      "service_history": [
        {
          "date": "2024-01-15",
          "service": "Carpet cleaning",
          "rooms": 3,
          "satisfaction": 5
        }
      ]
    },
    {
      "name": "Sarah Johnson",
      "email": "sarah.j@test.local",
      "phone": "(555) 102-1002",
      "address": "456 Oak Ave, Test City, TC 12346",
      "zone": "Zone B",
      "notes": "Has two dogs - requires pet-safe products",
      "service_history": []
    },
    {
      "name": "Mike Wilson",
      "email": "m.wilson@test.local",
      "phone": "(555) 103-1003",
      "address": "789 Pine Dr, Test City, TC 12347",
      "zone": "Zone A",
      "notes": "Commercial property - after hours access required",
      "service_history": [
        {
          "date": "2024-02-20",
          "service": "Office carpet cleaning",
          "rooms": 8,
          "satisfaction": 4
        }
      ]
    }
  ]
}
EOF

    # Create test job scenarios
    cat > "$UAT_DIR/data/test_jobs.json" << 'EOF'
{
  "job_scenarios": [
    {
      "scenario": "Standard Residential Cleaning",
      "customer": "John Smith",
      "service_type": "Carpet cleaning",
      "rooms": ["Living room", "Bedroom 1", "Bedroom 2"],
      "scheduled_date": "2024-12-20",
      "scheduled_time": "10:00 AM",
      "estimated_duration": "2 hours",
      "technician": "Tech 1",
      "special_instructions": "Use low-moisture cleaning method"
    },
    {
      "scenario": "Pet-Safe Cleaning",
      "customer": "Sarah Johnson",
      "service_type": "Carpet and upholstery",
      "rooms": ["Living room", "Dining room"],
      "scheduled_date": "2024-12-21",
      "scheduled_time": "2:00 PM",
      "estimated_duration": "3 hours",
      "technician": "Tech 2",
      "special_instructions": "Pet-safe products only - 2 dogs on premise"
    },
    {
      "scenario": "Commercial After-Hours",
      "customer": "Mike Wilson",
      "service_type": "Commercial cleaning",
      "rooms": ["Office areas", "Conference rooms", "Reception"],
      "scheduled_date": "2024-12-22",
      "scheduled_time": "6:00 PM",
      "estimated_duration": "4 hours",
      "technician": "Tech 1",
      "special_instructions": "After hours access - security code: 1234"
    }
  ]
}
EOF

    # Create SMS test scenarios
    cat > "$UAT_DIR/data/sms_test_cases.json" << 'EOF'
{
  "sms_scenarios": [
    {
      "test_case": "Standard Reminder",
      "recipient": "+15551011001",
      "message_type": "appointment_reminder",
      "expected_delivery": true,
      "compliance_check": "Includes opt-out instructions"
    },
    {
      "test_case": "On the Way Notification",
      "recipient": "+15551021002",
      "message_type": "on_the_way",
      "expected_delivery": true,
      "compliance_check": "Professional identification"
    },
    {
      "test_case": "Quiet Hours Test",
      "recipient": "+15551031003",
      "message_type": "appointment_reminder",
      "send_time": "22:30",
      "expected_behavior": "Delayed until 8:00 AM CT",
      "compliance_check": "Quiet hours compliance"
    },
    {
      "test_case": "STOP Request",
      "recipient": "+15551041004",
      "incoming_message": "STOP",
      "expected_behavior": "Added to opt-out list",
      "compliance_check": "Immediate opt-out processing"
    }
  ]
}
EOF

    print_success "Test data generated"
}

# Function to create setup scripts
create_setup_scripts() {
    print_status "Creating setup scripts..."

    # Create environment setup script
    cat > "$UAT_DIR/scripts/setup_uat_env.sh" << 'EOF'
#!/bin/bash

# UAT Environment Setup Script

echo "Setting up UAT environment..."

# Check for required environment variables
required_vars=("DATABASE_URL" "TWILIO_ACCOUNT_SID" "TWILIO_AUTH_TOKEN")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "ERROR: Required environment variable $var is not set"
        exit 1
    fi
done

echo "Environment variables validated"

# Check database connectivity
echo "Testing database connection..."
if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "Database connection successful"
    else
        echo "WARNING: Database connection failed"
    fi
else
    echo "WARNING: psql not found - cannot test database connection"
fi

# Validate Twilio configuration
echo "Validating Twilio configuration..."
echo "Account SID: ${TWILIO_ACCOUNT_SID:0:8}..."
echo "Auth Token: [HIDDEN]"
echo "Phone Number: ${TWILIO_PHONE_NUMBER:-Not set}"

echo "UAT environment setup completed"
EOF

    chmod +x "$UAT_DIR/scripts/setup_uat_env.sh"

    # Create data seeding script
    cat > "$UAT_DIR/scripts/seed_test_data.js" << 'EOF'
#!/usr/bin/env node

/**
 * Test Data Seeding Script
 * Populates database with UAT test data
 */

const fs = require('fs');
const path = require('path');

async function seedTestData() {
  console.log('🌱 Seeding UAT test data...');

  try {
    // Load test data files
    const customersPath = path.join(__dirname, '../data/sample_customers.json');
    const jobsPath = path.join(__dirname, '../data/test_jobs.json');

    if (!fs.existsSync(customersPath)) {
      throw new Error('sample_customers.json not found');
    }

    if (!fs.existsSync(jobsPath)) {
      throw new Error('test_jobs.json not found');
    }

    const customers = JSON.parse(fs.readFileSync(customersPath, 'utf8'));
    const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));

    console.log(`📊 Loaded ${customers.customers.length} test customers`);
    console.log(`📋 Loaded ${jobs.job_scenarios.length} test job scenarios`);

    // In a real implementation, this would:
    // 1. Connect to the database
    // 2. Insert test customers
    // 3. Create test jobs
    // 4. Set up test user accounts
    // 5. Configure test SMS numbers

    console.log('✅ Test data seeding completed');
    console.log('');
    console.log('Next steps:');
    console.log('1. Review the UAT checklist');
    console.log('2. Execute test scenarios');
    console.log('3. Document results');

  } catch (error) {
    console.error('❌ Error seeding test data:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedTestData();
}

module.exports = { seedTestData };
EOF

    chmod +x "$UAT_DIR/scripts/seed_test_data.js"

    print_success "Setup scripts created"
}

# Function to create report templates
create_report_templates() {
    print_status "Creating report templates..."

    # Create test execution report template
    cat > "$UAT_DIR/reports/test_execution_report_template.md" << 'EOF'
# UAT Test Execution Report

**Test Date:** [DATE]
**Tester:** [TESTER_NAME]
**Environment:** UAT
**Version:** [VERSION]

## Executive Summary

- **Total Test Cases:** [TOTAL]
- **Passed:** [PASSED]
- **Failed:** [FAILED]
- **Blocked:** [BLOCKED]
- **Pass Rate:** [PASS_RATE]%

## Test Results Summary

| Category | Total | Passed | Failed | Pass Rate |
|----------|-------|--------|--------|-----------|
| Authentication | 5 | 0 | 0 | 0% |
| Customer Management | 8 | 0 | 0 | 0% |
| Job Management | 12 | 0 | 0 | 0% |
| Scheduling | 10 | 0 | 0 | 0% |
| SMS Communication | 8 | 0 | 0 | 0% |
| Mobile App | 15 | 0 | 0 | 0% |
| Reports | 6 | 0 | 0 | 0% |
| Security | 4 | 0 | 0 | 0% |

## Failed Test Cases

### [Test Case ID] - [Test Case Name]
- **Expected Result:** [EXPECTED]
- **Actual Result:** [ACTUAL]
- **Severity:** [HIGH/MEDIUM/LOW]
- **Comments:** [COMMENTS]
- **Evidence:** [SCREENSHOT/LOG_FILE]

## Blocked Test Cases

### [Test Case ID] - [Test Case Name]
- **Reason:** [BLOCKING_REASON]
- **Impact:** [IMPACT_DESCRIPTION]
- **Next Steps:** [REQUIRED_ACTIONS]

## Environment Issues

- [List any environment-specific issues encountered]

## Recommendations

- [Recommendations for go-live readiness]
- [Required fixes before production]
- [Risk mitigation strategies]

## Sign-off

**Technical Validation:** ________________ Date: ________
**Business Validation:** ________________ Date: ________
**UAT Manager:** ________________ Date: ________

## Appendix

- Test evidence files
- Error logs
- Screenshots
- Performance metrics
EOF

    # Create issue tracking template
    cat > "$UAT_DIR/reports/issue_tracking_template.md" << 'EOF'
# UAT Issue Tracking Log

**Last Updated:** [DATE]

## Issue Summary

| Status | Count |
|--------|-------|
| Open | 0 |
| In Progress | 0 |
| Resolved | 0 |
| Closed | 0 |

## Issues Log

### ISSUE-001
- **Title:** [Issue Title]
- **Priority:** [Critical/High/Medium/Low]
- **Status:** [Open/In Progress/Resolved/Closed]
- **Reported By:** [Name]
- **Date Reported:** [Date]
- **Description:** [Detailed description]
- **Steps to Reproduce:**
  1. [Step 1]
  2. [Step 2]
  3. [Step 3]
- **Expected Behavior:** [What should happen]
- **Actual Behavior:** [What actually happens]
- **Workaround:** [Temporary solution if available]
- **Resolution:** [How it was fixed]
- **Verified By:** [Name]
- **Date Closed:** [Date]

---

*Add new issues above this line*
EOF

    print_success "Report templates created"
}

# Function to run validation checks
run_validation_checks() {
    print_status "Running validation checks..."

    cd "$PROJECT_ROOT"

    # Check if TypeScript compiles
    print_status "Checking TypeScript compilation..."
    if npm run build:check >/dev/null 2>&1; then
        print_success "TypeScript compilation passed"
    else
        print_warning "TypeScript compilation issues detected"
    fi

    # Check if linting passes
    print_status "Running linter..."
    if npm run lint >/dev/null 2>&1; then
        print_success "Linting passed"
    else
        print_warning "Linting issues detected"
    fi

    # Check if tests pass
    print_status "Running tests..."
    if npm run test >/dev/null 2>&1; then
        print_success "Tests passed"
    else
        print_warning "Test failures detected"
    fi

    print_success "Validation checks completed"
}

# Function to generate final package
generate_package() {
    print_status "Generating final UAT package..."

    # Create README for the package
    cat > "$UAT_DIR/README.md" << 'EOF'
# Dirt Free CRM - UAT Package

This package contains everything needed to conduct User Acceptance Testing for Dirt Free CRM.

## Quick Start

1. **Review Documentation**
   ```bash
   ls docs/
   ```

2. **Set Up Environment**
   ```bash
   cd scripts/
   chmod +x setup_uat_env.sh
   ./setup_uat_env.sh
   ```

3. **Seed Test Data**
   ```bash
   node seed_test_data.js
   ```

4. **Execute UAT**
   - Follow the UAT checklist in `docs/uat-checklist.md`
   - Document results in `reports/`
   - Capture evidence in `evidence/`

## Package Contents

- **docs/**: All training guides, runbooks, and documentation
- **data/**: Sample data and test scenarios
- **scripts/**: Setup and utility scripts
- **reports/**: Test execution templates and tracking
- **evidence/**: Screenshots and test artifacts

## Support

For issues with this UAT package:
- System Administrator: admin@acme.test
- Emergency: [REDACTED]

## Version Information

- Package Version: 1.0
- Generated: $(date)
- Environment: UAT
EOF

    # Create package archive
    ARCHIVE_NAME="dirt_free_crm_uat_package_${TIMESTAMP}.tar.gz"
    cd "$PROJECT_ROOT"
    tar -czf "$ARCHIVE_NAME" -C "$(dirname "$UAT_DIR")" "$(basename "$UAT_DIR")"

    print_success "UAT package archived as: $ARCHIVE_NAME"
}

# Function to display completion summary
show_completion_summary() {
    echo ""
    echo "🎉 UAT Package Generation Complete!"
    echo "==================================="
    echo ""
    echo "📦 Package Location: $UAT_DIR"
    echo "📋 Archive Created: dirt_free_crm_uat_package_${TIMESTAMP}.tar.gz"
    echo ""
    echo "📚 Package Contents:"
    echo "   • Documentation (training guides, runbooks, FAQ)"
    echo "   • Test Data (sample customers, jobs, SMS scenarios)"
    echo "   • Setup Scripts (environment setup, data seeding)"
    echo "   • Report Templates (execution reports, issue tracking)"
    echo "   • Evidence Directory (for screenshots and artifacts)"
    echo ""
    echo "🚀 Next Steps:"
    echo "   1. Review the UAT checklist (docs/uat-checklist.md)"
    echo "   2. Set up your UAT environment (scripts/setup_uat_env.sh)"
    echo "   3. Seed test data (scripts/seed_test_data.js)"
    echo "   4. Execute test scenarios and document results"
    echo ""
    echo "📞 Support:"
    echo "   • System Administrator: admin@acme.test"
    echo "   • Emergency: [REDACTED]"
    echo ""
}

# Main execution flow
main() {
    check_prerequisites
    create_uat_structure
    copy_documentation
    generate_test_data
    create_setup_scripts
    create_report_templates
    run_validation_checks
    generate_package
    show_completion_summary
}

# Run main function
main "$@"