# Dirt Free CRM - Disaster Recovery & Operations Makefile
#
# This Makefile provides convenient commands for disaster recovery,
# secrets rotation, testing, and operational tasks.
#
# Usage:
#   make help           - Show available commands
#   make backup-prod    - Backup production data
#   make restore-staging - Restore backup to staging
#   make smoke          - Run smoke tests
#   make rotate-twilio  - Rotate Twilio API credentials
#   make sentry-scrub-test - Test Sentry PII scrubbing

.PHONY: help backup-prod restore-staging smoke rotate-twilio sentry-scrub-test dr-full test-ratelimit clean install dev build lint typecheck

# Default target
help:
	@echo "Dirt Free CRM - Operations & Disaster Recovery"
	@echo "=============================================="
	@echo ""
	@echo "Disaster Recovery Commands:"
	@echo "  backup-prod         Backup production database and storage"
	@echo "  restore-staging     Restore production backup to staging"
	@echo "  smoke               Run smoke tests against staging"
	@echo "  dr-full             Complete DR drill (backup + restore + smoke)"
	@echo ""
	@echo "Security & Rotation Commands:"
	@echo "  rotate-twilio       Rotate Twilio API credentials"
	@echo "  sentry-scrub-test   Test Sentry PII scrubbing configuration"
	@echo ""
	@echo "Development Commands:"
	@echo "  install             Install dependencies"
	@echo "  dev                 Start development server"
	@echo "  build               Build production bundle"
	@echo "  lint                Run linter"
	@echo "  typecheck           Run TypeScript type checking"
	@echo ""
	@echo "Testing Commands:"
	@echo "  test-ratelimit      Test rate limiting functionality"
	@echo "  smoke               Run API smoke tests"
	@echo ""
	@echo "Utility Commands:"
	@echo "  clean               Clean build artifacts and logs"
	@echo "  help                Show this help message"
	@echo ""
	@echo "Environment Requirements:"
	@echo "  - Required: PROD_PROJECT_REF, STAGING_PROJECT_REF"
	@echo "  - Required: PROD_DB_URL, STAGING_DB_URL"
	@echo "  - Required: SUPABASE_ACCESS_TOKEN"
	@echo "  - Optional: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN"
	@echo ""

# Disaster Recovery Commands
backup-prod:
	@echo "🗄️  Starting production backup..."
	@if [ ! -f "./scripts/backup_prod.sh" ]; then \
		echo "❌ Error: scripts/backup_prod.sh not found"; \
		exit 1; \
	fi
	@chmod +x ./scripts/backup_prod.sh
	@./scripts/backup_prod.sh
	@echo "✅ Production backup completed"

restore-staging:
	@echo "🔄 Starting staging restore..."
	@if [ ! -f "./scripts/restore_to_staging.sh" ]; then \
		echo "❌ Error: scripts/restore_to_staging.sh not found"; \
		exit 1; \
	fi
	@chmod +x ./scripts/restore_to_staging.sh
	@./scripts/restore_to_staging.sh
	@echo "✅ Staging restore completed"

smoke:
	@echo "🧪 Running smoke tests..."
	@if [ ! -f "./scripts/smoke_tests.sh" ]; then \
		echo "❌ Error: scripts/smoke_tests.sh not found"; \
		exit 1; \
	fi
	@chmod +x ./scripts/smoke_tests.sh
	@./scripts/smoke_tests.sh
	@echo "✅ Smoke tests completed"

dr-full: backup-prod restore-staging smoke
	@echo "🎉 Complete disaster recovery drill finished successfully!"
	@echo ""
	@echo "Summary:"
	@echo "  ✅ Production backup completed"
	@echo "  ✅ Staging restore completed"
	@echo "  ✅ Smoke tests passed"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Review backup artifacts in backups/ directory"
	@echo "  2. Check staging environment functionality"
	@echo "  3. Update DR documentation if needed"
	@echo "  4. Schedule next quarterly drill"

