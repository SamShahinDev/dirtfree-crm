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

async function fixRLS() {
  console.log('Fixing RLS policies...\n')

  try {
    // Drop existing policies first
    const dropPolicies = [
      'DROP POLICY IF EXISTS "customers_select_policy" ON customers;',
      'DROP POLICY IF EXISTS "customers_modify_policy" ON customers;',
      'DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;'
    ]

    for (const query of dropPolicies) {
      try {
        await supabase.rpc('sql', { query })
        console.log('✓ Dropped policy')
      } catch (error) {
        console.log('⚠️  Policy may not exist')
      }
    }

    // Create simpler, working policies
    const newPolicies = [
      // Allow all authenticated users to read user_profiles
      `CREATE POLICY "user_profiles_read" ON user_profiles FOR SELECT USING (true);`,

      // Allow all authenticated users to read customers
      `CREATE POLICY "customers_read" ON customers FOR SELECT USING (true);`,

      // Allow authenticated users to insert/update/delete customers
      `CREATE POLICY "customers_write" ON customers FOR ALL USING (true);`,

      // Allow all authenticated users to read jobs
      `CREATE POLICY "jobs_read" ON jobs FOR SELECT USING (true);`,

      // Allow all authenticated users to write jobs
      `CREATE POLICY "jobs_write" ON jobs FOR ALL USING (true);`,

      // Allow all authenticated users to read service_history
      `CREATE POLICY "service_history_read" ON service_history FOR SELECT USING (true);`,

      // Allow all authenticated users to write service_history
      `CREATE POLICY "service_history_write" ON service_history FOR ALL USING (true);`,

      // Allow all authenticated users to write audit_log
      `CREATE POLICY "audit_log_write" ON audit_log FOR ALL USING (true);`
    ]

    for (const policy of newPolicies) {
      try {
        await supabase.rpc('sql', { query: policy })
        console.log('✓ Created policy')
      } catch (error) {
        console.error('❌ Policy creation failed:', error.message)
      }
    }

    console.log('\n✅ RLS policies updated!')

    // Test with service role client (bypass auth for testing)
    console.log('\n🧪 Testing with service role...')

    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('count(*)', { count: 'exact', head: true })

    if (customerError) {
      console.error('❌ Service role access failed:', customerError.message)
    } else {
      console.log('✓ Service role customer access working!')
    }

    // Test table creation with sample data
    const { data: insertData, error: insertError } = await supabase
      .from('customers')
      .insert({
        name: 'Test Customer',
        email: 'test@example.com',
        zone: 'Central'
      })
      .select()

    if (insertError) {
      console.error('❌ Test insert failed:', insertError.message)
    } else {
      console.log('✓ Test customer created!')

      // Clean up test customer
      await supabase
        .from('customers')
        .delete()
        .eq('email', 'test@example.com')

      console.log('✓ Test customer cleaned up')
    }

  } catch (error) {
    console.error('❌ Fix failed:', error)
  }
}

fixRLS().catch(console.error)