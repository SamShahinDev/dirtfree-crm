#!/usr/bin/env tsx

/**
 * Database Migration Script
 *
 * Runs Supabase SQL migrations against target environment
 * Usage: tsx scripts/migrate.ts --env STAGING|PROD [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface MigrationFile {
  filename: string;
  version: string;
  description: string;
  sql: string;
}

interface MigrationResult {
  version: string;
  filename: string;
  success: boolean;
  error?: string;
  executionTime?: number;
}

class DatabaseMigrator {
  private supabase;
  private environment: string;
  private dryRun: boolean;

  constructor(environment: string, dryRun: boolean = false) {
    this.environment = environment;
    this.dryRun = dryRun;

    // Get environment-specific credentials
    const config = this.getEnvironmentConfig(environment);

    this.supabase = createClient(config.url, config.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log(`🗃️  Migrator initialized for ${environment}${dryRun ? ' (DRY RUN)' : ''}`);
  }

  private getEnvironmentConfig(env: string) {
    switch (env.toUpperCase()) {
      case 'STAGING':
        return {
          url: process.env.STAGING_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
          serviceKey: process.env.STAGING_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        };
      case 'PROD':
      case 'PRODUCTION':
        return {
          url: process.env.PROD_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
          serviceKey: process.env.PROD_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
        };
      default:
        throw new Error(`Unknown environment: ${env}. Use STAGING or PROD`);
    }
  }

  private async ensureMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(14) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        checksum VARCHAR(64),
        execution_time_ms INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
      ON schema_migrations(applied_at);
    `;

    if (this.dryRun) {
      console.log('🔍 [DRY RUN] Would ensure migrations table exists');
      return;
    }

    const { error } = await this.supabase.rpc('exec_sql', { sql: createTableSQL });
    if (error) {
      throw new Error(`Failed to create migrations table: ${error.message}`);
    }
  }

  private async getAppliedMigrations(): Promise<Set<string>> {
    if (this.dryRun) {
      console.log('🔍 [DRY RUN] Would fetch applied migrations');
      return new Set();
    }

    const { data, error } = await this.supabase
      .from('schema_migrations')
      .select('version')
      .order('version');

    if (error) {
      throw new Error(`Failed to fetch applied migrations: ${error.message}`);
    }

    return new Set(data?.map(row => row.version) || []);
  }

  private loadMigrationFiles(): MigrationFile[] {
    const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

    try {
      const files = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      return files.map(filename => {
        const filepath = join(migrationsDir, filename);
        const sql = readFileSync(filepath, 'utf-8');

        // Extract version from filename (format: YYYYMMDDHHMMSS_description.sql)
        const versionMatch = filename.match(/^(\d{14})_(.+)\.sql$/);
        if (!versionMatch) {
          throw new Error(`Invalid migration filename format: ${filename}`);
        }

        const [, version, description] = versionMatch;

        return {
          filename,
          version,
          description: description.replace(/_/g, ' '),
          sql,
        };
      });
    } catch (error) {
      throw new Error(`Failed to load migration files: ${error}`);
    }
  }

  private async executeMigration(migration: MigrationFile): Promise<MigrationResult> {
    const startTime = Date.now();

    try {
      if (this.dryRun) {
        console.log(`🔍 [DRY RUN] Would execute: ${migration.filename}`);
        return {
          version: migration.version,
          filename: migration.filename,
          success: true,
          executionTime: 0,
        };
      }

      // Execute the migration SQL
      const { error: execError } = await this.supabase.rpc('exec_sql', {
        sql: migration.sql
      });

      if (execError) {
        throw new Error(execError.message);
      }

      const executionTime = Date.now() - startTime;

      // Record the migration
      const { error: recordError } = await this.supabase
        .from('schema_migrations')
        .insert({
          version: migration.version,
          filename: migration.filename,
          execution_time_ms: executionTime,
        });

      if (recordError) {
        throw new Error(`Failed to record migration: ${recordError.message}`);
      }

      return {
        version: migration.version,
        filename: migration.filename,
        success: true,
        executionTime,
      };
    } catch (error) {
      return {
        version: migration.version,
        filename: migration.filename,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      };
    }
  }

  async migrate(): Promise<void> {
    try {
      console.log('🚀 Starting database migration...');

      await this.ensureMigrationsTable();

      const migrations = this.loadMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();

      const pendingMigrations = migrations.filter(
        migration => !appliedMigrations.has(migration.version)
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
      pendingMigrations.forEach(migration => {
        console.log(`   • ${migration.filename} - ${migration.description}`);
      });

      if (this.dryRun) {
        console.log('\n🔍 DRY RUN - No actual changes will be made');
      }

      console.log('\n🔄 Executing migrations...');

      const results: MigrationResult[] = [];

      for (const migration of pendingMigrations) {
        console.log(`⏳ ${migration.filename}...`);
        const result = await this.executeMigration(migration);
        results.push(result);

        if (result.success) {
          const timeStr = result.executionTime ? ` (${result.executionTime}ms)` : '';
          console.log(`✅ ${migration.filename}${timeStr}`);
        } else {
          console.error(`❌ ${migration.filename}: ${result.error}`);
          break; // Stop on first failure
        }
      }

      // Summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log('\n📊 Migration Summary:');
      console.log(`   Successful: ${successful}`);
      console.log(`   Failed: ${failed}`);
      console.log(`   Environment: ${this.environment}`);

      if (!this.dryRun) {
        const totalTime = results.reduce((sum, r) => sum + (r.executionTime || 0), 0);
        console.log(`   Total time: ${totalTime}ms`);
      }

      if (failed > 0) {
        process.exit(1);
      }

      console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    }
  }

  async status(): Promise<void> {
    try {
      console.log(`📊 Migration Status - ${this.environment}`);
      console.log('=' * 50);

      const migrations = this.loadMigrationFiles();
      const appliedMigrations = await this.getAppliedMigrations();

      console.log(`Total migrations: ${migrations.length}`);
      console.log(`Applied: ${appliedMigrations.size}`);
      console.log(`Pending: ${migrations.length - appliedMigrations.size}`);

      const pending = migrations.filter(m => !appliedMigrations.has(m.version));
      if (pending.length > 0) {
        console.log('\nPending migrations:');
        pending.forEach(migration => {
          console.log(`  • ${migration.filename} - ${migration.description}`);
        });
      }

    } catch (error) {
      console.error('Failed to get migration status:', error);
      process.exit(1);
    }
  }
}

// CLI Implementation
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Migration Tool

Usage:
  tsx scripts/migrate.ts --env STAGING|PROD [--dry-run] [--status]

Options:
  --env STAGING|PROD    Target environment
  --dry-run            Show what would be executed without making changes
  --status             Show migration status without executing
  --help               Show this help

Examples:
  tsx scripts/migrate.ts --env STAGING --dry-run
  tsx scripts/migrate.ts --env PROD
  tsx scripts/migrate.ts --env STAGING --status
`);
    process.exit(0);
  }

  const envIndex = args.indexOf('--env');
  if (envIndex === -1 || !args[envIndex + 1]) {
    console.error('❌ --env is required. Use STAGING or PROD');
    process.exit(1);
  }

  const environment = args[envIndex + 1];
  const dryRun = args.includes('--dry-run');
  const statusOnly = args.includes('--status');

  const migrator = new DatabaseMigrator(environment, dryRun);

  if (statusOnly) {
    await migrator.status();
  } else {
    await migrator.migrate();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

export { DatabaseMigrator };