# Security & Rotation Commands
rotate-twilio:
	@echo "🔑 Starting Twilio credential rotation..."
	@if [ ! -f "./scripts/twilio_rotate_key.ts" ]; then \
		echo "❌ Error: scripts/twilio_rotate_key.ts not found"; \
		exit 1; \
	fi
	@if [ -z "$(TWILIO_ACCOUNT_SID)" ] || [ -z "$(TWILIO_AUTH_TOKEN)" ]; then \
		echo "❌ Error: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set"; \
		echo "   Set these environment variables before running rotation"; \
		exit 1; \
	fi
	@chmod +x ./scripts/twilio_rotate_key.ts
	@npx tsx ./scripts/twilio_rotate_key.ts
	@echo "✅ Twilio credential rotation completed"

sentry-scrub-test:
	@echo "🔒 Testing Sentry PII scrubbing..."
	@if [ ! -f "./scripts/sentry_scrub_test.ts" ]; then \
		echo "❌ Error: scripts/sentry_scrub_test.ts not found"; \
		exit 1; \
	fi
	@if [ -z "$(SENTRY_DSN)" ]; then \
		echo "⚠️  Warning: SENTRY_DSN not set, running in dry-run mode"; \
	fi
	@chmod +x ./scripts/sentry_scrub_test.ts
	@npx tsx ./scripts/sentry_scrub_test.ts
	@echo "✅ Sentry scrub test completed"

# Development Commands
install:
	@echo "📦 Installing dependencies..."
	@npm ci
	@echo "✅ Dependencies installed"

dev:
	@echo "🚀 Starting development server..."
	@npm run dev

build:
	@echo "🏗️  Building production bundle..."
	@npm run build
	@echo "✅ Build completed"

lint:
	@echo "🔍 Running linter..."
	@if command -v npm run lint >/dev/null 2>&1; then \
		npm run lint; \
	else \
		echo "⚠️  No lint script found in package.json"; \
	fi

typecheck:
	@echo "📋 Running TypeScript type checking..."
	@if command -v npm run typecheck >/dev/null 2>&1; then \
		npm run typecheck; \
	elif command -v tsc >/dev/null 2>&1; then \
		npx tsc --noEmit; \
	else \
		echo "⚠️  TypeScript not available for type checking"; \
	fi

# Testing Commands
test-ratelimit:
	@echo "⏱️  Testing rate limiting functionality..."
	@echo "Starting development server in background for testing..."
	@if ! pgrep -f "npm run dev" > /dev/null; then \
		echo "Starting dev server..."; \
		npm run dev > /dev/null 2>&1 & \
		DEV_PID=$$!; \
		echo "Waiting for server to start..."; \
		sleep 10; \
	fi
	@echo "Testing rate limit endpoint..."
	@echo "Making initial requests:"
	@for i in 1 2 3 4 5; do \
		echo "Request $$i:"; \
		curl -s -w "Status: %{http_code}\n" "http://localhost:3000/api/dev/ratelimit-test" | head -n 1; \
		sleep 0.5; \
	done
	@echo ""
	@echo "Testing rate limit trigger (should get 429):"
	@for i in 6 7 8; do \
		echo "Request $$i:"; \
		curl -s -w "Status: %{http_code}\n" -I "http://localhost:3000/api/dev/ratelimit-test" | grep -E "(Status:|X-RateLimit|Retry-After)"; \
		sleep 0.5; \
	done
	@echo "✅ Rate limit testing completed"

# Utility Commands
clean:
	@echo "🧹 Cleaning build artifacts and logs..."
	@rm -rf .next/
	@rm -rf dist/
	@rm -rf node_modules/.cache/
	@rm -f /tmp/smoke_tests_*.log
	@rm -f /tmp/staging_restore_*.log
	@rm -f /tmp/smoke_test_report_*.txt
	@rm -f .env.local.patch
	@echo "✅ Cleanup completed"

