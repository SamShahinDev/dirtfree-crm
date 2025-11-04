const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupRLS() {
  console.log('Setting up RLS policies...\n')

  try {
    // Check current RLS status
    const { data: rlsCheck } = await supabase
      .rpc('sql', {
        query: `
          SELECT tablename, rowsecurity
          FROM pg_tables
          WHERE tablename IN ('customers', 'user_profiles', 'jobs', 'service_history', 'audit_log');
        `
      })

    console.log('Current RLS status:', rlsCheck)

    // Enable RLS on key tables
    const enableRLSQueries = [
      'ALTER TABLE customers ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE service_history ENABLE ROW LEVEL SECURITY;',
      'ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;'
    ]

    for (const query of enableRLSQueries) {
      try {
        await supabase.rpc('sql', { query })
        console.log('✓ Executed:', query)
      } catch (error) {
        console.log('⚠️  Already enabled or error:', query)
      }
    }

    // Create basic RLS policies
    const policies = [
      // User profiles - users can read their own profile, admins can read all
      `
      CREATE POLICY "user_profiles_select_policy" ON user_profiles
      FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.user_id = auth.uid() AND up.role = 'admin'
        )
      );
      `,

      // Customers - authenticated users can read all customers
      `
      CREATE POLICY "customers_select_policy" ON customers
      FOR SELECT USING (auth.role() = 'authenticated');
      `,

      // Customers - only admins and dispatchers can insert/update/delete
      `
      CREATE POLICY "customers_modify_policy" ON customers
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.user_id = auth.uid()
          AND up.role IN ('admin', 'dispatcher')
        )
      );
      `,

      // Jobs - authenticated users can read all
      `
      CREATE POLICY "jobs_select_policy" ON jobs
      FOR SELECT USING (auth.role() = 'authenticated');
      `,

      // Service history - authenticated users can read all
      `
      CREATE POLICY "service_history_select_policy" ON service_history
      FOR SELECT USING (auth.role() = 'authenticated');
      `,

      // Audit log - only admins can read
      `
      CREATE POLICY "audit_log_select_policy" ON audit_log
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.user_id = auth.uid() AND up.role = 'admin'
        )
      );
      `
    ]

    for (const policy of policies) {
      try {
        await supabase.rpc('sql', { query: policy })
        console.log('✓ Created policy')
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠️  Policy already exists')
        } else {
          console.error('❌ Policy creation failed:', error.message)
        }
      }
    }

    console.log('\n✅ RLS setup completed!')

    // Test access with our test user
    console.log('\n🧪 Testing access...')

    // Sign in as test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@dirtfreecarpet.com',
      password: 'TestPassword123!'
    })

    if (authError) {
      console.error('❌ Test login failed:', authError.message)
      return
    }

    // Test customer access
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('count(*)', { count: 'exact', head: true })

    if (customerError) {
      console.error('❌ Customer access failed:', customerError.message)
    } else {
      console.log('✓ Customer access working!')
    }

    await supabase.auth.signOut()

  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

setupRLS().catch(console.error)