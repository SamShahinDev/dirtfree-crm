#!/usr/bin/env npx tsx

/**
 * Twilio API Key Rotation Script for Dirt Free CRM
 *
 * This script automates the rotation of Twilio API keys by:
 * 1. Creating a new API Key via Twilio REST API
 * 2. Generating environment variable patch file
 * 3. Providing safe revocation of old keys
 *
 * Usage:
 *   ./scripts/twilio_rotate_key.ts                    # Create new key
 *   ./scripts/twilio_rotate_key.ts --revoke-key SK... --confirm  # Revoke old key
 */

import { createWriteStream } from 'fs'
import { writeFile } from 'fs/promises'

// Configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const OUTPUT_FILE = '.env.local.patch'

// Required environment variables
const REQUIRED_ENV_VARS = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN'
]

// Types
interface TwilioApiKey {
  sid: string
  friendlyName: string
  secret?: string
  dateCreated: string
  dateUpdated: string
}

interface TwilioApiResponse {
  sid: string
  friendly_name: string
  secret?: string
  date_created: string
  date_updated: string
}

interface RotationResult {
  success: boolean
  newKeySid?: string
  message: string
  envPatch?: string
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

function validateEnvironment(): void {
  logInfo('Validating environment variables')

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      logError(`Required environment variable ${envVar} is not set`)
      process.exit(1)
    }
  }

  logInfo('Environment validation completed')
}

