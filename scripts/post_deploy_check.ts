#!/usr/bin/env tsx

/**
 * Post-Deploy Health Check Script
 *
 * Validates deployment health by testing critical endpoints
 * Usage: tsx scripts/post_deploy_check.ts --url https://app.example.com [--timeout 30]
 */

interface HealthCheckResult {
  endpoint: string;
  status: 'pass' | 'fail' | 'warn';
  responseTime: number;
  statusCode?: number;
  error?: string;
  data?: any;
}

interface CheckOptions {
  timeout: number;
  verbose: boolean;
}

class PostDeployChecker {
  private baseUrl: string;
  private options: CheckOptions;

  constructor(baseUrl: string, options: Partial<CheckOptions> = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.options = {
      timeout: 30000, // 30 seconds default
      verbose: false,
      ...options,
    };

    console.log(`🏥 Health check initialized for: ${this.baseUrl}`);
    if (this.options.verbose) {
      console.log(`⚙️  Timeout: ${this.options.timeout}ms`);
    }
  }

  private async makeRequest(
    path: string,
    options: RequestInit = {}
  ): Promise<{ response: Response; time: number }> {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'PostDeployChecker/1.0',
          ...options.headers,
        },
      });

      const time = Date.now() - startTime;
      clearTimeout(timeoutId);

      return { response, time };
    } catch (error) {
      clearTimeout(timeoutId);
      const time = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.options.timeout}ms`);
      }

      throw error;
    }
  }

  private async checkHealthEndpoint(): Promise<HealthCheckResult> {
    try {
      const { response, time } = await this.makeRequest('/api/ready');

      if (response.status === 200) {
        const data = await response.json();
        return {
          endpoint: '/api/ready',
          status: 'pass',
          responseTime: time,
          statusCode: response.status,
          data,
        };
      } else {
        return {
          endpoint: '/api/ready',
          status: 'fail',
          responseTime: time,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        endpoint: '/api/ready',
        status: 'fail',
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkOpsHeartbeat(): Promise<HealthCheckResult> {
    try {
      const { response, time } = await this.makeRequest('/api/ops/heartbeat');

      if (response.status === 200) {
        const data = await response.json();

        // Validate expected heartbeat structure
        const isValidHeartbeat = data &&
          typeof data.timestamp === 'string' &&
          typeof data.environment === 'string' &&
          typeof data.version === 'string';

        return {
          endpoint: '/api/ops/heartbeat',
          status: isValidHeartbeat ? 'pass' : 'warn',
          responseTime: time,
          statusCode: response.status,
          data,
        };
      } else {
        return {
          endpoint: '/api/ops/heartbeat',
          status: 'fail',
          responseTime: time,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        endpoint: '/api/ops/heartbeat',
        status: 'fail',
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkOpsSamples(): Promise<HealthCheckResult> {
    try {
      const { response, time } = await this.makeRequest('/api/ops/samples');

      if (response.status === 200) {
        const data = await response.json();

        // Validate samples structure
        const isValidSamples = data &&
          Array.isArray(data.metrics) &&
          typeof data.summary === 'object';

        return {
          endpoint: '/api/ops/samples',
          status: isValidSamples ? 'pass' : 'warn',
          responseTime: time,
          statusCode: response.status,
          data: this.options.verbose ? data : { metricsCount: data?.metrics?.length },
        };
      } else {
        return {
          endpoint: '/api/ops/samples',
          status: 'fail',
          responseTime: time,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        endpoint: '/api/ops/samples',
        status: 'fail',
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkDashboardPage(): Promise<HealthCheckResult> {
    try {
      const { response, time } = await this.makeRequest('/', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (response.status === 200) {
        const html = await response.text();

        // Basic HTML validation
        const hasTitle = html.includes('<title>');
        const hasNextJs = html.includes('_next') || html.includes('__NEXT_DATA__');
        const isValidHtml = html.includes('<!DOCTYPE html>') || html.includes('<html');

        const score = [hasTitle, hasNextJs, isValidHtml].filter(Boolean).length;
        const status = score >= 2 ? 'pass' : score >= 1 ? 'warn' : 'fail';

        return {
          endpoint: '/',
          status,
          responseTime: time,
          statusCode: response.status,
          data: this.options.verbose ? { hasTitle, hasNextJs, isValidHtml } : { score },
        };
      } else if (response.status === 401 || response.status === 403) {
        // Auth redirect is expected for dashboard, so this is actually good
        return {
          endpoint: '/',
          status: 'pass',
          responseTime: time,
          statusCode: response.status,
          data: { note: 'Auth protection working correctly' },
        };
      } else {
        return {
          endpoint: '/',
          status: 'fail',
          responseTime: time,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
        };
      }
    } catch (error) {
      return {
        endpoint: '/',
        status: 'fail',
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkCronEndpoint(): Promise<HealthCheckResult> {
    try {
      // Check if cron endpoint exists (should return 401 without auth)
      const { response, time } = await this.makeRequest('/api/cron/send-reminders');

      if (response.status === 401) {
        // Expected response - cron is protected
        return {
          endpoint: '/api/cron/send-reminders',
          status: 'pass',
          responseTime: time,
          statusCode: response.status,
          data: { note: 'Cron endpoint properly protected' },
        };
      } else if (response.status === 404) {
        // Cron might be disabled in this environment
        return {
          endpoint: '/api/cron/send-reminders',
          status: 'warn',
          responseTime: time,
          statusCode: response.status,
          data: { note: 'Cron endpoint not found (may be disabled)' },
        };
      } else {
        return {
          endpoint: '/api/cron/send-reminders',
          status: 'warn',
          responseTime: time,
          statusCode: response.status,
          error: `Unexpected status: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        endpoint: '/api/cron/send-reminders',
        status: 'warn',
        responseTime: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async runChecks(): Promise<void> {
    console.log('🔍 Running post-deploy health checks...\n');

    const checks = [
      { name: 'Health Endpoint', fn: () => this.checkHealthEndpoint() },
      { name: 'Ops Heartbeat', fn: () => this.checkOpsHeartbeat() },
      { name: 'Ops Samples', fn: () => this.checkOpsSamples() },
      { name: 'Dashboard Page', fn: () => this.checkDashboardPage() },
      { name: 'Cron Protection', fn: () => this.checkCronEndpoint() },
    ];

    const results: HealthCheckResult[] = [];

    for (const check of checks) {
      process.stdout.write(`⏳ ${check.name}... `);

      try {
        const result = await check.fn();
        results.push(result);

        const emoji = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
        const timeStr = `(${result.responseTime}ms)`;
        const statusStr = result.statusCode ? ` [${result.statusCode}]` : '';

        console.log(`${emoji} ${result.status.toUpperCase()}${statusStr} ${timeStr}`);

        if (this.options.verbose && result.error) {
          console.log(`   Error: ${result.error}`);
        }

        if (this.options.verbose && result.data) {
          console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
        }
      } catch (error) {
        console.log(`❌ FAIL (${error})`);
        results.push({
          endpoint: check.name,
          status: 'fail',
          responseTime: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Summary
    console.log('\n📊 Health Check Summary:');
    console.log('=' .repeat(50));

    const passed = results.filter(r => r.status === 'pass').length;
    const warned = results.filter(r => r.status === 'warn').length;
    const failed = results.filter(r => r.status === 'fail').length;

    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️  Warnings: ${warned}`);
    console.log(`❌ Failed: ${failed}`);

    const avgResponseTime = results
      .filter(r => r.responseTime > 0)
      .reduce((sum, r) => sum + r.responseTime, 0) / results.length;

    console.log(`⏱️  Average response time: ${Math.round(avgResponseTime)}ms`);

    if (failed > 0) {
      console.log('\n💥 Critical failures detected:');
      results
        .filter(r => r.status === 'fail')
        .forEach(r => {
          console.log(`   • ${r.endpoint}: ${r.error}`);
        });

      console.log('\n❌ Post-deploy check FAILED');
      process.exit(1);
    }

    if (warned > 0) {
      console.log('\n⚠️  Warnings (non-critical):');
      results
        .filter(r => r.status === 'warn')
        .forEach(r => {
          console.log(`   • ${r.endpoint}: ${r.error || 'Check manually'}`);
        });
    }

    console.log('\n🎉 Post-deploy check PASSED');
  }
}

// CLI Implementation
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Post-Deploy Health Check Tool

Usage:
  tsx scripts/post_deploy_check.ts --url https://app.example.com [options]

Options:
  --url URL            Target URL to check (required)
  --timeout SECONDS    Request timeout in seconds (default: 30)
  --verbose           Show detailed output
  --help              Show this help

Examples:
  tsx scripts/post_deploy_check.ts --url https://staging.dirt-free-crm.com
  tsx scripts/post_deploy_check.ts --url https://dirt-free-crm.com --timeout 60 --verbose
`);
    process.exit(0);
  }

  const urlIndex = args.indexOf('--url');
  if (urlIndex === -1 || !args[urlIndex + 1]) {
    console.error('❌ --url is required');
    process.exit(1);
  }

  const url = args[urlIndex + 1];

  const timeoutIndex = args.indexOf('--timeout');
  const timeout = timeoutIndex !== -1 && args[timeoutIndex + 1]
    ? parseInt(args[timeoutIndex + 1]) * 1000
    : 30000;

  const verbose = args.includes('--verbose');

  // Validate URL
  try {
    new URL(url);
  } catch {
    console.error('❌ Invalid URL provided');
    process.exit(1);
  }

  const checker = new PostDeployChecker(url, { timeout, verbose });
  await checker.runChecks();
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { PostDeployChecker };