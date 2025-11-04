# Production Deployment Guide

**Dirt Free CRM** | Complete deployment procedures for production launch

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Staging Environment Setup](#staging-environment-setup)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedures](#rollback-procedures)
6. [Post-Deployment Monitoring](#post-deployment-monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Support Contacts](#support-contacts)

---

## Pre-Deployment Checklist

### Code Quality ✓

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] No ESLint warnings for production code
- [ ] Code reviewed and approved by senior developer
- [ ] No `console.log` statements in production code
- [ ] No `debugger` statements
- [ ] No TODO/FIXME comments for critical features
- [ ] All commented-out code removed
- [ ] All development-only code removed or feature-flagged

**Verification Commands:**
```bash
npm run type-check
npm run lint
npm run test
npm run test:e2e
```

### Database ✓

- [ ] All migrations tested in staging
- [ ] All migrations run successfully in staging
- [ ] Migration rollback procedures tested
- [ ] Database indexes created and tested
- [ ] RLS policies applied and tested
- [ ] Database functions tested
- [ ] Database views tested
- [ ] Test/seed data removed from production database
- [ ] Database backup plan in place
- [ ] Database restore procedures tested
- [ ] Connection pooling configured
- [ ] Query performance acceptable (<100ms for most queries)

**Migration Files to Run (in order):**
```
1. 20251024000000_initial_schema.sql
2. 20251024010000_portal_enhancements.sql
3. 20251024020000_opportunities.sql
4. 20251024030000_promotions.sql
5. 20251024040000_reviews.sql
6. 20251024050000_loyalty.sql
7. 20251024060000_referrals.sql
8. 20251024070000_chatbot.sql
9. 20251024080000_analytics.sql
10. 20251024090000_monitoring.sql
11. 20251024100000_audit_logs.sql
12. 20251024110000_portal_activity.sql
13. 20251024120000_vehicle_board.sql
14. 20251024130000_cron_job_logs.sql
15. 20251024140000_scheduled_reports.sql
```

### Environment Variables ✓

**Required Production Environment Variables:**

- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Production Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Production Supabase anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Production service role key
- [ ] `STRIPE_SECRET_KEY` - Stripe live secret key
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe live publishable key
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- [ ] `TWILIO_ACCOUNT_SID` - Twilio production account SID
- [ ] `TWILIO_AUTH_TOKEN` - Twilio production auth token
- [ ] `TWILIO_PHONE_NUMBER` - Twilio production phone number
- [ ] `RESEND_API_KEY` - Resend production API key
- [ ] `RESEND_FROM_EMAIL` - Verified sender email
- [ ] `CRON_SECRET` - Unique secret for cron job authentication
- [ ] `NEXT_PUBLIC_APP_URL` - Production app URL
- [ ] `SENTRY_DSN` - Sentry production DSN
- [ ] `SENTRY_AUTH_TOKEN` - Sentry auth token
- [ ] `SENTRY_ORG` - Sentry organization slug
- [ ] `SENTRY_PROJECT` - Sentry project slug
- [ ] `NODE_ENV` - Set to "production"

**Security Checklist:**
- [ ] All API keys rotated for production (never use dev/staging keys)
- [ ] Secrets stored in Vercel environment variables (never in code)
- [ ] `CRON_SECRET` generated with strong random value (32+ characters)
- [ ] Webhook secrets configured and stored securely
- [ ] Service role key never exposed to client
- [ ] Environment variables encrypted at rest
- [ ] Access to environment variables restricted to admins only

**Generate CRON_SECRET:**
```bash
# Generate secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Security ✓

- [ ] Security headers configured in `next.config.ts`
- [ ] Rate limiting enabled on all API endpoints
- [ ] CSRF protection enabled
- [ ] Input validation on all API endpoints
- [ ] SQL injection protection (parameterized queries only)
- [ ] XSS protection (sanitize all user input)
- [ ] Authentication middleware on protected routes
- [ ] Authorization checks on all sensitive operations
- [ ] PII data encrypted at rest
- [ ] PII data encrypted in transit (HTTPS only)
- [ ] Audit logging enabled for sensitive operations
- [ ] Password hashing with bcrypt (min 10 rounds)
- [ ] Session management secure (httpOnly, secure, sameSite cookies)
- [ ] No sensitive data in client-side logs
- [ ] No sensitive data in error messages exposed to users

**Security Headers Verification:**
```typescript
// Verify in next.config.ts
headers: [
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), microphone=(), camera=()'
  }
]
```

### Integrations ✓

**Stripe:**
- [ ] Stripe account in live mode
- [ ] Live API keys configured
- [ ] Webhook endpoint configured: `https://your-domain.com/api/webhooks/stripe`
- [ ] Webhook signing secret stored in env vars
- [ ] Webhook events tested (payment.succeeded, payment.failed)
- [ ] Products and prices created in live mode
- [ ] Payment methods enabled (card, ACH, etc.)
- [ ] Tax calculation configured (if applicable)
- [ ] Dispute handling configured

