#!/usr/bin/env ts-node

/**
 * Environment Variable Checker
 *
 * Validates that required environment variables are present.
 * Exits with code 1 if any required variables are missing.
 * Never logs actual values for security.
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env.local
config({ path: join(process.cwd(), '.env.local') });

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
] as const;

function checkEnvironmentVariables(): void {
  console.log('🔍 Checking required environment variables...\n');

  let hasErrors = false;

  for (const envVar of requiredEnvVars) {
    const isPresent = !!process.env[envVar];
    const status = isPresent ? '✅' : '❌';

    console.log(`${status} ${envVar}`);

    if (!isPresent) {
      hasErrors = true;
    }
  }

  console.log('');

  if (hasErrors) {
    console.error('❌ Some required environment variables are missing.');
    console.error('💡 Check your .env.local file and ensure all variables are set.');
    process.exit(1);
  } else {
    console.log('✅ All required environment variables are present.');
  }
}

// Run the check
checkEnvironmentVariables();