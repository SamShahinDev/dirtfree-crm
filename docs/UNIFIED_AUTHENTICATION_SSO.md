# Unified Authentication (SSO)

Single Sign-On (SSO) implementation enabling seamless authentication between Customer Portal and Marketing Website.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Security](#security)
- [Implementation](#implementation)
- [User Flow](#user-flow)
- [API Reference](#api-reference)
- [Components](#components)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The Unified Authentication system enables customers to sign in once on the Customer Portal and automatically access personalized features on the Marketing Website without re-authenticating.

### Key Benefits

- **Seamless Experience**: One login for both Portal and Website
- **Personalization**: Show customer-specific content on website
- **Security**: JWT-based token authentication with expiration
- **Privacy**: No third-party authentication services required
- **Flexibility**: Easy to extend to additional applications

## Features

### Single Sign-On

- Login once on Portal, access both Portal and Website
- Automatic token generation and validation
- Secure token transmission via HTTPS
- Session expiration after 1 hour (configurable)

### Personalized Website Experience

- Welcome message with customer name
- Access to customer portal from website
- View booking history without re-login
- Loyalty points display
- Quick access to account features

### Session Management

- Automatic session storage in localStorage
- Session expiration handling
- Cross-tab synchronization
- Logout from any application clears all sessions

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Customer Portal                         │
│  - User authenticated with Supabase Auth           │
│  - Customer linked to portal_user_id               │
└──────────────┬──────────────────────────────────────┘
               │
               │ User clicks "Visit Website"
               │
               ↓
┌─────────────────────────────────────────────────────┐
│        SSO Token Generation                          │
│  1. Verify user authentication                      │
│  2. Get customer record                             │
│  3. Create JWT token with customer data             │
│  4. Redirect to website with token                  │
└──────────────┬──────────────────────────────────────┘
               │
               │ HTTPS Redirect with token
               │
               ↓
┌─────────────────────────────────────────────────────┐
│         Website SSO Callback                         │
│  1. Receive token from Portal                       │
│  2. Verify token with Portal API                    │
│  3. Get customer information                         │
│  4. Create local session                            │
│  5. Redirect to intended page                       │
└──────────────┬──────────────────────────────────────┘
               │
               │ Session stored in localStorage
               │
               ↓
┌─────────────────────────────────────────────────────┐
│      Personalized Website Experience                │
│  - Show customer name in header                     │
│  - Display account menu                             │
│  - Link to portal                                   │
│  - Show booking history                             │
│  - Display loyalty points                           │
└─────────────────────────────────────────────────────┘
```

## Security

### JWT Token Security

**Token Structure:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
{
  "userId": "uuid",
  "customerId": "uuid",
  "type": "sso",
  "email": "customer@example.com",
  "name": "John Doe",
  "iat": 1234567890,
  "exp": 1234571490,
  "iss": "dirt-free-portal",
  "aud": "dirt-free-website"
}
```

**Security Features:**
- HS256 algorithm (HMAC with SHA-256)
- Secret key minimum 32 characters
- Token expiration (default 1 hour)
- Issuer and audience validation
- Signature verification on every use

### Best Practices

1. **Secret Key Management**
   - Use strong, random secret (32+ characters)
   - Store in environment variables only
   - Never commit to version control
   - Rotate periodically (quarterly recommended)

2. **HTTPS Only**
   - Always use HTTPS in production
   - Tokens transmitted over HTTP can be intercepted
   - Set secure cookie flags when applicable

3. **Token Expiration**
   - Default 1 hour is recommended
   - Shorter = more secure, less convenient
   - Longer = less secure, more convenient

4. **Session Storage**
   - Use localStorage with care (XSS risks)
   - Consider httpOnly cookies for production
   - Clear sessions on logout

5. **Validation**
   - Always verify token before trusting data
   - Check issuer, audience, and expiration
   - Validate customer exists in database

## Implementation

### Portal Implementation

#### 1. SSO Token Module

**File**: `/dirt-free-customer-portal/src/lib/auth/sso-token.ts`

```typescript
import { SignJWT, jwtVerify } from 'jose';

// Create token
export async function createSSOToken(
  userId: string,
  customerId: string,
  metadata?: { email?: string; name?: string }
): Promise<string> {
  const token = await new SignJWT({
    userId,
    customerId,
    type: 'sso',
    ...metadata,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer('dirt-free-portal')
    .setAudience('dirt-free-website')
    .sign(SSO_SECRET);

  return token;
}

// Verify token
export async function verifySSOToken(token: string) {
  const verified = await jwtVerify(token, SSO_SECRET, {
    issuer: 'dirt-free-portal',
    audience: 'dirt-free-website',
  });

  return verified.payload;
}
```

#### 2. SSO Endpoint

**File**: `/dirt-free-customer-portal/src/app/api/auth/sso/route.ts`

```typescript
export async function GET(req: NextRequest) {
  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Get customer record
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('portal_user_id', user.id)
    .single();

  // 3. Create SSO token
  const ssoToken = await createSSOToken(user.id, customer.id, {
    email: customer.email,
    name: `${customer.first_name} ${customer.last_name}`,
  });

  // 4. Redirect to website with token
  const targetUrl = new URL('/auth/sso-callback', WEBSITE_URL);
  targetUrl.searchParams.set('token', ssoToken);

  return NextResponse.redirect(targetUrl.toString());
}
```

#### 3. Verification Endpoint

**File**: `/dirt-free-customer-portal/src/app/api/auth/sso/verify/route.ts`

```typescript
export async function POST(req: NextRequest) {
  const { token } = await req.json();

  // Verify token
  const payload = await verifySSOToken(token);

  // Get customer details
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', payload.customerId)
    .single();

  return NextResponse.json({
    success: true,
    userId: payload.userId,
    customerId: payload.customerId,
    name: `${customer.first_name} ${customer.last_name}`,
    email: customer.email,
    // ... other customer data
  });
}
```

### Website Implementation

#### 1. SSO Callback Handler

**File**: `/dirt-free-website/src/app/auth/sso-callback/page.tsx`

```typescript
'use client';

export default function SSOCallbackPage() {
  useEffect(() => {
    async function handleSSOCallback() {
      const token = searchParams.get('token');

      // Verify token with portal
      const response = await fetch(`${PORTAL_URL}/api/auth/sso/verify`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      // Store session
      localStorage.setItem('sso_session', JSON.stringify({
        ...data,
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      }));

      // Redirect
      router.push(returnPath);
    }

    handleSSOCallback();
  }, []);
}
```

#### 2. SSO Session Hook

**File**: `/dirt-free-website/src/hooks/useSSOSession.ts`

```typescript
export function useSSOSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedSession = localStorage.getItem('sso_session');
    if (storedSession) {
      const parsed = JSON.parse(storedSession);
      // Check expiration
      if (parsed.expiresAt > Date.now()) {
        setSession(parsed);
      }
    }
    setLoading(false);
  }, []);

  return { session, loading, isAuthenticated: !!session };
}
```

#### 3. Navigation Component

**File**: `/dirt-free-website/src/components/Navigation.tsx`

```typescript
export function Navigation() {
  const { session, isAuthenticated, logout } = useSSOSession();

  return (
    <nav>
      {isAuthenticated ? (
        <div>
          <span>Welcome, {session.firstName}!</span>
          <DropdownMenu>
            <DropdownMenuTrigger>My Account</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild>
                <a href={PORTAL_URL}>Customer Portal</a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <a href={`${PORTAL_URL}/login`}>Sign In</a>
      )}
    </nav>
  );
}
```

## User Flow

### Flow 1: First-Time SSO

```
1. Customer logs into Portal
2. Customer clicks "Visit Website" link
3. Portal generates SSO token
4. Portal redirects to Website with token in URL
5. Website receives token on /auth/sso-callback
6. Website calls Portal /api/auth/sso/verify
7. Portal verifies token and returns customer data
8. Website stores session in localStorage
9. Website redirects to home page
10. Customer sees personalized content
```

### Flow 2: Returning to Website

```
1. Customer already has SSO session in localStorage
2. Customer visits website
3. useSSOSession hook loads session from localStorage
4. Session expiration is checked
5. If valid: Show personalized content
6. If expired: Clear session, show sign in button
```

### Flow 3: Logout

```
1. Customer clicks "Sign Out" on website
2. logout() function clears localStorage
3. Session removed from all tabs (storage event)
4. Website shows sign in button
5. Portal session remains active (Portal logout is separate)
```

## API Reference

### Portal Endpoints

#### GET /api/auth/sso

Initiates SSO flow from Portal to Website.

**Query Parameters:**
- `return_url` - Full URL to redirect after SSO (optional)
- `return_path` - Path on website to redirect to (optional)

**Example:**
```
GET /api/auth/sso?return_path=/my-bookings
```

**Response:**
- HTTP 302 Redirect to website with token

#### POST /api/auth/sso/verify

Verifies SSO token and returns customer information.

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response (Success):**
```json
{
  "success": true,
  "userId": "uuid",
  "customerId": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "713-555-0100",
  "loyaltyPoints": 500,
  "loyaltyTier": "gold"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid or expired token"
}
```

### Website Routes

#### /auth/sso-callback

Handles SSO redirect from Portal.

**Query Parameters:**
- `token` - JWT token from Portal (required)
- `return_path` - Path to redirect after authentication (optional)

**Example:**
```
/auth/sso-callback?token=eyJhbG...&return_path=/my-bookings
```

## Components

### Portal Components

**SSO Link in Header:**
```typescript
<a href={`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso`}>
  Visit Website
</a>
```

**SSO Link with Return Path:**
```typescript
<a href={`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso?return_path=/services`}>
  Browse Services
</a>
```

### Website Components

**useSSOSession Hook:**
```typescript
const { session, isAuthenticated, loading, logout } = useSSOSession();

if (loading) return <Spinner />;
if (isAuthenticated) return <p>Welcome, {session.name}!</p>;
return <SignInButton />;
```

**Conditional Rendering:**
```typescript
{isAuthenticated ? (
  <PersonalizedContent session={session} />
) : (
  <GenericContent />
)}
```

## Setup Instructions

### 1. Install Dependencies

**Portal:**
```bash
cd dirt-free-customer-portal
npm install jose
```

### 2. Set Environment Variables

**Portal (.env.local):**
```bash
# SSO Secret (32+ characters, randomly generated)
SSO_SECRET_KEY=your-super-secret-key-at-least-32-characters-long-change-this

# Website URL
NEXT_PUBLIC_WEBSITE_URL=https://dirtfreecarpet.com
```

**Website (.env.local):**
```bash
# Portal URL
NEXT_PUBLIC_PORTAL_URL=https://portal.dirtfreecarpet.com
```

### 3. Generate Secret Key

```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Deploy Changes

1. Deploy Portal with SSO endpoints
2. Deploy Website with SSO callback
3. Test SSO flow in production

### 5. Test SSO Flow

1. Login to Portal
2. Click "Visit Website"
3. Verify redirect to website
4. Check personalized content appears
5. Test logout
6. Verify session cleared

## Environment Variables

### Portal

| Variable | Description | Example |
|----------|-------------|---------|
| `SSO_SECRET_KEY` | JWT signing secret | `abc123...` (32+ chars) |
| `NEXT_PUBLIC_WEBSITE_URL` | Website base URL | `https://dirtfreecarpet.com` |
| `NEXT_PUBLIC_APP_URL` | Portal base URL | `https://portal.dirtfreecarpet.com` |

### Website

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_PORTAL_URL` | Portal base URL | `https://portal.dirtfreecarpet.com` |

## Usage Examples

### Example 1: Link to Website from Portal

```typescript
// In Portal dashboard
<Button asChild>
  <a href={`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso`}>
    Visit Our Website
  </a>
</Button>
```

### Example 2: Show Loyalty Points on Website

```typescript
// In Website component
function LoyaltyBanner() {
  const { session, isAuthenticated } = useSSOSession();

  if (!isAuthenticated) return null;

  return (
    <div className="bg-blue-50 p-4 rounded-lg">
      <p className="text-sm">
        You have <strong>{session.loyaltyPoints}</strong> points!
      </p>
      <a href={`${process.env.NEXT_PUBLIC_PORTAL_URL}/loyalty`}>
        View Rewards
      </a>
    </div>
  );
}
```

### Example 3: Show Booking History Link

```typescript
// In Website navigation
{isAuthenticated && (
  <Link href="/my-bookings" className="...">
    My Bookings ({session.customerId})
  </Link>
)}
```

### Example 4: Personalized Service Recommendations

```typescript
// In Website services page
function ServiceRecommendations() {
  const { session, isAuthenticated } = useSSOSession();

  if (!isAuthenticated) {
    return <GenericRecommendations />;
  }

  // Fetch previous bookings for this customer
  // Show personalized service recommendations
  return (
    <div>
      <h3>Recommended for You, {session.firstName}</h3>
      <ServiceCards customerId={session.customerId} />
    </div>
  );
}
```

## Best Practices

### 1. Always Use HTTPS

```typescript
// ✅ Good
const websiteUrl = 'https://dirtfreecarpet.com';

// ❌ Bad (in production)
const websiteUrl = 'http://dirtfreecarpet.com';
```

### 2. Validate Environment Variables

```typescript
// ✅ Good
if (!process.env.SSO_SECRET_KEY || process.env.SSO_SECRET_KEY.length < 32) {
  throw new Error('SSO_SECRET_KEY must be at least 32 characters');
}

// ❌ Bad
const secret = process.env.SSO_SECRET_KEY || 'default-secret';
```

### 3. Handle Expired Sessions Gracefully

```typescript
// ✅ Good
if (session.expiresAt <= Date.now()) {
  logout();
  toast.info('Your session has expired. Please sign in again.');
}

// ❌ Bad
// Just show error without explanation
```

### 4. Log SSO Activities

```typescript
// ✅ Good
await supabase.from('portal_activity_logs').insert({
  customer_id: customer.id,
  activity_type: 'sso_initiated',
  description: 'SSO token created for website access',
});

// ❌ Bad
// No logging
```

### 5. Rate Limit SSO Endpoints

```typescript
// ✅ Good
// Implement rate limiting on /api/auth/sso
const rateLimit = new RateLimiter({ max: 10, window: '1m' });

// ❌ Bad
// No rate limiting (vulnerable to abuse)
```

## Troubleshooting

### Issue: Token Verification Fails

**Symptoms**: Website shows "Authentication failed" after redirect from Portal

**Causes:**
1. Different SSO_SECRET_KEY on Portal
2. Token expired during verification
3. CORS issues blocking verification request

**Solutions:**
```bash
# 1. Verify secret matches
echo $SSO_SECRET_KEY  # On Portal server

# 2. Check token expiration time
# Token default is 1 hour - increase if needed

# 3. Check CORS headers
# Ensure Portal allows requests from Website domain
```

### Issue: Session Not Persisting

**Symptoms**: User appears logged out after page refresh

**Causes:**
1. localStorage not supported
2. Session expired
3. Browser privacy settings blocking storage

**Solutions:**
```typescript
// Check localStorage availability
if (typeof window !== 'undefined' && window.localStorage) {
  // Safe to use localStorage
}

// Check session expiration
const session = JSON.parse(localStorage.getItem('sso_session'));
if (session.expiresAt <= Date.now()) {
  // Session expired - clear it
  localStorage.removeItem('sso_session');
}
```

### Issue: Infinite Redirect Loop

**Symptoms**: Browser keeps redirecting between Portal and Website

**Causes:**
1. Return URL includes SSO endpoint
2. Token not being stored properly

**Solutions:**
```typescript
// ✅ Prevent SSO endpoint in return URL
const returnPath = searchParams.get('return_path');
if (returnPath.includes('/api/auth/sso')) {
  // Redirect to home instead
  return '/';
}

// ✅ Ensure session is stored before redirect
localStorage.setItem('sso_session', JSON.stringify(sessionData));
await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
router.push(returnPath);
```

### Issue: Customer Data Not Matching

**Symptoms**: Wrong customer data shown after SSO

**Causes:**
1. Token payload contains wrong customer ID
2. Database query error

**Solutions:**
```typescript
// Validate customer matches user
if (customer.portal_user_id !== payload.userId) {
  throw new Error('Invalid token - customer mismatch');
}

// Log mismatches for debugging
console.error('Customer/User mismatch:', {
  customerId: customer.id,
  expectedUserId: payload.userId,
  actualUserId: customer.portal_user_id,
});
```

## Related Documentation

- [Customer Portal](../dirt-free-customer-portal/README.md)
- [Portal Provisioning](./PORTAL_PROVISIONING.md)
- [Account Linking](../dirt-free-customer-portal/ACCOUNT_LINKING.md)
- [Website Analytics](./WEBSITE_ANALYTICS.md)

## Support

For questions or issues:
- Check browser console for errors
- Verify environment variables are set
- Check Portal logs for token generation
- Review this documentation for solutions
- Contact development team for assistance
