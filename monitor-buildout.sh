#!/bin/bash

# Dirt Free CRM Buildout Monitoring Script
# Monitors the development server and key functionality

echo "🔍 Dirt Free CRM Buildout Monitor"
echo "=================================="
echo "$(date)"
echo ""

# Function to check HTTP status
check_route() {
    local route=$1
    local name=$2
    local status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001$route 2>/dev/null)

    if [ "$status" = "200" ]; then
        echo "✅ $name: $status OK"
    elif [ "$status" = "500" ]; then
        echo "⚠️  $name: $status (Server Error - may be Next.js dev issues)"
    elif [ "$status" = "000" ]; then
        echo "❌ $name: Server not responding"
    else
        echo "🔶 $name: $status"
    fi
}

# Check server health
echo "🏥 Server Health Check"
echo "---------------------"
check_route "/" "Homepage"
check_route "/dashboard" "Dashboard"
check_route "/reminders" "Reminders List"

echo ""

# Check if TypeScript compiles
echo "📝 TypeScript Check"
echo "------------------"
cd "/Users/royaltyvixion/Documents/dirt free carpet/dirt-free-crm"
if npx tsc --noEmit --skipLibCheck 2>/dev/null; then
    echo "✅ TypeScript compilation: OK"
else
    echo "⚠️  TypeScript compilation: Has errors (may be from existing code)"
fi

echo ""

# Check file structure
echo "📁 Reminders Module Files"
echo "-------------------------"
if [ -f "src/app/(dashboard)/reminders/page.tsx" ]; then
    echo "✅ Main reminders page exists"
else
    echo "❌ Main reminders page missing"
fi

if [ -f "src/app/(dashboard)/reminders/actions.ts" ]; then
    echo "✅ Server actions exist"
else
    echo "❌ Server actions missing"
fi

if [ -d "src/app/(dashboard)/reminders/_components" ]; then
    component_count=$(ls src/app/(dashboard)/reminders/_components/*.tsx 2>/dev/null | wc -l)
    echo "✅ Components directory exists ($component_count components)"
else
    echo "❌ Components directory missing"
fi

if [ -f "src/app/(dashboard)/reminders/[id]/page.tsx" ]; then
    echo "✅ Detail page exists"
else
    echo "❌ Detail page missing"
fi

echo ""

# Check package health
echo "📦 Package Health"
echo "-----------------"
if npm list --depth=0 --silent 2>/dev/null; then
    echo "✅ NPM packages: OK"
else
    echo "⚠️  NPM packages: May have issues"
fi

echo ""

# Monitor tools check
echo "🛠️  Monitoring Tools"
echo "--------------------"
if command -v lighthouse >/dev/null 2>&1; then
    echo "✅ Lighthouse: Available"
else
    echo "❌ Lighthouse: Not found"
fi

if command -v mcp-inspector >/dev/null 2>&1; then
    echo "✅ MCP Inspector: Available"
else
    echo "❌ MCP Inspector: Not found"
fi

if command -v mcp-server-puppeteer >/dev/null 2>&1; then
    echo "✅ MCP Puppeteer: Available"
else
    echo "❌ MCP Puppeteer: Not found"
fi

echo ""

# Performance check (if server is responding)
echo "⚡ Quick Performance Check"
echo "-------------------------"
if curl -s http://localhost:3001 >/dev/null 2>&1; then
    echo "Running basic Lighthouse audit..."
    timeout 30s lighthouse http://localhost:3001 --quiet --chrome-flags="--headless" \
        --only-categories=performance --output=json 2>/dev/null | \
        jq -r '.categories.performance.score * 100 | floor | tostring + "/100 Performance Score"' 2>/dev/null || \
        echo "⚠️  Lighthouse audit timed out or failed"
else
    echo "❌ Server not responding - skipping performance check"
fi

echo ""
echo "🎯 Monitoring complete at $(date)"
echo "=================================="

# Optional: Save to log file
echo "Monitor run at $(date)" >> buildout-monitor.log