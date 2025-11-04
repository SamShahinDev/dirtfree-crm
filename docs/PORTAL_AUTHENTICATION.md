# Portal Authentication System Documentation

## Overview

The Portal Authentication System provides secure, JWT-based authentication for the customer portal with support for access tokens, refresh tokens, session management, and comprehensive audit logging.

## Features

✅ **Complete Implementation**
- JWT-based access & refresh tokens
- Secure token generation using JOSE library
- Session tracking in database
- Token refresh mechanism
- Single & multi-device logout
- IP address & user agent tracking
- Audit logging for all auth events
- Automatic session expiration
- CORS support
- Rate limiting ready

## Architecture

### Components

1. **Token Layer** (`src/lib/auth/portal-tokens.ts`)
   - JWT generation and validation
   - Token refresh logic
   - Session management
   - Expiry handling

2. **API Endpoints** (`src/app/api/portal/auth/*`)
   - `/login` - Customer authentication
   - `/refresh` - Token refresh
   - `/logout` - Session termination

3. **Database** (`portal_sessions` table)
   - Session storage
   - Token hash tracking
   - Metadata collection (IP, user agent)
   - Expiration management

## Token System

### Token Types

#### Access Token
- **Purpose:** Used for API authentication
- **Lifespan:** 7 days
- **Type:** JWT with customer info
- **Storage:** Should be stored in memory or secure storage (not localStorage)

#### Refresh Token
- **Purpose:** Used to obtain new access tokens
- **Lifespan:** 30 days
- **Type:** JWT with session info
- **Storage:** Should be stored securely (httpOnly cookie recommended)

### Token Structure

Both tokens are JWTs with the following claims:

```typescript
{
  sub: string        // customer_id
  email: string      // customer email
  type: 'access' | 'refresh'
  sessionId: string  // unique session identifier
  iat: number        // issued at (Unix timestamp)
  exp: number        // expires at (Unix timestamp)
}
```

### Security Features

1. **HS256 Signing** - Tokens signed with secret key
2. **SHA-256 Hashing** - Token hashes stored in database
3. **Session Validation** - Every request validates against database
4. **Automatic Expiration** - Tokens expire after set duration
5. **Secure Storage** - Only hash stored, never plaintext token

## API Endpoints

### 1. POST /api/portal/auth/login

Authenticates a customer and returns JWT tokens.

**Request:**
```bash
POST /api/portal/auth/login
Content-Type: application/json

{
  "email": "customer@example.com",
  "password": "secure_password"
}
```

**Validation:**
- Email: Must be valid email format
- Password: Required, minimum 1 character

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800,
    "refreshExpiresIn": 2592000,
    "customer": {
      "id": "uuid",
      "email": "customer@example.com",
      "name": "John Doe",
      "phone": "+1234567890"
    },
    "sessionId": "uuid"
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "authentication_failed",
  "message": "Invalid email or password",
  "version": "v1"
}
```

**Status Codes:**
- `200` - Success
- `400` - Validation error
- `401` - Authentication failed
- `403` - Account inactive
- `404` - Customer not found
- `500` - Server error

**Side Effects:**
1. Creates session in `portal_sessions` table
2. Logs login event in audit log
3. Records IP address and user agent
4. Validates customer account is active

**Security Notes:**
- Generic error messages prevent user enumeration
- Password is validated via Supabase Auth
- IP address extracted from headers (X-Forwarded-For, X-Real-IP, X-Vercel-Forwarded-For)

### 2. POST /api/portal/auth/refresh

Refreshes an expired access token using a valid refresh token.

**Request:**
```bash
POST /api/portal/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 604800,
    "refreshExpiresIn": 2592000
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "token_expired",
  "message": "Your session has expired. Please log in again.",
  "version": "v1"
}
```

**Status Codes:**
- `200` - Success
- `400` - Validation error (missing refresh token)
- `401` - Invalid or expired refresh token
- `500` - Server error

**Side Effects:**
1. Generates new access token
2. Updates session with new token hash
3. Updates `last_accessed_at` timestamp
4. Refreshes session expiration time
5. Keeps same refresh token (rotated on login only)

**Token Rotation:**
- Access token is regenerated
- Refresh token remains the same (simplifies client logic)
- Session ID remains constant

### 3. POST /api/portal/auth/logout

Terminates customer session and revokes tokens.

**Request (Single Session Logout):**
```bash
POST /api/portal/auth/logout
Content-Type: application/json
X-Portal-Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "allSessions": false
}
```

**Request (All Sessions Logout):**
```bash
POST /api/portal/auth/logout
Content-Type: application/json
X-Portal-Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "allSessions": true
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully",
    "sessionsRevoked": 1
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