function parseArguments(): { action: 'create' | 'revoke', revokeKeySid?: string, confirm?: boolean } {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Twilio API Key Rotation Script

Usage:
  ${process.argv[1]} [options]

Options:
  --revoke-key SID    Revoke the specified API Key (requires --confirm)
  --confirm           Confirm revocation (required for revoke action)
  --help, -h          Show this help message

Examples:
  # Create new API key
  ${process.argv[1]}

  # Revoke old API key (requires confirmation)
  ${process.argv[1]} --revoke-key SK1234567890abcdef --confirm
`)
    process.exit(0)
  }

  const revokeIndex = args.indexOf('--revoke-key')
  if (revokeIndex !== -1) {
    const revokeKeySid = args[revokeIndex + 1]
    const confirm = args.includes('--confirm')

    if (!revokeKeySid) {
      logError('--revoke-key requires a SID argument')
      process.exit(1)
    }

    if (!confirm) {
      logError('Revocation requires --confirm flag for safety')
      process.exit(1)
    }

    return { action: 'revoke', revokeKeySid, confirm }
  }

  return { action: 'create' }
}

async function makeApiRequest(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, any>
): Promise<any> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}${path}`

  const headers: Record<string, string> = {
    'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  }

  const config: RequestInit = {
    method,
    headers
  }

  if (body && (method === 'POST' || method === 'PUT')) {
    const formData = new URLSearchParams()
    Object.entries(body).forEach(([key, value]) => {
      formData.append(key, String(value))
    })
    config.body = formData.toString()
  }

  try {
    const response = await fetch(url, config)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Twilio API error (${response.status}): ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    logError(`API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    throw error
  }
}

async function createNewApiKey(): Promise<RotationResult> {
  logInfo('Creating new Twilio API Key')

  try {
    const friendlyName = `CRM-${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substring(2, 8)}`

    const response: TwilioApiResponse = await makeApiRequest('POST', '/Keys.json', {
      FriendlyName: friendlyName
    })

    const apiKey: TwilioApiKey = {
      sid: response.sid,
      friendlyName: response.friendly_name,
      secret: response.secret,
      dateCreated: response.date_created,
      dateUpdated: response.date_updated
    }

    logInfo(`New API Key created: ${apiKey.sid}`)
    logInfo(`Friendly name: ${apiKey.friendlyName}`)

    // Generate environment patch file
    const envPatch = `# Twilio API Key Rotation - ${new Date().toISOString()}
# Replace these values in your environment variables

TWILIO_API_KEY_SID=${apiKey.sid}
TWILIO_API_KEY_SECRET=${apiKey.secret}

# Previous values (for reference - DO NOT USE):
# TWILIO_API_KEY_SID_OLD=<your_old_key_sid>
# TWILIO_API_KEY_SECRET_OLD=<your_old_key_secret>

# After updating environment:
# 1. Deploy to staging and test
# 2. Deploy to production
# 3. Verify webhook signatures work
# 4. Run: ./scripts/twilio_rotate_key.ts --revoke-key <old_sid> --confirm
`

    await writeFile(OUTPUT_FILE, envPatch)
    logInfo(`Environment patch file created: ${OUTPUT_FILE}`)

    // Log success (without secret)
    logInfo('API Key rotation preparation completed')

    return {
      success: true,
      newKeySid: apiKey.sid,
      message: `New API Key created: ${apiKey.sid}`,
      envPatch
    }

  } catch (error) {
    const message = `Failed to create API Key: ${error instanceof Error ? error.message : 'Unknown error'}`
    logError(message)

    return {
      success: false,
      message
    }
  }
}

async function revokeApiKey(keySid: string): Promise<RotationResult> {
  logWarn(`Revoking Twilio API Key: ${keySid}`)

  try {
    // First, verify the key exists
    const keyInfo: TwilioApiResponse = await makeApiRequest('GET', `/Keys/${keySid}.json`)
    logInfo(`Found API Key: ${keyInfo.friendly_name} (created: ${keyInfo.date_created})`)

    // Revoke the key
    await makeApiRequest('DELETE', `/Keys/${keySid}.json`)

    logInfo(`API Key ${keySid} has been revoked successfully`)

    return {
      success: true,
      message: `API Key ${keySid} revoked successfully`
    }

  } catch (error) {
    const message = `Failed to revoke API Key ${keySid}: ${error instanceof Error ? error.message : 'Unknown error'}`
    logError(message)

    return {
      success: false,
      message
    }
  }
}

async function listActiveApiKeys(): Promise<void> {
  logInfo('Listing active API Keys')

  try {
    const response = await makeApiRequest('GET', '/Keys.json')
    const keys: TwilioApiResponse[] = response.keys || []

    if (keys.length === 0) {
      logInfo('No API Keys found')
      return
    }

    console.log('\nActive API Keys:')
    console.log('SID\t\t\t\tFriendly Name\t\t\tCreated')
    console.log('---\t\t\t\t-------------\t\t\t-------')

    for (const key of keys) {
      const createdDate = new Date(key.date_created).toLocaleDateString()
      console.log(`${key.sid}\t${key.friendly_name.padEnd(24)}\t${createdDate}`)
    }

    console.log(`\nTotal: ${keys.length} API Key(s)`)

  } catch (error) {
    logError(`Failed to list API Keys: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function displayUsageInstructions(result: RotationResult): void {
  if (!result.success) {
    return
  }

  console.log(`
${'-'.repeat(60)}
NEXT STEPS FOR API KEY ROTATION
${'-'.repeat(60)}

1. ENVIRONMENT UPDATE:
   - Review the patch file: ${OUTPUT_FILE}
   - Update your environment variables with the new values
   - DO NOT commit secrets to version control

2. DEPLOYMENT:
   - Deploy to staging first: vercel deploy --target staging
   - Test SMS functionality and webhook signatures
   - Deploy to production: vercel deploy --target production

3. VERIFICATION:
   - Test SMS sending via application
   - Verify webhook endpoints receive and validate signatures
   - Run smoke tests: make smoke

4. OLD KEY REVOCATION (after successful deployment):
   - Identify your old key SID from current environment
   - Run: ./scripts/twilio_rotate_key.ts --revoke-key <OLD_SID> --confirm
   - This step is IRREVERSIBLE

5. CLEANUP:
   - Remove the patch file: rm ${OUTPUT_FILE}
   - Update documentation with rotation date
   - Schedule next rotation (recommended: 180 days)

${'-'.repeat(60)}
SECURITY NOTES:
- The new secret is only shown once and saved in ${OUTPUT_FILE}
- Keep the old key active until new deployment is verified
- Webhook signatures will fail with the old key after deployment
- Emergency rollback: revert environment vars and redeploy
${'-'.repeat(60)}
`)
}

function displayRevocationInstructions(): void {
  console.log(`
${'-'.repeat(60)}
API KEY REVOCATION COMPLETED
${'-'.repeat(60)}

The old API key has been permanently revoked and can no longer be used.

VERIFICATION STEPS:
1. Confirm new API key is working in production
2. Check error monitoring for authentication failures
3. Test SMS sending functionality
4. Verify webhook signature validation

If you experience issues:
- Check environment variables are correctly set
- Verify deployment completed successfully
- Review application logs for API authentication errors

Next rotation scheduled: ${new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString()}
${'-'.repeat(60)}
`)
}

async function main(): Promise<void> {
  try {
    console.log('Twilio API Key Rotation Script')
    console.log('==============================\n')

    validateEnvironment()

    const { action, revokeKeySid, confirm } = parseArguments()

    if (action === 'create') {
      // List current keys for reference
      await listActiveApiKeys()
      console.log()

      // Create new key
      const result = await createNewApiKey()

      if (result.success) {
        displayUsageInstructions(result)
        process.exit(0)
      } else {
        logError('API key creation failed')
        process.exit(1)
      }

    } else if (action === 'revoke' && revokeKeySid && confirm) {
      // Revoke old key
      const result = await revokeApiKey(revokeKeySid)

      if (result.success) {
        displayRevocationInstructions()
        process.exit(0)
      } else {
        logError('API key revocation failed')
        process.exit(1)
      }
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

export { createNewApiKey, revokeApiKey, listActiveApiKeys }