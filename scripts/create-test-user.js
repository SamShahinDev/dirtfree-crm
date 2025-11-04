const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTestUsers() {
  console.log('Creating test users...\n')

  const testUsers = [
    {
      email: 'admin@dirtfreecarpet.com',
      password: 'TestPassword123!',
      role: 'admin',
      display_name: 'Admin User',
      zone: 'Central'
    },
    {
      email: 'dispatcher@dirtfreecarpet.com',
      password: 'TestPassword123!',
      role: 'dispatcher',
      display_name: 'Dispatcher User',
      zone: 'N'
    },
    {
      email: 'tech@dirtfreecarpet.com',
      password: 'TestPassword123!',
      role: 'technician',
      display_name: 'Technician User',
      zone: 'S'
    }
  ]

  for (const user of testUsers) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true
      })

      if (authError) {
        console.error(`❌ Failed to create ${user.email}:`, authError.message)
        continue
      }

      console.log(`✓ Created auth user: ${user.email}`)

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: authData.user.id,
          role: user.role,
          display_name: user.display_name,
          zone: user.zone
        })

      if (profileError) {
        console.error(`❌ Failed to create profile for ${user.email}:`, profileError.message)
        continue
      }

      console.log(`✓ Created profile for ${user.email} (${user.role})`)
      console.log(`  Login with: ${user.email} / ${user.password}\n`)

    } catch (error) {
      console.error(`Error creating ${user.email}:`, error)
    }
  }

  console.log('\n✅ Test users created successfully!')
  console.log('\nYou can now log in at http://localhost:3000/login with:')
  console.log('- admin@dirtfreecarpet.com / TestPassword123! (Admin)')
  console.log('- dispatcher@dirtfreecarpet.com / TestPassword123! (Dispatcher)')
  console.log('- tech@dirtfreecarpet.com / TestPassword123! (Technician)')
}

createTestUsers().catch(console.error)