**Response (All Sessions):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out from 3 sessions",
    "sessionsRevoked": 3
  },
  "version": "v1",
  "timestamp": "2025-10-21T10:30:00Z"
}
```

**Status Codes:**
- `200` - Success
- `401` - Invalid or missing access token
- `500` - Server error

**Side Effects:**
1. Deletes session(s) from `portal_sessions` table
2. Logs logout event in audit log
3. Invalidates access and refresh tokens
4. If `allSessions: true`, revokes all customer sessions

**Parameters:**
- `allSessions` (optional, default: false) - If true, logs out from all devices

## Database Schema

### portal_sessions Table

**Columns:**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (session ID) |
| `customer_id` | uuid | Customer reference (FK) |
| `token_hash` | text | SHA-256 hash of access token |
| `ip_address` | inet | Client IP address |
| `user_agent` | text | Client browser/device info |
| `expires_at` | timestamptz | Session expiration |
| `created_at` | timestamptz | Session creation time |
| `last_accessed_at` | timestamptz | Last API request time |

**Indexes:**
- `idx_portal_sessions_customer` - Customer lookup
- `idx_portal_sessions_token_hash` - Token validation
- `idx_portal_sessions_expires` - Expiration cleanup
- `idx_portal_sessions_customer_active` - Active sessions per customer

**Constraints:**
- `portal_sessions_token_hash_unique` - Prevents token duplication
- Foreign key on `customer_id` with CASCADE delete

### RLS Policies

**Customers can view own sessions:**
```sql
CREATE POLICY "Customers can view own sessions"
  ON portal_sessions FOR SELECT
  USING (customer_id IN (
    SELECT id FROM customers WHERE email = auth.email()
  ));
```

**Customers can delete own sessions (logout):**
```sql
CREATE POLICY "Customers can delete own sessions"
  ON portal_sessions FOR DELETE
  USING (customer_id IN (
    SELECT id FROM customers WHERE email = auth.email()
  ));
```

**Service role can manage sessions:**
```sql
CREATE POLICY "Service role can insert sessions"
  ON portal_sessions FOR INSERT
  WITH CHECK (auth.jwt() IS NOT NULL);

CREATE POLICY "Service role can update sessions"
  ON portal_sessions FOR UPDATE
  USING (true) WITH CHECK (true);
```

## Token Management Functions

### Generate Token Pair

```typescript
import { generateTokenPair } from '@/lib/auth/portal-tokens'

const { tokens, sessionId } = await generateTokenPair({
  customerId: 'uuid',
  email: 'customer@example.com',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
})

console.log(tokens.accessToken)   // JWT access token
console.log(tokens.refreshToken)  // JWT refresh token
console.log(tokens.expiresIn)     // 604800 (7 days in seconds)
console.log(sessionId)             // Session UUID
```

### Validate Access Token

```typescript
import { validateAccessToken } from '@/lib/auth/portal-tokens'

const result = await validateAccessToken(accessToken)

if (result.valid) {
  console.log(result.payload?.sub)        // customer_id
  console.log(result.payload?.email)      // customer email
  console.log(result.payload?.sessionId)  // session ID
} else {
  console.error(result.error)
}
```

### Refresh Access Token

```typescript
import { refreshAccessToken } from '@/lib/auth/portal-tokens'

