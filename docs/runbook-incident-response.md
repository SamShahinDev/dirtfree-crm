# Incident Response Runbook

## Table of Contents

- [Overview](#overview)
- [Severity Classification](#severity-classification)
- [Incident Response Team](#incident-response-team)
- [Initial Response](#initial-response)
- [Incident Workflow](#incident-workflow)
- [Communication Templates](#communication-templates)
- [Rollback Procedures](#rollback-procedures)
- [Post-Incident Review](#post-incident-review)
- [Emergency Contacts](#emergency-contacts)
- [Tools & Resources](#tools--resources)

## Overview

This runbook provides standardized procedures for responding to incidents affecting the Dirt Free CRM system. An incident is defined as any unplanned interruption or reduction in quality of service that impacts business operations or customer experience.

### Incident Response Objectives

1. **Minimize Impact**: Reduce the duration and scope of service disruption
2. **Restore Service**: Return systems to normal operation as quickly as possible
3. **Protect Data**: Ensure data integrity and prevent data loss
4. **Communicate Effectively**: Keep stakeholders informed throughout the incident
5. **Learn and Improve**: Conduct post-incident reviews to prevent recurrence

### Key Principles

- **Customer First**: Prioritize customer-facing services and data protection
- **Clear Communication**: Provide regular, accurate updates to all stakeholders
- **Document Everything**: Maintain detailed logs for analysis and compliance
- **Escalate Early**: Involve appropriate resources before problems worsen
- **Learn from Incidents**: Use every incident as an opportunity to improve

## Severity Classification

### Severity 1 (Critical) - Response Time: 15 minutes

**Definition**: Complete service outage or critical functionality unavailable

**Examples:**
- Application completely inaccessible
- Database corruption or unavailability
- Payment processing completely down
- Security breach or data exposure
- Critical customer data loss

**Impact**:
- Business operations halted
- All customers affected
- Revenue impact significant
- Potential legal/compliance issues

**Response Requirements:**
- Immediate page to on-call engineer
- Incident commander assigned within 15 minutes
- All hands on deck until resolved
- Executive notification within 30 minutes
- Hourly status updates

### Severity 2 (High) - Response Time: 30 minutes

**Definition**: Major functionality degraded but workarounds exist

**Examples:**
- Significant performance degradation (>5x normal response time)
- Core features unavailable (job management, scheduling)
- SMS delivery failures affecting multiple customers
- Mobile app crashes or major functionality broken
- Integration failures with critical services

**Impact**:
- Business operations significantly impacted
- Multiple customers affected
- Workarounds required
- Customer satisfaction affected

**Response Requirements:**
- On-call engineer notified within 30 minutes
- Incident commander assigned within 1 hour
- Manager notification within 1 hour
- Status updates every 2 hours

### Severity 3 (Medium) - Response Time: 2 hours

**Definition**: Minor functionality issues with limited impact

**Examples:**
- Non-critical features unavailable
- Performance issues affecting small user group
- Cosmetic UI issues
- Report generation delays
- Minor integration issues

**Impact**:
- Limited business impact
- Few customers affected
- Easy workarounds available
- Minor inconvenience

**Response Requirements:**
- Assigned to on-call engineer within 2 hours
- Daily status updates
- Fix targeted for next maintenance window

### Severity 4 (Low) - Response Time: 24 hours

**Definition**: Minor issues with minimal operational impact

**Examples:**
- Documentation errors
- Minor UI inconsistencies
- Feature requests
- Non-critical bugs
- Enhancement suggestions

**Impact**:
- Minimal business impact
- No customer service disruption
- Quality of life improvements

**Response Requirements:**
- Added to backlog within 24 hours
- Addressed in next development cycle
- Weekly status updates

## Incident Response Team

### Core Team Roles

**Incident Commander (IC)**
- **Primary**: System Administrator
- **Backup**: Lead Developer
- **Responsibilities**:
  - Overall incident coordination
  - Decision making authority
  - Stakeholder communication
  - Resource allocation
  - Documentation oversight

**Technical Lead**
- **Primary**: Lead Developer
- **Backup**: Senior Developer
- **Responsibilities**:
  - Technical investigation and resolution
  - Code fixes and deployments
  - System restoration
  - Technical communication

**Communications Lead**
- **Primary**: Operations Manager
- **Backup**: System Administrator
- **Responsibilities**:
  - Customer communication
  - Internal status updates
  - Slack and email notifications
  - Status page updates

**Business Liaison**
- **Primary**: Business Owner
- **Backup**: Operations Manager
- **Responsibilities**:
  - Business impact assessment
  - Stakeholder management
  - Customer escalation handling
  - Business continuity decisions

### Extended Team (As Needed)

**Database Administrator**
- Database issues and recovery
- Data integrity verification
- Performance optimization

**Security Specialist**
- Security incidents
- Compliance considerations
- Forensic analysis

**Customer Success**
- Customer communication
- Impact assessment
- Service recovery

**External Vendors**
- Vercel (hosting)
- Supabase (database)
- Twilio (SMS)
- Third-party integrations

## Initial Response

### First Responder Actions (First 15 minutes)

1. **Acknowledge Receipt**
   - Respond to alert or notification
   - Confirm you are investigating
   - Update incident status to "Investigating"

2. **Initial Assessment**
   - Verify the issue exists
   - Determine scope and impact
   - Classify severity level
   - Check related systems

3. **Create Incident Record**
   - Open incident tracking ticket
   - Document initial findings
   - Set appropriate severity level
   - Assign preliminary owner

4. **Escalate if Needed**
   - For Severity 1-2: Immediately escalate
   - Page Incident Commander if required
   - Notify management as per severity guidelines

5. **Begin Investigation**
   - Check monitoring dashboards
   - Review recent deployments
   - Check third-party service status
   - Gather initial evidence

### Escalation Criteria

**Immediate Escalation Required:**
- Severity 1 incidents
- Security-related incidents
- Data loss or corruption suspected
- Customer data potentially exposed
- Unknown root cause after 30 minutes

**Standard Escalation:**
- Severity 2 incidents
- Multiple systems affected
- Requires specialized knowledge
- Cross-team coordination needed

## Incident Workflow

### 1. Detection and Alerting

**Detection Sources:**
- Automated monitoring alerts (Sentry, Vercel)
- Customer reports
- Internal user reports
- Third-party service notifications
- Scheduled health checks

**Alert Channels:**
- **Critical**: Phone call + Slack + Email
- **High**: Slack + Email
- **Medium**: Slack notification
- **Low**: Email only

### 2. Investigation and Diagnosis

**Investigation Steps:**
1. **Reproduce the Issue**
   - Verify issue exists
   - Document reproduction steps
   - Identify affected systems

2. **Check System Health**
   - Review ops dashboard: `/ops`
   - Check error rates and response times
   - Verify database connectivity
   - Check external service status

3. **Review Recent Changes**
   - Check recent deployments
   - Review configuration changes
   - Identify correlation with timing
   - Check maintenance activities

4. **Gather Evidence**
   - Collect error logs
   - Document system state
   - Take screenshots
   - Record user impact

### 3. Containment and Mitigation

**Immediate Actions:**
- Stop any ongoing harmful processes
- Implement temporary fixes
- Enable feature flags to disable problematic features
- Scale resources if capacity issue
- Activate backup systems if needed

**Communication:**
- Notify incident team
- Update stakeholders
- Post to status page
- Send customer notifications

### 4. Resolution and Recovery

**Resolution Process:**
1. **Develop Fix**
   - Identify root cause
   - Develop permanent solution
   - Test fix in staging environment
   - Prepare rollback plan

2. **Deploy Fix**
   - Follow emergency deployment procedures
   - Monitor deployment progress
   - Verify fix effectiveness
   - Confirm service restoration

3. **Validate Recovery**
   - Run health checks
   - Test critical functionality
   - Verify customer access
   - Monitor for any side effects

### 5. Closure and Follow-up

**Closure Checklist:**
- [ ] Service fully restored
- [ ] All customers notified
- [ ] Monitoring shows normal operations
- [ ] Incident documentation complete
- [ ] Post-incident review scheduled

## Communication Templates

### Internal Notifications

**Incident Declaration (Slack)**
```
🚨 INCIDENT DECLARED - SEV [1/2/3/4]

Title: [Brief description]
Start Time: [timestamp]
Affected Systems: [list systems]
Customer Impact: [description]
Incident Commander: @[name]

War Room: #incident-[timestamp]
Status Updates: Every [frequency]

DO NOT reply in thread - join war room for updates
```

**Status Update Template**
```
📊 INCIDENT UPDATE - SEV [1/2/3/4]

Incident: [title]
Status: [Investigating/Identified/Monitoring/Resolved]
Current Actions: [what we're doing now]
Next Update: [time]

Impact: [current customer impact]
ETA: [estimated resolution time]

War Room: #incident-[timestamp]
```

**Resolution Notification**
```
✅ INCIDENT RESOLVED - SEV [1/2/3/4]

Incident: [title]
Resolution Time: [timestamp]
Duration: [total time]
Root Cause: [brief summary]

Customer Impact: [final impact assessment]
Post-Incident Review: [scheduled time]

Thank you to all responders: [list contributors]
```

### Customer Communications

**Service Disruption Notice**
```
Subject: Service Update - [Brief Description]

Dear Dirt Free CRM users,

We are currently experiencing [brief description of issue] affecting [specific functionality].

Our team is actively working to resolve this issue. We will provide updates every [frequency] until resolved.

Current Status: [status description]
Estimated Resolution: [timeframe]

We apologize for any inconvenience and appreciate your patience.

For urgent support, please contact [contact information].

- The Dirt Free CRM Team
```

**Service Restoration Notice**
```
Subject: Service Restored - [Brief Description]

Dear Dirt Free CRM users,

The service disruption affecting [functionality] has been resolved as of [time].

Duration: [total downtime]
Root Cause: [brief, non-technical explanation]
Resolution: [what was done]

All services are now operating normally. If you continue to experience issues, please contact support.

We apologize for the inconvenience and thank you for your patience.

- The Dirt Free CRM Team
```

### Status Page Updates

**Initial Update**
```
We are investigating reports of [issue description].
We will provide updates as more information becomes available.

Started at: [timestamp]
```

**In Progress Update**
```
We have identified the issue affecting [systems] and are working on a fix.
Affected services: [list]
Estimated resolution: [timeframe]

Updated at: [timestamp]
```

**Resolution Update**
```
The issue has been resolved. All services are operating normally.
Total duration: [timeframe]

We will continue monitoring to ensure stability.

Resolved at: [timestamp]
```

## Rollback Procedures

### When to Rollback

**Immediate Rollback Required:**
- New deployment causes Severity 1 incident
- Critical functionality completely broken
- Data corruption or loss detected
- Security vulnerability introduced
- Performance degradation >10x baseline

**Rollback Decision Tree:**
1. **Can the issue be fixed forward quickly?** (< 30 minutes)
   - Yes: Implement forward fix
   - No: Proceed to rollback

2. **Is rollback safe?** (No data migration conflicts)
   - Yes: Execute rollback
   - No: Implement emergency fix

3. **Will rollback restore service?**
   - Yes: Execute rollback
   - No: Investigate deeper issues

### Rollback Procedures

**Application Rollback (Vercel)**
1. **Access Vercel Dashboard**
   - Login to Vercel console
   - Navigate to project deployments
   - Identify last known good deployment

2. **Execute Rollback**
   ```bash
   # Promote previous deployment
   vercel promote [previous-deployment-url] --token [token]
   ```

3. **Verify Rollback**
   - Check application loads correctly
   - Test critical functionality
   - Monitor error rates
   - Verify database connectivity

**Database Rollback (Supabase)**
1. **Assess Data State**
   - Determine if data rollback needed
   - Check for data consistency issues
   - Identify safe rollback point

2. **Execute Database Rollback**
   ```bash
   # Restore from backup
   tsx scripts/migrate.ts --env PROD --rollback [backup-id]
   ```

3. **Verify Data Integrity**
   - Run data consistency checks
   - Verify user data intact
   - Test critical queries

### Post-Rollback Actions

1. **Verify Service Restoration**
   - Test all critical paths
   - Monitor system health
   - Confirm customer access

2. **Communicate Status**
   - Update incident status
   - Notify stakeholders
   - Post customer communication

3. **Investigate Root Cause**
   - Determine what went wrong
   - Plan permanent fix
   - Update deployment procedures

## Post-Incident Review

### Review Meeting (Within 48 hours)

**Attendees:**
- Incident Commander
- Technical Lead
- All responders
- Business stakeholders
- Management (for Severity 1-2)

**Agenda:**
1. **Incident Overview** (5 minutes)
   - Timeline and impact summary
   - Resolution overview

2. **What Went Well** (10 minutes)
   - Effective actions and responses
   - Successful procedures
   - Team collaboration highlights

3. **What Went Wrong** (15 minutes)
   - Process failures
   - Communication gaps
   - Technical issues
   - Response delays

4. **Root Cause Analysis** (15 minutes)
   - Primary root cause
   - Contributing factors
   - System vulnerabilities identified

5. **Action Items** (10 minutes)
   - Immediate fixes required
   - Process improvements
   - Training needs
   - Tool/monitoring enhancements

### Post-Incident Report

**Report Structure:**
1. **Executive Summary**
   - Incident overview
   - Customer impact
   - Resolution summary

2. **Timeline**
   - Detailed chronology of events
   - Response actions taken
   - Key decision points

3. **Root Cause Analysis**
   - Primary cause identification
   - Contributing factors
   - System weaknesses

4. **Impact Assessment**
   - Customer impact metrics
   - Business impact assessment
   - Financial impact (if applicable)

5. **Response Analysis**
   - What worked well
   - Areas for improvement
   - Process gaps identified

6. **Action Items**
   - Specific remediation tasks
   - Process improvements
   - Preventive measures
   - Assigned owners and deadlines

### Follow-up Actions

**Immediate (1-3 days):**
- Critical fixes implementation
- Monitoring improvements
- Documentation updates

**Short-term (1-2 weeks):**
- Process improvements
- Tool enhancements
- Training updates

**Long-term (1-3 months):**
- Architectural improvements
- Preventive measures
- System hardening

## Emergency Contacts

### Primary On-Call

**System Administrator**
- Phone: [REDACTED]
- Email: admin@acme.test
- Slack: @admin
- Escalation: Lead Developer

**Lead Developer**
- Phone: [REDACTED]
- Email: dev-lead@acme.test
- Slack: @dev-lead
- Escalation: CTO

**Operations Manager**
- Phone: [REDACTED]
- Email: ops@acme.test
- Slack: @ops-manager
- Escalation: CEO

### Secondary Contacts

**Database Specialist**
- Email: dba@acme.test
- Slack: @database-admin
- Availability: Business hours

**Security Team**
- Email: security@acme.test
- Slack: @security-team
- Availability: 24/7 for security incidents

### External Vendors

**Vercel Support**
- Email: support@vercel.com
- Portal: https://vercel.com/support
- Phone: (Available for Enterprise plans)

**Supabase Support**
- Email: support@supabase.com
- Portal: https://supabase.com/support
- Discord: Supabase Community

**Twilio Support**
- Phone: 1-888-TWILIO-1
- Email: support@twilio.com
- Portal: https://support.twilio.com

## Tools & Resources

### Monitoring & Alerting

**Ops Dashboard**
- URL: https://dirt-free-crm.com/ops
- Health checks and system metrics
- Real-time performance monitoring

**Sentry Error Tracking**
- URL: https://sentry.io/organizations/[org]/
- Error reporting and alerting
- Performance monitoring

**Vercel Analytics**
- URL: https://vercel.com/[team]/[project]/analytics
- Deployment and performance metrics
- Function execution monitoring

### Communication Tools

**Slack Channels**
- `#incidents` - Incident coordination
- `#ops-alerts` - Automated alerts
- `#on-call` - On-call discussions

**Status Page**
- URL: https://status.dirt-free-crm.com
- Customer-facing status updates
- Incident history

### Documentation

**System Architecture**
- Infrastructure diagrams
- Service dependencies
- Data flow documentation

**Runbooks**
- Deployment procedures
- Backup and recovery
- Common troubleshooting

**Configuration**
- Environment variables
- Service configurations
- Integration settings

### Recovery Resources

**Backup Locations**
- Supabase automated backups
- Configuration backups
- Code repository (GitHub)

**Recovery Scripts**
- Database restoration scripts
- Migration rollback procedures
- Emergency deployment scripts

---

**Last Updated:** [Date] | **Version:** 1.0 | **Next Review:** [Date + 3 months]

<!--
Note: This runbook should be reviewed and updated after each major incident
and at least quarterly to ensure accuracy and effectiveness.
-->