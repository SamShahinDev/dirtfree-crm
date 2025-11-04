# Access & Ownership Matrix

## Overview

This document defines the access control and ownership structure for all external services and platforms used by the Dirt Free CRM system. It establishes clear accountability, security requirements, and escalation procedures.

**Last Updated**: {date}
**Review Frequency**: Quarterly
**Next Review**: {next_date}

## Ownership Principles

- **Client Ownership**: Customer retains ownership of all vendor accounts
- **Administrative Access**: Development team maintains admin-level access for operations
- **MFA Required**: Multi-factor authentication mandatory for all production accounts
- **Break-Glass**: Emergency access procedures documented for business continuity

## Service Access Matrix

### Core Infrastructure

| Vendor/Service | Product | Account Owner | Our Role | MFA Required | SSO Available | Break-Glass Contact | Rotation Frequency |
|----------------|---------|---------------|----------|--------------|---------------|-------------------|-------------------|
| **Supabase** | Database & Auth | Client | Admin | ✅ Required | ❌ Not Available | support@supabase.io | 90 days |
| **Vercel** | Hosting Platform | Client | Admin | ✅ Required | ✅ GitHub SSO | support@vercel.com | N/A (SSO) |
| **Twilio** | SMS/Voice | Client | Admin | ✅ Required | ❌ Not Available | Emergency Support | 180 days |
| **Sentry** | Error Monitoring | Client | Admin | ✅ Required | ✅ GitHub SSO | support@sentry.io | N/A (SSO) |

### Development & Deployment

| Vendor/Service | Product | Account Owner | Our Role | MFA Required | SSO Available | Break-Glass Contact | Rotation Frequency |
|----------------|---------|---------------|----------|--------------|---------------|-------------------|-------------------|
| **GitHub** | Code Repository | Client | Admin | ✅ Required | N/A (Primary) | GitHub Support | N/A (SSH Keys: 365 days) |
| **npm** | Package Registry | Client | Contributor | ✅ Required | ❌ Not Available | npm Support | 180 days |

### Business Services

| Vendor/Service | Product | Account Owner | Our Role | MFA Required | SSO Available | Break-Glass Contact | Rotation Frequency |
|----------------|---------|---------------|----------|--------------|---------------|-------------------|-------------------|
| **Slack** | Team Communication | Client | Admin | ✅ Required | ✅ Available | Client Admin | N/A (Webhook URLs: 90 days) |

## Access Details

### Supabase
- **Account Level**: Organization Admin
- **Project Access**: Full access to production and staging projects
- **API Keys**: service_role access for application
- **Security**:
  - MFA enforced on console access
  - API keys rotated every 90 days
  - Database backup access restricted
- **Break-Glass**: Direct Supabase support for platform issues

### Vercel
- **Account Level**: Team Admin
- **Project Access**: Owner permissions on CRM deployments
- **Environment Variables**: Full access to production secrets
- **Security**:
  - GitHub SSO enforced
  - MFA required on GitHub account
  - Deploy hooks protected
- **Break-Glass**: Vercel support + GitHub account recovery

### Twilio
- **Account Level**: Account Administrator
- **Subaccounts**: Primary account only (no subaccounts used)
- **API Access**: Main account API Key/Secret
- **Security**:
  - Console MFA enforced
  - API keys rotated every 180 days
  - Webhook signature validation enabled
- **Break-Glass**: Emergency support line + account recovery

### Sentry
- **Account Level**: Organization Owner
- **Project Access**: Admin on error tracking projects
- **Security**:
  - GitHub SSO preferred
  - MFA enforced
  - DSN rotation as needed
- **Break-Glass**: Support ticket + GitHub account recovery

### GitHub
- **Account Level**: Repository Admin
- **Team Membership**: Development team
- **Security**:
  - MFA enforced for all team members
  - SSH keys rotated annually
  - Personal access tokens scoped and rotated
- **Break-Glass**: GitHub support + secondary admin account

## Security Requirements

### Multi-Factor Authentication (MFA)

**Required for all accounts**:
- Authentication app (Google Authenticator, Authy, 1Password)
- Hardware tokens where supported (YubiKey preferred)
- SMS backup only where app unavailable

**MFA Backup Procedures**:
- Recovery codes stored in secure password manager
- Multiple team members with backup access
- Client retains master recovery access