# Environment validation
check-env:
	@echo "🔧 Checking environment configuration..."
	@echo "Required variables:"
	@if [ -n "$(PROD_PROJECT_REF)" ]; then \
		echo "  ✅ PROD_PROJECT_REF is set"; \
	else \
		echo "  ❌ PROD_PROJECT_REF is not set"; \
	fi
	@if [ -n "$(STAGING_PROJECT_REF)" ]; then \
		echo "  ✅ STAGING_PROJECT_REF is set"; \
	else \
		echo "  ❌ STAGING_PROJECT_REF is not set"; \
	fi
	@if [ -n "$(SUPABASE_ACCESS_TOKEN)" ]; then \
		echo "  ✅ SUPABASE_ACCESS_TOKEN is set"; \
	else \
		echo "  ❌ SUPABASE_ACCESS_TOKEN is not set"; \
	fi
	@echo ""
	@echo "Optional variables:"
	@if [ -n "$(TWILIO_ACCOUNT_SID)" ]; then \
		echo "  ✅ TWILIO_ACCOUNT_SID is set"; \
	else \
		echo "  ⚠️  TWILIO_ACCOUNT_SID is not set (needed for rotation)"; \
	fi
	@if [ -n "$(SENTRY_DSN)" ]; then \
		echo "  ✅ SENTRY_DSN is set"; \
	else \
		echo "  ⚠️  SENTRY_DSN is not set (needed for scrub test)"; \
	fi

# Quick status check
status:
	@echo "📊 System Status Check"
	@echo "====================="
	@echo ""
	@echo "Scripts availability:"
	@if [ -f "./scripts/backup_prod.sh" ]; then echo "  ✅ backup_prod.sh"; else echo "  ❌ backup_prod.sh"; fi
	@if [ -f "./scripts/restore_to_staging.sh" ]; then echo "  ✅ restore_to_staging.sh"; else echo "  ❌ restore_to_staging.sh"; fi
	@if [ -f "./scripts/smoke_tests.sh" ]; then echo "  ✅ smoke_tests.sh"; else echo "  ❌ smoke_tests.sh"; fi
	@if [ -f "./scripts/twilio_rotate_key.ts" ]; then echo "  ✅ twilio_rotate_key.ts"; else echo "  ❌ twilio_rotate_key.ts"; fi
	@if [ -f "./scripts/sentry_scrub_test.ts" ]; then echo "  ✅ sentry_scrub_test.ts"; else echo "  ❌ sentry_scrub_test.ts"; fi
	@echo ""
	@echo "Dependencies:"
	@if command -v npm >/dev/null 2>&1; then echo "  ✅ npm"; else echo "  ❌ npm"; fi
	@if command -v node >/dev/null 2>&1; then echo "  ✅ node ($(node --version))"; else echo "  ❌ node"; fi
	@if command -v supabase >/dev/null 2>&1; then echo "  ✅ supabase CLI"; else echo "  ⚠️  supabase CLI (install with: npm install -g supabase)"; fi
	@if command -v curl >/dev/null 2>&1; then echo "  ✅ curl"; else echo "  ❌ curl"; fi
	@if command -v jq >/dev/null 2>&1; then echo "  ✅ jq"; else echo "  ⚠️  jq (needed for JSON processing)"; fi
	@echo ""
	@echo "Recent backups:"
	@if [ -d "./backups" ]; then \
		ls -la ./backups/ | tail -n 5; \
	else \
		echo "  No backups directory found"; \
	fi

# Documentation shortcuts
docs:
	@echo "📚 Available Documentation"
	@echo "========================="
	@echo ""
	@if [ -f "./docs/dr-runbook.md" ]; then echo "  📖 DR Runbook: docs/dr-runbook.md"; fi
	@if [ -f "./docs/secrets-rotation.md" ]; then echo "  🔑 Secrets Rotation: docs/secrets-rotation.md"; fi
	@if [ -f "./docs/access-ownership-matrix.md" ]; then echo "  👥 Access Matrix: docs/access-ownership-matrix.md"; fi
	@if [ -f "./README.md" ]; then echo "  📋 README: README.md"; fi
	@echo ""
	@echo "GitHub Workflows:"
	@if [ -f "./.github/workflows/dr-restore-smoke.yml" ]; then echo "  🔄 DR Workflow: .github/workflows/dr-restore-smoke.yml"; fi

# Version and build info
version:
	@echo "🏷️  Version Information"
	@echo "====================="
	@if [ -f "package.json" ]; then \
		echo "App version: $(shell node -p "require('./package.json').version")"; \
		echo "App name: $(shell node -p "require('./package.json').name")"; \
	fi
	@echo "Node.js: $(shell node --version 2>/dev/null || echo 'Not available')"
	@echo "npm: $(shell npm --version 2>/dev/null || echo 'Not available')"
	@echo "Make: $(shell make --version | head -n 1)"
	@echo "OS: $(shell uname -s) $(shell uname -r)"
	@echo "Date: $(shell date)"