**Twilio:**
- [ ] Twilio production account active
- [ ] Production phone number purchased and verified
- [ ] SMS service configured
- [ ] Voice service configured (if applicable)
- [ ] Webhook URLs configured
- [ ] Geographic permissions set correctly
- [ ] Messaging service created
- [ ] Opt-out keywords configured (STOP, UNSUBSCRIBE)
- [ ] Compliance requirements met (TCPA, CTIA)

**Resend:**
- [ ] Production API key generated
- [ ] Domain verified and DNS records configured
- [ ] SPF record added to DNS
- [ ] DKIM record added to DNS
- [ ] DMARC record added to DNS
- [ ] Sender email verified
- [ ] Email templates tested
- [ ] Bounce and complaint handling configured
- [ ] Suppression list reviewed

**Supabase:**
- [ ] Production Supabase project created
- [ ] Database migrated to production
- [ ] RLS policies enabled
- [ ] API keys generated
- [ ] Connection pooling configured
- [ ] Backups enabled (automatic daily)
- [ ] Database resources adequate (CPU, RAM, storage)
- [ ] Auth providers configured (if using social login)

**Sentry:**
- [ ] Production Sentry project created
- [ ] DSN configured in environment variables
- [ ] Source maps uploaded for better error tracking
- [ ] Release tracking configured
- [ ] Alert rules configured
- [ ] Integration with Slack/email for critical errors
- [ ] Performance monitoring enabled
- [ ] Session replay enabled (optional)

### Performance ✓

- [ ] Database queries optimized (<100ms for p95)
- [ ] Database indexes created for frequently queried columns
- [ ] N+1 query problems resolved
- [ ] Caching implemented (Redis/memory cache)
- [ ] API response times acceptable (<500ms for p95)
- [ ] Images optimized (Next.js Image component used)
- [ ] Lazy loading implemented for below-fold content
- [ ] Code splitting configured
- [ ] Bundle size acceptable (<300KB first load JS)
- [ ] Lighthouse performance score >90
- [ ] Core Web Vitals passing (LCP <2.5s, FID <100ms, CLS <0.1)
- [ ] CDN configured for static assets
- [ ] Compression enabled (gzip/brotli)

**Bundle Size Check:**
```bash
npm run build
# Check .next/analyze/client.html for bundle analysis
```

**Lighthouse Audit:**
```bash
# Run lighthouse on staging
npx lighthouse https://staging.your-domain.com --view
```

### Monitoring ✓

- [ ] Sentry error tracking active
- [ ] Sentry alerts configured for critical errors
- [ ] Uptime monitoring configured (UptimeRobot, Pingdom, or similar)
- [ ] Health check endpoint working: `/api/health`
- [ ] Detailed health check endpoint working: `/api/health/detailed`
- [ ] Alert rules configured for:
  - [ ] Error rate >1%
  - [ ] Response time >2s
  - [ ] Uptime <99.9%
  - [ ] Database connection failures
  - [ ] Integration failures (Stripe, Twilio, Resend)
- [ ] Analytics tracking active (Google Analytics, Mixpanel, etc.)
- [ ] Custom event tracking for key user actions
- [ ] Dashboard for real-time monitoring
- [ ] Log aggregation configured (Datadog, LogRocket, etc.)

### Cron Jobs ✓

- [ ] All cron jobs documented in `/src/lib/cron/registry.ts`
- [ ] Cron job schedules verified (18 total jobs)
- [ ] `CRON_SECRET` environment variable set
- [ ] Cron jobs configured in Vercel dashboard
- [ ] Cron job endpoints tested manually
- [ ] Cron job monitoring enabled
- [ ] Cron job failure alerts configured
- [ ] Timeout settings appropriate for each job
- [ ] Retry logic tested for failed jobs

**Cron Jobs to Configure in Vercel:**

