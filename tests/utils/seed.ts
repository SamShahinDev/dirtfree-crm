import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'dispatcher' | 'technician';
  id?: string;
}

export interface TestData {
  users: TestUser[];
  customerId?: string;
  jobIds?: string[];
  reminderId?: string;
}

const TEST_USERS: TestUser[] = [
  { email: 'admin@acme.test', password: 'Test123!@#', role: 'admin' },
  { email: 'dispatcher@acme.test', password: 'Test123!@#', role: 'dispatcher' },
  { email: 'tech@acme.test', password: 'Test123!@#', role: 'technician' },
];

export class TestSeeder {
  private supabase;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async cleanDatabase() {
    try {
      // Delete test data in reverse dependency order
      await this.supabase.from('audit_logs').delete().ilike('user_email', '%@acme.test');
      await this.supabase.from('sms_logs').delete().ilike('to_number', '+1555%');
      await this.supabase.from('reminders').delete().ilike('customer_name', 'Test Customer%');
      await this.supabase.from('jobs').delete().ilike('customer_name', 'Test Customer%');
      await this.supabase.from('customers').delete().ilike('name', 'Test Customer%');

      // Delete test users from auth
      const { data: users } = await this.supabase.auth.admin.listUsers();
      const testUsers = users?.users.filter(u => u.email?.endsWith('@acme.test')) || [];
      for (const user of testUsers) {
        await this.supabase.auth.admin.deleteUser(user.id);
      }

      // Delete test profiles
      await this.supabase.from('profiles').delete().ilike('email', '%@acme.test');
    } catch (error) {
      console.error('Error cleaning database:', error);
    }
  }

  async seedDatabase(): Promise<TestData> {
    const testData: TestData = { users: [] };

    try {
      // Create test users
      for (const user of TEST_USERS) {
        const { data: authUser, error } = await this.supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true,
        });

        if (!error && authUser?.user) {
          // Create profile
          await this.supabase.from('profiles').upsert({
            id: authUser.user.id,
            email: user.email,
            role: user.role,
            full_name: `Test ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}`,
            updated_at: new Date().toISOString(),
          });

          testData.users.push({ ...user, id: authUser.user.id });
        }
      }

      // Create test customer
      const { data: customer } = await this.supabase
        .from('customers')
        .insert({
          name: 'Test Customer Inc',
          email: 'customer@test.example.com',
          phone: '+15555551234',
          address: '123 Test St',
          city: 'Test City',
          state: 'TX',
          zip: '75001',
          notes: 'Test customer for E2E tests',
        })
        .select()
        .single();

      if (customer) {
        testData.customerId = customer.id;

        // Create test jobs in different zones/statuses
        const techUser = testData.users.find(u => u.role === 'technician');
        const zones = ['Zone A', 'Zone B', 'Zone C'];
        const statuses = ['scheduled', 'in_progress', 'completed'];

        const jobsToCreate = zones.map((zone, i) => ({
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_address: customer.address,
          customer_city: customer.city,
          customer_state: customer.state,
          customer_zip: customer.zip,
          zone_number: zone,
          status: statuses[i % statuses.length],
          assigned_tech_id: techUser?.id || null,
          scheduled_date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
          job_type: 'cleaning',
          notes: `Test job in ${zone}`,
        }));

        const { data: jobs } = await this.supabase
          .from('jobs')
          .insert(jobsToCreate)
          .select();

        if (jobs) {
          testData.jobIds = jobs.map(j => j.id);
        }

        // Create a reminder due "now"
        const { data: reminder } = await this.supabase
          .from('reminders')
          .insert({
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            scheduled_date: new Date().toISOString(),
            type: 'follow_up',
            origin: 'manual',
            status: 'pending',
            message: 'Test reminder for E2E tests',
          })
          .select()
          .single();

        if (reminder) {
          testData.reminderId = reminder.id;
        }

        // Add an opted-out phone number for STOP compliance testing
        await this.supabase
          .from('sms_opt_outs')
          .insert({
            phone_number: '+15555559999',
            opted_out_at: new Date().toISOString(),
          });
      }
    } catch (error) {
      console.error('Error seeding database:', error);
      throw error;
    }

    return testData;
  }

  async seed(): Promise<TestData> {
    await this.cleanDatabase();
    return await this.seedDatabase();
  }
}