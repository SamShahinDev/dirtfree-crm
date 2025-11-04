# Rollback Procedures

**Dirt Free CRM** | Emergency rollback guide for production deployments

---

## Quick Reference

**When to Rollback:**
- Critical bug affecting core functionality (opportunities, promotions, payments)
- Data corruption detected
- Security vulnerability discovered
- System-wide outage (>5 minutes)
- Error rate >5%
- Payment processing failures
- Database connection failures

**Decision Tree:**
```
Issue Detected
    ↓
Is it critical? (see criteria above)
    ↓ YES                    ↓ NO
Rollback Immediately    Monitor & Fix Forward
```

---

## Rollback Decision Matrix

| Issue Type | Severity | Action | Response Time |
|------------|----------|--------|---------------|
| **System Down** | P0 | Rollback immediately | <5 min |
| **Payments Failing** | P0 | Rollback immediately | <5 min |
| **Data Corruption** | P0 | Rollback + DB restore | <15 min |
| **Security Vuln** | P0-P1 | Rollback immediately | <10 min |
| **Major Feature Down** | P1 | Rollback if no quick fix | <30 min |
| **High Error Rate (>5%)** | P1 | Rollback if trending up | <15 min |
| **Minor Feature Issue** | P2 | Fix forward | Plan fix |
| **UI Bug** | P3 | Fix forward | Plan fix |

---

## Rollback Methods

### Method 1: Vercel Instant Rollback (Recommended)

**Duration**: 2-3 minutes
**Use When**: Application code issue (not database)
**Downtime**: Minimal (<30 seconds)

#### Steps:

**Option A: Vercel Dashboard (Easiest)**

1. **Navigate to Deployments**
   - Go to Vercel Dashboard
   - Select project: dirt-free-crm
   - Click "Deployments" tab

2. **Find Last Known Good Deployment**
   - Scroll to deployment before the problematic one
   - Verify timestamp and commit hash
   - Check deployment status is "Ready"

3. **Promote to Production**
   - Click "..." menu on deployment row
   - Select "Promote to Production"
   - Confirm promotion

4. **Verify Rollback**
   ```bash
   # Check health
   curl https://your-domain.com/api/health

   # Check version (should be previous)
   curl https://your-domain.com/api/version

   # Check error rate in Sentry
   ```

**Option B: Vercel CLI (Faster if you have CLI ready)**

```bash
# 1. List recent deployments
vercel ls

# 2. Find last good deployment URL
# Example: dirt-free-crm-abc123.vercel.app

# 3. Promote it to production
vercel promote dirt-free-crm-abc123.vercel.app

# 4. Verify
curl https://your-domain.com/api/health
```

**Verification Checklist:**
- [ ] Health check returns 200 OK
- [ ] Homepage loads correctly
- [ ] Can login successfully
- [ ] Sentry error rate decreasing
- [ ] Key features working (create opportunity, view analytics)

---

### Method 2: Git Revert + Redeploy

**Duration**: 5-10 minutes
**Use When**: Need more control, want proper git history
**Downtime**: Minimal (Vercel hot-swap)

#### Steps:

```bash
# 1. Identify problematic commit
git log --oneline -10

# Example output:
# abc1234 Add new feature (PROBLEMATIC)
# def5678 Fix bug (LAST GOOD)
# ghi9012 Update docs

# 2. Create revert commit
git revert abc1234

# Or revert multiple commits
git revert abc1234^..HEAD

# 3. Push to main
git push origin main

# 4. Deploy automatically triggers (if auto-deploy enabled)
# Or manually deploy:
vercel --prod

# 5. Monitor deployment
# Watch Vercel dashboard for deployment status

# 6. Verify once deployed
curl https://your-domain.com/api/health
```

**When to Use Git Revert:**
- You want clean git history
- Need to revert multiple commits
- Want teammates to see revert in history
- Planning to re-deploy fix later

**Verification Checklist:**
- [ ] Deployment completes successfully
- [ ] Health check returns 200 OK
- [ ] Application functional
- [ ] Error rate normal
- [ ] Git history shows revert commit

---

### Method 3: Database Rollback

**Duration**: 15-30 minutes
**Use When**: Database migration caused issues
**Downtime**: 5-15 minutes
**Risk**: HIGH - Can cause data loss if not careful

#### Pre-Requisites:
- [ ] Database backup exists from before migration
- [ ] Backup verified and tested
- [ ] Downtime window scheduled (if possible)
- [ ] Team notified