```
# Opportunities (2 jobs)
process-opportunity-offers: 0 8 * * * (Daily 8am)
check-stale-opportunities: 0 9 * * * (Daily 9am)

# Promotions (3 jobs)
process-promotion-deliveries: */30 * * * * (Every 30 min)
schedule-birthday-promotions: 0 6 * * * (Daily 6am)
schedule-anniversary-promotions: 0 6 * * * (Daily 6am)

# Reviews (2 jobs)
send-review-requests: 0 */6 * * * (Every 6 hours)
sync-google-reviews: 0 2 * * * (Daily 2am)

# Loyalty (3 jobs)
process-loyalty-tier-upgrades: 0 3 * * * (Daily 3am)
award-birthday-points: 0 0 * * * (Daily midnight)
award-anniversary-points: 0 0 * * * (Daily midnight)

# Analytics (2 jobs)
calculate-daily-metrics: 0 1 * * * (Daily 1am)
generate-weekly-report: 0 4 * * 1 (Monday 4am)

# Monitoring (1 job)
check-system-health: */15 * * * * (Every 15 min)

# Cleanup (4 jobs)
cleanup-old-notifications: 0 2 * * 0 (Sunday 2am)
cleanup-old-logs: 0 3 * * 0 (Sunday 3am)
cleanup-expired-sessions: 0 4 * * * (Daily 4am)
archive-old-opportunities: 0 5 * * 0 (Sunday 5am)

# Reports (1 job)
generate-scheduled-reports: 0 6 * * * (Daily 6am)
```

### Documentation ✓

- [ ] README.md updated with production deployment info
- [ ] API documentation complete (`/docs/API_REFERENCE.md`)
- [ ] Database schema documented (`/docs/DATABASE_SCHEMA.md`)
- [ ] User manual finalized (`/docs/USER_MANUAL.md`)
- [ ] Developer guide complete (`/docs/DEVELOPER_GUIDE.md`)
- [ ] Component library documented (`/docs/COMPONENT_LIBRARY.md`)
- [ ] Deployment procedures documented (this file)
- [ ] Cron job orchestration documented (`/docs/CRON_JOB_ORCHESTRATION.md`)
- [ ] Scheduled reports documented (`/docs/SCHEDULED_REPORTS.md`)
- [ ] Troubleshooting guide available
- [ ] Runbook created for common operations
- [ ] Incident response plan documented

---

## Staging Environment Setup

### Purpose

Staging is a production-like environment for final testing before deploying to production. All deployment steps should be tested in staging first.

### Creating Staging Environment

**1. Create Staging Supabase Project**

```bash
# In Supabase dashboard:
# 1. Create new project: "dirt-free-crm-staging"
# 2. Note the URL and anon key
# 3. Run all migrations in order
```

**2. Set Up Staging Vercel Project**

```bash
# Link to Vercel (if not already linked)
vercel link

# Add staging environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL staging
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY staging
vercel env add SUPABASE_SERVICE_ROLE_KEY staging
# ... (add all other environment variables with staging values)
```

**3. Deploy to Staging**

```bash
# Create staging branch
git checkout -b staging
git push origin staging

# Deploy to staging
vercel --env=staging

# Or set up automatic deployments in Vercel dashboard
# Settings > Git > staging branch → auto-deploy
```

**4. Configure Staging Integrations**

- **Stripe**: Use test mode API keys
- **Twilio**: Use test phone number or separate staging number
- **Resend**: Use separate staging API key or test mode
- **Sentry**: Create separate staging project

**5. Seed Staging Database**

```bash
# Add realistic test data
# Run seed scripts from /supabase/seed.sql
```

### Staging Testing Checklist

Before deploying to production, verify all features in staging:

**Authentication & Authorization:**
- [ ] User registration works
- [ ] User login works
- [ ] Password reset works
- [ ] Session management works
- [ ] Role-based access control works
- [ ] Protected routes enforce authentication

**Core Features:**
- [ ] Create opportunity
- [ ] Configure auto-offer
- [ ] Opportunity pipeline management
- [ ] Opportunity conversion
- [ ] Create promotion campaign
- [ ] Schedule promotion
- [ ] Send promotion (test mode)
- [ ] Track promotion performance

**Reviews:**
- [ ] Manual review request
- [ ] Automated review request (test with completed job)
- [ ] Review response
- [ ] Review analytics

**Loyalty:**
- [ ] Customer enrollment
- [ ] Point earning (manual and automatic)
- [ ] Point redemption
- [ ] Tier upgrades
- [ ] Referral tracking
- [ ] Referral code generation

**Customer Portal:**
- [ ] Customer registration
- [ ] Customer login
- [ ] View service history
- [ ] Book service online
- [ ] View loyalty points
- [ ] Redeem rewards
- [ ] Access referral code
- [ ] Update profile

