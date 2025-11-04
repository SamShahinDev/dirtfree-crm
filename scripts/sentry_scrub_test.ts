#!/usr/bin/env npx tsx

/**
 * Sentry PII Scrubbing Test for Dirt Free CRM
 *
 * This script tests that Sentry properly scrubs PII from error reports
 * by generating synthetic errors with fake PII data and validating
 * the scrubbing configuration.
 *
 * Usage:
 *   ./scripts/sentry_scrub_test.ts
 *   ./scripts/sentry_scrub_test.ts --verify-in-ui
 */

import * as Sentry from '@sentry/nextjs'

// Test data with fake PII (should be scrubbed)
const FAKE_PII_DATA = {
  customer_email: 'test.customer@example.com',
  customer_phone: '+15551234567',
  customer_name: 'John Test Customer',
  customer_address: '123 Test Street, Test City, TS 12345',
  credit_card: '4111-1111-1111-1111',
  ssn: '123-45-6789',
  password: 'test_password_123',
  api_key: 'sk_test_123456789abcdef',
  session_token: 'sess_abcdef123456789'
}

// Configuration
const TEST_EVENT_TAG = 'SCRUB_TEST'
const SCRIPT_VERSION = '1.0'

// Types
interface ScrubTestResult {
  success: boolean
  eventId?: string
  message: string
  timestamp: string
  errors: string[]
}

interface ScrubTestOptions {
  verifyInUi?: boolean
  skipSentry?: boolean
}

// Utility functions
function logInfo(message: string): void {
  console.log(`[${new Date().toISOString()}] INFO: ${message}`)
}

function logError(message: string): void {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`)
}

function logWarn(message: string): void {
  console.warn(`[${new Date().toISOString()}] WARN: ${message}`)
}

function parseArguments(): ScrubTestOptions {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Sentry PII Scrubbing Test

Usage:
  ${process.argv[1]} [options]

Options:
  --verify-in-ui      Instructions for manual verification in Sentry UI
  --skip-sentry       Skip actual Sentry event sending (dry run)
  --help, -h          Show this help message

Examples:
  # Run scrub test
  ${process.argv[1]}

  # Get UI verification instructions
  ${process.argv[1]} --verify-in-ui
`)
    process.exit(0)
  }

  return {
    verifyInUi: args.includes('--verify-in-ui'),
    skipSentry: args.includes('--skip-sentry')
  }
}

function validateSentryConfiguration(): void {
  logInfo('Validating Sentry configuration')

  if (!process.env.SENTRY_DSN) {
    logError('SENTRY_DSN environment variable not set')
    process.exit(1)
  }

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    logWarn('NEXT_PUBLIC_SENTRY_DSN not set - client-side events may not be captured')
  }

  // Check if Sentry is initialized
  const client = Sentry.getCurrentHub().getClient()
  if (!client) {
    logError('Sentry client not initialized - check Sentry configuration')
    process.exit(1)
  }

  logInfo('Sentry configuration validated')
}

