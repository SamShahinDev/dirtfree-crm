const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

async function checkDatabase() {
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

  console.log('🔍 Checking database connection and tables...')

  try {
    // Test basic connection
    const { data: version, error: versionError } = await supabase
      .rpc('version')
      .single()

    if (versionError) {
      console.log('⚠️  Using fallback connection test')
    } else {
      console.log('✅ Database connection successful')
    }

    // Check if main tables exist
    const tables = ['customers', 'jobs', 'technicians', 'invoices', 'reminders']
    const tableStatus = {}

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .limit(1)

        if (error) {
          tableStatus[table] = `❌ ${error.message}`
        } else {
          tableStatus[table] = '✅ Exists'
        }
      } catch (err) {
        tableStatus[table] = `❌ Error: ${err.message}`
      }
    }

    console.log('\n📋 Table Status:')
    for (const [table, status] of Object.entries(tableStatus)) {
      console.log(`  ${table}: ${status}`)
    }

    // Count rows in existing tables
    console.log('\n📊 Row Counts (for existing tables):')
    for (const [table, status] of Object.entries(tableStatus)) {
      if (status === '✅ Exists') {
        try {
          const { count, error } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true })

          if (!error) {
            console.log(`  ${table}: ${count} rows`)
          }
        } catch (err) {
          console.log(`  ${table}: Error counting rows`)
        }
      }
    }

  } catch (error) {
    console.error('❌ Database check failed:', error.message)
    process.exit(1)
  }
}

checkDatabase()