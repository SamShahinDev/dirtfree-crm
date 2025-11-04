# Environment Matrix

This document outlines the configuration differences across our three deployment environments.

## Environment Overview

| Environment | Domain | Purpose | Auto-Deploy | Protection |
|-------------|--------|---------|-------------|-----------|
| **Preview** | `*.vercel.app` | Feature branches, PRs | ✅ On PR | Basic Auth + Bot blocking |
| **Staging** | `staging.dirt-free-crm.com` | Pre-production testing | ✅ On `main` push | No indexing |
| **Production** | `dirt-free-crm.com` | Live application | 🔒 Manual only | Full security |

## Configuration Matrix

### Core Environment Variables

| Variable | Preview | Staging | Production | Source |
|----------|---------|---------|------------|--------|
| `VERCEL_ENV` | `preview` | `production` | `production` | Vercel (auto) |
| `NEXT_PUBLIC_VERCEL_ENV` | `preview` | `preview` | `production` | Vercel env vars |
| `NODE_ENV` | `production` | `production` | `production` | Vercel (auto) |

### Application URLs

| Variable | Preview | Staging | Production | Notes |
|----------|---------|---------|------------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://*.vercel.app` | `https://staging.dirt-free-crm.com` | `https://dirt-free-crm.com` | Used for webhooks, emails |

### Database Configuration

| Variable | Preview | Staging | Production | Notes |
|----------|---------|---------|------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging project | Staging project | Production project | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging anon key | Staging anon key | Production anon key | Public safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service key | Staging service key | Production service key | 🔒 Secret |

### External Services

#### Twilio Configuration

| Variable | Preview | Staging | Production | Notes |
|----------|---------|---------|------------|-------|
| `TWILIO_ACCOUNT_SID` | Staging SID | Staging SID | Production SID | Test vs Live |
| `TWILIO_AUTH_TOKEN` | Staging token | Staging token | Production token | 🔒 Secret |
| `TWILIO_PHONE_NUMBER` | Test number | Test number | Live number | SMS source |

#### Webhook Endpoints

| Service | Preview | Staging | Production | Purpose |
|---------|---------|---------|------------|---------|
| Twilio SMS | `preview-url/api/twilio/webhook` | `staging.../api/twilio/webhook` | `prod.../api/twilio/webhook` | SMS status updates |

### Monitoring & Alerts

| Variable | Preview | Staging | Production | Notes |
|----------|---------|---------|------------|-------|
| `SENTRY_DSN` | Same as prod | Same as prod | Production DSN | Error tracking |
| `SENTRY_ENVIRONMENT` | `preview` | `staging` | `production` | Environment tagging |

#### Slack Integration

| Variable | Preview | Staging | Production | Notes |
|----------|---------|---------|------------|-------|
| `SLACK_WEBHOOK_URL` | Disabled | `#staging-alerts` | `#prod-alerts` | Deploy notifications |

### Security & Protection

#### Authentication

| Variable | Preview | Staging | Production | Notes |
|----------|---------|---------|------------|-------|
| `PREVIEW_BASIC_AUTH` | `dev:preview123` | Not set | Not set | 🔒 Preview protection |
| `NEXTAUTH_SECRET` | Staging secret | Staging secret | Production secret | 🔒 JWT signing |

#### Feature Flags

| Variable | Preview | Staging | Production | Notes |
|----------|---------|---------|------------|-------|
| `ENABLE_CRON_JOBS` | `false` | `false` | `true` | Prevent duplicate crons |
| `ENABLE_EMAIL_SENDING` | `false` | `false` | `true` | Prevent accidental emails |
| `ENABLE_SMS_SENDING` | `false` | `true` | `true` | SMS testing allowed in staging |

### Cron Jobs

| Path | Preview | Staging | Production | Schedule |
|------|---------|---------|------------|----------|
| `/api/cron/send-reminders` | ❌ Disabled | ❌ Disabled | ✅ Enabled | `0 8,12,16,20 * * *` |
| `/api/cron/alerts` | ❌ Disabled | ❌ Disabled | ✅ Enabled | `*/15 * * * *` |

### SEO & Indexing

| Setting | Preview | Staging | Production | Implementation |
|---------|---------|---------|------------|----------------|
| Robots.txt | `Disallow: /` | `Disallow: /` | Selective allow | Dynamic route |
| X-Robots-Tag | `noindex, nofollow` | `noindex, nofollow` | Not set | Middleware |
| Sitemap | Not generated | Not generated | Generated | Production only |

### Performance & Caching

| Setting | Preview | Staging | Production | Notes |
|---------|---------|---------|------------|-------|
| Cache headers | 5 min max | 5 min max | 1 hour | Shorter for testing |
| CDN regions | `iad1` | `iad1, sfo1` | `iad1, sfo1` | Geographic distribution |

