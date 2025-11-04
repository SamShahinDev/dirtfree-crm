# API Security Guide

Comprehensive security implementation guide for Dirt Free CRM.

## Table of Contents

1. [Overview](#overview)
2. [Security Layers](#security-layers)
3. [Webhook Signature Verification](#webhook-signature-verification)
4. [Request Throttling](#request-throttling)
5. [Input Validation & Sanitization](#input-validation--sanitization)
6. [CSRF Protection](#csrf-protection)
7. [Security Headers](#security-headers)
8. [SQL Injection Prevention](#sql-injection-prevention)
9. [Best Practices](#best-practices)
10. [Security Checklist](#security-checklist)

---

## Overview

The security system implements multiple layers of protection:

```
┌─────────────────────────────────────────────────────────┐
│                    Request Received                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 1: Security Headers                   │
│         (Middleware - All Requests)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Layer 2: Authentication & Authorization          │
│              (withAuth middleware)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Layer 3: CSRF Protection                      │
│         (State-changing requests only)                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│           Layer 4: Rate Limiting                         │
│         (Per-user, per-action throttling)                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│     Layer 5: Input Validation & Sanitization             │
│              (Zod schemas)                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│          Layer 6: Business Logic                         │
│      (Parameterized queries, audit logging)              │
└─────────────────────────────────────────────────────────┘
```

---

## Security Layers

### 1. Security Headers (Middleware)

**File:** `/src/middleware.ts`

Automatically applied to all requests:

| Header | Purpose | Value |
|--------|---------|-------|
| `X-Content-Type-Options` | Prevent MIME sniffing | `nosniff` |
| `X-Frame-Options` | Prevent clickjacking | `DENY` |
| `X-XSS-Protection` | Enable XSS filter | `1; mode=block` |
| `Referrer-Policy` | Control referrer info | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Disable unused APIs | `geolocation=(), microphone=()...` |
| `Content-Security-Policy` | Prevent XSS, injection | See CSP section |
| `Strict-Transport-Security` | Force HTTPS (prod only) | `max-age=31536000` |

### 2. Authentication & Authorization

**File:** `/src/middleware/api-auth.ts`

See [Authentication Guide](./AUTHENTICATION.md) for details.

### 3. CSRF Protection

**File:** `/src/lib/security/csrf.ts`

Prevents cross-site request forgery attacks.

### 4. Rate Limiting

**File:** `/src/lib/security/throttling.ts`

Prevents abuse through request throttling.

### 5. Input Validation

**File:** `/src/lib/security/sanitize.ts`

Validates and sanitizes all user input.

### 6. Webhook Security

**File:** `/src/lib/security/signature-verification.ts`

Verifies webhook authenticity.

---

## Webhook Signature Verification

### Why It's Important

Webhooks can be spoofed by attackers. Signature verification ensures:
- Requests actually come from the expected service
- Payload hasn't been tampered with
- Protection against replay attacks (with timestamps)

### Basic Usage

```typescript
import { withWebhookVerification } from '@/lib/security/signature-verification'

export const POST = withWebhookVerification(
  async (req, payload) => {
    // Payload is verified and safe to use
    const data = JSON.parse(payload)

    // Process webhook...
    return NextResponse.json({ success: true })
  },
  {
    secret: process.env.WEBHOOK_SECRET,
    signatureHeader: 'x-webhook-signature'
  }
)
```

### With Timestamp Verification

Prevent replay attacks by verifying request age:

```typescript
export const POST = withWebhookVerification(
  handler,
  {
    secret: process.env.WEBHOOK_SECRET,
    signatureHeader: 'x-webhook-signature',
    timestampHeader: 'x-webhook-timestamp',
    timestampTolerance: 300 // 5 minutes
  }
)
```

### Secret Rotation

Support multiple secrets for graceful rotation:

```typescript
import { verifyWebhookSignatureWithRotation } from '@/lib/security/signature-verification'

const isValid = verifyWebhookSignatureWithRotation(
  payload,
  signature,
  [
    process.env.WEBHOOK_SECRET,      // Current secret
    process.env.WEBHOOK_SECRET_OLD   // Old secret
  ]
)
```

### Sending Webhooks

Generate signatures for outgoing webhooks:

```typescript
import { generateWebhookSignature } from '@/lib/security/signature-verification'

const payload = JSON.stringify(data)
const signature = generateWebhookSignature(payload, secret)

await fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature
  },
  body: payload
})
```

---

## Request Throttling

### Why It's Important

Rate limiting prevents:
- Brute force attacks
- API abuse
- Resource exhaustion
- DDoS attacks
- Accidental infinite loops

### Predefined Throttle Configs

| Action | Limit | Window | Use Case |
|--------|-------|--------|----------|
| `opportunities` | 20 req | 60s | Opportunity operations |
| `promotions` | 10 req | 60s | Promotion management |
| `analytics` | 30 req | 60s | Analytics queries |
| `export` | 5 req | 60s | Data exports |
| `auth` | 5 req | 5 min | Login attempts |
| `passwordReset` | 3 req | 1 hour | Password resets |
| `sms` | 10 req | 1 hour | SMS sending |
| `email` | 20 req | 1 hour | Email sending |

### Manual Throttle Check

```typescript
import { checkThrottle } from '@/lib/security/throttling'

export const POST = withAuth(async (req, { user }) => {
  // Check throttle
  const result = await checkThrottle(user.id, 'opportunities')

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: result.resetAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': result.resetAfter.toString()
        }
      }
    )
  }

  // Process request...
})
```

### With Middleware

```typescript
import { withThrottling } from '@/lib/security/throttling'

export const POST = withThrottling(
  async (req, context) => {
    // Request is not throttled
    return NextResponse.json({ success: true })
  },
  'opportunities',
  (req, context) => context.user.id
)
```

### Custom Throttle Config

```typescript
import { createThrottleConfig, checkThrottle } from '@/lib/security/throttling'

const customConfig = createThrottleConfig(
  100,  // 100 requests
  60,   // per 60 seconds
  'Custom rate limit exceeded'
)

const result = await checkThrottle(userId, 'custom-action', customConfig)
```

### IP-Based Throttling

For pre-authentication endpoints:

```typescript
import { checkThrottleByIP } from '@/lib/security/throttling'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const result = await checkThrottleByIP(ip, 'auth')

  if (!result.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // Process login...
}
```

---

## Input Validation & Sanitization

### Why It's Important

Prevents:
- SQL injection
- XSS attacks
- Data corruption
- Buffer overflow
- Path traversal

### Common Validation Schemas

```typescript
import { schemas } from '@/lib/security/sanitize'

// Available schemas:
schemas.email           // Email address
schemas.phone           // E.164 phone number
schemas.phoneUS         // US phone number
schemas.currency        // Money amount
schemas.percentage      // 0-100 percentage
schemas.text            // Generic text (max 10K chars)
schemas.shortText       // Short text (max 255 chars)
schemas.longText        // Long text (max 50K chars)
schemas.id              // UUID
schemas.url             // URL
schemas.date            // ISO 8601 date
schemas.postalCode      // Postal code
schemas.stateUS         // US state code
schemas.alphanumeric    // Letters and numbers only
schemas.slug            // URL-friendly slug
schemas.hexColor        // Hex color code
schemas.integer         // Integer
schemas.positiveInteger // Positive integer
schemas.latitude        // Latitude (-90 to 90)
schemas.longitude       // Longitude (-180 to 180)
```

### Validation Middleware

```typescript
import { createValidationMiddleware, schemas } from '@/lib/security/sanitize'
import { z } from 'zod'

const schema = z.object({
  email: schemas.email,
  name: schemas.shortText,
  phone: schemas.phone.optional()
})

const validate = createValidationMiddleware(schema)

export const POST = validate(async (req, { data }) => {
  // data is fully validated and typed
  const { email, name, phone } = data

  return NextResponse.json({ success: true })
})
```

### Manual Validation

```typescript
import { validateRequestBody, schemas } from '@/lib/security/sanitize'
import { z } from 'zod'

export async function POST(req: Request) {
  const body = await req.json()

  const schema = z.object({
    email: schemas.email,
    amount: schemas.currency
  })

  const result = validateRequestBody(body, schema)

  if (!result.success) {
    return NextResponse.json(
      { errors: result.errors.format() },
      { status: 400 }
    )
  }

  const { email, amount } = result.data
  // Use validated data...
}
```

### Sanitization Functions

```typescript
import {
  sanitizeHtml,
  sanitizeSql,
  stripHtmlTags,
  sanitizeFilename,
  normalizeWhitespace
} from '@/lib/security/sanitize'

// Escape HTML entities
const safe = sanitizeHtml('<script>alert("xss")</script>')
// Result: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'

// Remove HTML tags
const text = stripHtmlTags('<p>Hello <b>World</b></p>')
// Result: 'Hello World'

// Sanitize filename (prevent path traversal)
const filename = sanitizeFilename('../../../etc/passwd')
// Result: 'etcpasswd'

// Normalize whitespace
const normalized = normalizeWhitespace('  Hello   World  \n\n')
// Result: 'Hello World'
```

### Entity Schemas

Pre-built schemas for common entities:

```typescript
import { entitySchemas } from '@/lib/security/sanitize'

// Customer schema
entitySchemas.customer

// Job schema
entitySchemas.job

// Opportunity schema
entitySchemas.opportunity

// Promotion schema
entitySchemas.promotion
```

---

## CSRF Protection

### Why It's Important

Prevents attackers from:
- Making unauthorized requests on behalf of authenticated users
- Changing passwords
- Making purchases
- Deleting data
- Any state-changing operation

### Getting a CSRF Token

Client-side:

```typescript
// Fetch CSRF token
const response = await fetch('/api/csrf-token')
const { csrfToken } = await response.json()

// Store in memory or state (never localStorage)
setCsrfToken(csrfToken)
```

### Using CSRF Token

Include in request headers:

```typescript
await fetch('/api/protected-endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
})
```

### Protecting Endpoints

```typescript
import { withCsrfProtection } from '@/lib/security/csrf'

export const POST = withCsrfProtection(
  async (req) => {
    // Request has valid CSRF token
    return NextResponse.json({ success: true })
  },
  {
    tokenHeader: 'x-csrf-token',
    skipSafeMethods: true // Skip GET, HEAD, OPTIONS
  }
)
```

### Double Submit Cookie Pattern

Alternative to token storage:

```typescript
import { withDoubleSubmitCookie } from '@/lib/security/csrf'

export const POST = withDoubleSubmitCookie(async (req) => {
  // Verified via cookie and header match
  return NextResponse.json({ success: true })
})
```

---

## Security Headers

### Content Security Policy (CSP)

Configured in `/src/middleware.ts`:

```typescript
const csp = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL};
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
`
```

### Customizing CSP

Update `/src/middleware.ts` to adjust CSP based on your needs:

```typescript
// Allow specific domains
connect-src 'self' https://api.stripe.com https://*.supabase.co;

// Allow inline scripts with nonce
script-src 'self' 'nonce-{random}';

// Report CSP violations
report-uri /api/csp-report;
```

### HSTS (Strict Transport Security)

Automatically enabled in production:

```typescript
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## SQL Injection Prevention

### Always Use Parameterized Queries

✅ **GOOD** - Supabase uses parameterized queries:

```typescript
const { data } = await supabase
  .from('customers')
  .select('*')
  .eq('email', userInput)  // Safe - parameterized
```

❌ **BAD** - Never construct raw SQL with user input:

```typescript
// NEVER DO THIS!
const { data } = await supabase.rpc('raw_query', {
  query: `SELECT * FROM customers WHERE email = '${userInput}'`
})
```

### Using RPC Functions

If you must use RPC, use parameters:

```sql
-- In database
CREATE FUNCTION search_customers(search_term TEXT)
RETURNS TABLE (...) AS $$
  SELECT * FROM customers
  WHERE name ILIKE '%' || search_term || '%'
$$ LANGUAGE sql;
```

```typescript
// In code
const { data } = await supabase
  .rpc('search_customers', {
    search_term: userInput  // Safe - parameterized
  })
```

### Additional Sanitization

Even with parameterized queries, sanitize input:

```typescript
import { sanitizeSql } from '@/lib/security/sanitize'

const cleaned = sanitizeSql(userInput)
// Removes quotes, semicolons, backslashes
```

---

## Best Practices

### 1. Defense in Depth

Apply multiple security layers:

```typescript
export const POST = withAuth(        // Layer 1: Auth
  async (req, { user }) => {
    // Layer 2: CSRF
    const csrfToken = req.headers.get('x-csrf-token')
    if (!verifyCsrfToken(sessionId, csrfToken)) {
      return error403()
    }

    // Layer 3: Throttle
    const throttle = await checkThrottle(user.id, 'action')
    if (!throttle.allowed) {
      return error429()
    }

    // Layer 4: Validate
    const result = validateRequestBody(await req.json(), schema)
    if (!result.success) {
      return error400()
    }

    // Process with validated data
    return success()
  },
  { requirePermission: 'permission', enableAuditLog: true }
)
```

### 2. Principle of Least Privilege

Only grant minimum necessary permissions:

```typescript
// Bad - too permissive
{ requirePermission: 'system:admin' }

// Good - specific permission
{ requirePermission: 'customers:write' }
```

### 3. Input Validation

Validate ALL user input:

```typescript
// Validate
const schema = z.object({
  email: schemas.email,
  amount: schemas.currency.max(10000)
})

// Sanitize
const clean = sanitizeHtml(userInput)

// Both
const result = validateRequestBody(body, schema)
```

### 4. Output Encoding

Escape data before rendering:

```typescript
import { sanitizeHtml } from '@/lib/security/sanitize'

// In component
<div>{sanitizeHtml(userContent)}</div>
```

### 5. Secure Storage

Never store secrets in code or client-side:

```typescript
// Bad
const API_KEY = 'sk_live_abc123'

// Good
const API_KEY = process.env.API_SECRET_KEY
```

### 6. Error Handling

Don't leak sensitive info in errors:

```typescript
// Bad
catch (error) {
  return NextResponse.json({ error: error.message })
}

// Good
catch (error) {
  console.error('Database error:', error)
  return NextResponse.json({ error: 'Internal server error' })
}
```

### 7. Audit Logging

Log sensitive operations:

```typescript
export const DELETE = withAuth(
  handler,
  {
    requirePermission: 'customers:delete',
    enableAuditLog: true  // Log all deletions
  }
)
```

### 8. Regular Updates

Keep dependencies updated:

```bash
npm audit
npm update
npm audit fix
```

---

## Security Checklist

### API Endpoint Checklist

- [ ] Authentication required (`withAuth`)
- [ ] Permission check (`requirePermission`)
- [ ] Rate limiting (`checkThrottle`)
- [ ] Input validation (Zod schema)
- [ ] Input sanitization
- [ ] CSRF protection (state-changing)
- [ ] Audit logging (sensitive ops)
- [ ] Error handling (no leaks)
- [ ] Force dynamic (`export const dynamic = 'force-dynamic'`)

### Webhook Checklist

- [ ] Signature verification
- [ ] Timestamp verification
- [ ] Secret rotation support
- [ ] Replay attack prevention

### Frontend Checklist

- [ ] Output encoding
- [ ] CSRF token handling
- [ ] Secure storage (no localStorage for tokens)
- [ ] Permission guards
- [ ] Input validation
- [ ] Error handling

### Database Checklist

- [ ] Parameterized queries only
- [ ] RLS policies enabled
- [ ] Audit logging
- [ ] Regular backups
- [ ] Encrypted connections

### Infrastructure Checklist

- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Environment variables secured
- [ ] Secrets rotation
- [ ] Monitoring enabled
- [ ] Regular security audits

---

## Related Files

- `/src/lib/security/signature-verification.ts` - Webhook security
- `/src/lib/security/throttling.ts` - Rate limiting
- `/src/lib/security/sanitize.ts` - Input validation
- `/src/lib/security/csrf.ts` - CSRF protection
- `/src/middleware.ts` - Security headers
- `/src/middleware/api-auth.ts` - Authentication
- `/src/app/api/examples/security/` - Examples

---

**Last Updated:** 2025-10-24