try {
  const newTokens = await refreshAccessToken(refreshToken)
  console.log(newTokens.accessToken)  // New access token
  console.log(newTokens.refreshToken) // Same refresh token
} catch (error) {
  console.error('Token refresh failed:', error)
  // Redirect to login
}
```

### Revoke Session

```typescript
import { revokeSession } from '@/lib/auth/portal-tokens'

const success = await revokeSession(sessionId)
console.log(success ? 'Session revoked' : 'Failed to revoke')
```

### Get Active Sessions

```typescript
import { getActiveSessions } from '@/lib/auth/portal-tokens'

const sessions = await getActiveSessions(customerId)

sessions.forEach(session => {
  console.log('Session ID:', session.id)
  console.log('IP:', session.ipAddress)
  console.log('Device:', session.userAgent)
  console.log('Created:', session.createdAt)
  console.log('Last used:', session.lastAccessedAt)
})
```

## Client Integration

### Login Flow

```typescript
// 1. Customer submits credentials
const response = await fetch('/api/portal/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'customer@example.com',
    password: 'secure_password'
  })
})

const data = await response.json()

if (data.success) {
  // 2. Store tokens securely
  localStorage.setItem('accessToken', data.data.accessToken)

  // Better: Store refresh token in httpOnly cookie
  // This requires backend to set cookie on login
  sessionStorage.setItem('refreshToken', data.data.refreshToken)

  // 3. Store customer info
  localStorage.setItem('customer', JSON.stringify(data.data.customer))

  // 4. Redirect to dashboard
  window.location.href = '/dashboard'
}
```

### API Request with Token

```typescript
// Include access token in every request
const response = await fetch('/api/portal/customer', {
  headers: {
    'X-Portal-Token': localStorage.getItem('accessToken')
  }
})

if (response.status === 401) {
  // Token expired, try to refresh
  await refreshTokens()
  // Retry request
}
```

### Token Refresh Flow

```typescript
async function refreshTokens() {
  const refreshToken = sessionStorage.getItem('refreshToken')

  const response = await fetch('/api/portal/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })

  const data = await response.json()

  if (data.success) {
    // Update access token
    localStorage.setItem('accessToken', data.data.accessToken)
    return true
  } else {
    // Refresh failed, redirect to login
    window.location.href = '/login'
    return false
  }
}
```

### Logout Flow

```typescript
// Single device logout
async function logout() {
  const accessToken = localStorage.getItem('accessToken')

  await fetch('/api/portal/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Portal-Token': accessToken
    },
    body: JSON.stringify({ allSessions: false })
  })

  // Clear local storage
  localStorage.removeItem('accessToken')
  sessionStorage.removeItem('refreshToken')
  localStorage.removeItem('customer')

  // Redirect to login
  window.location.href = '/login'
}

// All devices logout
async function logoutEverywhere() {
  const accessToken = localStorage.getItem('accessToken')

  await fetch('/api/portal/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Portal-Token': accessToken
    },
    body: JSON.stringify({ allSessions: true })
  })

  // Clear local storage
  localStorage.removeItem('accessToken')
  sessionStorage.removeItem('refreshToken')
  localStorage.removeItem('customer')

  // Redirect to login
  window.location.href = '/login'
}
```

### Automatic Token Refresh

```typescript
// Set up interceptor to auto-refresh tokens
async function apiRequest(url: string, options: RequestInit = {}) {
  // Add access token to request
  const accessToken = localStorage.getItem('accessToken')
  const headers = {
    ...options.headers,
    'X-Portal-Token': accessToken
  }

  // Make request
  let response = await fetch(url, { ...options, headers })

  // If unauthorized, try refreshing token
  if (response.status === 401) {
    const refreshed = await refreshTokens()

    if (refreshed) {
      // Retry with new token
      const newToken = localStorage.getItem('accessToken')
      headers['X-Portal-Token'] = newToken
      response = await fetch(url, { ...options, headers })
    }
  }

  return response
}
```

## Configuration

### Required Environment Variables

```bash
# JWT Secret (REQUIRED - generate a strong random string)
PORTAL_JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long

