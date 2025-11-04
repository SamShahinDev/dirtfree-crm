const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

async function testConnection() {
  console.log('🔍 Testing Supabase connection...')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Missing environment variables')
    process.exit(1)
  }

  console.log('📡 URL:', supabaseUrl)
  console.log('🔑 Key:', anonKey.substring(0, 20) + '...')

  const supabase = createClient(supabaseUrl, anonKey)

  try {
    // Test 1: Basic connection
    console.log('\n📋 Test 1: Basic connection...')
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Connection failed:', error.message)
      console.error('Full error:', error)

      if (error.message.includes('Could not find the table')) {
        console.log('\n💡 Solution: Tables do not exist. You need to run migrations:')
        console.log('1. Go to https://supabase.com/dashboard/project/fydbcptxhfrncswwwzoe/sql')
        console.log('2. Copy contents of scripts/fixed-migration.sql')
        console.log('3. Paste and run the migration')
      }

      return false
    } else {
      console.log('✅ Connection successful!')
      console.log('📊 Sample data:', data)
      return true
    }

  } catch (err) {
    console.error('❌ Connection test failed:', err.message)
    return false
  }
}

// Test 2: Insert test
async function testInsert() {
  console.log('\n📝 Test 2: Insert test...')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    const testCustomer = {
      name: 'Test Customer ' + Date.now(),
      email: 'test@example.com',
      phone_e164: '+15551234567',
      address_line1: '123 Test Street',
      city: 'Test City',
      state: 'TX',
      postal_code: '12345',
      zone: 'Central',
      notes: 'Test customer created by connection test'
    }

    const { data, error } = await supabase
      .from('customers')
      .insert(testCustomer)
      .select('id')
      .single()

    if (error) {
      console.error('❌ Insert failed:', error.message)
      return false
    } else {
      console.log('✅ Insert successful! Customer ID:', data.id)

      // Clean up test data
      await supabase.from('customers').delete().eq('id', data.id)
      console.log('🧹 Test data cleaned up')

      return true
    }

  } catch (err) {
    console.error('❌ Insert test failed:', err.message)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Running Supabase connection tests...\n')

  const connectionSuccess = await testConnection()

  if (connectionSuccess) {
    const insertSuccess = await testInsert()

    if (insertSuccess) {
      console.log('\n🎉 All tests passed! Database is ready.')
    } else {
      console.log('\n⚠️  Connection works but insert failed. Check RLS policies.')
    }
  }

  console.log('\n📊 Test Summary:')
  console.log('- Connection: ' + (connectionSuccess ? '✅' : '❌'))
  console.log('- Insert: ' + (connectionSuccess ? '✅ (not tested)' : '❌'))
}

runAllTests()