#!/usr/bin/env node

/**
 * Lighthouse PWA Verification Script
 *
 * This script runs Lighthouse PWA audits to verify our PWA implementation.
 *
 * Prerequisites:
 * - Install Lighthouse CLI: npm install -g lighthouse
 * - Build and start the production server: npm run build && npm start
 *
 * Usage:
 * - node scripts/lighthouse-pwa-check.js [url]
 * - Default URL: http://localhost:3000
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_URL = 'http://localhost:3000';
const REPORTS_DIR = path.join(__dirname, '..', 'lighthouse-reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function runLighthousePWA(url = DEFAULT_URL) {
  console.log('🔍 Running Lighthouse PWA audit...');
  console.log(`📍 URL: ${url}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `pwa-audit-${timestamp}.html`);
  const jsonReportPath = path.join(REPORTS_DIR, `pwa-audit-${timestamp}.json`);

  try {
    // Check if Lighthouse is installed
    execSync('lighthouse --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Lighthouse CLI not found. Install it with: npm install -g lighthouse');
    process.exit(1);
  }

  try {
    // Run Lighthouse with PWA-focused audits
    const command = [
      'lighthouse',
      url,
      '--only-categories=pwa',
      '--chrome-flags="--headless"',
      `--output=html,json`,
      `--output-path=${reportPath.replace('.html', '')}`,
      '--quiet'
    ].join(' ');

    console.log('⏳ Running audit (this may take a moment)...');
    execSync(command, { stdio: 'inherit' });

    console.log('✅ Lighthouse PWA audit completed!');
    console.log(`📊 HTML Report: ${reportPath}`);
    console.log(`📊 JSON Report: ${jsonReportPath}`);

    // Parse and display key PWA metrics
    if (fs.existsSync(jsonReportPath)) {
      const report = JSON.parse(fs.readFileSync(jsonReportPath, 'utf8'));
      displayPWAResults(report);
    }

  } catch (error) {
    console.error('❌ Error running Lighthouse:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   - The development server is running (npm run dev)');
    console.log('   - The URL is accessible');
    console.log('   - No other processes are using port 3000');
    process.exit(1);
  }
}

function displayPWAResults(report) {
  console.log('\n📈 PWA Audit Results:');
  console.log('================================');

  const pwaCategory = report.categories.pwa;
  const score = Math.round(pwaCategory.score * 100);

  console.log(`🎯 Overall PWA Score: ${score}/100`);

  if (score >= 90) {
    console.log('🎉 Excellent PWA implementation!');
  } else if (score >= 70) {
    console.log('👍 Good PWA implementation with room for improvement');
  } else {
    console.log('⚠️  PWA implementation needs attention');
  }

  console.log('\n📋 Individual Audits:');

  const audits = report.audits;
  const pwaAudits = [
    { key: 'installable-manifest', name: 'Manifest is installable' },
    { key: 'service-worker', name: 'Service Worker registered' },
    { key: 'offline-start-url', name: 'Start URL responds offline' },
    { key: 'works-offline', name: 'Works offline' },
    { key: 'viewport', name: 'Has viewport meta tag' },
    { key: 'apple-touch-icon', name: 'Has apple-touch-icon' },
    { key: 'themed-omnibox', name: 'Themed omnibox' },
    { key: 'maskable-icon', name: 'Has maskable icon' },
  ];

  pwaAudits.forEach(({ key, name }) => {
    if (audits[key]) {
      const audit = audits[key];
      const status = audit.score === 1 ? '✅' : audit.score === 0 ? '❌' : '⚠️';
      console.log(`   ${status} ${name}`);

      if (audit.score !== 1 && audit.description) {
        console.log(`      💡 ${audit.description}`);
      }
    }
  });

  console.log('\n🔍 Key Requirements Check:');
  console.log(`   ${audits['installable-manifest']?.score === 1 ? '✅' : '❌'} App is installable`);
  console.log(`   ${audits['service-worker']?.score === 1 ? '✅' : '❌'} Service worker active`);
  console.log(`   ${audits['works-offline']?.score === 1 ? '✅' : '❌'} Offline support`);

  // Check for tech-weekly offline support specifically
  console.log(`   🔄 Tech-weekly offline caching: Check service worker implementation`);
  console.log(`   🔒 Sensitive data protection: Check service worker cache exclusions`);
}

function showHelp() {
  console.log(`
Lighthouse PWA Verification Script

Usage:
  node scripts/lighthouse-pwa-check.js [url]

Examples:
  node scripts/lighthouse-pwa-check.js
  node scripts/lighthouse-pwa-check.js http://localhost:3000
  node scripts/lighthouse-pwa-check.js https://your-app.vercel.app

Prerequisites:
  1. Install Lighthouse CLI: npm install -g lighthouse
  2. Start your application server
  3. Ensure the application is accessible at the specified URL

The script will generate HTML and JSON reports in the lighthouse-reports/ directory.
`);
}

// Main execution
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
  process.exit(0);
}

const url = args[0] || DEFAULT_URL;
runLighthousePWA(url);