#### Steps:

**Option A: Restore from Supabase Backup**

```bash
# 1. Create current state backup (if possible)
# Supabase Dashboard > Database > Backups > Create manual backup
# Name: "pre-rollback-{timestamp}"

# 2. Put application in maintenance mode (optional)
# Create /public/maintenance.html
# Or use Vercel maintenance mode

# 3. Restore from backup
# Supabase Dashboard > Database > Backups
# Select backup from before problematic migration
# Click "Restore"
# Confirm restoration (THIS WILL REPLACE CURRENT DATA)

# 4. Wait for restoration to complete (5-15 minutes)

# 5. Verify database state
# Supabase Dashboard > SQL Editor
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

# Check critical tables exist and have data
SELECT COUNT(*) FROM customers;
SELECT COUNT(*) FROM opportunities;

# 6. Test application with restored database
curl https://your-domain.com/api/health/detailed

# 7. If successful, rollback application code (Method 1 or 2)

# 8. Remove maintenance mode

# 9. Monitor closely for 1 hour
```

**Option B: Run Down Migration Scripts**

```sql
-- If migration has down script, run it
-- Example: Rolling back scheduled_reports migration

-- 1. Drop new tables (in reverse order of dependencies)
DROP TABLE IF EXISTS report_generation_log CASCADE;
DROP TABLE IF EXISTS scheduled_reports CASCADE;

-- 2. Drop new views
DROP VIEW IF EXISTS recent_report_generations;

-- 3. Drop new functions
DROP FUNCTION IF EXISTS get_report_generation_history();

-- 4. Verify rollback
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('scheduled_reports', 'report_generation_log');
-- Should return 0 rows

-- 5. Test application
```

**Data Loss Considerations:**

| Time Since Migration | Likely Data Loss |
|---------------------|------------------|
| <5 minutes | Minimal (few records) |
| 5-30 minutes | Low (recent data only) |
| 30-60 minutes | Moderate |
| >1 hour | Significant |

**Minimizing Data Loss:**

1. **Export Recent Data Before Rollback:**
   ```sql
   -- Export data created since migration
   COPY (
     SELECT * FROM new_table
     WHERE created_at > 'migration_timestamp'
   ) TO '/tmp/recent_data.csv' CSV HEADER;
   ```

2. **Restore from Backup**

3. **Re-import Recent Data:**
   ```sql
   -- Carefully re-import if structure allows
   COPY new_table FROM '/tmp/recent_data.csv' CSV HEADER;
   ```

**Verification Checklist:**
- [ ] Database restored successfully
- [ ] All expected tables exist
- [ ] Data counts match expectations
- [ ] RLS policies active
- [ ] Application can connect
- [ ] Critical queries working
- [ ] No data corruption detected

---

### Method 4: Feature Flag Disable

**Duration**: 1-2 minutes
**Use When**: New feature causing issues, can be disabled
**Downtime**: None

#### Steps:

```typescript
// If feature flags are implemented:

// 1. Disable problematic feature in feature flag system
// Example: LaunchDarkly, Unleash, or custom solution

// 2. Verify feature is disabled
// Test in browser that feature UI doesn't appear
// Or check via API

// 3. Monitor error rate decrease

// 4. Plan proper fix for next deployment
```

**Note**: Requires feature flags to be implemented. Consider adding for future deployments.

---

## Rollback Communication

### Internal Communication Template

**Immediate Alert (Slack/Email):**
```
🚨 PRODUCTION ROLLBACK IN PROGRESS

Issue: [Brief description]
Severity: P[0/1/2]
Impact: [What's affected]
Action: Rolling back to deployment from [timestamp]
ETA: [Expected completion time]
Incident Commander: [Name]

Updates will be posted here every 5 minutes.
```

### Status Updates (Every 5 minutes during rollback)

```
⏱️ UPDATE [HH:MM]

Status: [In Progress / Completed / Blocked]
Progress: [What's been done]
Next: [What's happening next]
ETA: [Updated if changed]
```

### Resolution Communication

```
✅ ROLLBACK COMPLETE

Issue: [Brief description]
Root Cause: [Technical explanation]
Rollback Method: [Vercel/Git/Database]
Duration: [Total time]
Impact: [What was affected and for how long]

Current Status: System operational and stable
Monitoring: Intensive monitoring for next 2 hours

Next Steps:
1. Root cause analysis (ETA: [time])
2. Fix implementation (ETA: [time])
3. Testing in staging (ETA: [time])
4. Next deployment attempt (ETA: [time])

Point of Contact: [Name, email, phone]
```