**Analytics:**
- [ ] View revenue analytics
- [ ] View customer analytics
- [ ] View opportunities performance
- [ ] View promotions effectiveness
- [ ] View review analytics
- [ ] View loyalty program metrics
- [ ] Create scheduled report
- [ ] Export data

**Integrations:**
- [ ] Stripe payment (test mode)
- [ ] Stripe webhook handling
- [ ] Twilio SMS sending (test number)
- [ ] Resend email sending
- [ ] Sentry error reporting

**Cron Jobs:**
- [ ] Manually trigger each cron job via `/api/cron/execute/[jobName]`
- [ ] Verify job execution logs
- [ ] Verify job results

**Performance:**
- [ ] Run Lighthouse audit (score >90)
- [ ] Check page load times (<3s)
- [ ] Check API response times (<500ms)
- [ ] Verify bundle size (<300KB)

---

## Deployment Steps

### Pre-Deployment (T-2 Days)

**1. Code Freeze**
- [ ] Merge all approved PRs
- [ ] No new features added
- [ ] Only critical bug fixes allowed
- [ ] Update version number in package.json
- [ ] Tag release in git

```bash
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Production release v1.0.0"
git push origin v1.0.0
```

**2. Final Staging Tests**
- [ ] Run complete staging checklist
- [ ] Perform load testing
- [ ] Perform security audit
- [ ] Verify all integrations
- [ ] Get stakeholder sign-off

**3. Database Preparation**
- [ ] Create production database backup strategy
- [ ] Test database restore procedure
- [ ] Prepare migration scripts
- [ ] Review database resource allocation

### Deployment Day (T-0)

#### Phase 1: Database Migration (30 minutes)

**1. Backup Existing Database (if applicable)**

```bash
# Connect to Supabase production
# Supabase automatically backs up, but create manual backup for safety
# Dashboard > Database > Backups > Create manual backup
```

**2. Run Migrations**

```bash
# In Supabase SQL Editor, run migrations in order
# File: supabase/migrations/20251024000000_initial_schema.sql
# Run each migration file sequentially
# Verify each completes successfully before proceeding
```

**3. Verify Migration Success**

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Check all RLS policies are enabled
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';

-- Check all functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public';
```

#### Phase 2: Environment Configuration (15 minutes)

**1. Add Production Environment Variables in Vercel**

```bash
# Option 1: Vercel CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Enter value when prompted

# Option 2: Vercel Dashboard
# Project Settings > Environment Variables
# Add each variable for "Production" environment
```

**Required Variables (use template from `/docs/env.production.template`):**
- All Supabase credentials
- All Stripe live keys
- All Twilio production credentials
- All Resend production credentials
- CRON_SECRET (generated secure random string)
- Sentry production DSN
- App URL (https://your-domain.com)

**2. Verify Environment Variables**

```bash
# In Vercel dashboard
# Settings > Environment Variables
# Ensure all required variables are set for "Production"
# Ensure no staging/test values are in production
```

#### Phase 3: Code Deployment (15 minutes)

**1. Deploy to Vercel Production**

```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Deploy to production
vercel --prod

# Or trigger deployment via Vercel dashboard
# Deployments > Deploy > main branch
```

**2. Monitor Deployment**

```bash
# Watch deployment progress in Vercel dashboard
# Check for build errors
# Verify deployment completes successfully
# Note deployment URL
```

**3. Verify Build Success**

- [ ] Build completed without errors
- [ ] No TypeScript errors
- [ ] No build warnings (or only expected warnings)
- [ ] Deployment status: "Ready"
- [ ] Functions deployed successfully

#### Phase 4: Cron Job Configuration (30 minutes)

**1. Configure Cron Jobs in Vercel**

```bash
# Vercel Dashboard > Project > Settings > Cron Jobs

# Add each job from registry:
# Job: process-opportunity-offers
# Path: /api/cron/execute/process-opportunity-offers
# Schedule: 0 8 * * * (cron expression)
# Headers: Authorization: Bearer YOUR_CRON_SECRET

