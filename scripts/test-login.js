const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, anonKey)

async function testLogin() {
  console.log('Testing login functionality...\n')

  const testCredentials = {
    email: 'admin@dirtfreecarpet.com',
    password: 'TestPassword123!'
  }

  try {
    // Test login
    const { data, error } = await supabase.auth.signInWithPassword(testCredentials)

    if (error) {
      console.error('❌ Login failed:', error.message)
      return
    }

    console.log('✓ Login successful!')
    console.log(`  User ID: ${data.user.id}`)
    console.log(`  Email: ${data.user.email}`)

    // Test getting user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single()

    if (profileError) {
      console.error('❌ Failed to get user profile:', profileError.message)
      return
    }

    console.log('✓ User profile found!')
    console.log(`  Role: ${profile.role}`)
    console.log(`  Display Name: ${profile.display_name}`)

    // Test customer access
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('count(*)', { count: 'exact', head: true })

    if (customerError) {
      console.error('❌ Failed to access customers:', customerError.message)
      return
    }

    console.log('✓ Customer table access successful!')

    // Sign out
    await supabase.auth.signOut()
    console.log('✓ Sign out successful!')

    console.log('\n✅ All login tests passed!')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testLogin().catch(console.error)