async function testPiiScrubbing(options: ScrubTestOptions): Promise<ScrubTestResult> {
  const timestamp = new Date().toISOString()
  const errors: string[] = []

  try {
    logInfo('Starting PII scrubbing test')

    if (options.skipSentry) {
      logWarn('Skipping Sentry event sending (dry run mode)')
      return {
        success: true,
        message: 'Dry run completed - no events sent to Sentry',
        timestamp,
        errors
      }
    }

    // Configure Sentry scope with test data
    const eventId = await new Promise<string>((resolve, reject) => {
      Sentry.withScope((scope) => {
        // Set test event tag
        scope.setTag('test_type', TEST_EVENT_TAG)
        scope.setTag('script_version', SCRIPT_VERSION)
        scope.setTag('environment', process.env.NODE_ENV || 'development')

        // Add context that should be scrubbed
        scope.setContext('customer_data', {
          email: FAKE_PII_DATA.customer_email,
          phone: FAKE_PII_DATA.customer_phone,
          name: FAKE_PII_DATA.customer_name,
          address: FAKE_PII_DATA.customer_address
        })

        scope.setContext('sensitive_data', {
          credit_card: FAKE_PII_DATA.credit_card,
          ssn: FAKE_PII_DATA.ssn,
          password: FAKE_PII_DATA.password,
          api_key: FAKE_PII_DATA.api_key,
          session_token: FAKE_PII_DATA.session_token
        })

        // Set additional data in different ways
        scope.setExtra('test_email', FAKE_PII_DATA.customer_email)
        scope.setExtra('test_phone', FAKE_PII_DATA.customer_phone)
        scope.setExtra('test_credit_card', FAKE_PII_DATA.credit_card)

        // Set user context (should be scrubbed)
        scope.setUser({
          id: 'test-user-123',
          email: FAKE_PII_DATA.customer_email,
          username: 'test_user',
          ip_address: '192.168.1.100' // Should be scrubbed
        })

        // Create error with PII in message
        const testError = new Error(
          `Test error with PII - Email: ${FAKE_PII_DATA.customer_email}, Phone: ${FAKE_PII_DATA.customer_phone}`
        )

        // Add PII to error properties
        Object.assign(testError, {
          customerEmail: FAKE_PII_DATA.customer_email,
          customerPhone: FAKE_PII_DATA.customer_phone,
          sensitiveData: FAKE_PII_DATA.credit_card
        })

        // Capture the exception
        const eventId = Sentry.captureException(testError, {
          tags: {
            test_type: TEST_EVENT_TAG,
            pii_test: 'true'
          },
          extra: {
            test_message: 'This is a PII scrubbing test event',
            fake_pii_included: true,
            should_be_scrubbed: [
              'customer_email',
              'customer_phone',
              'credit_card',
              'ssn',
              'password',
              'api_key'
            ]
          }
        })

        resolve(eventId)
      })
    })

    // Also test breadcrumb scrubbing
    Sentry.addBreadcrumb({
      message: `User action with email ${FAKE_PII_DATA.customer_email}`,
      category: 'user',
      level: 'info',
      data: {
        email: FAKE_PII_DATA.customer_email,
        phone: FAKE_PII_DATA.customer_phone,
        action: 'test_action'
      }
    })

    // Capture a message event
    const messageEventId = Sentry.captureMessage(
      `Test message with PII: ${FAKE_PII_DATA.customer_email}`,
      'warning'
    )

    logInfo(`Test events sent to Sentry:`)
    logInfo(`  Exception event ID: ${eventId}`)
    logInfo(`  Message event ID: ${messageEventId}`)

    // Flush Sentry to ensure events are sent
    await Sentry.flush(5000)

    return {
      success: true,
      eventId,
      message: 'PII scrubbing test events sent successfully',
      timestamp,
      errors
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    errors.push(errorMessage)
    logError(`Test failed: ${errorMessage}`)

    return {
      success: false,
      message: `Test failed: ${errorMessage}`,
      timestamp,
      errors
    }
  }
}

function displayVerificationInstructions(result: ScrubTestResult): void {
  if (!result.success) {
    logError('Cannot provide verification instructions - test failed')
    return
  }

  console.log(`
${'-'.repeat(70)}
SENTRY PII SCRUBBING VERIFICATION INSTRUCTIONS
${'-'.repeat(70)}

Test completed at: ${result.timestamp}
${result.eventId ? `Event ID: ${result.eventId}` : ''}

MANUAL VERIFICATION STEPS:

1. ACCESS SENTRY DASHBOARD:
   - Open your Sentry project dashboard
   - Navigate to Issues or Events section
   - Search for events with tag: "${TEST_EVENT_TAG}"

2. VERIFY PII SCRUBBING:
   Look for the test events and confirm the following data is SCRUBBED:

   ❌ Should NOT appear (scrubbed):
   - Email: ${FAKE_PII_DATA.customer_email}
   - Phone: ${FAKE_PII_DATA.customer_phone}
   - Credit Card: ${FAKE_PII_DATA.credit_card}
   - SSN: ${FAKE_PII_DATA.ssn}
   - Password: ${FAKE_PII_DATA.password}
   - API Key: ${FAKE_PII_DATA.api_key}
   - IP Address: 192.168.1.100

   ✅ Should appear (allowed):
   - Error stack traces (without PII)
   - Event timestamps
   - Tag: "${TEST_EVENT_TAG}"
   - Environment information
   - Non-sensitive metadata

3. CHECK THESE SECTIONS:
   - Event Details: Message and error text
   - User Context: Email and IP should be scrubbed
   - Additional Data: All PII should be redacted
   - Breadcrumbs: PII in breadcrumb data should be scrubbed
   - Stack Trace: Code context should be preserved

4. VERIFICATION CHECKLIST:
   □ No real email addresses visible
   □ No phone numbers visible
   □ No credit card numbers visible
   □ No passwords or API keys visible
   □ IP addresses are scrubbed
   □ Error context is still useful for debugging
   □ Non-sensitive data is preserved

EXPECTED SCRUBBING BEHAVIOR:
- Email addresses should be replaced with [Filtered] or similar
- Phone numbers should be redacted
- Credit card numbers should be masked
- Passwords and API keys should be completely removed
- IP addresses should be replaced with [ip]

TROUBLESHOOTING:
If PII is visible in Sentry:
1. Check your Sentry data scrubbing rules
2. Review beforeSend hooks in your Sentry configuration
3. Verify environment variables are set correctly
4. Update Sentry SDK to latest version
5. Review the PII scrubbing documentation

NEXT STEPS:
- If scrubbing works correctly: Test passes ✅
- If PII is visible: Update Sentry configuration and retest ❌
- Document any configuration changes needed
- Schedule regular verification of scrubbing rules

${'-'.repeat(70)}
`)
}

function displayConfigurationGuidance(): void {
  console.log(`
${'-'.repeat(70)}
SENTRY PII SCRUBBING CONFIGURATION GUIDANCE
${'-'.repeat(70)}

If your test reveals that PII is not being properly scrubbed, here are
the configuration steps to implement proper data scrubbing:

1. SENTRY PROJECT SETTINGS:
   - Go to Project Settings → Data Scrubbing
   - Enable "Use default scrubbers"
   - Add custom scrubbing rules for:
     * Email addresses: .*@.*
     * Phone numbers: \\+?1?[\\d\\s\\-\\(\\)]{10,}
     * Credit cards: \\d{4}[\\s\\-]?\\d{4}[\\s\\-]?\\d{4}[\\s\\-]?\\d{4}
     * SSN: \\d{3}[\\s\\-]?\\d{2}[\\s\\-]?\\d{4}

2. SENTRY SDK CONFIGURATION (beforeSend hook):
   Add to your sentry.client.config.ts:

   \`\`\`typescript
   import { init } from '@sentry/nextjs'

   init({
     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
     beforeSend(event, hint) {
       // Scrub PII from error messages
       if (event.message) {
         event.message = event.message
           .replace(/[\\w.-]+@[\\w.-]+\\.\\w+/g, '[EMAIL]')
           .replace(/\\+?1?[\\d\\s\\-\\(\\)]{10,}/g, '[PHONE]')
       }

       // Scrub PII from exception values
       if (event.exception?.values) {
         event.exception.values.forEach(exception => {
           if (exception.value) {
             exception.value = exception.value
               .replace(/[\\w.-]+@[\\w.-]+\\.\\w+/g, '[EMAIL]')
               .replace(/\\+?1?[\\d\\s\\-\\(\\)]{10,}/g, '[PHONE]')
           }
         })
       }

       return event
     }
   })
   \`\`\`

3. ADDITIONAL SECURITY:
   - Set \`sendDefaultPii: false\` in Sentry config
   - Use allowUrls to limit which domains send errors
   - Implement custom fingerprinting to group similar errors
   - Set up release tracking for better debugging context

4. TESTING:
   - Run this script after configuration changes
   - Verify both client-side and server-side scrubbing
   - Test with real-world error scenarios
   - Monitor Sentry events for any PII leaks

${'-'.repeat(70)}
`)
}

async function main(): Promise<void> {
  try {
    console.log('Sentry PII Scrubbing Test')
    console.log('========================\n')

    const options = parseArguments()

    if (options.verifyInUi) {
      displayVerificationInstructions({
        success: true,
        message: 'Verification instructions',
        timestamp: new Date().toISOString(),
        errors: []
      })
      displayConfigurationGuidance()
      return
    }

    validateSentryConfiguration()

    const result = await testPiiScrubbing(options)

    if (result.success) {
      logInfo(`✅ ${result.message}`)

      if (!options.skipSentry) {
        console.log('\nTest events have been sent to Sentry.')
        console.log('Please verify PII scrubbing manually in the Sentry dashboard.')
        console.log('\nFor verification instructions, run:')
        console.log(`  ${process.argv[1]} --verify-in-ui`)
      }

      process.exit(0)
    } else {
      logError(`❌ ${result.message}`)
      if (result.errors.length > 0) {
        console.log('\nErrors encountered:')
        result.errors.forEach(error => console.log(`  - ${error}`))
      }
      process.exit(1)
    }

  } catch (error) {
    logError(`Script execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

// Execute main function if script is run directly
if (require.main === module) {
  main().catch((error) => {
    logError(`Unhandled error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  })
}

export { testPiiScrubbing, FAKE_PII_DATA, TEST_EVENT_TAG }