# Repeat for all 18 jobs (see Cron Jobs section above)
```

**2. Test Cron Jobs Manually**

```bash
# Manually trigger each job to verify it works
curl -X POST https://your-domain.com/api/cron/execute/process-opportunity-offers \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Check response status (should be 200)
# Check job execution logs in database
```

#### Phase 5: Webhook Configuration (15 minutes)

**1. Configure Stripe Webhooks**

```bash
# Stripe Dashboard > Developers > Webhooks
# Add endpoint: https://your-domain.com/api/webhooks/stripe
# Select events:
# - payment_intent.succeeded
# - payment_intent.payment_failed
# - customer.created
# - customer.updated
# Copy webhook signing secret
# Add to Vercel env vars: STRIPE_WEBHOOK_SECRET
```

**2. Configure Twilio Webhooks (if applicable)**

```bash
# Twilio Console > Phone Numbers > Active Numbers
# Click your number
# Messaging > Webhook when message comes in
# URL: https://your-domain.com/api/webhooks/twilio
# Method: POST
```

**3. Test Webhooks**

```bash
# Stripe: Send test webhook from dashboard
# Twilio: Send test SMS to your Twilio number
# Verify webhook handler processes correctly
```

#### Phase 6: Smoke Tests (30 minutes)

**Critical Path Testing:**

- [ ] **Homepage loads**: Visit https://your-domain.com
- [ ] **Login works**: Test user authentication
- [ ] **Create opportunity**: Full workflow from creation to conversion
- [ ] **Create promotion**: Create and schedule test promotion
- [ ] **Send review request**: Manual review request
- [ ] **Award loyalty points**: Manual point adjustment
- [ ] **View analytics**: Check all analytics dashboards load
- [ ] **Customer portal**: Register and login as customer
- [ ] **API health check**: `curl https://your-domain.com/api/health`
- [ ] **Payment test**: Process small test payment (Stripe test mode first, then real $1 charge and refund)

**Integration Testing:**

- [ ] Send test SMS via Twilio
- [ ] Send test email via Resend
- [ ] Process test Stripe payment
- [ ] Verify Sentry receives test error
- [ ] Trigger test cron job
- [ ] Verify database connection

**Detailed Health Check:**

```bash
curl https://your-domain.com/api/health/detailed
# Verify all services return "operational"
```

---

## Post-Deployment Verification

### Immediate Verification (First Hour)

**System Health:**
- [ ] Application accessible at production URL
- [ ] No 500 errors in Sentry
- [ ] Health check endpoint returning "ok"
- [ ] Database connections stable
- [ ] All integrations responding

**Monitoring Dashboards:**
- [ ] Vercel dashboard shows deployment as "Ready"
- [ ] Sentry shows no critical errors
- [ ] Uptime monitor shows 100% uptime
- [ ] No alerts triggered

**User Access:**
- [ ] Admin can login
- [ ] Manager can login
- [ ] Staff can login
- [ ] Customer portal accessible

**Quick Feature Test:**
- [ ] Create test opportunity (then delete)
- [ ] View analytics dashboards
- [ ] Check cron job logs
- [ ] Verify email/SMS delivery

### First Day Verification

**Error Monitoring:**
- [ ] Review Sentry for any new errors
- [ ] Check error rate (<0.1% acceptable)
- [ ] Investigate any recurring errors
- [ ] Check for memory leaks or performance degradation

**Performance Monitoring:**
- [ ] Average response time <500ms
- [ ] p95 response time <1s
- [ ] No timeouts reported
- [ ] Database query performance acceptable

**Cron Jobs:**
- [ ] Verify scheduled cron jobs executed
- [ ] Check cron job logs for failures
- [ ] Verify cron job results (opportunities processed, promotions sent, etc.)
- [ ] Monitor cron job execution times

**Integration Health:**
- [ ] Stripe: Process real payment successfully
- [ ] Twilio: Send real SMS successfully
- [ ] Resend: Send real email successfully
- [ ] Verify webhook deliveries

**Customer Portal:**
- [ ] Test customer registration
- [ ] Test customer login
- [ ] Test booking flow
- [ ] Test loyalty point display
- [ ] Test referral code generation

### First Week Verification

**Analytics Review:**
- [ ] Review all analytics dashboards
- [ ] Check opportunity conversion rates
- [ ] Verify promotion delivery metrics
- [ ] Monitor review collection
- [ ] Track loyalty program enrollment

**User Feedback:**
- [ ] Collect feedback from early users
- [ ] Monitor support tickets
- [ ] Track feature usage
- [ ] Identify any UX issues

**Performance Analysis:**
- [ ] Review Lighthouse scores
- [ ] Check Core Web Vitals
- [ ] Analyze slow queries
- [ ] Optimize if needed

**System Stability:**
- [ ] Uptime percentage (target: 99.9%+)
- [ ] Error rate trend (should be decreasing)
- [ ] Resource utilization (CPU, memory, database)
- [ ] No memory leaks detected

---

## Rollback Procedures

### When to Rollback