### Customer Communication (If Needed)

**During Outage:**
```
We're currently experiencing technical difficulties with our CRM system.
Our team is actively working on a resolution. We apologize for any
inconvenience and will update you within 30 minutes.
```

**After Resolution:**
```
Our systems are now fully operational. The issue has been resolved and
we've implemented additional monitoring to prevent recurrence. Thank you
for your patience.
```

---

## Post-Rollback Procedures

### Immediate (Within 15 Minutes)

- [ ] **Verify System Stability**
  - Health checks passing
  - Error rate normal (<0.5%)
  - Key features working
  - Integrations functioning

- [ ] **Create Incident Ticket**
  - Document what happened
  - Timeline of events
  - Rollback method used
  - Current status

- [ ] **Notify Stakeholders**
  - Technical team (Slack)
  - Management (Email)
  - Customers (if affected)

- [ ] **Begin Monitoring**
  - Sentry: Watch error stream
  - Vercel: Monitor metrics
  - Supabase: Check database health
  - Set alarms for next 2 hours

### Within 1 Hour

- [ ] **Root Cause Analysis (Quick)**
  - What went wrong?
  - Why didn't testing catch it?
  - What code/config caused it?

- [ ] **Document Incident**
  - Update incident ticket with findings
  - Screenshots/logs of issue
  - Impact assessment (users affected, duration)

- [ ] **Begin Fix Development**
  - Create hotfix branch
  - Implement fix
  - Add tests to prevent recurrence

### Within 4 Hours

- [ ] **Complete Fix**
  - Fix implemented and tested locally
  - Unit tests added
  - Integration tests added

- [ ] **Deploy to Staging**
  - Test fix thoroughly in staging
  - Verify doesn't introduce new issues
  - Run full regression test suite

- [ ] **Prepare Deployment Plan**
  - Document what changed
  - Plan deployment timing
  - Identify additional safeguards

### Within 24 Hours

- [ ] **Complete Post-Mortem**
  - Detailed timeline
  - Root cause analysis
  - Contributing factors
  - Lessons learned
  - Action items

- [ ] **Update Procedures**
  - Update deployment checklist
  - Add new tests
  - Improve monitoring/alerts
  - Update documentation

- [ ] **Schedule Fix Deployment**
  - Pick low-traffic time
  - Notify team
  - Plan rollback (again)
  - Deploy with extra monitoring

---

## Incident Post-Mortem Template

```markdown
# Incident Post-Mortem: [Brief Title]

**Date**: [Date of incident]
**Duration**: [How long was system impacted]
**Severity**: P[0/1/2/3]
**Incident Commander**: [Name]

## Summary

[2-3 sentences describing what happened]

## Impact

- **Users Affected**: [Number or percentage]
- **Features Affected**: [List]
- **Financial Impact**: [If applicable]
- **Duration**: [Start time - End time]

## Timeline

| Time | Event |
|------|-------|
| HH:MM | Deployment to production |
| HH:MM | First error detected |
| HH:MM | Incident declared |
| HH:MM | Rollback initiated |
| HH:MM | Rollback completed |
| HH:MM | System verified stable |

## Root Cause

[Detailed technical explanation of what went wrong]

## Contributing Factors

- [Factor 1]
- [Factor 2]
- [Factor 3]

## Resolution

[How the issue was resolved - rollback method, fix implemented, etc.]

## What Went Well

- [Thing 1]
- [Thing 2]

## What Didn't Go Well

- [Thing 1]
- [Thing 2]

## Action Items

| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action 1] | [Name] | [Date] | [ ] |
| [Action 2] | [Name] | [Date] | [ ] |
| [Action 3] | [Name] | [Date] | [ ] |

## Lessons Learned

- [Lesson 1]
- [Lesson 2]
- [Lesson 3]

## Prevention

How we'll prevent this in the future:

1. [Prevention measure 1]
2. [Prevention measure 2]
3. [Prevention measure 3]

---

**Prepared By**: [Name]
**Reviewed By**: [Name, Name]
**Date**: [Date]
```

---

## Testing Rollback Procedures

### Rollback Drills (Quarterly)

