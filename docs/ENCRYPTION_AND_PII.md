# Encryption & PII Protection Guide

Comprehensive guide to data encryption and Personally Identifiable Information (PII) protection.

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Encryption](#encryption)
4. [PII Access Logging](#pii-access-logging)
5. [PII Masking](#pii-masking)
6. [Database Schema](#database-schema)
7. [Best Practices](#best-practices)
8. [Compliance](#compliance)
9. [Key Rotation](#key-rotation)

---

## Overview

The encryption and PII protection system provides:

- **AES-256-GCM Encryption** - Authenticated encryption for sensitive data
- **PII Access Logging** - Audit trail of all PII access
- **PII Masking** - Automatic masking of sensitive data in logs
- **Compliance Support** - GDPR, CCPA, HIPAA compliance features

### What Data Should Be Encrypted?

Encrypt data that is:
- ✅ Social Security Numbers (SSN)
- ✅ Credit card numbers (use tokens instead)
- ✅ Bank account numbers
- ✅ Medical records
- ✅ Passwords
- ✅ Private notes/messages
- ❌ Names (searchable)
- ❌ Email addresses (need for communication)
- ❌ Phone numbers (need for communication)

**Note:** Only encrypt data that doesn't need to be searched. Use PII masking for logs instead.

---

## Setup

### 1. Generate Encryption Key

```bash
# Generate a new encryption key
npm run generate-key

# Or using ts-node
ts-node scripts/generate-encryption-key.ts
```

This outputs:
```
ENCRYPTION_KEY=a1b2c3d4e5f6789...
```

### 2. Add to Environment Variables

```bash
# .env.local
ENCRYPTION_KEY=your-64-character-hex-key
```

**IMPORTANT:**
- ✅ Use different keys for dev/staging/production
- ✅ Store keys in secure secrets manager (AWS Secrets Manager, Vault)
- ✅ Never commit keys to version control
- ✅ Back up keys securely
- ❌ Never share keys via email/Slack
- ❌ Never log keys

### 3. Run Database Migration

```bash
npx supabase migration up

# Or manually apply
psql -f supabase/migrations/20251024100000_encryption_and_pii_logging.sql
```

---

## Encryption

### Basic Usage

```typescript
import { encrypt, decrypt } from '@/lib/security/encryption'

// Encrypt sensitive data
const ssn = '123-45-6789'
const encrypted = encrypt(ssn)
// Result: 'a1b2c3...iv...authTag...data'

// Store in database
await supabase.from('customer_sensitive_data').insert({
  customer_id: '123',
  ssn_encrypted: encrypted
})

// Decrypt when needed
const decrypted = decrypt(encrypted)
// Result: '123-45-6789'
```

### Encrypt Multiple Fields

```typescript
import { encryptFields, decryptFields } from '@/lib/security/encryption'

// Encrypt multiple fields at once
const customer = {
  name: 'John Doe',
  ssn: '123-45-6789',
  notes: 'Sensitive information'
}

const encrypted = encryptFields(customer, ['ssn', 'notes'])
// Result: {
//   name: 'John Doe',
//   ssn_encrypted: '...',
//   notes_encrypted: '...'
// }

// Decrypt multiple fields
const decrypted = decryptFields(encrypted, ['ssn', 'notes'])
// Result: {
//   name: 'John Doe',
//   ssn: '123-45-6789',
//   notes: 'Sensitive information'
// }
```

### One-Way Hashing

For data that needs comparison but never decryption:

```typescript
import { hashData, hashDataWithSalt, verifyHash } from '@/lib/security/encryption'

// Simple hash (one-way)
const hashed = hashData('secret-token')

// Hash with salt (more secure)
const { hash, salt } = hashDataWithSalt('password')
await supabase.from('tokens').insert({ hash, salt })

// Verify hash
const isValid = verifyHash('password', storedHash, storedSalt)
```

### Generate Secure Tokens

```typescript
import { generateToken, generateSecurePassword } from '@/lib/security/encryption'

// Generate API key or reset token
const apiKey = generateToken() // 64 character hex
const resetToken = generateToken(48) // 96 character hex

// Generate random password
const password = generateSecurePassword(16)
// Result: 'aB3$xZ9@kL2%pQ7!'
```

---

## PII Access Logging

### Automatic Logging

```typescript
import { logPiiAccess } from '@/lib/db/pii-access-log'

// Log every time PII is accessed
await logPiiAccess({
  userId: user.id,
  customerId: '123',
  fieldAccessed: ['ssn', 'credit_card'],
  action: 'view',
  ipAddress: req.headers.get('x-forwarded-for'),
  userAgent: req.headers.get('user-agent'),
  accessReason: 'Customer support request'
})
```

### With Middleware

```typescript
import { withPiiLogging } from '@/lib/db/pii-access-log'

export const GET = withPiiLogging(
  async (req, { user, params }) => {
    const customer = await getCustomer(params.id)
    return NextResponse.json(customer)
  },
  {
    fields: ['ssn', 'credit_card'],
    action: 'view',
    getCustomerId: (req, params) => params.id
  }
)
```

### Retrieve Logs

```typescript
import { getPiiAccessLogs, generatePiiAccessReport } from '@/lib/db/pii-access-log'

// Get logs for a customer
const logs = await getPiiAccessLogs('customer-id', 100)

// Generate compliance report
const report = await generatePiiAccessReport({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  customerId: '123'
})

console.log(report)
// {
//   totalAccesses: 45,
//   byAction: { view: 30, edit: 10, export: 5 },
//   byField: { ssn: 15, email: 20, phone: 10 },
//   byUser: { 'user-1': 25, 'user-2': 20 },
//   accessesByHour: { 9: 10, 10: 15, 11: 20 }
// }
```

---

## PII Masking

### Automatic Masking in Logs

```typescript
import { maskPii, safeLogger } from '@/lib/logging/mask-pii'

const customerData = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+15551234567',
  ssn: '123-45-6789',
  credit_card: '4532123456781234'
}

// ❌ BAD - Exposes PII in logs
console.log('Customer:', customerData)

// ✅ GOOD - Masks PII
console.log('Customer:', maskPii(customerData))
// Logs: {
//   name: 'John Doe',
//   email: 'jo***@example.com',
//   phone: '***-***-4567',
//   ssn: '***-**-6789',
//   credit_card: '****-****-****-1234'
// }

// ✅ BETTER - Use safe logger
safeLogger.info('Customer accessed', customerData)
// Automatically masks PII
```

### Individual Masking Functions

```typescript
import {
  maskEmail,
  maskPhone,
  maskCreditCard,
  maskSSN,
  maskIP
} from '@/lib/logging/mask-pii'

maskEmail('john@example.com')       // 'jo***@example.com'
maskPhone('+15551234567')           // '***-***-4567'
maskCreditCard('4532123456781234')  // '****-****-****-1234'
maskSSN('123-45-6789')              // '***-**-6789'
maskIP('192.168.1.100')             // '192.168.***.***'
```

---

## Database Schema

### customer_sensitive_data

Stores encrypted sensitive customer data:

```sql
create table customer_sensitive_data (
  id uuid primary key,
  customer_id uuid references customers(id),
  ssn_encrypted text,              -- Encrypted SSN
  notes_encrypted text,             -- Encrypted sensitive notes
  credit_card_last4 varchar(4),    -- Last 4 digits only
  payment_method_token text,        -- Stripe/provider token
  payment_method_type varchar(50),
  created_at timestamptz,
  updated_at timestamptz
);
```

### pii_access_log

Audit log of all PII access:

```sql
create table pii_access_log (
  id uuid primary key,
  user_id uuid references auth.users(id),
  customer_id uuid references customers(id),
  field_accessed varchar(255),      -- Comma-separated fields
  action varchar(20),                -- view, edit, export, delete, create
  ip_address inet,
  user_agent text,
  metadata jsonb,
  access_reason text,
  accessed_at timestamptz
);
```

---

## Best Practices

### 1. Encrypt at Rest

```typescript
// ✅ Encrypt before storing
const encrypted = encrypt(sensitiveData)
await db.insert({ data_encrypted: encrypted })

// ❌ Never store plaintext
await db.insert({ data: sensitiveData })
```

### 2. Minimize Decryption

```typescript
// ✅ Only decrypt when absolutely necessary
if (user.role === 'admin') {
  const decrypted = decrypt(data)
  return decrypted
}

// ❌ Don't decrypt everything
const allData = data.map(d => decrypt(d.encrypted))
```

### 3. Always Log PII Access

```typescript
// ✅ Log every PII access
const data = await getCustomerPII(id)
await logPiiAccess({ userId, customerId: id, ... })
return data

// ❌ Accessing PII without logging
return await getCustomerPII(id)
```

### 4. Use Masked Logging

```typescript
// ✅ Use safe logger
safeLogger.info('Customer data', customerData)

// ❌ Regular logging with PII
console.log('Customer data', customerData)
```

### 5. Validate Before Encrypting

```typescript
// ✅ Validate format before encrypting
if (!/^\d{3}-\d{2}-\d{4}$/.test(ssn)) {
  throw new Error('Invalid SSN format')
}
const encrypted = encrypt(ssn)

// ❌ Encrypt invalid data
const encrypted = encrypt(anyInput)
```

### 6. Never Store Credit Cards

```typescript
// ✅ Use payment provider tokens
const { token } = await stripe.createToken(card)
await db.insert({
  payment_method_token: token,
  card_last4: '1234'
})

// ❌ Never store actual card numbers
await db.insert({ card_number: '4532...' })
```

### 7. Implement Access Controls

```typescript
// ✅ Check permissions before decrypting
if (!hasPermission(user.role, 'pii:view')) {
  return error403()
}
const decrypted = decrypt(data)

// ❌ Decrypt without permission check
const decrypted = decrypt(data)
```

---

## Compliance

### GDPR Compliance

**Right to Access:**
```typescript
// Customer can request their PII
const piiData = await getCustomerPII(customerId)
const accessLogs = await getPiiAccessLogs(customerId)

return {
  personalData: piiData,
  accessHistory: accessLogs
}
```

**Right to Erasure:**
```typescript
// Delete or anonymize customer data
await deleteCustomerPII(customerId)
await logPiiAccess({
  userId: 'system',
  customerId,
  action: 'delete',
  accessReason: 'GDPR erasure request'
})
```

**Access Logging:**
- All PII access is logged automatically
- Generate compliance reports
- Detect suspicious access patterns

### CCPA Compliance

**Data Inventory:**
```typescript
// List all PII collected
const piiFields = [
  'name', 'email', 'phone', 'address',
  'ssn', 'credit_card', 'payment_method'
]
```

**Do Not Sell:**
```typescript
// Track customer opt-out preferences
await db.update('customers').set({
  data_sharing_opt_out: true
})
```

### HIPAA Compliance (if applicable)

- ✅ Encryption at rest (AES-256)
- ✅ Access logging (who, what, when)
- ✅ Audit trails
- ✅ Role-based access control
- ✅ Data minimization
- ✅ Secure disposal

---

## Key Rotation

### Why Rotate Keys?

- Security best practice
- Comply with regulations
- Limit exposure if key is compromised
- Meet audit requirements

### Rotation Process

**1. Generate New Key:**
```bash
npm run generate-key
```

**2. Set New Key (keep old key):**
```bash
# .env.local
ENCRYPTION_KEY=new-key
ENCRYPTION_KEY_OLD=old-key
```

**3. Re-encrypt Data:**
```typescript
// Script to re-encrypt all data
import { decrypt, encrypt } from '@/lib/security/encryption'

async function rotateEncryptionKeys() {
  // Use old key to decrypt
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY_OLD
  const decrypted = decrypt(oldEncryptedData)

  // Use new key to encrypt
  process.env.ENCRYPTION_KEY = newKey
  const reEncrypted = encrypt(decrypted)

  // Update database
  await db.update({ data_encrypted: reEncrypted })
}
```

**4. Backup Old Data:**
```typescript
// Backup before rotation
await db.insert('encrypted_data_backup').values({
  table_name: 'customer_sensitive_data',
  record_id: id,
  encrypted_data: oldData,
  encryption_version: 1
})
```

**5. Verify Migration:**
```typescript
// Test decryption with new key
const testDecrypt = decrypt(reEncryptedData)
assert(testDecrypt === originalData)
```

**6. Remove Old Key:**
```bash
# After verification, remove old key
# .env.local
ENCRYPTION_KEY=new-key
# ENCRYPTION_KEY_OLD=old-key (remove this)
```

### Rotation Schedule

- **Production:** Every 12 months
- **High Security:** Every 6 months
- **Compliance Required:** Per regulation (e.g., PCI-DSS)
- **After Breach:** Immediately

---

## Examples

See `/src/app/api/examples/encryption/` for complete examples:

1. **customer-sensitive/** - Encrypt/decrypt customer data
2. **masked-logging/** - Mask PII in logs
3. **pii-access-logs/** - Retrieve access logs

---

## Troubleshooting

### "ENCRYPTION_KEY environment variable is not set"

**Solution:**
```bash
# Generate key
npm run generate-key

# Add to .env.local
ENCRYPTION_KEY=your-generated-key
```

### "Failed to decrypt data"

**Causes:**
- Wrong encryption key
- Corrupted encrypted data
- Key was rotated without re-encrypting

**Solution:**
- Verify ENCRYPTION_KEY matches the one used to encrypt
- Check if data format is correct (iv:authTag:data)
- Restore from backup if corrupted

### "PII access not being logged"

**Check:**
1. Database table exists (`pii_access_log`)
2. RLS policies allow inserts
3. User ID is valid
4. No errors in console

### Performance Issues with Encryption

**Solutions:**
1. Only encrypt necessary fields
2. Cache decrypted data (with caution)
3. Use database indexes
4. Consider field-level encryption vs full record

---

## Related Files

- `/src/lib/security/encryption.ts` - Encryption utilities
- `/src/lib/db/pii-access-log.ts` - PII access logging
- `/src/lib/logging/mask-pii.ts` - PII masking
- `/supabase/migrations/20251024100000_encryption_and_pii_logging.sql` - Database schema
- `/scripts/generate-encryption-key.ts` - Key generation

---

**Last Updated:** 2025-10-24
