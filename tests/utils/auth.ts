import { Page, BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type UserRole = 'admin' | 'dispatcher' | 'technician';

export interface TestUser {
  email: string;
  password: string;
  role: UserRole;
  id?: string;
}

export const TEST_USERS: Record<UserRole, TestUser> = {
  admin: { email: 'admin@acme.test', password: 'Test123!@#', role: 'admin' },
  dispatcher: { email: 'dispatcher@acme.test', password: 'Test123!@#', role: 'dispatcher' },
  technician: { email: 'tech@acme.test', password: 'Test123!@#', role: 'technician' },
};

export class AuthHelper {
  private supabase;
  private baseURL: string;

  constructor(baseURL: string) {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.baseURL = baseURL;
  }

  /**
   * Programmatic login via Supabase client
   */
  async loginProgrammatically(role: UserRole): Promise<{ accessToken: string; refreshToken: string }> {
    const user = TEST_USERS[role];

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });

    if (error || !data.session) {
      throw new Error(`Failed to login as ${role}: ${error?.message}`);
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  /**
   * UI login fallback for when programmatic login fails
   */
  async loginViaUI(page: Page, role: UserRole): Promise<void> {
    const user = TEST_USERS[role];

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill login form
    await page.getByTestId('email-input').fill(user.email);
    await page.getByTestId('password-input').fill(user.password);
    await page.getByTestId('login-button').click();

    // Wait for redirect to dashboard
    await page.waitForURL(url => url.pathname !== '/login', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  }

  /**
   * Save storage state for a specific role
   */
  async saveStorageState(context: BrowserContext, role: UserRole): Promise<void> {
    const authDir = path.join(__dirname, '..', '.auth');

    // Ensure auth directory exists
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }

    const storageStatePath = path.join(authDir, `${role}.json`);
    await context.storageState({ path: storageStatePath });
  }

  /**
   * Create storage state for a role using programmatic login
   */
  async createStorageState(page: Page, role: UserRole): Promise<void> {
    try {
      // Try programmatic login first
      const tokens = await this.loginProgrammatically(role);

      // Set the session in the browser
      await page.goto('/');

      await page.evaluate(
        ({ accessToken, refreshToken }) => {
          localStorage.setItem('supabase.auth.token', JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 3600,
            token_type: 'bearer',
          }));
        },
        tokens
      );

      // Reload to apply the session
      await page.reload();
      await page.waitForLoadState('networkidle');

    } catch (error) {
      console.warn(`Programmatic login failed for ${role}, falling back to UI login:`, error);

      // Fallback to UI login
      await this.loginViaUI(page, role);
    }

    // Verify we're logged in by checking for user-specific elements
    await page.waitForSelector('[data-testid="user-menu"]', { timeout: 5000 });

    // Save the storage state
    await this.saveStorageState(page.context(), role);
  }

  /**
   * Logout from current session
   */
  async logout(page: Page): Promise<void> {
    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout-button').click();
    await page.waitForURL('/login');
  }

  /**
   * Get the file path for a role's storage state
   */
  getStorageStatePath(role: UserRole): string {
    return path.join(__dirname, '..', '.auth', `${role}.json`);
  }

  /**
   * Check if storage state exists for a role
   */
  hasStorageState(role: UserRole): boolean {
    return fs.existsSync(this.getStorageStatePath(role));
  }

  /**
   * Delete storage state for a role
   */
  deleteStorageState(role: UserRole): void {
    const path = this.getStorageStatePath(role);
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  }

  /**
   * Delete all storage states
   */
  deleteAllStorageStates(): void {
    const authDir = path.join(__dirname, '..', '.auth');
    if (fs.existsSync(authDir)) {
      const files = fs.readdirSync(authDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(authDir, file));
        }
      }
    }
  }
}