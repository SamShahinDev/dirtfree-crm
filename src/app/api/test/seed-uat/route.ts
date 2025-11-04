import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { UATDataManager, uatCustomers, uatJobs, uatUsers } from '@/lib/uat/sample-data'

/**
 * UAT Data Seeding API Endpoint
 * POST /api/test/seed-uat
 *
 * Seeds the database with UAT test data for User Acceptance Testing
 *
 * ⚠️  WARNING: This endpoint should only be available in UAT environments
 * ⚠️  It will modify production data if used in production
 */

export async function POST(request: NextRequest) {
  try {
    // Environment safety check
    const environment = process.env.NODE_ENV
    const isUATEnvironment = process.env.VERCEL_ENV === 'preview' ||
                           process.env.NEXT_PUBLIC_APP_ENV === 'uat' ||
                           environment === 'development'

    if (!isUATEnvironment) {
      return NextResponse.json(
        {
          error: 'UAT seeding is not allowed in this environment',
          environment: environment,
          message: 'This endpoint can only be used in UAT or development environments'
        },
        { status: 403 }
      )
    }

    const supabase = createClient()

    // Parse request body for options
    const body = await request.json().catch(() => ({}))
    const {
      clearExisting = false,
      seedUsers = true,
      seedCustomers = true,
      seedJobs = true,
      dryRun = false
    } = body

    const results = {
      environment,
      dryRun,
      timestamp: new Date().toISOString(),
      operations: [] as any[],
      summary: {
        users: { created: 0, skipped: 0, errors: 0 },
        customers: { created: 0, skipped: 0, errors: 0 },
        jobs: { created: 0, skipped: 0, errors: 0 }
      }
    }

    // Validate UAT data integrity first
    const validation = UATDataManager.validateDataIntegrity()
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'UAT data validation failed',
          validationErrors: validation.errors
        },
        { status: 400 }
      )
    }

    results.operations.push({
      operation: 'data_validation',
      status: 'success',
      message: 'UAT data integrity validated'
    })

    // Clear existing test data if requested
    if (clearExisting && !dryRun) {
      try {
        // Delete in correct order to respect foreign keys
        await supabase.from('jobs').delete().like('id', 'job_%')
        await supabase.from('customers').delete().like('id', 'cust_%')
        await supabase.from('users').delete().like('email', '%.test@acme.test')

        results.operations.push({
          operation: 'clear_existing',
          status: 'success',
          message: 'Existing UAT data cleared'
        })
      } catch (error) {
        results.operations.push({
          operation: 'clear_existing',
          status: 'error',
          message: 'Failed to clear existing data',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Seed Users
    if (seedUsers) {
      for (const user of uatUsers) {
        try {
          if (dryRun) {
            results.summary.users.created++
            continue
          }

          // Check if user already exists
          const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .single()

          if (existingUser) {
            results.summary.users.skipped++
            continue
          }

          // Create user (in a real implementation, this would use Supabase Auth)
          const { error } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              phone: user.phone,
              created_at: user.created_at,
              is_test_user: true // Flag to identify test users
            })

          if (error) {
            results.summary.users.errors++
            results.operations.push({
              operation: 'create_user',
              status: 'error',
              user_id: user.id,
              error: error.message
            })
          } else {
            results.summary.users.created++
          }
        } catch (error) {
          results.summary.users.errors++
          results.operations.push({
            operation: 'create_user',
            status: 'error',
            user_id: user.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    // Seed Customers
    if (seedCustomers) {
      for (const customer of uatCustomers) {
        try {
          if (dryRun) {
            results.summary.customers.created++
            continue
          }

          // Check if customer already exists
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('id', customer.id)
            .single()

          if (existingCustomer) {
            results.summary.customers.skipped++
            continue
          }

          // Create customer
          const { error } = await supabase
            .from('customers')
            .insert({
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
              zone: customer.zone,
              notes: customer.notes,
              created_at: customer.created_at,
              is_test_customer: true // Flag to identify test customers
            })

          if (error) {
            results.summary.customers.errors++
            results.operations.push({
              operation: 'create_customer',
              status: 'error',
              customer_id: customer.id,
              error: error.message
            })
          } else {
            results.summary.customers.created++

            // Create service history entries
            for (const service of customer.service_history) {
              await supabase
                .from('service_history')
                .insert({
                  customer_id: customer.id,
                  service_date: service.date,
                  service_type: service.service,
                  room_count: service.rooms,
                  satisfaction_rating: service.satisfaction,
                  notes: service.notes,
                  is_test_data: true
                })
            }
          }
        } catch (error) {
          results.summary.customers.errors++
          results.operations.push({
            operation: 'create_customer',
            status: 'error',
            customer_id: customer.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    // Seed Jobs
    if (seedJobs) {
      for (const job of uatJobs) {
        try {
          if (dryRun) {
            results.summary.jobs.created++
            continue
          }

          // Check if job already exists
          const { data: existingJob } = await supabase
            .from('jobs')
            .select('id')
            .eq('id', job.id)
            .single()

          if (existingJob) {
            results.summary.jobs.skipped++
            continue
          }

          // Create job
          const { error } = await supabase
            .from('jobs')
            .insert({
              id: job.id,
              customer_id: job.customer_id,
              service_type: job.service_type,
              rooms: job.rooms,
              scheduled_date: job.scheduled_date,
              scheduled_time: job.scheduled_time,
              estimated_duration: job.estimated_duration,
              assigned_technician: job.technician,
              zone: job.zone,
              status: job.status,
              special_instructions: job.special_instructions,
              internal_notes: job.internal_notes,
              created_at: new Date().toISOString(),
              is_test_job: true // Flag to identify test jobs
            })

          if (error) {
            results.summary.jobs.errors++
            results.operations.push({
              operation: 'create_job',
              status: 'error',
              job_id: job.id,
              error: error.message
            })
          } else {
            results.summary.jobs.created++
          }
        } catch (error) {
          results.summary.jobs.errors++
          results.operations.push({
            operation: 'create_job',
            status: 'error',
            job_id: job.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    // Generate final summary
    const totalCreated = results.summary.users.created +
                        results.summary.customers.created +
                        results.summary.jobs.created

    const totalErrors = results.summary.users.errors +
                       results.summary.customers.errors +
                       results.summary.jobs.errors

    results.operations.push({
      operation: 'final_summary',
      status: totalErrors === 0 ? 'success' : 'partial_success',
      message: `UAT data seeding completed. Created: ${totalCreated}, Errors: ${totalErrors}`,
      details: results.summary
    })

    const statusCode = totalErrors === 0 ? 200 : 207 // 207 = Multi-Status

    return NextResponse.json(results, { status: statusCode })

  } catch (error) {
    console.error('UAT seeding error:', error)

    return NextResponse.json(
      {
        error: 'Internal server error during UAT seeding',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/test/seed-uat
 * Returns information about UAT seeding capabilities and current data
 */
export async function GET() {
  try {
    const environment = process.env.NODE_ENV
    const isUATEnvironment = process.env.VERCEL_ENV === 'preview' ||
                           process.env.NEXT_PUBLIC_APP_ENV === 'uat' ||
                           environment === 'development'

    if (!isUATEnvironment) {
      return NextResponse.json(
        {
          error: 'UAT endpoints not available in this environment',
          environment
        },
        { status: 403 }
      )
    }

    const supabase = createClient()
    const dataset = UATDataManager.generateFullDataset()
    const validation = UATDataManager.validateDataIntegrity()

    // Check existing test data
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id')
      .eq('is_test_customer', true)

    const { data: existingJobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('is_test_job', true)

    const { data: existingUsers } = await supabase
      .from('users')
      .select('id')
      .eq('is_test_user', true)

    return NextResponse.json({
      environment,
      available: isUATEnvironment,
      timestamp: new Date().toISOString(),
      dataset_info: {
        customers: dataset.customers.length,
        jobs: dataset.jobs.length,
        users: dataset.users.length,
        sms_scenarios: dataset.smsScenarios.length
      },
      existing_test_data: {
        customers: existingCustomers?.length || 0,
        jobs: existingJobs?.length || 0,
        users: existingUsers?.length || 0
      },
      data_validation: validation,
      usage: {
        endpoint: 'POST /api/test/seed-uat',
        parameters: {
          clearExisting: 'boolean - Clear existing test data first',
          seedUsers: 'boolean - Seed test users',
          seedCustomers: 'boolean - Seed test customers',
          seedJobs: 'boolean - Seed test jobs',
          dryRun: 'boolean - Preview changes without applying'
        },
        example: {
          method: 'POST',
          body: {
            clearExisting: true,
            seedUsers: true,
            seedCustomers: true,
            seedJobs: true,
            dryRun: false
          }
        }
      }
    })

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to retrieve UAT seeding information',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/test/seed-uat
 * Removes all UAT test data from the database
 */
export async function DELETE() {
  try {
    const environment = process.env.NODE_ENV
    const isUATEnvironment = process.env.VERCEL_ENV === 'preview' ||
                           process.env.NEXT_PUBLIC_APP_ENV === 'uat' ||
                           environment === 'development'

    if (!isUATEnvironment) {
      return NextResponse.json(
        {
          error: 'UAT cleanup not allowed in this environment',
          environment
        },
        { status: 403 }
      )
    }

    const supabase = createClient()
    const results = {
      environment,
      timestamp: new Date().toISOString(),
      operations: [] as any[],
      summary: {
        service_history_deleted: 0,
        jobs_deleted: 0,
        customers_deleted: 0,
        users_deleted: 0
      }
    }

    // Delete in correct order to respect foreign keys

    // Delete service history
    const { count: serviceHistoryCount, error: serviceHistoryError } = await supabase
      .from('service_history')
      .delete({ count: 'exact' })
      .eq('is_test_data', true)

    if (serviceHistoryError) {
      results.operations.push({
        operation: 'delete_service_history',
        status: 'error',
        error: serviceHistoryError.message
      })
    } else {
      results.summary.service_history_deleted = serviceHistoryCount || 0
      results.operations.push({
        operation: 'delete_service_history',
        status: 'success',
        deleted: serviceHistoryCount
      })
    }

    // Delete jobs
    const { count: jobsCount, error: jobsError } = await supabase
      .from('jobs')
      .delete({ count: 'exact' })
      .eq('is_test_job', true)

    if (jobsError) {
      results.operations.push({
        operation: 'delete_jobs',
        status: 'error',
        error: jobsError.message
      })
    } else {
      results.summary.jobs_deleted = jobsCount || 0
      results.operations.push({
        operation: 'delete_jobs',
        status: 'success',
        deleted: jobsCount
      })
    }

    // Delete customers
    const { count: customersCount, error: customersError } = await supabase
      .from('customers')
      .delete({ count: 'exact' })
      .eq('is_test_customer', true)

    if (customersError) {
      results.operations.push({
        operation: 'delete_customers',
        status: 'error',
        error: customersError.message
      })
    } else {
      results.summary.customers_deleted = customersCount || 0
      results.operations.push({
        operation: 'delete_customers',
        status: 'success',
        deleted: customersCount
      })
    }

    // Delete users
    const { count: usersCount, error: usersError } = await supabase
      .from('users')
      .delete({ count: 'exact' })
      .eq('is_test_user', true)

    if (usersError) {
      results.operations.push({
        operation: 'delete_users',
        status: 'error',
        error: usersError.message
      })
    } else {
      results.summary.users_deleted = usersCount || 0
      results.operations.push({
        operation: 'delete_users',
        status: 'success',
        deleted: usersCount
      })
    }

    const totalDeleted = Object.values(results.summary).reduce((sum, count) => sum + count, 0)
    const hasErrors = results.operations.some(op => op.status === 'error')

    results.operations.push({
      operation: 'cleanup_summary',
      status: hasErrors ? 'partial_success' : 'success',
      message: `UAT cleanup completed. Total deleted: ${totalDeleted}`,
      details: results.summary
    })

    const statusCode = hasErrors ? 207 : 200

    return NextResponse.json(results, { status: statusCode })

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to cleanup UAT data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}