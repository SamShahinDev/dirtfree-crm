import { FullConfig } from '@playwright/test';
import { AuthHelper } from './utils/auth';

async function globalTeardown(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

  console.log('🧹 Starting global teardown...');

  // Clean up authentication states
  console.log('🔐 Cleaning authentication states...');
  const authHelper = new AuthHelper(baseURL);
  authHelper.deleteAllStorageStates();

  // Optionally clean the database (uncomment if needed)
  // console.log('🗑️ Cleaning test database...');
  // const seedSecret = process.env.TEST_SEED_SECRET;
  // if (seedSecret) {
  //   try {
  //     const response = await fetch(`${baseURL}/api/test/seed`, {
  //       method: 'DELETE',
  //       headers: {
  //         'Authorization': `Bearer ${seedSecret}`,
  //         'Content-Type': 'application/json',
  //       },
  //     });

  //     if (response.ok) {
  //       console.log('✅ Test database cleaned');
  //     } else {
  //       console.warn('⚠️ Failed to clean test database:', response.statusText);
  //     }
  //   } catch (error) {
  //     console.warn('⚠️ Failed to clean test database:', error);
  //   }
  // }

  console.log('✅ Global teardown completed');
}

export default globalTeardown;