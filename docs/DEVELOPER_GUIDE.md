# Dirt Free CRM - Developer Guide

Complete developer documentation for the Dirt Free Carpet Cleaning & Restoration CRM system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Setup & Installation](#setup--installation)
3. [Database Schema](#database-schema)
4. [API Reference](#api-reference)
5. [Component Library](#component-library)
6. [Testing Guide](#testing-guide)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)
9. [Contributing](#contributing)

---

## Architecture Overview

### Technology Stack

**Frontend:**
- Next.js 15.5.3 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 3
- shadcn/ui Components
- Recharts for analytics visualization

**Backend:**
- Next.js API Routes (Serverless)
- Supabase (PostgreSQL 15)
- Row Level Security (RLS)
- Real-time subscriptions

**Authentication:**
- Supabase Auth
- JWT tokens
- Role-based access control (RBAC)
- Multi-user support

**Third-Party Integrations:**
- Stripe (Payments)
- Twilio (SMS/Voice)
- Resend (Email)
- Sentry (Error Tracking)
- OpenAI (Chatbot - optional)

**DevOps:**
- Vercel (Hosting & CI/CD)
- GitHub (Version Control)
- Vercel Cron Jobs
- Environment Variables

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Browser                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │       Next.js Frontend (React 19)                │  │
│  │  • Customer Portal  • Admin Dashboard            │  │
│  │  • Analytics        • Reports                    │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS/WebSocket
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Vercel Edge Network (CDN)                  │
│  • Global CDN        • SSL/TLS                          │
│  • Edge Functions    • DDoS Protection                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│           Next.js API Routes (Serverless)               │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Business Logic Layer                            │  │
│  │  • Portal APIs      • Opportunities              │  │
│  │  • Promotions       • Reviews                    │  │
│  │  • Loyalty          • Referrals                  │  │
│  │  • Analytics        • Chatbot                    │  │
│  │  • Reports          • Cron Jobs                  │  │
│  └──────────────────────────────────────────────────┘  │
└──┬────────┬──────────┬──────────┬─────────────────┬────┘
   │        │          │          │                 │
   │        │          │          │                 │
   ▼        ▼          ▼          ▼                 ▼
┌──────┐ ┌──────┐ ┌────────┐ ┌───────┐      ┌─────────┐
│Supa- │ │Stripe│ │Twilio │ │Resend │      │ Sentry │
│base  │ │      │ │        │ │       │      │        │
└──┬───┘ └──────┘ └────────┘ └───────┘      └─────────┘
   │
   ▼
┌──────────────────────────────────────┐
│     PostgreSQL Database              │
│  • 30+ Tables                        │
│  • Row Level Security (RLS)          │
│  • Real-time subscriptions           │
│  • Functions & Triggers              │
│  • Views for analytics               │
└──────────────────────────────────────┘
```

### Feature Modules

The system is organized into feature modules:

**1. Customer Portal** (`/src/app/(dashboard)/dashboard/portal/`)
- Customer authentication
- Service history viewing
- Invoice management
- Promotion claiming
- Review submission
- Account management

**2. Opportunities Pipeline** (`/src/lib/opportunities/`)
- Missed opportunity detection
- Automated follow-up
- Conversion tracking
- Offer generation
- Pipeline analytics

**3. Promotions Engine** (`/src/lib/promotions/`)
- Promotion creation
- Multi-channel delivery (Email, SMS, Portal)
- Engagement tracking
- Analytics and ROI
- Automated triggers

**4. Review Management** (`/src/lib/reviews/`)
- Review request automation
- Response management
- Google review integration
- Sentiment analysis
- Follow-up workflows

**5. Loyalty & Referrals** (`/src/lib/loyalty/` & `/src/lib/referrals/`)
- Tiered loyalty program
- Points management
- Achievement system
- Referral tracking
- Rewards redemption

**6. Analytics & Reports** (`/src/lib/analytics/` & `/src/lib/reports/`)
- Portal analytics
- Opportunity metrics
- Promotion performance
- Scheduled reports
- Custom exports

**7. Chatbot & Support** (`/src/lib/chatbot/`)
- AI-powered chatbot
- Message templates
- Support ticket management
- Conversation history

**8. Monitoring & Cron** (`/src/lib/monitoring/` & `/src/lib/cron/`)
- Health monitoring
- Uptime tracking
- Cron job orchestration
- Alert management
- Error tracking

---

## Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- Git
- Supabase account
- Vercel account (for deployment)
- Stripe account (optional)
- Twilio account (optional)
- Resend account (optional)

### Local Development Setup

#### 1. Clone Repository

```bash
git clone https://github.com/your-org/dirt-free-crm.git
cd dirt-free-crm
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Environment Variables

Create `.env.local`:

```bash
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (Optional)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Twilio (Optional)
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Resend (Optional)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@dirtfreecarpet.com

# Sentry (Optional)
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_AUTH_TOKEN=your-auth-token

# Cron Jobs
CRON_SECRET=your-secure-random-string

# Operations
OPS_EMAIL=ops@dirtfreecarpet.com
OPS_PHONE=+1234567890
```

#### 4. Database Setup

```bash
# Initialize Supabase
npx supabase init

# Link to your Supabase project
npx supabase link --project-ref your-project-ref

# Run migrations
npx supabase db push

# Or apply migrations manually
npm run migrate
```

#### 5. Run Development Server

```bash
npm run dev
```

Access the application at `http://localhost:3000`

#### 6. Seed Database (Optional)

```bash
npm run db:seed
```

### Verify Installation

1. **Database**: Check tables exist in Supabase dashboard
2. **Authentication**: Test login at `/auth/login`
3. **API**: Test health endpoint: `curl http://localhost:3000/api/health`
4. **Portal**: Access customer portal at `/dashboard/portal`

---

## Database Schema

The database consists of 30+ tables organized into logical groups:

### Core Tables

- **customers**: Customer information
- **users**: System users (admins, staff)
- **user_profiles**: Extended user data
- **user_permissions**: Granular permissions

### Opportunities

- **missed_opportunities**: Detected opportunities
- **opportunity_interactions**: Follow-up history
- **opportunity_offers**: Generated offers

### Promotions

- **promotions**: Promotion definitions
- **promotion_deliveries**: Delivery tracking
- **promotion_analytics**: Performance metrics

### Reviews

- **review_requests**: Sent requests
- **review_responses**: Customer responses
- **google_reviews**: Synced Google reviews

### Loyalty & Referrals

- **loyalty_tiers**: Tier definitions
- **loyalty_transactions**: Points history
- **loyalty_achievements**: Available achievements
- **customer_achievements**: Earned achievements
- **referrals**: Referral tracking
- **loyalty_rewards**: Reward catalog
- **loyalty_redemptions**: Redemption history

### Chatbot & Support

- **chatbot_interactions**: Chat history
- **message_templates**: Template library
- **support_tickets**: Support tracking

### Monitoring & Logs

- **uptime_logs**: Health check history
- **alert_history**: System alerts
- **cron_job_logs**: Cron execution logs
- **audit_logs**: Security audit trail
- **portal_activity_logs**: Customer activity

### Reports

- **scheduled_reports**: Report configurations
- **report_generation_log**: Generation history

For detailed schema documentation, see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

---

## API Reference

### API Organization

APIs are organized by feature module:

```
/api/
├── auth/                   # Authentication
├── portal/                 # Customer portal
├── opportunities/          # Opportunity management
├── promotions/             # Promotion engine
├── reviews/                # Review management
├── loyalty/                # Loyalty program
├── referrals/              # Referral tracking
├── chatbot/                # Chatbot interactions
├── analytics/              # Analytics data
├── admin/                  # Admin functions
├── cron/                   # Cron jobs
├── monitoring/             # Health monitoring
└── health/                 # Health checks
```

### Authentication

All API routes use middleware for authentication:

```typescript
import { withAuth } from '@/middleware/api-auth'

export const GET = withAuth(
  async (req) => {
    // Your logic here
    const userId = req.user?.id
  },
  {
    requirePermission: 'opportunities:view',
    enableAuditLog: true,
  }
)
```

### Common Response Format

```typescript
// Success
{
  "success": true,
  "data": { /* response data */ }
}

// Error
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Example API Call

```typescript
// Frontend
const response = await fetch('/api/opportunities', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    customerId: 'uuid',
    opportunityType: 'missed_appointment',
  }),
})

const result = await response.json()
if (result.success) {
  console.log('Created:', result.data)
}
```

For complete API documentation, see [API_REFERENCE.md](./API_REFERENCE.md)

---

## Component Library

### UI Components (shadcn/ui)

The project uses shadcn/ui components:

```typescript
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
```

### Custom Components

**Opportunity Components:**
```typescript
import { OpportunityCard } from '@/components/opportunities/OpportunityCard'
import { OpportunityBoard } from '@/components/opportunities/OpportunityBoard'
import { OpportunityFilters } from '@/components/opportunities/OpportunityFilters'
```

**Analytics Components:**
```typescript
import { AnalyticsChart } from '@/components/analytics/AnalyticsChart'
import { MetricCard } from '@/components/analytics/MetricCard'
import { TrendIndicator } from '@/components/analytics/TrendIndicator'
```

**Portal Components:**
```typescript
import { PortalNav } from '@/components/portal/PortalNav'
import { ServiceHistory } from '@/components/portal/ServiceHistory'
import { PromotionCard } from '@/components/portal/PromotionCard'
```

### Component Patterns

**Server Components (Default):**
```typescript
// app/dashboard/page.tsx
export default async function DashboardPage() {
  const data = await fetchData() // Server-side data fetching
  return <Dashboard data={data} />
}
```

**Client Components:**
```typescript
'use client'

import { useState } from 'react'

export function InteractiveComponent() {
  const [state, setState] = useState()
  // Component logic
}
```

For complete component documentation, see [COMPONENT_LIBRARY.md](./COMPONENT_LIBRARY.md)

---

## Testing Guide

### Test Structure

```
tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
├── e2e/               # End-to-end tests
└── fixtures/          # Test data
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# Specific test file
npm test -- opportunities.test.ts
```

### Writing Unit Tests

```typescript
// __tests__/lib/opportunities/detector.test.ts
import { detectMissedOpportunities } from '@/lib/opportunities/detector'

describe('detectMissedOpportunities', () => {
  it('should detect missed appointments', async () => {
    const opportunities = await detectMissedOpportunities('customer-id')
    expect(opportunities).toHaveLength(1)
    expect(opportunities[0].opportunity_type).toBe('missed_appointment')
  })
})
```

### Writing Integration Tests

```typescript
// __tests__/api/opportunities.test.ts
import { POST } from '@/app/api/opportunities/route'

describe('POST /api/opportunities', () => {
  it('should create opportunity', async () => {
    const req = new Request('http://localhost/api/opportunities', {
      method: 'POST',
      body: JSON.stringify({ customerId: 'uuid', type: 'missed_appointment' }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/portal.spec.ts
import { test, expect } from '@playwright/test'

test('customer can view promotions', async ({ page }) => {
  await page.goto('/dashboard/portal')
  await page.click('text=Promotions')
  await expect(page.locator('.promotion-card')).toBeVisible()
})
```

### Test Coverage Goals

- Unit tests: >80%
- Integration tests: Critical paths
- E2E tests: User flows

---

## Deployment

### Vercel Deployment

#### 1. Connect Repository

1. Go to Vercel dashboard
2. Click "New Project"
3. Import Git repository
4. Select Next.js framework preset

#### 2. Configure Environment Variables

Add all environment variables from `.env.local` in Vercel dashboard:
- Project Settings → Environment Variables

#### 3. Configure Build Settings

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

#### 4. Deploy

```bash
# Production deployment
git push origin main

# Preview deployment
git push origin feature-branch
```

### Cron Job Configuration

In Vercel dashboard, configure cron jobs:

**Project Settings → Cron Jobs:**

| Path | Schedule | Description |
|------|----------|-------------|
| `/api/cron/execute/health-check` | `*/5 * * * *` | Health monitoring |
| `/api/cron/execute/process-promotion-deliveries` | `*/30 * * * *` | Promotion delivery |
| `/api/cron/execute/send-review-requests` | `0 */6 * * *` | Review requests |
| `/api/cron/execute/generate-scheduled-reports` | `0 6 * * *` | Scheduled reports |

**Authorization Header:**
```
Bearer ${CRON_SECRET}
```

### Database Migrations

Run migrations on deployment:

```bash
# From local machine
npx supabase db push --project-ref your-project-ref

# Or via CI/CD
npm run migrate:prod
```

### Post-Deployment Checklist

- [ ] Verify environment variables
- [ ] Test authentication
- [ ] Check cron jobs running
- [ ] Verify integrations (Stripe, Twilio, Resend)
- [ ] Test critical user flows
- [ ] Check Sentry for errors
- [ ] Monitor performance

---

## Troubleshooting

### Common Issues

#### Cron Jobs Not Running

**Symptoms:** Scheduled tasks not executing

**Solutions:**
1. Check Vercel cron configuration
2. Verify `CRON_SECRET` matches
3. Check cron job logs: `/dashboard/admin/cron-jobs`
4. Test manually: `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/execute/job-name`

#### Database Connection Errors

**Symptoms:** `ECONNREFUSED` or timeout errors

**Solutions:**
1. Verify Supabase credentials
2. Check database is running
3. Verify connection pooling settings
4. Check RLS policies

#### Authentication Issues

**Symptoms:** `401 Unauthorized` or redirect loops

**Solutions:**
1. Clear cookies and try again
2. Verify JWT secret configuration
3. Check user permissions in database
4. Ensure RLS policies allow access

#### Promotion Not Delivering

**Symptoms:** Promotions created but not sent

**Solutions:**
1. Check `promotion_deliveries` table for status
2. Verify email/SMS credentials
3. Check cron job is running
4. Review error logs in Sentry

#### Reports Not Generating

**Symptoms:** Scheduled reports not arriving

**Solutions:**
1. Check `scheduled_reports` table - is report enabled?
2. Verify `RESEND_API_KEY` is set
3. Check `report_generation_log` for errors
4. Test report generation manually

### Debug Mode

Enable debug logging:

```typescript
// Add to any file
console.log('[DEBUG]', 'Your debug message', data)

// Or use environment variable
if (process.env.NODE_ENV === 'development') {
  console.debug('Development only message')
}
```

### Monitoring Tools

**1. Sentry Dashboard**
- View errors and performance
- Filter by environment
- Track user impact

**2. Vercel Analytics**
- Monitor site performance
- Track Core Web Vitals
- View deployment logs

**3. Supabase Dashboard**
- View database logs
- Monitor real-time subscriptions
- Check RLS policies

**4. Application Dashboards**
- Health monitoring: `/dashboard/admin/monitoring`
- Cron jobs: `/dashboard/admin/cron-jobs`
- Error tracking: `/dashboard/admin/errors`

### Getting Help

**Internal:**
1. Check documentation (you're here!)
2. Review API reference
3. Search codebase for examples

**External:**
- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- shadcn/ui: https://ui.shadcn.com/docs

---

## Contributing

### Code Style

**TypeScript:**
```typescript
// Use explicit types
function processOrder(orderId: string): Promise<Order> {
  // ...
}

// Use interfaces for complex types
interface CustomerData {
  id: string
  name: string
  email: string
}
```

**React Components:**
```typescript
// Functional components with TypeScript
interface Props {
  customerId: string
  onUpdate: (data: CustomerData) => void
}

export function CustomerCard({ customerId, onUpdate }: Props) {
  // Component logic
}
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/opportunity-enhancements

# Make changes and commit
git add .
git commit -m "feat: add opportunity filtering"

# Push and create PR
git push origin feature/opportunity-enhancements
```

### Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build/config changes

**Examples:**
```
feat(opportunities): add bulk convert action
fix(portal): resolve invoice display issue
docs(api): update authentication guide
```

### Pull Request Process

1. Create feature branch
2. Make changes with tests
3. Update documentation
4. Create pull request
5. Address review feedback
6. Merge after approval

### Code Review Checklist

- [ ] Code follows style guide
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log() in production
- [ ] Error handling implemented
- [ ] TypeScript types defined
- [ ] Performance considered
- [ ] Security reviewed

---

## Additional Resources

### Documentation

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Database Schema](./DATABASE_SCHEMA.md) - Full schema reference
- [Component Library](./COMPONENT_LIBRARY.md) - Component usage guide
- [Cron Jobs](./CRON_JOB_ORCHESTRATION.md) - Cron job management
- [Health Monitoring](./HEALTH_MONITORING.md) - System monitoring
- [Scheduled Reports](./SCHEDULED_REPORTS.md) - Automated reports
- [Sentry Integration](./SENTRY_ERROR_TRACKING.md) - Error tracking

### Quick Links

- **Production:** https://crm.dirtfreecarpet.com
- **Staging:** https://staging-crm.dirtfreecarpet.com
- **Supabase:** https://supabase.com/dashboard/project/your-project
- **Vercel:** https://vercel.com/your-org/dirt-free-crm

---

**Last Updated:** 2025-01-24

**Version:** 1.0.0
