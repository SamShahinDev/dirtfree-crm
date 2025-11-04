# Release Management Runbook

## Table of Contents

- [Overview](#overview)
- [Release Types](#release-types)
- [Pre-Release Gates](#pre-release-gates)
- [Staging Release Process](#staging-release-process)
- [Production Release Process](#production-release-process)
- [Hotfix Process](#hotfix-process)
- [Rollback Procedures](#rollback-procedures)
- [Version Management](#version-management)
- [Communication Plan](#communication-plan)
- [Post-Release Activities](#post-release-activities)

## Overview

This runbook defines the standardized procedures for releasing software changes to the Dirt Free CRM system. Our release process ensures quality, minimizes risk, and maintains system reliability through automated testing, staged deployments, and comprehensive validation.

### Release Objectives

1. **Quality Assurance**: Ensure all releases meet quality standards
2. **Risk Mitigation**: Minimize potential impact of new releases
3. **Reliability**: Maintain high system availability during releases
4. **Traceability**: Document all changes and their impact
5. **Efficiency**: Streamline release process while maintaining safety

### Release Environments

| Environment | Purpose | Auto-Deploy | Protection |
|-------------|---------|-------------|------------|
| **Development** | Active development | ✅ Feature branches | None |
| **Staging** | Pre-production testing | ✅ Main branch | E2E tests |
| **Production** | Live customer system | 🔒 Manual only | Full validation |

## Release Types

### Standard Release

**Definition**: Regular planned releases containing new features, improvements, and bug fixes

**Frequency**: Bi-weekly (every 2 weeks)
**Timeline**:
- Week 1: Development and testing
- Week 2: Staging validation and production deployment

**Requirements**:
- All features complete and tested
- Full E2E test suite passes
- UAT sign-off completed
- Documentation updated
- Rollback plan prepared

### Patch Release

**Definition**: Minor updates containing bug fixes and small improvements

**Frequency**: As needed (typically weekly)
**Timeline**: 1-3 days from code complete to production

**Requirements**:
- Limited scope changes only
- Critical path testing passed
- Low risk assessment
- Quick rollback capability

### Hotfix Release

**Definition**: Emergency fixes for critical production issues

**Frequency**: As needed (emergency only)
**Timeline**: 2-4 hours from identification to production

**Requirements**:
- Severity 1 or 2 incident driving the fix
- Minimal scope (single issue focus)
- Emergency approval process
- Immediate rollback capability

### Major Release

**Definition**: Significant feature releases or architectural changes

**Frequency**: Quarterly
**Timeline**: 3-4 weeks from code freeze to production

**Requirements**:
- Extended testing period
- Customer notification
- Detailed migration planning
- Comprehensive documentation
- Enhanced monitoring

## Pre-Release Gates

### Automated Gates (Required for all releases)

**Code Quality Checks:**
- [ ] TypeScript compilation passes
- [ ] ESLint checks pass with zero errors
- [ ] Unit tests pass (>90% coverage)
- [ ] Security vulnerability scan passes
- [ ] Dependency audit clean

**Build Verification:**
- [ ] Application builds successfully
- [ ] Static assets generated correctly
- [ ] Environment configuration valid
- [ ] Docker image builds (if applicable)

**Integration Tests:**
- [ ] API endpoints respond correctly
- [ ] Database migrations run successfully
- [ ] External service integrations functional
- [ ] Authentication and authorization working

### Manual Gates (Required by release type)

**Standard/Major Releases:**
- [ ] E2E test suite passes (100% critical scenarios)
- [ ] UAT sign-off completed
- [ ] Performance testing completed
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Rollback plan documented and tested

**Patch Releases:**
- [ ] Critical path testing completed
- [ ] Impact assessment documented
- [ ] Stakeholder approval received

**Hotfix Releases:**
- [ ] Root cause identified and addressed
- [ ] Fix validated in staging
- [ ] Emergency approval received
- [ ] Incident commander approval

### Staging Sign-off Checklist

**Functional Validation:**
- [ ] All new features working as expected
- [ ] Existing functionality not broken
- [ ] User interface renders correctly
- [ ] Mobile responsiveness maintained
- [ ] Cross-browser compatibility verified

**Performance Validation:**
- [ ] Page load times within acceptable limits (<3 seconds)
- [ ] API response times normal (<800ms p95)
- [ ] Database performance stable
- [ ] Memory and CPU usage normal

**Integration Validation:**
- [ ] SMS delivery working correctly
- [ ] Email notifications sending
- [ ] External API integrations functional
- [ ] Webhook endpoints responding
- [ ] Payment processing working (if applicable)

**Security Validation:**
- [ ] Authentication working correctly
- [ ] Authorization rules enforced
- [ ] Data access controls functioning
- [ ] Security headers present
- [ ] No sensitive data exposed in logs

## Staging Release Process

### Automatic Staging Deployment

**Trigger**: Push to `main` branch
**Process**: Automated via GitHub Actions

**Deployment Steps (Automated):**
1. **Build and Test**
   - Checkout code from main branch
   - Install dependencies and build application
   - Run full test suite including E2E tests

2. **Database Migration**
   - Apply any pending migrations to staging database
   - Verify migration success
   - Run data integrity checks

3. **Application Deployment**
   - Deploy to Vercel staging environment
   - Verify deployment health
   - Run post-deployment smoke tests

4. **Notification**
   - Send deployment notification to Slack
   - Update deployment status
   - Generate deployment report

### Manual Staging Validation

**Validation Steps:**
1. **Access Staging Environment**
   - URL: https://staging.dirt-free-crm.com
   - Verify application loads correctly
   - Check for any obvious errors

2. **Functional Testing**
   - Test all new features
   - Verify existing functionality
   - Check critical user paths
   - Validate mobile responsiveness

3. **Integration Testing**
   - Test SMS functionality with test numbers
   - Verify email notifications
   - Check webhook endpoints
   - Validate external service connections

4. **Performance Testing**
   - Check page load times
   - Monitor API response times
   - Verify database performance
   - Check for memory leaks

**Sign-off Process:**
1. **Technical Validation** (Lead Developer)
   - All automated tests pass
   - Code review completed
   - Performance metrics acceptable

2. **Functional Validation** (Product Owner)
   - Features work as specified
   - User experience acceptable
   - Business requirements met

3. **UAT Validation** (Stakeholders)
   - User acceptance testing completed
   - Critical scenarios validated
   - Sign-off documentation completed

## Production Release Process

### Manual Production Deployment

**Trigger**: Manual workflow dispatch in GitHub Actions
**Requirements**:
- Staging deployment successful
- All pre-release gates passed
- Required approvals received

### Pre-Production Checklist

**Pre-Deployment (T-1 hour):**
- [ ] Verify staging environment is healthy
- [ ] Confirm all tests pass
- [ ] Review deployment checklist
- [ ] Prepare rollback plan
- [ ] Schedule deployment window
- [ ] Notify stakeholders of upcoming deployment

**System Preparation:**
- [ ] Verify backup systems are current
- [ ] Check system resource utilization
- [ ] Confirm monitoring systems are operational
- [ ] Validate emergency contact information
- [ ] Prepare communication templates

### Production Deployment Steps

**1. Pre-Deployment Validation (15 minutes)**
```bash
# Verify staging health
curl -f https://staging.dirt-free-crm.com/api/ready

# Check production health baseline
curl -f https://dirt-free-crm.com/api/ready

# Verify monitoring systems
check-monitoring-status.sh
```

**2. Database Migration (15 minutes)**
```bash
# Run migration dry-run
tsx scripts/migrate.ts --env PROD --dry-run

# Apply migrations
tsx scripts/migrate.ts --env PROD

# Verify migration success
tsx scripts/migrate.ts --env PROD --status
```

**3. Application Deployment (20 minutes)**
```bash
# Trigger production deployment
gh workflow run deploy-production.yml \
  --ref main \
  --field confirm_production=true \
  --field git_ref=main
```

**4. Post-Deployment Validation (15 minutes)**
```bash
# Run comprehensive health checks
tsx scripts/post_deploy_check.ts \
  --url https://dirt-free-crm.com \
  --timeout 60 \
  --verbose

# Verify critical functionality
run-smoke-tests.sh production
```

**5. Monitoring and Verification (30 minutes)**
- Monitor error rates and response times
- Check user traffic and engagement
- Verify no critical alerts triggered
- Confirm customer-facing features working
- Monitor social media and support channels

### Post-Deployment Activities

**Immediate (0-2 hours):**
- [ ] Verify all health checks pass
- [ ] Monitor error rates and performance
- [ ] Check customer support channels
- [ ] Validate critical user journeys
- [ ] Send deployment success notification

**Short-term (2-24 hours):**
- [ ] Monitor system stability
- [ ] Review performance metrics
- [ ] Check for any user-reported issues
- [ ] Validate feature usage analytics
- [ ] Update release notes and documentation

**Follow-up (1-7 days):**
- [ ] Analyze feature adoption metrics
- [ ] Review support ticket trends
- [ ] Collect user feedback
- [ ] Plan next release cycle
- [ ] Update documentation and training materials

## Hotfix Process

### Hotfix Trigger Criteria

**Severity 1 Issues:**
- Application completely unavailable
- Critical data loss or corruption
- Security vulnerability actively exploited
- Payment processing completely broken

**Severity 2 Issues:**
- Major functionality unavailable
- Significant performance degradation
- SMS/email delivery completely failed
- Authentication system compromised

### Hotfix Workflow

**1. Hotfix Initiation (30 minutes)**
- [ ] Incident declared and assessed
- [ ] Hotfix decision made by incident commander
- [ ] Hotfix branch created from production
- [ ] Emergency team assembled

**2. Hotfix Development (2-4 hours)**
- [ ] Root cause identified
- [ ] Minimal fix developed
- [ ] Code review expedited
- [ ] Fix tested in staging environment

**3. Emergency Approval (30 minutes)**
- [ ] Technical lead approval
- [ ] Business stakeholder approval
- [ ] Risk assessment completed
- [ ] Communication plan prepared

**4. Hotfix Deployment (1 hour)**
- [ ] Production deployment executed
- [ ] Health checks passed
- [ ] Issue resolution verified
- [ ] Monitoring confirms stability

**5. Post-Hotfix (24 hours)**
- [ ] Incident resolution confirmed
- [ ] Post-incident review scheduled
- [ ] Documentation updated
- [ ] Process improvements identified

### Hotfix Branch Management

**Creating Hotfix Branch:**
```bash
# Create hotfix branch from production tag
git checkout -b hotfix/incident-[id] production-v[version]

# Make minimal changes to fix issue
git add [files]
git commit -m "hotfix: [brief description] - fixes #[incident-id]"

# Push hotfix branch
git push origin hotfix/incident-[id]
```

**Merging Hotfix:**
```bash
# Merge to main branch
git checkout main
git merge hotfix/incident-[id]

# Tag new version
git tag production-v[new-version]
git push origin main --tags

# Deploy to production
gh workflow run deploy-production.yml --ref production-v[new-version]
```

## Rollback Procedures

### Rollback Decision Criteria

**Immediate Rollback Required:**
- Severity 1 incident caused by deployment
- Critical functionality completely broken
- Data corruption detected
- Security vulnerability introduced
- Performance degradation >10x baseline

**Rollback Decision Process:**
1. **Assess Impact** (5 minutes)
   - Determine scope and severity
   - Identify affected users
   - Estimate resolution time

2. **Evaluate Options** (10 minutes)
   - Can issue be fixed forward quickly?
   - Is rollback safe (no data migration conflicts)?
   - What is risk/benefit of each approach?

3. **Make Decision** (5 minutes)
   - Incident commander makes final call
   - Document decision rationale
   - Communicate decision to team

### Application Rollback Process

**1. Prepare for Rollback (10 minutes)**
```bash
# Identify last known good deployment
vercel list --token [token]

# Verify rollback target health
check-deployment-health.sh [previous-deployment-url]
```

**2. Execute Application Rollback (15 minutes)**
```bash
# Promote previous deployment to production
vercel promote [previous-deployment-url] \
  --token [token] \
  --target production

# Verify rollback successful
curl -f https://dirt-free-crm.com/api/ready
```

**3. Database Rollback (if needed) (30 minutes)**
```bash
# Check if database rollback needed
assess-database-changes.sh [deployment-range]

# If needed, rollback database
tsx scripts/migrate.ts --env PROD --rollback [target-version]

# Verify data integrity
run-data-integrity-checks.sh
```

**4. Verify Rollback Success (15 minutes)**
```bash
# Run comprehensive health checks
tsx scripts/post_deploy_check.ts \
  --url https://dirt-free-crm.com \
  --timeout 60

# Test critical functionality
run-smoke-tests.sh production

# Monitor for stability
monitor-system-health.sh --duration 30m
```

### Post-Rollback Activities

**Immediate:**
- [ ] Verify service restoration
- [ ] Update incident status
- [ ] Notify stakeholders
- [ ] Monitor system stability

**Short-term:**
- [ ] Investigate root cause
- [ ] Plan forward fix
- [ ] Update documentation
- [ ] Review rollback effectiveness

## Version Management

### Versioning Strategy

**Semantic Versioning (MAJOR.MINOR.PATCH)**
- **MAJOR**: Breaking changes or significant new features
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

**Version Examples:**
- `v1.0.0` - Initial release
- `v1.1.0` - New features added
- `v1.1.1` - Bug fixes
- `v2.0.0` - Breaking changes

### Release Tags

**Tag Naming Convention:**
- Production releases: `production-v1.2.3`
- Release candidates: `rc-v1.2.3`
- Hotfixes: `hotfix-v1.2.4`

**Creating Release Tags:**
```bash
# Create and push production tag
git tag production-v1.2.3
git push origin production-v1.2.3

# Create release notes
gh release create production-v1.2.3 \
  --title "Release v1.2.3" \
  --notes-file RELEASE_NOTES.md
```

### Changelog Management

**Changelog Format:**
```markdown
# Changelog

## [1.2.3] - 2024-12-15

### Added
- New customer survey feature
- Mobile app push notifications

### Changed
- Improved dashboard performance
- Updated SMS templates

### Fixed
- Resolved calendar sync issue
- Fixed photo upload bug

### Security
- Updated dependency vulnerabilities
```

**Changelog Maintenance:**
- Update for each release
- Include all user-facing changes
- Categorize changes appropriately
- Reference issue/PR numbers
- Keep format consistent

## Communication Plan

### Release Notifications

**Internal Team (Slack #releases):**
```
🚀 PRODUCTION RELEASE - v1.2.3

Deployment Status: ✅ Successful
Deployment Time: 2024-12-15 14:30 UTC
Features: Customer surveys, dashboard improvements
Bug Fixes: Calendar sync, photo uploads

Health Check: ✅ All systems green
Monitoring: 📊 No alerts, performance normal

Release Notes: [link]
Rollback Plan: [ready if needed]
```

**Stakeholder Update (Email):**
```
Subject: Production Release v1.2.3 - Successfully Deployed

Team,

We have successfully deployed release v1.2.3 to production.

New Features:
- Customer survey integration for feedback collection
- Enhanced dashboard performance and responsiveness

Bug Fixes:
- Resolved calendar synchronization issues
- Fixed photo upload problems on mobile devices

System Health: All monitoring shows green, no issues detected.

Full release notes: [link to documentation]

If you encounter any issues, please report immediately.

Thanks,
Development Team
```

### Customer Communication

**Feature Announcements:**
- Email newsletter for significant features
- In-app notifications for new functionality
- Help documentation updates
- Training material refresh

**Maintenance Windows:**
- 24-hour advance notice for planned maintenance
- Status page updates during deployment
- Social media updates if needed
- Customer support team briefing

## Post-Release Activities

### Release Review Meeting

**Timing**: Within 48 hours of production deployment
**Attendees**: Development team, stakeholders, operations

**Agenda:**
1. **Deployment Summary** (10 minutes)
   - Timeline and process overview
   - Any issues encountered
   - Resolution times

2. **Feature Review** (15 minutes)
   - Feature functionality validation
   - User acceptance testing results
   - Performance impact assessment

3. **Metrics Review** (10 minutes)
   - System performance metrics
   - User engagement analytics
   - Error rates and incidents

4. **Process Improvement** (10 minutes)
   - What went well
   - Areas for improvement
   - Action items for next release

### Success Metrics

**Technical Metrics:**
- Deployment success rate: >99%
- Rollback rate: <5%
- Post-deployment incidents: <1 per release
- Deployment time: <60 minutes

**Business Metrics:**
- Feature adoption rate: >50% within 30 days
- Customer satisfaction: Maintain >4.5/5
- Support ticket increase: <10% post-release
- System uptime: >99.9%

### Continuous Improvement

**Monthly Release Process Review:**
- Analyze release metrics and trends
- Identify process bottlenecks
- Update procedures and documentation
- Implement tooling improvements

**Quarterly Process Assessment:**
- Comprehensive process evaluation
- Stakeholder feedback collection
- Industry best practice review
- Strategic improvement planning

---

**Last Updated:** [Date] | **Version:** 1.0 | **Next Review:** [Date + 3 months]

<!--
This runbook should be updated after each major release to reflect
lessons learned and process improvements.
-->