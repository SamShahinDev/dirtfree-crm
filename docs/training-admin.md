# Administrator Training Guide

## Table of Contents

- [Role Overview](#role-overview)
- [Day-1 Quick Start](#day-1-quick-start)
- [User Management](#user-management)
- [System Configuration](#system-configuration)
- [Templates & Messaging](#templates--messaging)
- [Reports & Analytics](#reports--analytics)
- [Audit & Compliance](#audit--compliance)
- [Backup & Disaster Recovery](#backup--disaster-recovery)
- [Deployment & Operations](#deployment--operations)
- [Security & Maintenance](#security--maintenance)
- [Troubleshooting](#troubleshooting)

## Role Overview

As a **System Administrator**, you have the highest level of access to Dirt Free CRM. Your responsibilities include:

- **User Management**: Creating/managing user accounts and permissions
- **System Configuration**: Setting up templates, workflows, and business rules
- **Data Oversight**: Monitoring data integrity and audit trails
- **Performance Management**: Ensuring system health and optimal performance
- **Security Management**: Maintaining security policies and access controls
- **Backup & Recovery**: Ensuring data protection and disaster recovery readiness
- **Compliance**: Managing SMS compliance, audit logs, and regulatory requirements

### Key Privileges

✅ **Full System Access**: All features and data
✅ **User Management**: Create/edit/deactivate users
✅ **System Settings**: Modify global configurations
✅ **Audit Access**: View all system audit logs
✅ **Reports**: Generate and export all reports
✅ **Ops Dashboard**: Monitor system health and performance

## Day-1 Quick Start

### Initial Login & Setup

1. **Login to System**
   - URL: `https://dirt-free-crm.com`
   - Use provided admin credentials
   - Change default password immediately

2. **Verify System Health**
   - Navigate to **Ops Dashboard** (`/ops`)
   - Check all health indicators are green
   - Review any pending alerts

3. **Review User Accounts**
   - Go to **Settings > Users**
   - Verify all team members are set up
   - Check role assignments

4. **Configure Company Settings**
   - Navigate to **Settings > Company**
   - Update company information
   - Set timezone and business hours

### Essential Day-1 Tasks Checklist

- [ ] Change default admin password
- [ ] Verify ops dashboard shows healthy status
- [ ] Review and update company settings
- [ ] Check user accounts and permissions
- [ ] Test SMS functionality with test number
- [ ] Review backup status
- [ ] Set up email notifications
- [ ] Configure alert preferences
- [ ] Test disaster recovery documentation access
- [ ] Schedule first team training session

## User Management

### Creating New Users

1. **Navigate to User Management**
   ```
   Settings → Users → Add New User
   ```

2. **User Creation Form**
   - **Email**: Must be unique, becomes login username
   - **Full Name**: Display name throughout system
   - **Role**: Select appropriate role (Admin/Dispatcher/Technician)
   - **Phone**: Optional, for notifications
   - **Initial Password**: System-generated or custom

3. **Role Permissions**

   | Feature | Admin | Dispatcher | Technician |
   |---------|-------|------------|------------|
   | User Management | ✅ | ❌ | ❌ |
   | All Customer Data | ✅ | ✅ | ❌ (assigned only) |
   | All Job Data | ✅ | ✅ | ❌ (assigned only) |
   | Scheduling | ✅ | ✅ | ❌ (view only) |
   | Zone Board | ✅ | ✅ | ❌ (view only) |
   | Reports | ✅ | ✅ (limited) | ❌ |
   | Audit Logs | ✅ | ❌ | ❌ |
   | System Settings | ✅ | ❌ | ❌ |

### Managing Existing Users

**Editing Users:**
- Navigate to **Settings > Users**
- Click user name to edit
- Modify permissions, contact info, or status
- Save changes

**Deactivating Users:**
- Edit user profile
- Set status to "Inactive"
- User retains data but cannot login
- Can be reactivated later

**Password Resets:**
- Click "Reset Password" in user profile
- System sends reset email to user
- Or provide temporary password manually

### User Access Monitoring

**Active Sessions:**
- View current logged-in users
- Force logout if needed
- Monitor concurrent sessions

**Login History:**
- Track user login patterns
- Identify suspicious activity
- Generate access reports

## System Configuration

### Company Settings

**Business Information:**
```
Settings → Company → Basic Info
```
- Company name and logo
- Contact information
- Business hours and timezone
- Service areas and zones

**Operational Settings:**
```
Settings → Operations
```
- Default job duration
- Scheduling rules
- Zone definitions
- Service types

### SMS Configuration

**Twilio Integration:**
```
Settings → Integrations → SMS
```
- Account SID and Auth Token
- Phone number configuration
- Webhook endpoints
- Quiet hours settings (9 PM - 8 AM CT)

**Compliance Settings:**
- STOP/START keyword handling
- Opt-out list management
- Message templates
- Delivery tracking

### Email Settings

**SMTP Configuration:**
```
Settings → Integrations → Email
```
- SMTP server settings
- Authentication credentials
- Default sender information
- Template customization

### Integration Management

**Supabase Database:**
- Connection status monitoring
- Row-level security verification
- Backup configuration
- Performance monitoring

**External Services:**
- Twilio SMS status
- Email service health
- Third-party API connections
- Webhook configurations

## Templates & Messaging

### SMS Templates

**Default Templates:**
1. **Appointment Reminder**
   ```
   Hi [CUSTOMER_NAME]! This is a reminder that Dirt Free Carpet is scheduled to clean your carpets on [DATE] at [TIME]. We'll text you when we're on the way. Reply STOP to opt out.
   ```

2. **On the Way**
   ```
   Hi [CUSTOMER_NAME]! Our technician [TECH_NAME] is on the way to your location. ETA: [ETA]. Contact us at [PHONE] if needed.
   ```

3. **Job Complete**
   ```
   Your carpet cleaning is complete! We'd love your feedback: [SURVEY_LINK]. Thank you for choosing Dirt Free Carpet!
   ```

4. **Follow-up**
   ```
   Hi [CUSTOMER_NAME]! How are your carpets looking? We recommend cleaning every 12 months. Schedule your next appointment: [BOOKING_LINK]
   ```

**Template Variables:**
- `[CUSTOMER_NAME]` - Customer's name
- `[DATE]` - Formatted appointment date
- `[TIME]` - Appointment time
- `[TECH_NAME]` - Assigned technician name
- `[ETA]` - Estimated arrival time
- `[SURVEY_LINK]` - Customer survey URL
- `[BOOKING_LINK]` - Online booking URL
- `[PHONE]` - Company phone number

### Email Templates

**System Notifications:**
- Password reset emails
- Account activation
- Alert notifications
- Weekly reports

**Customer Communications:**
- Appointment confirmations
- Invoice emails
- Follow-up surveys
- Thank you messages

### Message Customization

**Editing Templates:**
1. Navigate to **Settings > Templates**
2. Select template category (SMS/Email)
3. Edit template content
4. Preview with sample data
5. Save and activate

**Best Practices:**
- Keep SMS under 160 characters
- Include clear call-to-action
- Always include opt-out option
- Test templates before activation
- Use merge fields for personalization

## Reports & Analytics

### Available Reports

**Daily Operations Report:**
- Jobs completed
- Revenue generated
- Technician performance
- Customer satisfaction scores

**Weekly Summary:**
- Trend analysis
- Capacity utilization
- Customer acquisition
- SMS delivery rates

**Monthly Business Report:**
- Financial summary
- Growth metrics
- Operational efficiency
- Customer retention

**Custom Reports:**
- Date range selection
- Filtered data views
- Exported formats (PDF/CSV)
- Scheduled delivery

### Report Generation

**Accessing Reports:**
```
Reports → [Report Type] → Generate
```

**Configuration Options:**
- Date range selection
- Filter criteria
- Output format
- Delivery method

**Automated Reports:**
- Schedule daily/weekly/monthly reports
- Email delivery to stakeholders
- Dashboard widget integration
- Alert thresholds

### Key Metrics to Monitor

**Operational Metrics:**
- Job completion rate: >95%
- Customer satisfaction: >4.5/5
- SMS delivery rate: >97%
- Technician utilization: 70-85%

**Financial Metrics:**
- Revenue per job
- Customer lifetime value
- Monthly recurring revenue
- Profit margins

**System Metrics:**
- Application uptime: >99.9%
- Response time: <800ms p95
- Error rate: <2%
- SMS compliance: 100%

## Audit & Compliance

### Audit Log Management

**Accessing Audit Logs:**
```
Settings → Audit → Explorer
```

**Log Categories:**
- User actions (login, data changes)
- System events (automated processes)
- Data modifications (before/after values)
- Security events (failed logins, permission changes)

**Search and Filtering:**
- Filter by user
- Filter by action type
- Date range selection
- Text search in log entries

### Compliance Monitoring

**SMS Compliance:**
- STOP/START compliance tracking
- Opt-out list management
- Quiet hours enforcement
- Message content monitoring

**Data Protection:**
- PII handling verification
- Access control auditing
- Data retention policies
- Export/deletion tracking

**Regulatory Requirements:**
- TCPA compliance for SMS
- Data privacy regulations
- Industry-specific requirements
- Documentation maintenance

### Compliance Reports

**Monthly Compliance Report:**
- SMS opt-out statistics
- Failed delivery analysis
- Quiet hours adherence
- User access patterns

**Audit Trail Export:**
- Complete audit log export
- Filtered data exports
- Compliance documentation
- Legal discovery support

## Backup & Disaster Recovery

### Backup Verification

**Daily Backup Checks:**
1. Navigate to **Ops Dashboard**
2. Check backup status indicators
3. Verify last backup timestamp
4. Review any backup failures

**Backup Components:**
- Database (automated Supabase backups)
- File uploads (cloud storage redundancy)
- Configuration data
- User-generated content

### Disaster Recovery Planning

**RTO/RPO Targets:**
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 1 hour
- **Data Loss Tolerance**: <1 hour of transactions

**Recovery Procedures:**
1. **Assessment Phase**
   - Determine scope of outage
   - Identify affected systems
   - Estimate recovery time

2. **Communication Phase**
   - Notify stakeholders
   - Update status page
   - Coordinate with team

3. **Recovery Phase**
   - Execute recovery procedures
   - Validate data integrity
   - Test system functionality

4. **Post-Recovery Phase**
   - Document lessons learned
   - Update procedures
   - Schedule post-mortem

### DR Testing Schedule

**Monthly Tests:**
- Backup restoration testing
- Failover procedure validation
- Contact list verification
- Documentation updates

**Quarterly Tests:**
- Full disaster recovery simulation
- Cross-training validation
- Vendor coordination testing
- Business continuity planning

## Deployment & Operations

### Deployment Process Overview

**Staging Environment:**
- URL: `https://staging.dirt-free-crm.com`
- Auto-deploys from main branch
- Full E2E testing required
- UAT validation

**Production Environment:**
- URL: `https://dirt-free-crm.com`
- Manual deployment only
- Requires staging sign-off
- Comprehensive health checks

### Deployment Responsibilities

**Pre-Deployment:**
- Review staging deployment results
- Verify UAT completion
- Check migration scripts
- Confirm rollback plan

**During Deployment:**
- Monitor deployment pipeline
- Watch for errors or failures
- Communicate status to team
- Coordinate with technical team

**Post-Deployment:**
- Verify system health
- Test critical functions
- Monitor error rates
- Confirm user accessibility

### Release Management

**Release Planning:**
- Feature freeze dates
- Testing schedules
- Communication plans
- Rollback procedures

**Version Control:**
- Semantic versioning (MAJOR.MINOR.PATCH)
- Release notes documentation
- Change log maintenance
- Feature flag management

**Hotfix Procedures:**
- Emergency deployment process
- Expedited testing requirements
- Stakeholder notification
- Post-hotfix validation

## Security & Maintenance

### Security Monitoring

**Daily Security Checks:**
- Review failed login attempts
- Monitor user access patterns
- Check for unusual data access
- Verify system updates

**Security Alerts:**
- Suspicious login activity
- Unusual data export volumes
- Failed API requests
- Potential security violations

### System Maintenance

**Weekly Maintenance:**
- Review system performance
- Check error logs
- Monitor storage usage
- Validate backup integrity

**Monthly Maintenance:**
- User access review
- Permission audit
- Security patch verification
- Performance optimization

**Quarterly Maintenance:**
- Full security audit
- Disaster recovery testing
- Documentation updates
- Training requirement review

### Access Control Management

**Regular Access Reviews:**
- Quarterly user permission audit
- Inactive account identification
- Role appropriateness validation
- Contractor access management

**Security Policies:**
- Password complexity requirements
- Session timeout policies
- Multi-factor authentication
- API access controls

## Troubleshooting

### Common Issues & Solutions

**User Cannot Login:**
1. Verify account is active
2. Check password reset if needed
3. Review failed login logs
4. Verify email address spelling
5. Check for account lockout

**SMS Not Delivering:**
1. Check Twilio account status
2. Verify phone number format
3. Check opt-out list
4. Review quiet hours settings
5. Validate message content

**Performance Issues:**
1. Check ops dashboard metrics
2. Review database performance
3. Monitor API response times
4. Check for high user load
5. Validate caching systems

**Data Sync Issues:**
1. Review audit logs for errors
2. Check integration status
3. Validate webhook endpoints
4. Monitor background jobs
5. Verify data consistency

### Escalation Procedures

**Level 1 - Self-Service:**
- Check documentation
- Review FAQ section
- Use troubleshooting guides
- Check system status

**Level 2 - Internal Support:**
- Contact technical team lead
- Review with development team
- Escalate to vendor support
- Engage external consultants

**Level 3 - Emergency Response:**
- Activate incident response plan
- Engage disaster recovery procedures
- Contact emergency support
- Implement business continuity plan

### Documentation Updates

**Keeping Documentation Current:**
- Review quarterly
- Update after major changes
- Incorporate user feedback
- Maintain version control

**Training Material Updates:**
- Refresh screenshots
- Update procedures
- Add new features
- Remove deprecated items

---

**Last Updated:** [Date] | **Version:** 1.0 | **Next Review:** [Date + 3 months]

<!-- Screenshot placeholders:
- [Admin Dashboard Overview]
- [User Management Interface]
- [System Settings Configuration]
- [Reports Dashboard]
- [Ops Health Monitoring]
- [Audit Log Explorer]
- [Template Management]
- [Backup Status Display]
-->