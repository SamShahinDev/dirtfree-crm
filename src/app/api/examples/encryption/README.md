# Encryption & PII Protection Examples

Examples demonstrating encryption and PII protection features.

## Prerequisites

1. **Generate Encryption Key:**
   ```bash
   npm run generate-key
   ```

2. **Add to Environment:**
   ```bash
   # .env.local
   ENCRYPTION_KEY=your-generated-64-char-hex-key
   ```

3. **Run Database Migration:**
   ```bash
   npx supabase migration up
   ```

---

## Available Examples

### 1. Customer Sensitive Data

**Path:** `/api/examples/encryption/customer-sensitive`

**Features:**
- Encrypt sensitive customer data (SSN, notes)
- Store encrypted data in database
- Decrypt data for authorized users
- Automatic PII access logging

**Endpoints:**

**GET** - Retrieve encrypted data:
```bash
curl http://localhost:3000/api/examples/encryption/customer-sensitive?id=customer-id \
  -H "Authorization: Bearer $TOKEN"
```

**POST** - Create/update encrypted data:
```bash
curl -X POST http://localhost:3000/api/examples/encryption/customer-sensitive \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "customer-id",
    "ssn": "123-45-6789",
    "notes": "Sensitive customer information",
    "creditCardLast4": "1234",
    "paymentMethodToken": "tok_visa",
    "paymentMethodType": "card"
  }'
```

### 2. Masked PII Logging

**Path:** `/api/examples/encryption/masked-logging`

**Features:**
- Automatically mask PII in logs
- Prevent accidental PII exposure
- Safe logging for debugging

**Example:**
```bash
curl -X POST http://localhost:3000/api/examples/encryption/masked-logging \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Console Output:**
```javascript
// Original data (NOT logged)
{
  email: 'john@example.com',
  phone: '+15551234567',
  ssn: '123-45-6789'
}

// Masked output (what gets logged)
{
  email: 'jo***@example.com',
  phone: '***-***-4567',
  ssn: '***-**-6789'
}
```

### 3. PII Access Logs

**Path:** `/api/examples/encryption/pii-access-logs`

**Features:**
- Retrieve PII access audit logs
- Generate compliance reports
- Track who accessed what and when

**GET - Retrieve Logs:**

```bash
# Get logs for specific customer
curl "http://localhost:3000/api/examples/encryption/pii-access-logs?customerId=customer-id" \
  -H "Authorization: Bearer $TOKEN"

# Get logs for specific user
curl "http://localhost:3000/api/examples/encryption/pii-access-logs?userId=user-id" \
  -H "Authorization: Bearer $TOKEN"

# Get recent logs
curl "http://localhost:3000/api/examples/encryption/pii-access-logs?recent=true&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

**POST - Generate Report:**

```bash
curl -X POST http://localhost:3000/api/examples/encryption/pii-access-logs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "customerId": "customer-id"
  }'
```

**Report Output:**
```json
{
  "success": true,
  "report": {
    "totalAccesses": 45,
    "byAction": {
      "view": 30,
      "edit": 10,
      "export": 5
    },
    "byField": {
      "ssn": 15,
      "email": 20,
      "phone": 10
    },
    "byUser": {
      "user-1": 25,
      "user-2": 20
    },
    "accessesByHour": {
      "9": 10,
      "10": 15,
      "11": 20
    }
  }
}
```

---

## Code Examples

### Encrypt Sensitive Data

```typescript
import { encrypt, decrypt } from '@/lib/security/encryption'

// Encrypt
const ssn = '123-45-6789'
const encrypted = encrypt(ssn)
// Result: '1a2b3c...iv...authTag...encryptedData'

// Store in database
await supabase.from('customer_sensitive_data').insert({
  customer_id: customerId,
  ssn_encrypted: encrypted
})

// Decrypt when needed
const { data } = await supabase
  .from('customer_sensitive_data')
  .select('ssn_encrypted')
  .eq('customer_id', customerId)
  .single()

const decrypted = decrypt(data.ssn_encrypted)
// Result: '123-45-6789'
```

### Log PII Access

```typescript
import { logPiiAccess } from '@/lib/db/pii-access-log'

// Log every PII access
await logPiiAccess({
  userId: user.id,
  customerId: customer.id,
  fieldAccessed: ['ssn', 'credit_card'],
  action: 'view',
  ipAddress: req.headers.get('x-forwarded-for'),
  userAgent: req.headers.get('user-agent'),
  accessReason: 'Customer support ticket #1234'
})
```

### Mask PII in Logs

