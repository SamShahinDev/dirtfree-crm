# User Acceptance Testing (UAT) Checklist

**Acceptance Statement:** All UAT scenarios pass; Help page reachable; Feedback successfully logged and posted to Slack; docs printable; no PII in logs.

## Table of Contents

- [UAT Overview](#uat-overview)
- [Test Data Setup](#test-data-setup)
- [UAT Scenarios](#uat-scenarios)
  - [Authentication & RBAC](#authentication--rbac)
  - [Customer Management](#customer-management)
  - [Job Management](#job-management)
  - [Calendar & Scheduling](#calendar--scheduling)
  - [Zone Board](#zone-board)
  - [Tech Weekly](#tech-weekly)
  - [Reminders Inbox](#reminders-inbox)
  - [SMS & Compliance](#sms--compliance)
  - [Trucks & Vehicle Board](#trucks--vehicle-board)
  - [Reports](#reports)
  - [Surveys & Reviews](#surveys--reviews)
  - [Audit Explorer](#audit-explorer)
  - [Ops Dashboard](#ops-dashboard)
  - [Disaster Recovery](#disaster-recovery)

## UAT Overview

### Scope & Owners

| Area | Owner | Secondary | Environment |
|------|-------|-----------|-------------|
| Authentication & RBAC | Admin | - | Staging |
| Customer/Job Management | Dispatcher | Admin | Staging |
| Calendar & Scheduling | Dispatcher | - | Staging |
| Zone Board | Dispatcher | Admin | Staging |
| Tech Weekly | Technician | Dispatcher | Staging |
| SMS & Compliance | Dispatcher | Admin | Staging |
| Vehicle Board | Technician | Dispatcher | Staging |
| Reports | Admin | Dispatcher | Staging |
| Surveys | Dispatcher | Admin | Staging |
| Audit & Ops | Admin | - | Staging |
| DR Smoke Test | Admin | - | Production |

### Test Environment

- **URL**: https://staging.dirt-free-crm.com
- **Test Data**: UAT Demo dataset (see Test Data Setup)
- **Test Period**: [To be scheduled]
- **Sign-off Required**: All Primary Owners

## Test Data Setup

### Pre-UAT Preparation

1. **Seed UAT Data**
   ```bash
   curl -X POST https://staging.dirt-free-crm.com/api/test/seed-uat \
     -H "Authorization: Bearer [TEST_SEED_SECRET]" \
     -H "Content-Type: application/json"
   ```

2. **Test Users**
   - `admin@acme.test` (password: `UAT2024Admin!`)
   - `dispatcher@acme.test` (password: `UAT2024Dispatch!`)
   - `tech1@acme.test` (password: `UAT2024Tech!`)
   - `tech2@acme.test` (password: `UAT2024Tech!`)

3. **Test Customers**
   - UAT Demo Customer 1 (555-0001)
   - UAT Demo Customer 2 (555-0002)
   - UAT Demo Customer 3 (555-0003)

4. **Test Jobs**
   - Various statuses (scheduled, in_progress, completed)
   - Different zones (Zone A, Zone B, Zone C)
   - Mixed assignments across technicians

## UAT Scenarios

### Authentication & RBAC

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| Login with valid admin credentials | Admin | Successful login, redirect to dashboard | ☐ ✅ ☐ ❌ | |
| Login with valid dispatcher credentials | Dispatcher | Successful login, redirect to dashboard | ☐ ✅ ☐ ❌ | |
| Login with valid technician credentials | Technician | Successful login, redirect to dashboard | ☐ ✅ ☐ ❌ | |
| Login with invalid credentials | Any | Error message, no access granted | ☐ ✅ ☐ ❌ | |
| Access admin-only features as dispatcher | Dispatcher | Access denied or feature not visible | ☐ ✅ ☐ ❌ | |
| Access admin-only features as technician | Technician | Access denied or feature not visible | ☐ ✅ ☐ ❌ | |
| View only assigned jobs as technician | Technician | Only see jobs assigned to current user | ☐ ✅ ☐ ❌ | |
| Session timeout handling | Any | Automatic logout after inactivity | ☐ ✅ ☐ ❌ | |
| Password reset flow | Any | Email sent, password reset successful | ☐ ✅ ☐ ❌ | |
| Logout functionality | Any | Successful logout, redirect to login | ☐ ✅ ☐ ❌ | |

### Customer Management

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| Create new customer | Dispatcher | Customer created with all fields | ☐ ✅ ☐ ❌ | |
| Edit existing customer | Dispatcher | Changes saved successfully | ☐ ✅ ☐ ❌ | |
| Search customers by name | Dispatcher | Accurate search results displayed | ☐ ✅ ☐ ❌ | |
| Search customers by phone | Dispatcher | Accurate search results displayed | ☐ ✅ ☐ ❌ | |
| View customer history | Dispatcher | All jobs and interactions shown | ☐ ✅ ☐ ❌ | |
| Add customer notes | Dispatcher | Notes saved and visible | ☐ ✅ ☐ ❌ | |
| Duplicate customer prevention | Dispatcher | Warning shown for similar customers | ☐ ✅ ☐ ❌ | |
| Required field validation | Dispatcher | Cannot save without required fields | ☐ ✅ ☐ ❌ | |
| Phone number formatting | Dispatcher | Phone numbers formatted correctly | ☐ ✅ ☐ ❌ | |
| Customer activity timeline | Dispatcher | Chronological activity display | ☐ ✅ ☐ ❌ | |

### Job Management

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| Create new job | Dispatcher | Job created with all details | ☐ ✅ ☐ ❌ | |
| Assign job to technician | Dispatcher | Assignment saved and visible | ☐ ✅ ☐ ❌ | |
| Change job status | Technician | Status updated with timestamp | ☐ ✅ ☐ ❌ | |
| Add job notes | Technician | Notes saved and visible to team | ☐ ✅ ☐ ❌ | |
| Upload job photos | Technician | Photos uploaded and EXIF stripped | ☐ ✅ ☐ ❌ | |
| Set job priority | Dispatcher | Priority reflected in views | ☐ ✅ ☐ ❌ | |
| Job completion workflow | Technician | Status change + follow-up prompt | ☐ ✅ ☐ ❌ | |
| View job details | Any | All information displayed correctly | ☐ ✅ ☐ ❌ | |
| Job timeline/audit | Dispatcher | Complete change history visible | ☐ ✅ ☐ ❌ | |
| Bulk job operations | Dispatcher | Multiple jobs updated efficiently | ☐ ✅ ☐ ❌ | |

### Calendar & Scheduling

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| View daily calendar | Dispatcher | All scheduled jobs visible | ☐ ✅ ☐ ❌ | |
| View weekly calendar | Dispatcher | Week view with all assignments | ☐ ✅ ☐ ❌ | |
| Schedule new job | Dispatcher | Job appears on calendar | ☐ ✅ ☐ ❌ | |
| Reschedule existing job | Dispatcher | Job moved to new time slot | ☐ ✅ ☐ ❌ | |
| Detect scheduling conflicts | Dispatcher | Warning shown for conflicts | ☐ ✅ ☐ ❌ | |
| Filter by technician | Dispatcher | Calendar filtered correctly | ☐ ✅ ☐ ❌ | |
| Filter by zone | Dispatcher | Zone-specific jobs shown | ☐ ✅ ☐ ❌ | |
| Time slot availability | Dispatcher | Available slots highlighted | ☐ ✅ ☐ ❌ | |
| Calendar export | Dispatcher | Calendar data exportable | ☐ ✅ ☐ ❌ | |
| Mobile calendar view | Technician | Calendar accessible on mobile | ☐ ✅ ☐ ❌ | |

### Zone Board

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| View zone board layout | Dispatcher | All zones and jobs visible | ☐ ✅ ☐ ❌ | |
| Drag job between zones | Dispatcher | Job moved with audit log | ☐ ✅ ☐ ❌ | |
| Drag job between technicians | Dispatcher | Assignment updated | ☐ ✅ ☐ ❌ | |
| Filter by status | Dispatcher | Filtered view displayed | ☐ ✅ ☐ ❌ | |
| Filter by priority | Dispatcher | Priority-based filtering | ☐ ✅ ☐ ❌ | |
| Job card information | Dispatcher | Complete job details on card | ☐ ✅ ☐ ❌ | |
| Quick job actions | Dispatcher | Actions accessible from card | ☐ ✅ ☐ ❌ | |
| Real-time updates | Dispatcher | Changes reflect immediately | ☐ ✅ ☐ ❌ | |
| Zone capacity indicators | Dispatcher | Workload indicators visible | ☐ ✅ ☐ ❌ | |
| Bulk zone operations | Dispatcher | Multiple jobs moved efficiently | ☐ ✅ ☐ ❌ | |

### Tech Weekly

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| View weekly schedule | Technician | Personal schedule for week | ☐ ✅ ☐ ❌ | |
| Start job ("On the Way") | Technician | Status updated with timestamp | ☐ ✅ ☐ ❌ | |
| Complete job | Technician | Completion workflow triggered | ☐ ✅ ☐ ❌ | |
| Add job notes | Technician | Notes saved successfully | ☐ ✅ ☐ ❌ | |
| Upload photos | Technician | Photos uploaded and processed | ☐ ✅ ☐ ❌ | |
| View job details | Technician | Complete job information | ☐ ✅ ☐ ❌ | |
| Report issues | Technician | Issue reported to dispatch | ☐ ✅ ☐ ❌ | |
| Navigation integration | Technician | Maps/navigation accessible | ☐ ✅ ☐ ❌ | |
| Offline functionality | Technician | Basic functions work offline | ☐ ✅ ☐ ❌ | |
| Mobile responsiveness | Technician | Interface optimized for mobile | ☐ ✅ ☐ ❌ | |

### Reminders Inbox

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| View pending reminders | Dispatcher | All due reminders listed | ☐ ✅ ☐ ❌ | |
| Send reminder now | Dispatcher | SMS sent immediately | ☐ ✅ ☐ ❌ | |
| Snooze reminder | Dispatcher | Reminder rescheduled | ☐ ✅ ☐ ❌ | |
| Mark reminder complete | Dispatcher | Reminder marked as sent | ☐ ✅ ☐ ❌ | |
| Edit reminder message | Dispatcher | Custom message saved | ☐ ✅ ☐ ❌ | |
| Filter by type | Dispatcher | Reminder types filtered | ☐ ✅ ☐ ❌ | |
| Filter by customer | Dispatcher | Customer-specific reminders | ☐ ✅ ☐ ❌ | |
| Bulk reminder actions | Dispatcher | Multiple reminders processed | ☐ ✅ ☐ ❌ | |
| Reminder history | Dispatcher | Past reminders visible | ☐ ✅ ☐ ❌ | |
| Auto-generated reminders | System | Follow-up reminders created | ☐ ✅ ☐ ❌ | |

### SMS & Compliance

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| Send SMS to valid number | Dispatcher | SMS sent successfully | ☐ ✅ ☐ ❌ | |
| SMS blocked by STOP | Dispatcher | Send blocked with error message | ☐ ✅ ☐ ❌ | |
| Quiet hours deferral (9p-8a CT) | System | SMS deferred to next business hour | ☐ ✅ ☐ ❌ | |
| Receive STOP reply | System | Number added to opt-out list | ☐ ✅ ☐ ❌ | |
| Receive START reply | System | Number removed from opt-out | ☐ ✅ ☐ ❌ | |
| SMS delivery status | Dispatcher | Delivery status tracked | ☐ ✅ ☐ ❌ | |
| SMS character limit | Dispatcher | Warning for long messages | ☐ ✅ ☐ ❌ | |
| Template messages | Dispatcher | Templates available and editable | ☐ ✅ ☐ ❌ | |
| SMS logs/history | Dispatcher | Complete SMS history visible | ☐ ✅ ☐ ❌ | |
| Compliance reporting | Admin | Opt-out reports available | ☐ ✅ ☐ ❌ | |

### Trucks & Vehicle Board

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| View vehicle board | Technician | All vehicles and statuses | ☐ ✅ ☐ ❌ | |
| Report vehicle need | Technician | Need posted to board | ☐ ✅ ☐ ❌ | |
| Report vehicle issue | Technician | Issue escalated properly | ☐ ✅ ☐ ❌ | |
| Update vehicle status | Technician | Status change logged | ☐ ✅ ☐ ❌ | |
| View vehicle history | Dispatcher | Complete vehicle timeline | ☐ ✅ ☐ ❌ | |
| Assign vehicle to tech | Dispatcher | Assignment tracked | ☐ ✅ ☐ ❌ | |
| Vehicle maintenance alerts | System | Alerts for due maintenance | ☐ ✅ ☐ ❌ | |
| Photo documentation | Technician | Photos of issues uploaded | ☐ ✅ ☐ ❌ | |
| Maintenance scheduling | Dispatcher | Maintenance jobs scheduled | ☐ ✅ ☐ ❌ | |
| Vehicle reports | Admin | Usage and maintenance reports | ☐ ✅ ☐ ❌ | |

### Reports

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| Generate daily report | Admin | Accurate daily metrics | ☐ ✅ ☐ ❌ | |
| Generate weekly report | Admin | Weekly summary with trends | ☐ ✅ ☐ ❌ | |
| Generate monthly report | Admin | Monthly business metrics | ☐ ✅ ☐ ❌ | |
| Technician performance | Admin | Individual tech metrics | ☐ ✅ ☐ ❌ | |
| Customer satisfaction | Admin | Survey results aggregated | ☐ ✅ ☐ ❌ | |
| Revenue reporting | Admin | Financial summaries | ☐ ✅ ☐ ❌ | |
| Export to PDF | Admin | Reports exportable as PDF | ☐ ✅ ☐ ❌ | |
| Export to CSV | Admin | Data exportable as CSV | ☐ ✅ ☐ ❌ | |
| Scheduled reports | Admin | Reports auto-generated | ☐ ✅ ☐ ❌ | |
| Custom date ranges | Admin | Flexible date filtering | ☐ ✅ ☐ ❌ | |

### Surveys & Reviews

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| Send survey after job completion | System | Survey link sent via SMS | ☐ ✅ ☐ ❌ | |
| Customer completes survey | Customer | Responses recorded | ☐ ✅ ☐ ❌ | |
| Positive survey triggers reviews | System | Review links sent for positive feedback | ☐ ✅ ☐ ❌ | |
| Negative survey triggers alert | System | Alert sent to management | ☐ ✅ ☐ ❌ | |
| View survey responses | Dispatcher | All responses visible | ☐ ✅ ☐ ❌ | |
| Survey analytics | Admin | Response trends and metrics | ☐ ✅ ☐ ❌ | |
| Custom survey questions | Admin | Questions editable | ☐ ✅ ☐ ❌ | |
| Survey token validation | System | Secure token handling | ☐ ✅ ☐ ❌ | |
| Review link tracking | System | Click tracking for review links | ☐ ✅ ☐ ❌ | |
| Survey reminder flow | System | Follow-up reminders sent | ☐ ✅ ☐ ❌ | |

### Audit Explorer

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| View audit log | Admin | Complete activity log | ☐ ✅ ☐ ❌ | |
| Filter by user | Admin | User-specific activities | ☐ ✅ ☐ ❌ | |
| Filter by action type | Admin | Action-based filtering | ☐ ✅ ☐ ❌ | |
| Filter by date range | Admin | Date-specific audit trail | ☐ ✅ ☐ ❌ | |
| Search audit entries | Admin | Text search in audit logs | ☐ ✅ ☐ ❌ | |
| Export audit log | Admin | Audit data exportable | ☐ ✅ ☐ ❌ | |
| View entry details | Admin | Detailed audit information | ☐ ✅ ☐ ❌ | |
| Track data changes | Admin | Before/after values shown | ☐ ✅ ☐ ❌ | |
| System event logging | System | Automated events logged | ☐ ✅ ☐ ❌ | |
| Audit data retention | System | Historical data preserved | ☐ ✅ ☐ ❌ | |

### Ops Dashboard

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| View system health | Admin | All health metrics displayed | ☐ ✅ ☐ ❌ | |
| Monitor API performance | Admin | Response times and errors | ☐ ✅ ☐ ❌ | |
| Check database status | Admin | Database health indicators | ☐ ✅ ☐ ❌ | |
| Review error logs | Admin | Recent errors listed | ☐ ✅ ☐ ❌ | |
| SMS delivery metrics | Admin | SMS success/failure rates | ☐ ✅ ☐ ❌ | |
| User activity monitoring | Admin | Active users and sessions | ☐ ✅ ☐ ❌ | |
| System alerts | Admin | Critical alerts displayed | ☐ ✅ ☐ ❌ | |
| Performance trends | Admin | Historical performance data | ☐ ✅ ☐ ❌ | |
| Cron job status | Admin | Background job monitoring | ☐ ✅ ☐ ❌ | |
| Integration status | Admin | External service health | ☐ ✅ ☐ ❌ | |

### Disaster Recovery

| Step | Role | Expected Result | Result | Notes |
|------|------|----------------|--------|-------|
| Access backup documentation | Admin | DR procedures accessible | ☐ ✅ ☐ ❌ | |
| Verify backup systems | Admin | Backups running successfully | ☐ ✅ ☐ ❌ | |
| Test data recovery | Admin | Sample data restored successfully | ☐ ✅ ☐ ❌ | |
| Failover procedures | Admin | Failover steps documented | ☐ ✅ ☐ ❌ | |
| Contact procedures | Admin | Emergency contacts available | ☐ ✅ ☐ ❌ | |
| RTO/RPO validation | Admin | Recovery objectives met | ☐ ✅ ☐ ❌ | |
| Communication plan | Admin | Outage communication ready | ☐ ✅ ☐ ❌ | |
| Rollback procedures | Admin | Rollback steps tested | ☐ ✅ ☐ ❌ | |
| Monitoring during DR | Admin | Monitoring tools functional | ☐ ✅ ☐ ❌ | |
| Post-DR verification | Admin | Full system validation | ☐ ✅ ☐ ❌ | |

## UAT Sign-off

### Completion Criteria

- [ ] All critical scenarios pass (✅)
- [ ] Any failures have documented workarounds
- [ ] Performance meets expectations
- [ ] Security requirements validated
- [ ] Accessibility requirements met

### Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Admin | _________________ | _________________ | _______ |
| Dispatcher | _________________ | _________________ | _______ |
| Technician | _________________ | _________________ | _______ |
| Project Manager | _________________ | _________________ | _______ |

---

**Last Updated:** [Date] | **Version:** 1.0 | **Environment:** Staging

<!-- Screenshot placeholders:
- [UAT Dashboard Overview]
- [Test Data Setup Screen]
- [Role-based Access Demonstration]
- [Critical Workflow Screenshots]
-->