## Environment-Specific Behavior

### Preview Environment

**Purpose**: Feature branch testing and PR reviews

**Characteristics**:
- ✅ Auto-deploys on PR creation/updates
- 🔒 Basic authentication protection (`PREVIEW_BASIC_AUTH`)
- 🤖 Bot blocking (Googlebot, etc.)
- 📈 No indexing allowed
- 🚫 No cron jobs
- 🚫 No real email/SMS sending
- 📊 Sentry environment: `preview`

**Access**:
```bash
# Basic auth credentials (if enabled)
Username: dev
Password: preview123
```

### Staging Environment

**Purpose**: Pre-production testing with production-like data

**Characteristics**:
- ✅ Auto-deploys from `main` branch
- 📈 No indexing allowed
- 🚫 No cron jobs (prevents duplicate operations)
- ✅ SMS testing allowed (staging Twilio)
- 🚫 No real email sending
- 📊 Sentry environment: `staging`
- 🔍 Full E2E test suite runs before deployment

**Data**:
- Uses staging Supabase project
- Safe to reset/modify data
- Test SMS numbers only

### Production Environment

**Purpose**: Live customer-facing application

**Characteristics**:
- 🔒 Manual deployment only
- ✅ Full indexing allowed
- ✅ All cron jobs enabled
- ✅ Real email/SMS sending
- 📊 Sentry environment: `production`
- 🔍 Full E2E + smoke tests before live
- 💰 Live billing and customer data

**Protection Gates**:
1. Staging deployment must be successful
2. E2E tests must pass
3. Database migrations must be applied
4. Post-deploy health checks must pass
5. Manual approval required

## Environment Variable Setup

### Vercel Dashboard Configuration

#### Preview Environment
```bash
# Set in Vercel dashboard for "Preview" environment
NEXT_PUBLIC_VERCEL_ENV=preview
PREVIEW_BASIC_AUTH=dev:preview123
ENABLE_CRON_JOBS=false
ENABLE_EMAIL_SENDING=false
ENABLE_SMS_SENDING=false
SENTRY_ENVIRONMENT=preview
```

#### Staging Environment
```bash
# Set in Vercel dashboard for "Production" environment with "staging" branch
NEXT_PUBLIC_VERCEL_ENV=preview
NEXT_PUBLIC_APP_URL=https://staging.dirt-free-crm.com
ENABLE_CRON_JOBS=false
ENABLE_EMAIL_SENDING=false
ENABLE_SMS_SENDING=true
SENTRY_ENVIRONMENT=staging
SLACK_WEBHOOK_URL=[staging-alerts-webhook]
```

#### Production Environment
```bash
# Set in Vercel dashboard for "Production" environment with "main" branch
NEXT_PUBLIC_VERCEL_ENV=production
NEXT_PUBLIC_APP_URL=https://dirt-free-crm.com
ENABLE_CRON_JOBS=true
ENABLE_EMAIL_SENDING=true
ENABLE_SMS_SENDING=true
SENTRY_ENVIRONMENT=production
SLACK_WEBHOOK_URL=[prod-alerts-webhook]
```

## Security Considerations

### Secrets Management

🔒 **Never expose these in logs or client-side code**:
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_AUTH_TOKEN`
- `NEXTAUTH_SECRET`
- `PREVIEW_BASIC_AUTH`
- Database passwords
- API keys

### Environment Isolation

✅ **Best practices**:
- Preview/Staging share the same staging database
- Production has completely separate infrastructure
- No cross-environment data access
- Separate Twilio accounts for staging vs production
- Environment-specific Sentry projects

### Access Control

| Environment | Access Method | Protection Level |
|-------------|---------------|------------------|
| Preview | Basic Auth + Bot blocking | Medium |
| Staging | Domain restriction + No indexing | Medium |
| Production | Full authentication | High |

## Troubleshooting

### Common Issues

**Wrong environment detection:**
```typescript
// Check environment
console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('NEXT_PUBLIC_VERCEL_ENV:', process.env.NEXT_PUBLIC_VERCEL_ENV);
```

**Cron jobs running in wrong environment:**
```typescript
// Check in cron handler
const isProd = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';
if (!isProd) {
  return Response.json({ skipped: 'Not production' });
}
```

**Environment variable not found:**
- Check Vercel dashboard environment variable settings
- Ensure variable is set for correct environment (Preview/Production)
- Verify deployment includes the latest environment variables

### Environment Verification

Use the ops dashboard to verify environment configuration:
- `/api/ops/heartbeat` - Shows environment info
- `/api/ready` - Health check endpoint
- `/api/ops/samples` - Environment-specific features