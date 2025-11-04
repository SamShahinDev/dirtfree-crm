# Security Quick Reference

Fast reference for common security tasks.

## Quick Links

- [Full Security Guide](./SECURITY.md)
- [Authentication Guide](./AUTHENTICATION.md)

---

## Common Patterns

### Secure API Endpoint (Full Stack)

```typescript
import { withAuth } from '@/middleware/api-auth'
import { checkThrottle } from '@/lib/security/throttling'
import { createValidationMiddleware, schemas } from '@/lib/security/sanitize'
import { verifyCsrfToken, getSessionId } from '@/lib/security/csrf'
import { z } from 'zod'

// Define schema
const schema = z.object({
  email: schemas.email,
  amount: schemas.currency
})

// Validate input
const validate = createValidationMiddleware(schema)

// Protect endpoint
export const POST = withAuth(
  validate(async (req, { user, data }) => {
    // CSRF check
    const csrf = req.headers.get('x-csrf-token')
    const sessionId = await getSessionId(req)
    if (!verifyCsrfToken(sessionId, csrf)) {
      return NextResponse.json({ error: 'Invalid CSRF' }, { status: 403 })
    }

    // Rate limit
    const throttle = await checkThrottle(user.id, 'action')
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }

    // Process with validated data
    const { email, amount } = data
    return NextResponse.json({ success: true })
  }),
  {
    requirePermission: 'resource:write',
    enableAuditLog: true
  }
)

export const dynamic = 'force-dynamic'
```

---

## Webhook Protection

```typescript
import { withWebhookVerification } from '@/lib/security/signature-verification'

export const POST = withWebhookVerification(
  async (req, payload) => {
    const data = JSON.parse(payload)
    // Process verified webhook
    return NextResponse.json({ success: true })
  },
  {
    secret: process.env.WEBHOOK_SECRET,
    signatureHeader: 'x-webhook-signature',
    timestampHeader: 'x-webhook-timestamp',
    timestampTolerance: 300
  }
)
```

---

## Rate Limiting

### Quick Check

```typescript
import { checkThrottle } from '@/lib/security/throttling'

const result = await checkThrottle(userId, 'opportunities')
if (!result.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    {
      status: 429,
      headers: {
        'Retry-After': result.resetAfter.toString()
      }
    }
  )
}
```

### With Middleware

```typescript
import { withThrottling } from '@/lib/security/throttling'

export const POST = withThrottling(
  handler,
  'opportunities',
  (req, ctx) => ctx.user.id
)
```

### Available Actions

| Action | Limit | Window |
|--------|-------|--------|
| opportunities | 20 | 60s |
| promotions | 10 | 60s |
| analytics | 30 | 60s |
| export | 5 | 60s |
| auth | 5 | 5min |
| passwordReset | 3 | 1hr |
| sms | 10 | 1hr |
| email | 20 | 1hr |

---

## Input Validation

### With Middleware

```typescript
import { createValidationMiddleware, schemas } from '@/lib/security/sanitize'
import { z } from 'zod'

const schema = z.object({
  email: schemas.email,
  name: schemas.shortText,
  amount: schemas.currency
})

const validate = createValidationMiddleware(schema)

export const POST = validate(async (req, { data }) => {
  // data is validated
  return NextResponse.json({ success: true })
})
```

### Manual Validation

```typescript
import { validateRequestBody, schemas } from '@/lib/security/sanitize'

const result = validateRequestBody(body, schema)

if (!result.success) {
  return NextResponse.json(
    { errors: result.errors.format() },
    { status: 400 }
  )
}

const data = result.data
```

### Common Schemas

```typescript
import { schemas } from '@/lib/security/sanitize'

schemas.email           // Email address
schemas.phone           // E.164 phone
schemas.phoneUS         // US phone
schemas.currency        // Money (0.01 precision)
schemas.percentage      // 0-100
schemas.text            // Text (10K max)
schemas.shortText       // Text (255 max)
schemas.id              // UUID
schemas.url             // URL
schemas.date            // ISO 8601
schemas.stateUS         // US state code
schemas.postalCodeUS    // US zip code
```

### Sanitization

```typescript
import {
  sanitizeHtml,
  stripHtmlTags,
  sanitizeFilename
} from '@/lib/security/sanitize'

// Escape HTML
const safe = sanitizeHtml(userInput)

// Remove tags
const text = stripHtmlTags(userInput)

// Safe filename
const filename = sanitizeFilename(userInput)
```

---

## CSRF Protection

