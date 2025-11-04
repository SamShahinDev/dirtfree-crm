const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

async function applyMigrations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  console.log('🚀 Starting database migration...')

  try {
    // Read the consolidated migration SQL
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'consolidated-migration.sql'),
      'utf8'
    )

    console.log('📄 Executing migration SQL...')

    // Execute the migration SQL using the SQL RPC function
    const { data, error } = await supabase.rpc('exec', {
      sql: migrationSQL
    })

    if (error) {
      throw error
    }

    console.log('✅ Migration completed successfully!')

    // Verify tables were created
    console.log('🔍 Verifying table creation...')

    const tables = ['customers', 'jobs', 'technicians', 'invoices', 'reminders', 'trucks', 'user_profiles']

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`⚠️  Table '${table}': ${error.message}`)
      } else {
        console.log(`✅ Table '${table}': Created successfully`)
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error('')
    console.error('💡 Next steps:')
    console.error('1. Go to https://supabase.com/dashboard/project/fydbcptxhfrncswwwzoe/sql')
    console.error('2. Click "New query"')
    console.error('3. Copy and paste the contents of scripts/consolidated-migration.sql')
    console.error('4. Click "Run" to execute the migration')
    process.exit(1)
  }
}

applyMigrations()