Rollback immediately if:
- Critical bug affecting core functionality
- Data corruption detected
- Security vulnerability discovered
- System-wide outage (>5 minutes)
- Error rate >5%
- Payment processing failures
- Database connection failures

### Rollback Procedure

#### Option 1: Vercel Rollback (Fastest - 2 minutes)

**For application code issues (not database):**

```bash
# Method 1: Vercel Dashboard
# 1. Go to Vercel Dashboard > Deployments
# 2. Find last known good deployment
# 3. Click "..." menu > "Promote to Production"
# 4. Confirm promotion

# Method 2: Vercel CLI
vercel rollback
# Follow prompts to select deployment to rollback to
```

**Verification:**
```bash
# Check deployment is active
curl https://your-domain.com/api/health

# Verify version
curl https://your-domain.com/api/version
```

#### Option 2: Git Revert + Redeploy (5-10 minutes)

**For more controlled rollback:**

```bash
# 1. Find commit to revert to
git log --oneline

# 2. Create revert commit
git revert <bad-commit-hash>

# 3. Push to main
git push origin main

# 4. Deploy to production
vercel --prod
```

#### Option 3: Database Rollback (15-30 minutes)

**For database migration issues:**

```bash
# 1. Create backup of current state (if time permits)
# Supabase Dashboard > Database > Backups > Create manual backup

# 2. Restore from backup
# Supabase Dashboard > Database > Backups
# Select backup from before migration
# Click "Restore"

# 3. Confirm restoration
# Verify database state in SQL Editor

# 4. Rollback application if needed (Option 1 or 2 above)
```

**Database Rollback Script (if migrations have down scripts):**

```sql
-- Run down migration scripts in reverse order
-- Example: Rolling back migration 20251024140000_scheduled_reports.sql
DROP TABLE IF EXISTS report_generation_log CASCADE;
DROP TABLE IF EXISTS scheduled_reports CASCADE;
-- etc.
```

### Post-Rollback Actions

**Immediate (Within 5 minutes):**
- [ ] Verify rollback successful
- [ ] Confirm system operational
- [ ] Check error rates returned to normal
- [ ] Notify team of rollback
- [ ] Create incident report

**Within 1 Hour:**
- [ ] Root cause analysis of issue
- [ ] Document what went wrong
- [ ] Create fix in development environment
- [ ] Test fix thoroughly in staging
- [ ] Plan next deployment with fix

**Within 24 Hours:**
- [ ] Complete incident post-mortem
- [ ] Update deployment procedures if needed
- [ ] Communicate to stakeholders
- [ ] Schedule next deployment attempt

---

## Post-Deployment Monitoring

### First 24 Hours - Intensive Monitoring

**Every 30 Minutes:**
- [ ] Check Sentry for new errors
- [ ] Review Vercel metrics (response times, errors)
- [ ] Check uptime monitor
- [ ] Verify cron jobs executing
- [ ] Monitor database performance

**Key Metrics to Watch:**

| Metric | Threshold | Action if Exceeded |
|--------|-----------|-------------------|
| Error Rate | <0.5% | Investigate errors, consider rollback if >5% |
| Response Time (p95) | <1s | Investigate slow endpoints |
| Uptime | >99.9% | Investigate downtime immediately |
| Database CPU | <70% | Optimize queries, consider scaling |
| Database Memory | <80% | Investigate memory usage |
| Failed Cron Jobs | 0 | Investigate and re-run manually |

**Dashboard Monitoring:**
- [ ] Sentry: Real-time error stream
- [ ] Vercel: Deployment metrics and logs
- [ ] Supabase: Database metrics
- [ ] Uptime Monitor: Availability tracking

### First Week - Daily Monitoring

**Daily Tasks:**
- [ ] Review Sentry error summary
- [ ] Check analytics dashboards
- [ ] Verify cron job execution (all jobs)
- [ ] Monitor integration health (Stripe, Twilio, Resend)
- [ ] Review customer portal activity
- [ ] Check for performance degradation
- [ ] Review support tickets

**Key Metrics:**

| Metric | Target | Notes |
|--------|--------|-------|
| Opportunities Created | 10-50/day | Depends on business volume |
| Opportunity Conversion Rate | 25-35% | Industry benchmark |
| Promotions Sent | 100-1000/day | Depends on campaigns |
| Promotion Conversion Rate | 8-15% | Industry benchmark |
| Review Requests Sent | 50-200/day | Depends on job completions |
| Review Response Rate | 15-25% | Industry benchmark |
| Loyalty Enrollments | 5-20/day | Growing metric |
| Customer Portal Logins | 20-100/day | Growing metric |