### Get Token (Client)

```typescript
const response = await fetch('/api/csrf-token')
const { csrfToken } = await response.json()
```

### Use Token (Client)

```typescript
await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
})
```

### Protect Endpoint (Server)

```typescript
import { withCsrfProtection } from '@/lib/security/csrf'

export const POST = withCsrfProtection(handler, {
  tokenHeader: 'x-csrf-token'
})
```

### Manual Check

```typescript
import { verifyCsrfToken, getSessionId } from '@/lib/security/csrf'

const token = req.headers.get('x-csrf-token')
const sessionId = await getSessionId(req)

if (!verifyCsrfToken(sessionId, token)) {
  return NextResponse.json({ error: 'Invalid CSRF' }, { status: 403 })
}
```

---

## Security Headers

Already configured in `/src/middleware.ts`:

- ✅ X-Content-Type-Options: nosniff
- ✅ X-Frame-Options: DENY
- ✅ X-XSS-Protection: 1; mode=block
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Permissions-Policy: geolocation=(), microphone=()...
- ✅ Content-Security-Policy: (see middleware.ts)
- ✅ Strict-Transport-Security: (production only)

---

## SQL Injection Prevention

### Always Parameterized

✅ **Good:**
```typescript
await supabase
  .from('customers')
  .eq('email', userInput)  // Safe
```

❌ **Bad:**
```typescript
// NEVER DO THIS
await supabase.rpc('raw_query', {
  query: `SELECT * FROM users WHERE email = '${userInput}'`
})
```

---

## Environment Variables

### Required Secrets

```bash
# .env.local
WEBHOOK_SECRET=your-webhook-secret
CRON_SECRET=your-cron-secret
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### Never Commit Secrets

```bash
# Add to .gitignore
.env.local
.env.*.local
```

---

## Cheat Sheet

### Secure Endpoint Template

```typescript
import { withAuth } from '@/middleware/api-auth'
import { checkThrottle } from '@/lib/security/throttling'
import { createValidationMiddleware, schemas } from '@/lib/security/sanitize'
import { z } from 'zod'

const schema = z.object({
  field: schemas.shortText
})

const validate = createValidationMiddleware(schema)

export const POST = withAuth(
  validate(async (req, { user, data }) => {
    // Throttle
    const throttle = await checkThrottle(user.id, 'action')
    if (!throttle.allowed) return error429()

    // Process
    return NextResponse.json({ success: true })
  }),
  {
    requirePermission: 'resource:write',
    enableAuditLog: true
  }
)

export const dynamic = 'force-dynamic'
```

### Webhook Template

```typescript
import { withWebhookVerification } from '@/lib/security/signature-verification'

export const POST = withWebhookVerification(
  async (req, payload) => {
    const data = JSON.parse(payload)
    return NextResponse.json({ success: true })
  },
  { secret: process.env.WEBHOOK_SECRET }
)
```

---

## Testing

### Test Rate Limiting

```bash
# Make multiple rapid requests
for i in {1..25}; do
  curl -X POST http://localhost:3000/api/endpoint \
    -H "Authorization: Bearer $TOKEN"
done
```

### Test CSRF Protection

```bash
# Without CSRF token (should fail)
curl -X POST http://localhost:3000/api/endpoint \
  -H "Authorization: Bearer $TOKEN"

# With CSRF token (should succeed)
curl -X POST http://localhost:3000/api/endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF_TOKEN"
```

### Test Webhook Signature

```bash
# Generate signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send request
curl -X POST http://localhost:3000/api/webhook \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

---

## Common Errors

### 401 Unauthorized
- Missing or invalid auth token
- Expired session

### 403 Forbidden
- Missing permission
- Invalid CSRF token
- Webhook signature mismatch

### 429 Too Many Requests
- Rate limit exceeded
- Check `Retry-After` header

### 400 Bad Request
- Validation failed
- Invalid input format

---

## Security Checklist

**For every new endpoint:**

- [ ] Add `withAuth` wrapper
- [ ] Set `requirePermission`
- [ ] Add rate limiting
- [ ] Validate input (Zod schema)
- [ ] Sanitize user input
- [ ] Add CSRF protection (POST/PUT/DELETE)
- [ ] Enable audit logging (sensitive ops)
- [ ] Handle errors securely
- [ ] Add `export const dynamic = 'force-dynamic'`
- [ ] Test all security features

---

**See also:** [Full Security Guide](./SECURITY.md) | [Authentication Guide](./AUTHENTICATION.md)
