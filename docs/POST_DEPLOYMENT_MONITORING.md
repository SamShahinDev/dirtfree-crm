# Post-Deployment Monitoring Guide

**Dirt Free CRM** | Comprehensive monitoring procedures after production deployment

---

## Table of Contents

1. [Monitoring Timeline](#monitoring-timeline)
2. [First Hour - Critical Monitoring](#first-hour---critical-monitoring)
3. [First 24 Hours - Intensive Monitoring](#first-24-hours---intensive-monitoring)
4. [First Week - Daily Monitoring](#first-week---daily-monitoring)
5. [First Month - Weekly Monitoring](#first-month---weekly-monitoring)
6. [Monitoring Dashboards](#monitoring-dashboards)
7. [Alert Thresholds](#alert-thresholds)
8. [Issue Response](#issue-response)

---

## Monitoring Timeline

| Phase | Duration | Frequency | Focus |
|-------|----------|-----------|-------|
| **Critical** | First Hour | Every 5-10 min | System stability, errors, health |
| **Intensive** | First 24 Hours | Every 30-60 min | Performance, integrations, jobs |
| **Daily** | First Week | 2-3x per day | Feature adoption, user feedback |
| **Weekly** | First Month | Weekly review | Trends, optimization opportunities |
| **Ongoing** | After Month 1 | Daily + weekly | Normal operations |

---

## First Hour - Critical Monitoring

### Every 5-10 Minutes

#### 1. System Health Check ✓

**Dashboard**: Vercel + Sentry

**Checklist**:
- [ ] Application accessible at production URL
- [ ] Health endpoint returning `200 OK`
- [ ] No 500 errors in Sentry
- [ ] Response times < 1s (p95)
- [ ] No deployment errors in Vercel logs

**Commands**:
```bash
# Health check
curl https://your-domain.com/api/health
# Expected: {"status":"ok"}

# Detailed health check
curl https://your-domain.com/api/health/detailed
# Expected: All services "operational"

# Check response time
curl -w "@curl-format.txt" -o /dev/null -s https://your-domain.com
```

**curl-format.txt**:
```
time_total:  %{time_total}\n
```

#### 2. Error Monitoring ✓

**Dashboard**: Sentry

**Checklist**:
- [ ] Error rate < 0.5%
- [ ] No new critical/fatal errors
- [ ] No recurring error patterns
- [ ] No security-related errors

**Metrics to Track**:

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error Rate | <0.5% | Normal |
| Error Rate | 0.5-1% | Investigate |
| Error Rate | 1-5% | Urgent investigation |
| Error Rate | >5% | **ROLLBACK** |

**Sentry Dashboard**:
```
1. Go to Sentry > Issues
2. Filter: "is:unresolved"
3. Sort by: "Last seen"
4. Check for new issues since deployment
5. Review error frequency and impact
```

#### 3. Database Health ✓

**Dashboard**: Supabase

**Checklist**:
- [ ] Database connections stable
- [ ] CPU usage < 70%
- [ ] Memory usage < 80%
- [ ] No connection errors
- [ ] Query performance acceptable

**Supabase Metrics**:
```
1. Supabase Dashboard > Project Health
2. Check CPU, Memory, Disk usage
3. Database > Query Performance
4. Check for slow queries (>100ms)
```

**Critical Queries to Test**:
```sql
-- Test customer lookup (should be <50ms)
SELECT * FROM customers WHERE id = 'test-id';

-- Test opportunities query (should be <100ms)
SELECT * FROM missed_opportunities
WHERE status = 'pending'
LIMIT 20;

-- Test analytics query (should be <200ms)
SELECT COUNT(*), status
FROM missed_opportunities
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY status;
```

#### 4. Integration Health ✓

**Test Each Integration**:

**Stripe**:
```bash
# Create test payment intent
curl https://your-domain.com/api/test/stripe-payment

# Check Stripe dashboard for test payment
# Verify webhook received
```

**Twilio**:
```bash
# Send test SMS
curl -X POST https://your-domain.com/api/test/send-sms \
  -H "Content-Type: application/json" \
  -d '{"to":"+1234567890","message":"Test deployment message"}'

# Check Twilio logs for delivery
```

**Resend**:
```bash
# Send test email
curl -X POST https://your-domain.com/api/test/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test Deployment"}'

# Check Resend logs for delivery
```

**Checklist**:
- [ ] Stripe: Test payment processed
- [ ] Twilio: Test SMS delivered
- [ ] Resend: Test email delivered
- [ ] Webhooks receiving events
- [ ] No integration errors in logs

---

### First Hour Summary Report

**After 1 hour, complete this report:**

```markdown
# 1-Hour Post-Deployment Report

**Deployment Time**: [HH:MM]
**Report Time**: [HH:MM] (1 hour later)

## System Health ✓ / ✗
- Application Status: [UP/DOWN]
- Health Check: [PASS/FAIL]
- Error Rate: [X.XX%]
- Response Time p95: [XXX ms]

## Errors
- New Issues: [count]
- Critical Issues: [count]
- Most Common: [error description]

## Integrations ✓ / ✗
- Stripe: [OPERATIONAL/ISSUES]
- Twilio: [OPERATIONAL/ISSUES]
- Resend: [OPERATIONAL/ISSUES]
- Database: [OPERATIONAL/ISSUES]

## Database
- CPU: [XX%]
- Memory: [XX%]
- Connections: [XX/100]
- Slow Queries: [count]

## Actions Taken
- [Action 1]
- [Action 2]

## Issues Detected
- [Issue 1] - [Status: Resolved/Monitoring/Open]
- [Issue 2] - [Status]

## Overall Status
[GREEN/YELLOW/RED]

**Recommendation**: [Continue monitoring / Investigate issues / Rollback]

**Next Check**: [HH:MM]
```

---

## First 24 Hours - Intensive Monitoring

### Every 30-60 Minutes

#### 1. Performance Metrics ✓

**Vercel Analytics Dashboard**

**Metrics to Track**:

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Response Time (p50) | <300ms | 300-500ms | >500ms |
| Response Time (p95) | <1s | 1-2s | >2s |
| Response Time (p99) | <2s | 2-5s | >5s |
| Error Rate | <0.5% | 0.5-1% | >1% |
| Requests/min | Baseline | 2x baseline | 10x baseline |

**Checklist**:
- [ ] Response times within targets
- [ ] No timeouts (30s+)
- [ ] No memory issues
- [ ] No CPU throttling
- [ ] Bundle size unchanged (<300KB)

#### 2. Cron Job Monitoring ✓

**First Execution Verification**

**Checklist**:
- [ ] All 18 cron jobs executed on schedule
- [ ] No cron job failures
- [ ] Execution times acceptable
- [ ] Results as expected (data processed correctly)

**Check Cron Execution Logs**:
```sql
-- Query cron job logs
SELECT
  job_name,
  started_at,
  completed_at,
  status,
  error_message,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
FROM cron_job_logs
WHERE started_at > NOW() - INTERVAL '24 hours'
ORDER BY started_at DESC;

-- Check for failures
SELECT job_name, COUNT(*) as failures
FROM cron_job_logs
WHERE status = 'failed'
AND started_at > NOW() - INTERVAL '24 hours'
GROUP BY job_name;
```

**Cron Job Checklist** (verify each ran successfully):

| Job | Schedule | Expected First Run | Status |
|-----|----------|-------------------|--------|
| process-opportunity-offers | 0 8 * * * | Next 8am | [ ] |
| process-promotion-deliveries | */30 * * * * | Next 30 min | [ ] |
| send-review-requests | 0 */6 * * * | Next 6-hour mark | [ ] |
| check-system-health | */15 * * * * | Within 15 min | [ ] |
| generate-scheduled-reports | 0 6 * * * | Next 6am | [ ] |
| ... (all 18 jobs) | ... | ... | [ ] |

#### 3. User Activity Monitoring ✓

**Analytics Dashboard**

**Metrics to Track**:

| Metric | Baseline | Notes |
|--------|----------|-------|
| Active Users | [Your baseline] | Track hourly |
| Page Views | [Your baseline] | Track trends |
| Session Duration | [Your baseline] | Should be stable |
| Bounce Rate | [Your baseline] | Watch for increase |
| Portal Logins | [Your baseline] | Customer portal usage |

**Checklist**:
- [ ] Users can login successfully
- [ ] Core workflows working (create opportunity, etc.)
- [ ] No unusual drop in activity
- [ ] No complaints from users
- [ ] Support tickets normal volume

#### 4. Feature Usage Tracking ✓

**Track New/Changed Features**

**Checklist**:
- [ ] Opportunities created successfully
- [ ] Promotions sent successfully
- [ ] Review requests sent successfully
- [ ] Loyalty points awarded correctly
- [ ] Customer portal accessible
- [ ] Analytics dashboards loading

**Feature Health Check**:
```bash
# Test each critical feature manually
# Document results

# 1. Create Opportunity
# - Navigate to Opportunities
# - Click "+ New Opportunity"
# - Fill form and save
# - Verify appears in pipeline
# Result: [PASS/FAIL]

# 2. Send Promotion
# - Navigate to Promotions
# - Create test campaign
# - Send to test recipient
# - Verify delivery
# Result: [PASS/FAIL]

# 3. Award Loyalty Points
# - Navigate to Loyalty > Members
# - Select customer
# - Award test points
# - Verify balance updated
# Result: [PASS/FAIL]
```

---

### 24-Hour Summary Report

**After 24 hours, complete comprehensive report:**

```markdown
# 24-Hour Post-Deployment Report

**Deployment Time**: [Date HH:MM]
**Report Time**: [Date HH:MM]

## Executive Summary
[1-2 paragraphs: Overall status, major issues, actions taken]

## System Health

### Uptime
- Total Uptime: [99.XX%]
- Downtime Events: [count]
- Total Downtime: [X minutes]

### Performance
- Avg Response Time: [XXX ms]
- P95 Response Time: [XXX ms]
- P99 Response Time: [XXX ms]
- Error Rate: [X.XX%]

### Traffic
- Total Requests: [XXXXX]
- Unique Users: [XXXX]
- Peak Requests/min: [XXX]

## Errors & Issues

### Sentry Summary
- Total Errors: [count]
- Unique Issues: [count]
- Critical Issues: [count]
- Top 3 Errors:
  1. [Error type] - [count] occurrences
  2. [Error type] - [count] occurrences
  3. [Error type] - [count] occurrences

### Resolved Issues
1. [Issue] - [How resolved]
2. [Issue] - [How resolved]

### Open Issues
1. [Issue] - [Priority] - [Assigned to] - [ETA]

## Integrations

| Integration | Status | Notes |
|-------------|--------|-------|
| Stripe | ✓ / ✗ | [Any issues or all good] |
| Twilio | ✓ / ✗ | [Any issues or all good] |
| Resend | ✓ / ✗ | [Any issues or all good] |
| Supabase | ✓ / ✗ | [Any issues or all good] |
| Sentry | ✓ / ✗ | [Any issues or all good] |

## Cron Jobs

- Total Executions: [count]
- Successful: [count]
- Failed: [count]
- Avg Execution Time: [XX seconds]
- Failed Jobs: [list if any]

## Feature Usage

| Feature | Usage Count | Notes |
|---------|-------------|-------|
| Opportunities Created | [count] | [Any issues?] |
| Promotions Sent | [count] | [Any issues?] |
| Review Requests Sent | [count] | [Any issues?] |
| Loyalty Points Awarded | [count] | [Any issues?] |
| Portal Logins | [count] | [Any issues?] |

## Database

- Avg CPU: [XX%]
- Peak CPU: [XX%]
- Avg Memory: [XX%]
- Total Queries: [XXXXX]
- Slow Queries: [count]
- Connection Errors: [count]

## User Feedback

- Support Tickets: [count]
- Bug Reports: [count]
- Feature Requests: [count]
- Positive Feedback: [count]

## Recommendations

1. [Recommendation 1]
2. [Recommendation 2]
3. [Recommendation 3]

## Action Items

| Action | Priority | Owner | Due Date |
|--------|----------|-------|----------|
| [Action] | [P0/P1/P2] | [Name] | [Date] |

## Overall Status

**Status**: 🟢 GREEN / 🟡 YELLOW / 🔴 RED

**Confidence Level**: [High/Medium/Low] that deployment is stable

**Recommendation**: [Continue normal monitoring / Enhanced monitoring needed / Issues require attention]

---

**Prepared By**: [Name]
**Date**: [Date]
```

---

## First Week - Daily Monitoring

### Daily Review (Every Morning)

#### 1. Overnight Health Check

**Review Period**: Last 24 hours

```bash
# Quick health check
curl https://your-domain.com/api/health/detailed

# Check for overnight errors
# Sentry > Issues > Filter: Last 24 hours
```

**Checklist**:
- [ ] No overnight outages
- [ ] No spike in errors
- [ ] Cron jobs executed successfully
- [ ] Database health good
- [ ] Integration health good

#### 2. Daily Metrics Review

**Vercel Analytics**:

| Metric | Yesterday | 7-Day Avg | Trend |
|--------|-----------|-----------|-------|
| Requests | [count] | [count] | ↑/↓/→ |
| Error Rate | [%] | [%] | ↑/↓/→ |
| Avg Response Time | [ms] | [ms] | ↑/↓/→ |
| P95 Response Time | [ms] | [ms] | ↑/↓/→ |

**Checklist**:
- [ ] Metrics stable or improving
- [ ] No concerning trends (rising errors, response times)
- [ ] Traffic patterns normal
- [ ] No unusual spikes or drops

#### 3. Feature Adoption Tracking

**Daily Feature Usage**:

| Feature | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Day 6 | Day 7 |
|---------|-------|-------|-------|-------|-------|-------|-------|
| Opportunities | | | | | | | |
| Promotions | | | | | | | |
| Reviews | | | | | | | |
| Loyalty | | | | | | | |
| Portal Logins | | | | | | | |

**Checklist**:
- [ ] Features being used
- [ ] Usage growing or stable
- [ ] No abandoned features
- [ ] User feedback positive or neutral

#### 4. Support Ticket Review

**Checklist**:
- [ ] Review all new support tickets
- [ ] Identify deployment-related issues
- [ ] Track recurring problems
- [ ] Respond to critical tickets

**Categories**:
- Bug Reports: [count]
- Feature Questions: [count]
- Access Issues: [count]
- Performance Issues: [count]

---

### End of Week Summary

**After 7 days, complete this report:**

```markdown
# Week 1 Post-Deployment Summary

**Deployment Date**: [Date]
**Report Date**: [Date] (1 week later)

## Highlights

- ✓ [Major success 1]
- ✓ [Major success 2]
- ⚠️ [Issue encountered and resolved]

## System Stability

### Uptime
- Week 1 Uptime: [99.XX%]
- Total Downtime: [X minutes across Y incidents]
- Target: 99.9%
- Status: [PASS/FAIL]

### Performance
| Metric | Week 1 Avg | Target | Status |
|--------|------------|--------|--------|
| Response Time p50 | [XXms] | <300ms | ✓/✗ |
| Response Time p95 | [XXms] | <1s | ✓/✗ |
| Error Rate | [X.XX%] | <0.5% | ✓/✗ |

## Feature Adoption

| Feature | Total Usage | Daily Avg | Trend |
|---------|-------------|-----------|-------|
| Opportunities Created | [count] | [count] | ↑/↓/→ |
| Opportunity Conversions | [count] | [count] | ↑/↓/→ |
| Promotions Sent | [count] | [count] | ↑/↓/→ |
| Promotion Conversions | [count] | [count] | ↑/↓/→ |
| Review Requests | [count] | [count] | ↑/↓/→ |
| Reviews Received | [count] | [count] | ↑/↓/→ |
| Loyalty Points Awarded | [count] | [count] | ↑/↓/→ |
| Portal Registrations | [count] | [count] | ↑/↓/→ |

## Issues Encountered

### Critical (P0)
[None / List with resolutions]

### High (P1)
[None / List with resolutions]

### Medium (P2)
[None / List with status]

## Cron Jobs

- Total Scheduled Executions: [count]
- Successful: [count] ([XX%])
- Failed: [count] ([XX%])
- Issues: [List if any]

## User Feedback

### Quantitative
- Support Tickets: [count]
- Bug Reports: [count]
- Feature Requests: [count]

### Qualitative
- Common Positive Feedback: [summary]
- Common Issues Reported: [summary]
- Feature Requests: [summary]

## Database Health

- Avg CPU: [XX%]
- Peak CPU: [XX%] (occurred [when])
- Avg Memory: [XX%]
- Storage Used: [XX GB / YY GB]
- Slow Query Count: [count]
- Action Items: [Any optimizations needed?]

## Optimizations Completed

1. [Optimization 1]
2. [Optimization 2]

## Lessons Learned

1. [Lesson 1]
2. [Lesson 2]
3. [Lesson 3]

## Action Items for Week 2

| Action | Priority | Owner | Due Date |
|--------|----------|-------|----------|
| [Action] | [P0/P1/P2] | [Name] | [Date] |

## Overall Assessment

**Deployment Success**: ✓ SUCCESSFUL / ⚠️ PARTIAL / ✗ FAILED

**Stability**: 🟢 STABLE / 🟡 NEEDS ATTENTION / 🔴 UNSTABLE

**Next Steps**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

---

**Prepared By**: [Name]
**Date**: [Date]
```

---

## First Month - Weekly Monitoring

### Weekly Review Meeting (Every Monday)

#### Agenda

1. **Review Previous Week** (15 min)
   - System health metrics
   - Issues encountered and resolved
   - Feature usage trends

2. **Performance Analysis** (15 min)
   - Response time trends
   - Error rate trends
   - Database performance
   - Cost analysis

3. **User Feedback** (15 min)
   - Support ticket trends
   - Feature requests
   - Bug reports
   - User satisfaction

4. **Optimization Opportunities** (15 min)
   - Slow queries to optimize
   - Underutilized features to promote
   - High-cost operations to reduce

5. **Action Items** (10 min)
   - Review last week's action items
   - Assign new action items
   - Set priorities for next week

#### Week 2, 3, 4 Focus Areas

**Week 2: Performance Optimization**
- [ ] Optimize slow database queries
- [ ] Review and optimize API endpoints
- [ ] Check bundle size and optimize if needed
- [ ] Implement additional caching if beneficial

**Week 3: Feature Refinement**
- [ ] Analyze feature adoption
- [ ] Gather user feedback on new features
- [ ] Identify UX improvements
- [ ] Plan feature enhancements

**Week 4: Stability & Planning**
- [ ] Month 1 comprehensive review
- [ ] Capacity planning for growth
- [ ] Roadmap planning
- [ ] Documentation updates

---

## Monitoring Dashboards

### Primary Dashboards

**1. Vercel Dashboard**
- URL: `https://vercel.com/[team]/dirt-free-crm`
- **Metrics**: Deployment status, requests, errors, response times
- **Check**: Every 30 min (first 24 hours), then daily

**2. Sentry Dashboard**
- URL: `https://sentry.io/organizations/[org]/issues/`
- **Metrics**: Errors, performance, releases
- **Check**: Every 15 min (first hour), every 30 min (first 24 hours), then daily

**3. Supabase Dashboard**
- URL: `https://supabase.com/dashboard/project/[project-id]`
- **Metrics**: Database CPU, memory, connections, queries
- **Check**: Every 30 min (first 24 hours), then daily

**4. Stripe Dashboard**
- URL: `https://dashboard.stripe.com/`
- **Metrics**: Payments, disputes, webhooks
- **Check**: Daily

**5. Twilio Console**
- URL: `https://console.twilio.com/`
- **Metrics**: SMS delivery, costs, errors
- **Check**: Daily

**6. Resend Dashboard**
- URL: `https://resend.com/dashboard`
- **Metrics**: Email delivery, bounces, complaints
- **Check**: Daily

### Custom Monitoring Dashboard

**Create in /dashboard/admin/monitoring**

**Widgets**:
1. System Health (Green/Yellow/Red indicator)
2. Error Rate Chart (last 24 hours)
3. Response Time Chart (p50, p95, p99)
4. Active Users (real-time)
5. Cron Job Status (last execution time for each)
6. Integration Status (Stripe, Twilio, Resend)
7. Database Metrics (CPU, Memory, Connections)
8. Recent Errors (top 5 from Sentry)

---

## Alert Thresholds

### Critical Alerts (P0) - Immediate Response

| Alert | Threshold | Action |
|-------|-----------|--------|
| System Down | Health check fails | **Investigate immediately, consider rollback** |
| Error Rate Spike | >5% | **Investigate immediately, likely rollback** |
| Database Down | Connection failures | **Check Supabase status, restart if needed** |
| Payment Failures | Any Stripe errors | **Check Stripe integration, fix immediately** |

### High Priority Alerts (P1) - Within 1 Hour

| Alert | Threshold | Action |
|-------|-----------|--------|
| High Error Rate | 1-5% | Investigate errors, identify root cause |
| Slow Response Time | p95 >2s | Check database queries, optimize |
| Cron Job Failures | Any job fails | Check logs, re-run manually if needed |
| Integration Issues | Twilio/Resend errors | Check integration status and logs |

### Medium Priority Alerts (P2) - Within 4 Hours

| Alert | Threshold | Action |
|-------|-----------|--------|
| Elevated Error Rate | 0.5-1% | Monitor, investigate if persists |
| Database CPU High | >80% | Review queries, consider scaling |
| Slow Query | >1s execution | Add to optimization backlog |

---

## Issue Response

### Response Procedure

**When Alert Triggers:**

1. **Acknowledge** (within 5 min)
   - Acknowledge alert in monitoring system
   - Post in #production-alerts Slack channel
   - Assign incident commander

2. **Assess** (within 10 min)
   - Check severity using decision matrix
   - Determine impact (users affected, features down)
   - Decide: Fix forward or rollback?

3. **Act** (immediately)
   - If rollback needed: Follow rollback procedures
   - If fix forward: Implement fix in hotfix branch
   - Update stakeholders every 15 minutes

4. **Verify** (after fix/rollback)
   - Confirm issue resolved
   - Check metrics returned to normal
   - Verify no side effects

5. **Document** (within 24 hours)
   - Create incident report
   - Document root cause
   - Create prevention action items

---

## Checklist Templates

### Daily Monitoring Checklist

```markdown
# Daily Monitoring - [Date]

## System Health
- [ ] Health endpoint: OK
- [ ] Error rate: <0.5%
- [ ] Response time p95: <1s
- [ ] No critical errors in Sentry

## Database
- [ ] CPU usage: <70%
- [ ] Memory usage: <80%
- [ ] No connection issues
- [ ] No slow queries (>100ms)

## Integrations
- [ ] Stripe: No errors
- [ ] Twilio: No delivery failures
- [ ] Resend: No bounce rate spikes

## Cron Jobs
- [ ] All jobs executed successfully
- [ ] No failures in last 24 hours

## Feature Usage
- [ ] Opportunities created: [count]
- [ ] Promotions sent: [count]
- [ ] Review requests sent: [count]
- [ ] Portal logins: [count]

## Support
- [ ] Reviewed new tickets
- [ ] No deployment-related issues
- [ ] All critical tickets addressed

## Notes
[Any observations or concerns]

## Action Items
- [ ] [Action if needed]

**Overall Status**: 🟢 / 🟡 / 🔴

**Checked By**: [Name]
**Time**: [HH:MM]
```

---

**Document Version**: 1.0.0
**Last Updated**: January 2025

**Questions?** Contact: dev@dirtfree.com