### Password Management

**Requirements**:
- Unique passwords for each service (password manager generated)
- Minimum 16 characters with complexity
- Shared team passwords via secure vault
- No password reuse across services

**Password Manager**:
- Team vault for shared credentials
- Individual vaults for personal access
- Regular security audits of stored credentials

### Access Reviews

**Quarterly Reviews**:
- [ ] Verify current team member access
- [ ] Remove access for departed team members
- [ ] Validate MFA status on all accounts
- [ ] Update contact information
- [ ] Test break-glass procedures

**Annual Reviews**:
- [ ] Full security audit of all accounts
- [ ] Review and update access policies
- [ ] Validate disaster recovery procedures
- [ ] Update emergency contact lists

## Break-Glass Procedures

### Emergency Access Scenarios

1. **Primary Account Compromise**
   - Immediately contact account owner (client)
   - Use secondary admin account if available
   - Contact vendor support for account recovery
   - Document incident for security review

2. **Team Member Unavailable**
   - Use shared team credentials from secure vault
   - Contact client for additional access if needed
   - Escalate to vendor support for time-sensitive issues

3. **Vendor Platform Outage**
   - Monitor vendor status pages
   - Use alternative communication channels
   - Implement backup procedures where available
   - Document impact for post-incident review

### Emergency Contacts

#### Primary Contacts (24/7)
- **Client Primary**: {client_primary_phone}
- **Client Secondary**: {client_secondary_phone}
- **Team Lead**: {team_lead_phone}

#### Vendor Support
- **Supabase**: support@supabase.io (Pro Support)
- **Vercel**: support@vercel.com (Priority Support)
- **Twilio**: Emergency support line + console support
- **Sentry**: support@sentry.io
- **GitHub**: support@github.com

### Escalation Matrix

| Severity | Response Time | Escalation Path |
|----------|---------------|-----------------|
| **Critical** (Production Down) | 15 minutes | Team Lead → Client → Vendor Support |
| **High** (Degraded Service) | 1 hour | Team Member → Team Lead → Client |
| **Medium** (Non-Critical) | 4 hours | Team Member → Team Lead |
| **Low** (Informational) | 24 hours | Standard ticket/email |

## Compliance & Audit

### Access Logging

**Required Logging**:
- All administrative actions in vendor consoles
- API key rotations and usage
- Account access and permission changes
- Emergency access procedures used

**Audit Trail**:
- Quarterly access reviews documented
- All break-glass access logged and justified
- Vendor security notifications tracked
- Compliance violations documented and resolved

### Data Governance

**Data Classification**:
- **Customer PII**: Restricted access, encryption required
- **System Credentials**: Admin-only access, secure storage
- **Application Data**: Role-based access controls
- **Audit Logs**: Restricted access, retention policies

**Privacy Compliance**:
- GDPR/CCPA compliance for customer data
- Data retention policies enforced
- Right to deletion procedures documented
- Privacy impact assessments completed

## Change Management

### Adding New Services

1. **Security Review**
   - Evaluate vendor security practices
   - Review data handling policies
   - Assess integration security requirements

2. **Access Setup**
   - Client creates account with admin access
   - Add development team as administrators
   - Configure MFA and security settings
   - Document in access matrix

3. **Integration**
   - Use least-privilege access principles
   - Implement proper credential rotation
   - Add monitoring and alerting
   - Update disaster recovery procedures

### Removing Services

1. **Data Export**
   - Export all relevant data before decommission
   - Verify backup and recovery procedures
   - Document data retention requirements

2. **Access Revocation**
   - Remove all team member access
   - Revoke API keys and tokens
   - Update access matrix documentation
   - Notify client of account status

## Maintenance Activities

### Monthly
- [ ] Review access logs for anomalies
- [ ] Verify MFA status on critical accounts
- [ ] Update emergency contact information

### Quarterly
- [ ] Complete full access review
- [ ] Test break-glass procedures
- [ ] Rotate credentials per schedule
- [ ] Update documentation

### Annually
- [ ] Security audit of all vendor relationships
- [ ] Review and update access policies
- [ ] Disaster recovery testing
- [ ] Compliance assessment

---

**Document Classification**: Confidential
**Owner**: Security Team
**Stakeholders**: DevOps, Client, Legal
**Distribution**: Authorized Personnel Only