# Supabase (for customer authentication)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Portal URLs (for CORS)
NEXT_PUBLIC_PORTAL_URL=https://portal.yourdomain.com
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
ALLOWED_PORTAL_ORIGINS=https://portal.yourdomain.com,https://portal2.yourdomain.com
```

### Generating JWT Secret

**Option 1: OpenSSL**
```bash
openssl rand -base64 32
```

**Option 2: Node.js**
```javascript
require('crypto').randomBytes(32).toString('base64')
```

**Option 3: Online Tool**
- Use: https://www.grc.com/passwords.htm
- Select "63 random alpha-numeric characters"

### Token Expiry Configuration

To change token expiry times, edit `src/lib/auth/portal-tokens.ts`:

```typescript
const TOKEN_EXPIRY = {
  access: 7 * 24 * 60 * 60,   // 7 days (change to desired duration)
  refresh: 30 * 24 * 60 * 60, // 30 days (change to desired duration)
} as const
```

## Security Best Practices

### Token Storage

**Recommended Approach:**
1. **Access Token:** Memory or sessionStorage (cleared on tab close)
2. **Refresh Token:** HttpOnly cookie (backend sets, client can't access)

**NOT Recommended:**
- Storing tokens in localStorage (vulnerable to XSS)
- Storing refresh tokens in accessible storage

### Implementation Example

Backend sets httpOnly cookie on login:

```typescript
// In login endpoint
response.cookies.set('refreshToken', tokens.refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 30 * 24 * 60 * 60, // 30 days
  path: '/api/portal/auth'
})
```

Frontend reads from cookie automatically:

```typescript
// Refresh endpoint automatically reads from cookie
fetch('/api/portal/auth/refresh', {
  method: 'POST',
  credentials: 'include' // Send cookies
})
```

### HTTPS Only

Always use HTTPS in production:
- Prevents token interception
- Required for secure cookies
- Protects customer credentials

### Rate Limiting

Implement rate limiting on auth endpoints:
- Login: 5 attempts per 15 minutes
- Refresh: 10 requests per minute
- Logout: Unlimited (already authenticated)

### CORS Configuration

Restrict CORS to known portal domains:

```typescript
const allowedOrigins = [
  'https://portal.yourdomain.com',
  'https://portal2.yourdomain.com'
]
```

### Password Requirements

Enforce strong passwords via Supabase Auth:
- Minimum 8 characters
- Mix of uppercase, lowercase, numbers
- Special characters recommended

## Monitoring & Maintenance

### Session Cleanup

Run periodic cleanup of expired sessions:

```typescript
import { cleanupExpiredSessions } from '@/lib/auth/portal-tokens'

// Run daily via cron job
const deleted = await cleanupExpiredSessions()
console.log(`Cleaned up ${deleted} expired sessions`)
```

**Cron Schedule:**
```bash
# Run at 3 AM daily
0 3 * * * /path/to/cleanup-sessions.sh
```

### Monitor Active Sessions

Query active sessions:

```sql
-- Active sessions count
SELECT COUNT(*) FROM portal_sessions
WHERE expires_at > now();

-- Sessions by customer
SELECT customer_id, COUNT(*) as session_count
FROM portal_sessions
WHERE expires_at > now()
GROUP BY customer_id
ORDER BY session_count DESC
LIMIT 10;

-- Recent logins
SELECT ps.*, c.email, c.name
FROM portal_sessions ps
JOIN customers c ON c.id = ps.customer_id
WHERE ps.created_at > now() - interval '24 hours'
ORDER BY ps.created_at DESC;
```

### Audit Log Queries

Track authentication events:

```sql
-- Recent logins
SELECT * FROM audit_logs
WHERE meta->>'action' = 'portal_login'
ORDER BY created_at DESC
LIMIT 50;

-- Failed login attempts
SELECT entity_id, COUNT(*) as attempts
FROM audit_logs
WHERE action = 'LOGIN'
  AND meta->>'action' = 'portal_login_failed'
  AND created_at > now() - interval '1 hour'