**Purpose**: Ensure team can rollback quickly and confidently

**Schedule**: Every 3 months

**Drill Procedure:**

1. **Setup** (in staging):
   - Deploy baseline version
   - Deploy "problematic" version (with known benign issue)
   - Note deployment URLs and times

2. **Execute Drill**:
   - Set timer
   - Team performs rollback following procedures
   - Record time taken
   - Note any difficulties

3. **Debrief**:
   - What went well?
   - What was confusing?
   - Update procedures if needed
   - Set target time improvement

**Target Times**:
- Method 1 (Vercel): <3 minutes
- Method 2 (Git Revert): <8 minutes
- Method 3 (Database): <20 minutes

### Rollback Checklist for Drills

- [ ] Team knows where procedures are documented
- [ ] Team can access Vercel dashboard
- [ ] Team can access Supabase dashboard
- [ ] Team knows who to notify
- [ ] Communication templates readily available
- [ ] Verification steps clear and actionable
- [ ] Post-rollback monitoring process understood

---

## Rollback Prevention

**Better than rollback is not needing to rollback.**

### Pre-Deployment Safeguards

- [ ] All tests passing (unit, integration, E2E)
- [ ] Code reviewed by senior developer
- [ ] Tested thoroughly in staging environment
- [ ] Database migrations tested with down scripts
- [ ] Feature flags for new features (can disable without rollback)
- [ ] Gradual rollout (deploy to 10% of users first)
- [ ] Automated smoke tests post-deployment
- [ ] Real-time monitoring and alerts

### Deployment Best Practices

- [ ] Deploy during low-traffic periods
- [ ] Have rollback plan ready before deploying
- [ ] Monitor intensively for first hour post-deployment
- [ ] Keep changes small and incremental
- [ ] Never deploy on Fridays (unless emergency)
- [ ] Have two people available during deployment
- [ ] Test rollback procedure in staging first

### Early Warning Signs

Watch for these indicators that might require rollback:

- Error rate >1% (warning)
- Error rate >5% (rollback)
- Response time >2s p95 (investigate)
- Response time >5s p95 (rollback)
- Database CPU >90% (investigate)
- Any payment processing failures (rollback)
- Customer reports of major issues (investigate)

---

## Emergency Contacts

**For Rollback Decisions:**

- **Primary**: Engineering Manager - (555) 123-4567
- **Secondary**: CTO - (555) 987-6543
- **Emergency**: On-call rotation - (555) 999-0000

**Communication Channels:**

- **Slack**: #production-alerts
- **Email**: emergency@dirtfree.com
- **Phone Tree**: Check on-call calendar

---

## Appendix

### A. Rollback Decision Flowchart

```
[Issue Detected]
       ↓
[Is it P0 severity?] → YES → [Rollback immediately]
       ↓ NO
[Error rate >5%?] → YES → [Rollback immediately]
       ↓ NO
[Can fix forward in <15 min?] → YES → [Fix forward, monitor closely]
       ↓ NO
[Is it getting worse?] → YES → [Rollback]
       ↓ NO
[Monitor closely, plan fix]
```

### B. Common Rollback Scenarios

**Scenario 1: New feature breaking existing feature**
- Method: Vercel instant rollback
- Duration: <3 minutes
- Risk: Low

**Scenario 2: Database migration causing errors**
- Method: Database restore + App rollback
- Duration: 15-20 minutes
- Risk: Medium (possible data loss)

**Scenario 3: Environment variable misconfiguration**
- Method: Fix env var + redeploy (no rollback needed)
- Duration: 5 minutes
- Risk: Low

**Scenario 4: Integration failure (Stripe/Twilio)**
- Method: Fix integration config or rollback
- Duration: Varies
- Risk: Medium

### C. Useful Commands

**Check Deployment Status:**
```bash
vercel ls
```

**View Recent Logs:**
```bash
vercel logs <deployment-url> --follow
```

**Promote Deployment:**
```bash
vercel promote <deployment-url>
```

**Check Health:**
```bash
curl https://your-domain.com/api/health
curl https://your-domain.com/api/health/detailed
```

**Check Error Rate (Sentry CLI):**
```bash
sentry-cli releases list
sentry-cli releases finalize <version>
```

---

**Document Version**: 1.0.0
**Last Updated**: January 2025
**Next Review**: February 2025

**Questions?** Contact: dev@dirtfree.com | Emergency: (555) 999-0000
