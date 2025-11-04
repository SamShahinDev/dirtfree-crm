const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAuth() {
  console.log('Testing Supabase Authentication...\n');

  // Test connection
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('Service role key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  // List all users
  console.log('\n1. Checking existing users...');
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('Error listing users:', error);
    } else {
      console.log(`Found ${users.users.length} users:`);
      users.users.forEach(user => {
        console.log(`  - ${user.email} (created: ${new Date(user.created_at).toLocaleDateString()})`);
      });
    }
  } catch (err) {
    console.error('Failed to list users:', err);
  }

  // Try to authenticate with test credentials
  console.log('\n2. Testing authentication with admin@dirtfreecarpet.com...');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@dirtfreecarpet.com',
      password: 'TestPassword123!'
    });

    if (error) {
      console.error('Authentication failed:', error.message);

      // If user doesn't exist, create it
      if (error.message.includes('Invalid login credentials')) {
        console.log('\n3. User might not exist. Creating test users...');

        const testUsers = [
          { email: 'admin@dirtfreecarpet.com', password: 'TestPassword123!', role: 'admin' },
          { email: 'dispatcher@dirtfreecarpet.com', password: 'TestPassword123!', role: 'dispatcher' },
          { email: 'tech@dirtfreecarpet.com', password: 'TestPassword123!', role: 'technician' }
        ];

        for (const testUser of testUsers) {
          try {
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
              email: testUser.email,
              password: testUser.password,
              email_confirm: true
            });

            if (createError) {
              console.error(`Failed to create ${testUser.email}:`, createError.message);
            } else {
              console.log(`✓ Created user: ${testUser.email}`);

              // Add user profile
              const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                  id: newUser.user.id,
                  email: testUser.email,
                  role: testUser.role,
                  full_name: testUser.role.charAt(0).toUpperCase() + testUser.role.slice(1) + ' User'
                });

              if (profileError) {
                console.error(`Failed to create profile for ${testUser.email}:`, profileError.message);
              } else {
                console.log(`  ✓ Created profile with role: ${testUser.role}`);
              }
            }
          } catch (err) {
            console.error(`Error creating ${testUser.email}:`, err);
          }
        }
      }
    } else {
      console.log('✓ Authentication successful!');
      console.log('  User ID:', data.user?.id);
      console.log('  Email:', data.user?.email);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }

  // Check if profiles table exists
  console.log('\n4. Checking profiles table...');
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);

    if (error) {
      console.error('Error querying profiles:', error.message);
      if (error.message.includes('relation "public.profiles" does not exist')) {
        console.log('\n⚠️  Profiles table does not exist. You need to run the database migrations.');
      }
    } else {
      console.log(`Found ${profiles?.length || 0} profiles`);
    }
  } catch (err) {
    console.error('Failed to check profiles:', err);
  }
}

testAuth().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});