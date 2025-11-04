import { chromium, FullConfig } from '@playwright/test';
import { AuthHelper } from './utils/auth';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

  console.log('🚀 Starting global setup...');

  // Seed the database
  console.log('📡 Seeding test database...');
  const seedSecret = process.env.TEST_SEED_SECRET;
  if (!seedSecret) {
    throw new Error('TEST_SEED_SECRET environment variable is required');
  }

  try {
    const response = await fetch(`${baseURL}/api/test/seed`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${seedSecret}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to seed database: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Database seeded:', result.message);
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    throw error;
  }

  // Create authentication states for each role
  console.log('🔐 Creating authentication states...');

  const browser = await chromium.launch();
  const authHelper = new AuthHelper(baseURL);

  try {
    // Create storage states for each role
    const roles = ['admin', 'dispatcher', 'technician'] as const;

    for (const role of roles) {
      console.log(`   Creating auth state for ${role}...`);

      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await authHelper.createStorageState(page, role);
        console.log(`   ✅ ${role} auth state created`);
      } catch (error) {
        console.error(`   ❌ Failed to create ${role} auth state:`, error);
        throw error;
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup completed');
}

export default globalSetup;