**Weekly Review:**
- [ ] Performance trends (improving/degrading)
- [ ] Feature adoption rates
- [ ] User feedback summary
- [ ] Bug report summary
- [ ] Infrastructure costs review
- [ ] Security audit

### First Month - Optimization Phase

**Week 1:**
- [ ] Analyze feature adoption
- [ ] Identify underutilized features
- [ ] Review user feedback
- [ ] Optimize slow queries
- [ ] Adjust cron schedules if needed

**Week 2:**
- [ ] Performance optimization pass
- [ ] Security audit
- [ ] Review and tune rate limiting
- [ ] Optimize database indexes
- [ ] Bundle size optimization

**Week 3:**
- [ ] User training completion review
- [ ] Feature usage analysis
- [ ] UX improvement opportunities
- [ ] Integration reliability review
- [ ] Cost optimization review

**Week 4:**
- [ ] Full system health review
- [ ] Month 1 metrics report
- [ ] Stakeholder presentation
- [ ] Roadmap planning for improvements
- [ ] Documentation updates

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Application Not Loading

**Symptoms**: White screen, 500 error, or infinite loading

**Diagnosis:**
```bash
# Check deployment status
vercel ls

# Check logs
vercel logs <deployment-url>

# Check health endpoint
curl https://your-domain.com/api/health
```

**Solutions:**
1. Verify deployment completed successfully in Vercel
2. Check for build errors in Vercel logs
3. Verify environment variables are set correctly
4. Check for JavaScript errors in browser console
5. Rollback to last known good deployment if needed

#### Issue: Database Connection Failures

**Symptoms**: "Could not connect to database" errors

**Diagnosis:**
```bash
# Check Supabase status
# Supabase Dashboard > Project Health

# Test connection
curl https://your-domain.com/api/health/detailed
```

**Solutions:**
1. Verify Supabase project is not paused (auto-pauses on free tier)
2. Check database connection string is correct
3. Verify service role key is correct
4. Check database resource limits (connections, CPU, memory)
5. Restart database if needed (Supabase dashboard)
6. Check RLS policies aren't blocking necessary queries

#### Issue: Cron Jobs Not Executing

**Symptoms**: Jobs not running at scheduled times

**Diagnosis:**
```bash
# Check cron job configuration in Vercel
# Settings > Cron Jobs

# Check recent executions
# Vercel > Logs > Filter by cron function

# Manually trigger job
curl -X POST https://your-domain.com/api/cron/execute/[jobName] \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Solutions:**
1. Verify cron jobs are configured in Vercel dashboard
2. Verify cron schedule syntax is correct
3. Check CRON_SECRET environment variable is set
4. Verify authorization header in cron job configuration
5. Check job logs for errors
6. Manually trigger job to test functionality

#### Issue: Stripe Payments Failing

**Symptoms**: Payment errors, webhook not received

**Diagnosis:**
```bash
# Check Stripe dashboard for payment attempts
# Check webhook delivery logs in Stripe

# Test webhook endpoint
curl -X POST https://your-domain.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Solutions:**
1. Verify using live API keys (not test keys)
2. Check webhook endpoint is configured correctly in Stripe
3. Verify webhook signing secret is correct
4. Check webhook handler logs for errors
5. Test payment with Stripe test card first
6. Verify SSL certificate is valid

#### Issue: SMS/Email Not Sending

**Symptoms**: Messages not delivered, integration errors

**Diagnosis:**
```bash
# Check Twilio logs
# Twilio Console > Monitor > Logs > Messaging

# Check Resend logs
# Resend Dashboard > Logs

# Test sending
curl -X POST https://your-domain.com/api/test/send-sms
curl -X POST https://your-domain.com/api/test/send-email
```

**Solutions:**
1. Verify Twilio/Resend API keys are correct (production keys)
2. Check account balance/credits (Twilio)
3. Verify sender phone number (Twilio) or email (Resend) is verified
4. Check for rate limiting or blocked messages
5. Verify message content doesn't contain spam triggers
6. Check recipient opt-out status

#### Issue: Customer Portal Not Loading

**Symptoms**: Portal errors, login failures

**Diagnosis:**
```bash
# Check portal route
curl https://your-domain.com/portal

# Check auth configuration
# Verify Supabase auth settings

# Check browser console for errors
```

**Solutions:**
1. Verify portal routes are correctly configured
2. Check authentication middleware is working
3. Verify Supabase auth is enabled
4. Check for CORS issues
5. Clear browser cache and cookies
6. Verify customer account exists and is active

#### Issue: High Error Rate in Sentry

