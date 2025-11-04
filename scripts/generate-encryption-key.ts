#!/usr/bin/env ts-node

/**
 * Generate Encryption Key
 *
 * Generates a secure 32-byte (256-bit) encryption key for AES-256-GCM.
 *
 * Usage:
 *   npm run generate-key
 *   or
 *   ts-node scripts/generate-encryption-key.ts
 */

import { generateEncryptionKey, validateEncryptionKey } from '../src/lib/security/encryption'

function main() {
  console.log('Generating new encryption key...\n')

  // Generate key
  const key = generateEncryptionKey()

  // Validate key
  const isValid = validateEncryptionKey(key)

  console.log('========================================')
  console.log('ENCRYPTION KEY GENERATED')
  console.log('========================================\n')

  console.log('Add this to your .env.local file:\n')
  console.log(`ENCRYPTION_KEY=${key}\n`)

  console.log('========================================')
  console.log('IMPORTANT SECURITY NOTES')
  console.log('========================================\n')

  console.log('1. NEVER commit this key to version control')
  console.log('2. Store this key securely (password manager, secrets vault)')
  console.log('3. Use different keys for development/staging/production')
  console.log('4. Rotate keys periodically (see key rotation guide)')
  console.log('5. If key is lost, encrypted data CANNOT be recovered')
  console.log('6. Backup this key securely before using in production\n')

  console.log('Key Details:')
  console.log(`- Length: ${key.length} characters (${key.length / 2} bytes)`)
  console.log(`- Valid: ${isValid ? '✓ Yes' : '✗ No'}`)
  console.log(`- Algorithm: AES-256-GCM\n`)

  // Test encryption/decryption
  try {
    // Set key temporarily for testing
    process.env.ENCRYPTION_KEY = key

    const { encrypt, decrypt } = require('../src/lib/security/encryption')

    const testData = 'Test encryption data'
    const encrypted = encrypt(testData)
    const decrypted = decrypt(encrypted)

    console.log('Test Encryption:')
    console.log(`- Original: "${testData}"`)
    console.log(`- Encrypted: "${encrypted.substring(0, 50)}..."`)
    console.log(`- Decrypted: "${decrypted}"`)
    console.log(`- Match: ${testData === decrypted ? '✓ Yes' : '✗ No'}\n`)
  } catch (error) {
    console.error('Test encryption failed:', error)
  }
}

main()
