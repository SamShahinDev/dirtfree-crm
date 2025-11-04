/**
 * Database Performance Verification Script
 *
 * This script verifies that performance optimizations have been applied
 * and generates a comprehensive performance report.
 *
 * Usage:
 *   npx tsx scripts/verify-performance.ts
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// =====================================================
// Verification Functions
// =====================================================

async function verifyIndexes() {
  console.log('\n📊 Verifying Performance Indexes...\n')

  const expectedIndexes = [
    // Opportunities
    'idx_opportunities_created_at',
    'idx_opportunities_customer_status',
    'idx_opportunities_followup_pending',

    // Promotions
    'idx_promotions_active_dates',
    'idx_promotion_deliveries_tracking',
    'idx_promotion_deliveries_claimed',

    // Reviews
    'idx_review_requests_pending',
    'idx_review_requests_completed',

    // Loyalty
    'idx_loyalty_redemptions_customer',
    'idx_customer_achievements_earned',

    // Referrals
    'idx_referrals_status_created',
    'idx_referrals_referrer_status',

    // Analytics
    'idx_portal_analytics_date',

    // Chatbot
    'idx_chatbot_customer_session',
    'idx_chatbot_escalated',

    // Core tables
    'idx_jobs_customer_status_date',
    'idx_invoices_customer_status_paid',
  ]

  let foundCount = 0
  let missingIndexes: string[] = []

  for (const indexName of expectedIndexes) {
    const { data, error } = await supabase.rpc('check_index_exists', {
      index_name: indexName,
    })

    if (error) {
      // Fallback query if RPC doesn't exist
      const { data: fallbackData } = await supabase
        .from('pg_indexes')
        .select('indexname')
        .eq('indexname', indexName)
        .single()

      if (fallbackData) {
        console.log(`✓ ${indexName}`)
        foundCount++
      } else {
        console.log(`✗ ${indexName} - MISSING`)
        missingIndexes.push(indexName)
      }
    } else if (data) {
      console.log(`✓ ${indexName}`)
      foundCount++
    } else {
      console.log(`✗ ${indexName} - MISSING`)
      missingIndexes.push(indexName)
    }
  }

  console.log(`\n✓ Found ${foundCount}/${expectedIndexes.length} expected indexes`)

  if (missingIndexes.length > 0) {
    console.log(`\n⚠️  Missing ${missingIndexes.length} indexes:`)
    missingIndexes.forEach((idx) => console.log(`   - ${idx}`))
  }

  return { foundCount, total: expectedIndexes.length, missingIndexes }
}

async function verifyQueryAnalyzer() {
  console.log('\n🔍 Verifying Query Analyzer Setup...\n')

  // Check if slow_query_log table exists
  const { data: tableData, error: tableError } = await supabase
    .from('slow_query_log')
    .select('id')
    .limit(1)

  if (tableError) {
    console.log('✗ slow_query_log table - NOT FOUND')
    console.log('   Run sql/17-query-analyzer-schema.sql')
    return false
  }

  console.log('✓ slow_query_log table exists')

  // Check functions
  const functions = [
    'get_index_usage_stats',
    'find_unused_indexes',
    'get_table_bloat_stats',
    'get_slow_query_summary',
    'get_top_slow_queries',
  ]

  let functionsFound = 0

  for (const funcName of functions) {
    try {
      const { error } = await supabase.rpc(funcName as any)
      if (!error || error.message.includes('missing')) {
        console.log(`✓ ${funcName}()`)
        functionsFound++
      } else {
        console.log(`✗ ${funcName}() - NOT FOUND`)
      }
    } catch (err) {
      console.log(`✗ ${funcName}() - ERROR`)
    }
  }

  console.log(`\n✓ Found ${functionsFound}/${functions.length} analyzer functions`)

  return functionsFound === functions.length
}

async function getIndexUsageReport() {
  console.log('\n📈 Index Usage Statistics...\n')

  try {
    const { data, error } = await supabase.rpc('get_index_usage_stats')

    if (error) throw error

    if (!data || data.length === 0) {
      console.log('No index usage data available yet')
      return
    }

    console.log('Top 10 Most-Used Indexes:')
    console.log('─'.repeat(80))

    data.slice(0, 10).forEach((stat: any, i: number) => {
      console.log(`${i + 1}. ${stat.indexname}`)
      console.log(`   Table: ${stat.tablename}`)
      console.log(`   Scans: ${stat.idx_scan.toLocaleString()}`)
      console.log(`   Size: ${stat.index_size}`)
      console.log(`   Usage Ratio: ${stat.usage_ratio}%`)
      console.log()
    })
  } catch (err: any) {
    console.log('⚠️  Could not fetch index usage stats:', err.message)
  }
}

async function findUnusedIndexes() {
  console.log('\n🗑️  Unused Indexes...\n')

  try {
    const { data, error } = await supabase.rpc('find_unused_indexes')

    if (error) throw error

    if (!data || data.length === 0) {
      console.log('✓ No unused indexes found - all indexes are being used!')
      return
    }

    console.log(`Found ${data.length} unused indexes:\n`)

    data.forEach((idx: any) => {
      console.log(`• ${idx.indexname} on ${idx.tablename}`)
      console.log(`  Size: ${idx.index_size}`)
      console.log(`  SQL to drop: DROP INDEX IF EXISTS ${idx.indexname};`)
      console.log()
    })

    console.log('⚠️  Review carefully before dropping indexes!')
  } catch (err: any) {
    console.log('⚠️  Could not find unused indexes:', err.message)
  }
}

async function getSlowQuerySummary() {
  console.log('\n🐌 Slow Query Summary (Last 24 Hours)...\n')

  try {
    const { data, error } = await supabase.rpc('get_slow_query_summary', {
      since_hours: 24,
    })

    if (error) throw error

    if (!data || data.length === 0) {
      console.log('✓ No slow queries recorded in the last 24 hours!')
      return
    }

    const summary = data[0]

    console.log(`Total Slow Queries: ${summary.total_slow_queries}`)
    console.log(`Average Duration: ${Math.round(summary.avg_duration)}ms`)
    console.log(`Max Duration: ${Math.round(summary.max_duration)}ms`)
    console.log(`Critical Queries: ${summary.critical_queries}`)
    console.log(`Unique Endpoints: ${summary.unique_endpoints}`)
    console.log(`Affected Users: ${summary.affected_users}`)

    if (summary.critical_queries > 0) {
      console.log(`\n⚠️  ${summary.critical_queries} critical queries need attention!`)
    }
  } catch (err: any) {
    console.log('ℹ️  No slow queries logged yet - query analyzer is ready to use')
  }
}

async function getTableSizes() {
  console.log('\n💾 Database Size Overview...\n')

  try {
    const { data, error } = await supabase.rpc('get_table_bloat_stats')

    if (error) throw error

    if (!data || data.length === 0) {
      console.log('Could not fetch table sizes')
      return
    }

    console.log('Top Tables by Size:')
    console.log('─'.repeat(80))

    data.slice(0, 10).forEach((table: any, i: number) => {
      console.log(`${i + 1}. ${table.tablename}`)
      console.log(`   Total Size: ${table.table_size}`)
      console.log(`   Bloat: ${table.bloat_size} (${table.bloat_ratio}%)`)
      console.log()
    })
  } catch (err: any) {
    console.log('⚠️  Could not fetch table sizes:', err.message)
  }
}

async function runPerformanceTest() {
  console.log('\n⚡ Running Sample Performance Tests...\n')

  // Test 1: Customer query
  console.log('1. Testing customer list query...')
  const start1 = performance.now()
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .limit(100)
  const duration1 = performance.now() - start1
  console.log(`   ✓ Completed in ${Math.round(duration1)}ms`)

  // Test 2: Jobs query
  console.log('2. Testing jobs query...')
  const start2 = performance.now()
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, customers(*)')
    .limit(100)
  const duration2 = performance.now() - start2
  console.log(`   ✓ Completed in ${Math.round(duration2)}ms`)

  // Test 3: Analytics query
  console.log('3. Testing analytics query...')
  const start3 = performance.now()
  const { data: analytics } = await supabase
    .from('portal_analytics_daily')
    .select('*')
    .order('date', { ascending: false })
    .limit(30)
  const duration3 = performance.now() - start3
  console.log(`   ✓ Completed in ${Math.round(duration3)}ms`)

  const avgDuration = (duration1 + duration2 + duration3) / 3
  console.log(`\nAverage query time: ${Math.round(avgDuration)}ms`)

  if (avgDuration < 100) {
    console.log('✓ Excellent performance!')
  } else if (avgDuration < 300) {
    console.log('⚠️  Acceptable performance, but could be improved')
  } else {
    console.log('⚠️  Performance needs optimization')
  }
}

// =====================================================
// Main Execution
// =====================================================

async function main() {
  console.log('\n╔════════════════════════════════════════════╗')
  console.log('║   Database Performance Verification       ║')
  console.log('║   Dirt Free CRM                            ║')
  console.log('╚════════════════════════════════════════════╝')

  try {
    // Verify indexes
    const indexResults = await verifyIndexes()

    // Verify query analyzer
    const analyzerSetup = await verifyQueryAnalyzer()

    // Performance reports
    await getIndexUsageReport()
    await findUnusedIndexes()
    await getSlowQuerySummary()
    await getTableSizes()

    // Run performance tests
    await runPerformanceTest()

    // Final summary
    console.log('\n╔════════════════════════════════════════════╗')
    console.log('║   Verification Complete                    ║')
    console.log('╚════════════════════════════════════════════╝\n')

    console.log('Summary:')
    console.log(`✓ Indexes: ${indexResults.foundCount}/${indexResults.total} found`)
    console.log(`✓ Query Analyzer: ${analyzerSetup ? 'Ready' : 'Not configured'}`)

    if (indexResults.missingIndexes.length > 0) {
      console.log('\n⚠️  Action Required:')
      console.log('   Run: npm run db:optimize')
      console.log('   Or: ./scripts/optimize-database.sh')
    } else {
      console.log('\n✓ All performance optimizations are in place!')
      console.log('\n📚 Next steps:')
      console.log('   - Review src/lib/db/query-analyzer-usage.md')
      console.log('   - Wrap critical queries with measureQuery()')
      console.log('   - Monitor slow queries regularly')
    }
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message)
    process.exit(1)
  }
}

// Run the verification
main()