GROUP BY entity_id
HAVING COUNT(*) > 3;

-- Logout events
SELECT * FROM audit_logs
WHERE meta->>'action' IN ('portal_logout', 'portal_logout_all')
ORDER BY created_at DESC;
```

## Troubleshooting

### Token Validation Fails

**Symptoms:**
- 401 errors on all requests
- "Invalid token signature" errors

**Solutions:**
1. Check `PORTAL_JWT_SECRET` is set correctly
2. Verify secret hasn't changed (invalidates all tokens)
3. Check token hasn't been modified client-side
4. Ensure session exists in database

### Session Not Found

**Symptoms:**
- "Session not found or invalid" errors
- Valid JWT but auth fails

**Solutions:**
1. Check `portal_sessions` table for session
2. Verify session hasn't expired
3. Ensure token hash matches
4. Check RLS policies aren't blocking access

### Refresh Token Expired

**Symptoms:**
- Refresh fails after 30 days
- User must log in again

**Solutions:**
1. This is expected behavior
2. User should log in again
3. Consider extending refresh token expiry if needed
4. Implement "remember me" feature for longer sessions

### Multiple Active Sessions

**Symptoms:**
- Customer has many active sessions
- Performance issues

**Solutions:**
1. Implement max sessions per customer
2. Auto-revoke oldest sessions
3. Prompt user to logout other devices
4. Add session management UI

## Testing

### Manual Testing Checklist

#### Login
- [ ] Valid credentials return tokens
- [ ] Invalid email returns 401
- [ ] Invalid password returns 401
- [ ] Inactive account returns 403
- [ ] Non-existent customer returns 404
- [ ] Session created in database
- [ ] Audit log entry created
- [ ] IP address recorded
- [ ] User agent recorded

#### Token Refresh
- [ ] Valid refresh token returns new access token
- [ ] Invalid refresh token returns 401
- [ ] Expired refresh token returns 401
- [ ] Session updated with new token hash
- [ ] Last accessed timestamp updated
- [ ] Expiration time extended

#### Logout
- [ ] Single session logout works
- [ ] All sessions logout works
- [ ] Session deleted from database
- [ ] Audit log entry created
- [ ] Tokens no longer valid after logout

#### Security
- [ ] JWT secret required
- [ ] Tokens properly signed
- [ ] Token hashes stored (not plaintext)
- [ ] Sessions expire correctly
- [ ] RLS policies enforce access control
- [ ] CORS headers correct

### Automated Testing

```typescript
// Example test suite
describe('Portal Authentication', () => {
  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const response = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.accessToken).toBeDefined()
      expect(data.data.refreshToken).toBeDefined()
    })

    it('should reject invalid credentials', async () => {
      const response = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'wrong_password'
        })
      })

      expect(response.status).toBe(401)
    })
  })

  describe('Token Refresh', () => {
    it('should refresh with valid refresh token', async () => {
      // ... test implementation
    })
  })

  describe('Logout', () => {
    it('should logout and invalidate session', async () => {
      // ... test implementation
    })
  })
})
```

## Migration Guide

### Migrating from Supabase Auth to Portal Tokens

If you're currently using Supabase Auth directly:

**Step 1:** Update client code to use new login endpoint
```typescript
// Old
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

// New
const response = await fetch('/api/portal/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
})
```

**Step 2:** Update token validation
```typescript
// Old
const { data: { user } } = await supabase.auth.getUser(token)

// New
const result = await validateAccessToken(token)
```

**Step 3:** Implement token refresh logic
```typescript
// Add automatic refresh on 401 errors
if (response.status === 401) {
  await refreshTokens()
}
```

## API Version

Current Version: **v1**

All responses include `version: "v1"` field.

## Changelog

### v1.0.0 (2025-10-21)
- Initial implementation
- JWT-based authentication
- Access & refresh tokens
- Session management
- Audit logging
- CORS support
- Multi-device logout
- Comprehensive documentation