```typescript
import { maskPii, safeLogger } from '@/lib/logging/mask-pii'

const customerData = {
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+15551234567',
  ssn: '123-45-6789'
}

// ❌ NEVER do this
console.log('Customer:', customerData)

// ✅ Always mask PII
console.log('Customer:', maskPii(customerData))

// ✅ Or use safe logger
safeLogger.info('Customer accessed', customerData)
```

---

## Database Tables

### customer_sensitive_data

Stores encrypted sensitive customer information:

```sql
create table customer_sensitive_data (
  id uuid primary key,
  customer_id uuid references customers(id) unique,
  ssn_encrypted text,              -- AES-256-GCM encrypted
  notes_encrypted text,             -- AES-256-GCM encrypted
  credit_card_last4 varchar(4),    -- Last 4 digits only
  payment_method_token text,        -- Payment provider token
  payment_method_type varchar(50),
  created_at timestamptz,
  updated_at timestamptz
);
```

### pii_access_log

Audit trail of all PII access:

```sql
create table pii_access_log (
  id uuid primary key,
  user_id uuid references auth.users(id),
  customer_id uuid references customers(id),
  field_accessed varchar(255),     -- Comma-separated fields
  action varchar(20),               -- view, edit, export, delete, create
  ip_address inet,
  user_agent text,
  metadata jsonb,
  access_reason text,
  accessed_at timestamptz
);
```

---

## Testing

### Test Encryption

```typescript
// In your test file
import { encrypt, decrypt } from '@/lib/security/encryption'

test('encryption and decryption', () => {
  const original = 'sensitive data'
  const encrypted = encrypt(original)
  const decrypted = decrypt(encrypted)

  expect(decrypted).toBe(original)
  expect(encrypted).not.toBe(original)
  expect(encrypted).toContain(':') // Format check
})
```

### Test PII Masking

```typescript
import { maskEmail, maskPhone, maskSSN } from '@/lib/logging/mask-pii'

test('PII masking', () => {
  expect(maskEmail('john@example.com')).toBe('jo***@example.com')
  expect(maskPhone('+15551234567')).toBe('***-***-4567')
  expect(maskSSN('123-45-6789')).toBe('***-**-6789')
})
```

---

## Security Best Practices

### 1. Never Log Plaintext PII

```typescript
// ❌ BAD
console.log('Customer:', customer)

// ✅ GOOD
safeLogger.info('Customer:', customer)
```

### 2. Always Log PII Access

```typescript
// ✅ Log every access
const data = await getCustomerPII(id)
await logPiiAccess({ userId, customerId: id, ... })
return data
```

### 3. Minimize Decryption

```typescript
// ✅ Only decrypt when needed
if (user.role === 'admin') {
  return decrypt(data)
}
return maskSensitiveData(data)
```

### 4. Use Role-Based Access

```typescript
// ✅ Check permissions
export const GET = withAuth(handler, {
  requirePermission: 'customers:read',
  enableAuditLog: true
})
```

### 5. Never Store Credit Cards

```typescript
// ✅ Use payment tokens
await db.insert({
  payment_method_token: stripeToken,
  card_last4: '1234'
})

// ❌ NEVER store actual cards
await db.insert({ card_number: '4532...' })
```

---

## Compliance

### GDPR

- ✅ Right to access: `/api/examples/encryption/pii-access-logs`
- ✅ Right to erasure: Delete encrypted data
- ✅ Access logging: All PII access is logged
- ✅ Data minimization: Only encrypt what's necessary

### CCPA

- ✅ Data inventory: Know what PII you collect
- ✅ Access logs: Track who accesses PII
- ✅ Data deletion: Support customer requests

### HIPAA

- ✅ Encryption at rest: AES-256-GCM
- ✅ Access controls: RBAC with permissions
- ✅ Audit trails: Complete PII access logs
- ✅ Data integrity: GCM authentication

---

## Troubleshooting

### "ENCRYPTION_KEY not set"

```bash
# Generate key
npm run generate-key

# Add to .env.local
ENCRYPTION_KEY=your-key-here
```

### "Failed to decrypt data"

Check:
1. Is the ENCRYPTION_KEY the same as when encrypted?
2. Is the encrypted data format valid (iv:authTag:data)?
3. Has the key been rotated without re-encrypting?

### PII Logs Not Appearing

Check:
1. Database migration ran successfully
2. RLS policies allow inserts
3. User ID is valid
4. No console errors

---

## Related Documentation

- [Full Encryption Guide](../../../../../docs/ENCRYPTION_AND_PII.md)
- [Security Guide](../../../../../docs/SECURITY.md)
- [Authentication Guide](../../../../../docs/AUTHENTICATION.md)

---

**Last Updated:** 2025-10-24