**Symptoms**: Many errors reported in short time

**Diagnosis:**
```bash
# Check Sentry dashboard for error patterns
# Group by error type, URL, user action

# Check recent deployments
# Correlate with deployment timing
```

**Solutions:**
1. Identify common error pattern
2. Check if errors started after recent deployment
3. Review recent code changes for bugs
4. Verify environment variables are correct
5. Check for integration failures
6. Rollback if error rate >5% and critical

#### Issue: Slow Performance

**Symptoms**: Pages loading slowly, timeouts

**Diagnosis:**
```bash
# Run Lighthouse audit
npx lighthouse https://your-domain.com --view

# Check Vercel metrics
# Analytics > Performance

# Check slow database queries
# Supabase > Database > Query Performance
```

**Solutions:**
1. Identify slow pages/endpoints
2. Optimize database queries (add indexes, reduce N+1)
3. Implement caching for frequently accessed data
4. Optimize images and assets
5. Review bundle size and implement code splitting
6. Scale database resources if needed
7. Implement CDN for static assets

---

## Support Contacts

### Technical Issues

**Primary Contact:**
- **Name**: Development Team
- **Email**: dev@dirtfree.com
- **Slack**: #dev-support
- **Response Time**: <2 hours during business hours

**Escalation Contact:**
- **Name**: Senior Developer / CTO
- **Email**: cto@dirtfree.com
- **Phone**: (555) 123-4567
- **Response Time**: <30 minutes for critical issues

### Database Issues

**Primary Contact:**
- **Name**: Database Admin
- **Email**: dba@dirtfree.com
- **Supabase Support**: support@supabase.io
- **Response Time**: <1 hour for critical issues

### Integration Issues

**Stripe:**
- **Support**: https://support.stripe.com
- **Email**: support@stripe.com
- **Phone**: 1-888-926-2289

**Twilio:**
- **Support**: https://support.twilio.com
- **Email**: help@twilio.com
- **Phone**: 1-866-987-3806

**Resend:**
- **Support**: https://resend.com/support
- **Email**: support@resend.com

**Supabase:**
- **Support**: https://supabase.com/support
- **Email**: support@supabase.io
- **Community**: https://github.com/supabase/supabase/discussions

### Infrastructure & Hosting

**Vercel:**
- **Support**: https://vercel.com/support
- **Email**: support@vercel.com
- **Status**: https://vercel-status.com

### Monitoring & Error Tracking

**Sentry:**
- **Support**: https://sentry.io/support
- **Email**: support@sentry.io
- **Documentation**: https://docs.sentry.io

### Emergency Contacts

**For Critical Production Issues (P0 - System Down):**

**Immediate Action:**
1. Post in #production-alerts Slack channel
2. Call emergency hotline: (555) 999-0000
3. Email: emergency@dirtfree.com

**On-Call Rotation:**
- **Primary**: Check on-call calendar
- **Secondary**: Check on-call calendar
- **Escalation**: CTO (555) 123-4567

**SLA Response Times:**
- **P0 (Critical - System Down)**: 15 minutes
- **P1 (High - Major Feature Down)**: 1 hour
- **P2 (Medium - Minor Feature Issues)**: 4 hours
- **P3 (Low - Cosmetic Issues)**: 24 hours

---

## Appendix

### A. Environment Variables Template

See `/docs/env.production.template` for complete template

### B. Database Migration Checklist

See complete migration list in "Database" section above

### C. Cron Job Configuration Reference

See complete cron job list in "Cron Jobs" section above

### D. Health Check Endpoints

**Simple Health Check:**
```
GET /api/health
Response: { "status": "ok" }
```

**Detailed Health Check:**
```
GET /api/health/detailed
Response: {
  "status": "operational",
  "database": "operational",
  "stripe": "operational",
  "twilio": "operational",
  "resend": "operational",
  "sentry": "operational"
}
```

### E. Useful Commands

**Check TypeScript:**
```bash
npm run type-check
```

**Run Linter:**
```bash
npm run lint
```

**Run Tests:**
```bash
npm run test
npm run test:e2e
```

**Build for Production:**
```bash
npm run build
```

**Deploy to Vercel:**
```bash
vercel --prod
```

**View Logs:**
```bash
vercel logs <deployment-url>
```

**Rollback Deployment:**
```bash
vercel rollback
```

---

## Document Version

**Version**: 1.0.0
**Last Updated**: January 2025
**Next Review**: February 2025

---

**Questions or Issues?**
Contact: dev@dirtfree.com | Emergency: (555) 999-0000
