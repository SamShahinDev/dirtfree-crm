# Security Examples

Example API routes demonstrating all security features.

## Available Examples

### 1. Webhook with Signature Verification

**Path:** `/api/examples/security/webhook`

Demonstrates:
- Webhook signature verification
- Timestamp verification
- Replay attack prevention

```typescript
import { withWebhookVerification } from '@/lib/security/signature-verification'

export const POST = withWebhookVerification(
  async (req, payload) => {
    // Verified payload
    return NextResponse.json({ success: true })
  },
  {
    secret: process.env.WEBHOOK_SECRET,
    timestampHeader: 'x-webhook-timestamp'
  }
)
```

### 2. Request Throttling

**Path:** `/api/examples/security/throttled`

Demonstrates:
- Per-user rate limiting
- Rate limit headers
- Retry-After responses

```typescript
import { checkThrottle } from '@/lib/security/throttling'

const result = await checkThrottle(user.id, 'opportunities')
if (!result.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  )
}
```

### 3. Input Validation

**Path:** `/api/examples/security/validated`

Demonstrates:
- Zod schema validation
- Input sanitization
- Type-safe request handling

```typescript
import { createValidationMiddleware, schemas } from '@/lib/security/sanitize'

const validate = createValidationMiddleware(schema)

export const POST = validate(async (req, { data }) => {
  // data is fully validated
})
```

### 4. CSRF Protection

**Path:** `/api/examples/security/csrf-protected`

Demonstrates:
- CSRF token verification
- Protection from cross-site attacks
- Safe state-changing operations

```typescript
import { withCsrfProtection } from '@/lib/security/csrf'

export const POST = withCsrfProtection(handler, {
  tokenHeader: 'x-csrf-token'
})
```

### 5. Full-Stack Security

**Path:** `/api/examples/security/full-stack`

Demonstrates all security layers:
- Authentication & authorization
- CSRF protection
- Rate limiting
- Input validation
- Audit logging

---

## Testing Examples

### Test Webhook

```bash
# Generate signature
SECRET="your-webhook-secret"
PAYLOAD='{"event":"test"}'
TIMESTAMP=$(date +%s)
SIGNATURE=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send request
curl -X POST http://localhost:3000/api/examples/security/webhook \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -H "X-Webhook-Timestamp: $TIMESTAMP" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

### Test Rate Limiting

```bash
# Rapid requests to trigger throttle
for i in {1..25}; do
  curl -X POST http://localhost:3000/api/examples/security/throttled \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
done
```

### Test CSRF Protection

```bash
# Get CSRF token
CSRF_TOKEN=$(curl http://localhost:3000/api/csrf-token | jq -r .csrfToken)

# Use token
curl -X POST http://localhost:3000/api/examples/security/csrf-protected \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Test Input Validation

```bash
# Valid input
curl -X POST http://localhost:3000/api/examples/security/validated \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+15551234567",
    "address": {
      "line1": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "postalCode": "94102"
    }
  }'

# Invalid input (should fail validation)
curl -X POST http://localhost:3000/api/examples/security/validated \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "email": "not-an-email",
    "phone": "invalid"
  }'
```

---

## Common Response Codes

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 200 | Success | Request processed successfully |
| 400 | Bad Request | Validation failed, invalid input |
| 401 | Unauthorized | Missing or invalid auth token |
| 403 | Forbidden | Invalid CSRF token, missing permission |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error, check logs |

---

## Security Headers

All endpoints automatically include:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: ...
```

Rate-limited endpoints also include:

```
X-RateLimit-Remaining: 19
X-RateLimit-Reset: 45
Retry-After: 45
```

---

## Environment Variables

Required for examples:

```bash
# .env.local
WEBHOOK_SECRET=your-webhook-secret
CRON_SECRET=your-cron-secret
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Related Documentation

- [Full Security Guide](../../../../../docs/SECURITY.md)
- [Security Quick Reference](../../../../../docs/SECURITY_QUICK_REFERENCE.md)
- [Authentication Guide](../../../../../docs/AUTHENTICATION.md)
- [Authentication Quick Reference](../../../../../docs/AUTH_QUICK_REFERENCE.md)

---

## Implementation Checklist

When creating a new secure endpoint:

- [ ] Add authentication (`withAuth`)
- [ ] Set permission requirement
- [ ] Add rate limiting
- [ ] Validate input (Zod schema)
- [ ] Add CSRF protection (POST/PUT/DELETE)
- [ ] Enable audit logging (if sensitive)
- [ ] Handle errors securely
- [ ] Add `export const dynamic = 'force-dynamic'`
- [ ] Test all security features
- [ ] Document the endpoint

---

**Last Updated:** 2025-10-24
