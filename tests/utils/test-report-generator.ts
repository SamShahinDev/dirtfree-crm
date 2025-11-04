import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string;
}

interface TestSummary {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  totalDuration: number;
  errors: string[];
  warnings: string[];
  screenshots: string[];
  results: TestResult[];
}

class TestReportGenerator {
  private results: TestResult[] = [];
  private startTime = Date.now();

  addResult(result: TestResult) {
    this.results.push(result);
  }

  generateSummary(): TestSummary {
    const summary: TestSummary = {
      timestamp: new Date().toISOString(),
      totalTests: this.results.length,
      passed: this.results.filter(r => r.status === 'passed').length,
      failed: this.results.filter(r => r.status === 'failed').length,
      skipped: this.results.filter(r => r.status === 'skipped').length,
      totalDuration: Date.now() - this.startTime,
      errors: this.results.filter(r => r.error).map(r => r.error!),
      warnings: [],
      screenshots: this.results.filter(r => r.screenshot).map(r => r.screenshot!),
      results: this.results
    };

    return summary;
  }

  generateHTMLReport(summary: TestSummary): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Dirt Free CRM Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric.passed { border-left: 4px solid #4CAF50; }
        .metric.failed { border-left: 4px solid #f44336; }
        .metric.skipped { border-left: 4px solid #ff9800; }
        .results { margin-top: 30px; }
        .result { padding: 10px; margin: 5px 0; border-radius: 3px; }
        .result.passed { background: #e8f5e8; }
        .result.failed { background: #ffeaea; }
        .result.skipped { background: #fff3cd; }
        .error { background: #ffebee; padding: 10px; margin: 10px 0; border-radius: 3px; }
        .screenshots { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .screenshot { border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
        .screenshot img { width: 100%; height: auto; }
        .screenshot-title { padding: 10px; background: #f5f5f5; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧪 Dirt Free CRM Test Report</h1>
        <p>Generated on: ${summary.timestamp}</p>
        <p>Total Duration: ${(summary.totalDuration / 1000).toFixed(2)}s</p>
    </div>

    <div class="summary">
        <div class="metric passed">
            <h3>✅ Passed</h3>
            <div style="font-size: 2em; font-weight: bold;">${summary.passed}</div>
        </div>
        <div class="metric failed">
            <h3>❌ Failed</h3>
            <div style="font-size: 2em; font-weight: bold;">${summary.failed}</div>
        </div>
        <div class="metric skipped">
            <h3>⏭️ Skipped</h3>
            <div style="font-size: 2em; font-weight: bold;">${summary.skipped}</div>
        </div>
        <div class="metric">
            <h3>📊 Total</h3>
            <div style="font-size: 2em; font-weight: bold;">${summary.totalTests}</div>
        </div>
    </div>

    ${summary.errors.length > 0 ? `
    <div class="errors">
        <h2>🚨 Errors Found</h2>
        ${summary.errors.map(error => `<div class="error">${error}</div>`).join('')}
    </div>
    ` : ''}

    <div class="results">
        <h2>📋 Test Results</h2>
        ${summary.results.map(result => `
            <div class="result ${result.status}">
                <strong>${result.name}</strong>
                <span style="float: right;">${result.duration}ms</span>
                <div style="color: #666; font-size: 0.9em;">${result.status.toUpperCase()}</div>
                ${result.error ? `<div style="color: red; margin-top: 5px;">${result.error}</div>` : ''}
            </div>
        `).join('')}
    </div>

    ${summary.screenshots.length > 0 ? `
    <div class="screenshots">
        <h2>📸 Screenshots</h2>
        ${summary.screenshots.map(screenshot => {
          const filename = path.basename(screenshot);
          return `
            <div class="screenshot">
                <div class="screenshot-title">${filename}</div>
                <img src="${screenshot}" alt="${filename}">
            </div>
          `;
        }).join('')}
    </div>
    ` : ''}
</body>
</html>
    `;
  }

  async writeReports() {
    const summary = this.generateSummary();

    // Ensure results directory exists
    const resultsDir = 'tests/results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Write JSON report
    fs.writeFileSync(
      path.join(resultsDir, 'test-results-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Write HTML report
    const htmlReport = this.generateHTMLReport(summary);
    fs.writeFileSync(
      path.join(resultsDir, 'test-report.html'),
      htmlReport
    );

    console.log('📊 Test reports generated:');
    console.log('  JSON: tests/results/test-results-summary.json');
    console.log('  HTML: tests/results/test-report.html');
  }
}

// Export singleton instance
export const testReportGenerator = new TestReportGenerator();

test.afterAll(async () => {
  await testReportGenerator.writeReports();
});