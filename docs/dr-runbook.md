# Disaster Recovery Runbook

## Overview

This runbook defines the procedures for backing up production data, restoring to staging environments, and validating system integrity through automated smoke tests.

**Frequency**: Quarterly (every 3 months)
**Last Updated**: {date}
**Next Scheduled Drill**: {next_date}

## Scope

- **Production Database**: Complete PostgreSQL schema and data backup
- **Production Storage**: Supabase Storage buckets (uploads, invoices, maintenance)
- **Staging Restore**: Full environment recreation with data masking
- **Smoke Tests**: Critical API endpoint validation
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 1 hour

## Roles & Responsibilities (RACI)

| Task | DevOps Lead | Platform Admin | QA Lead | Business Owner |
|------|-------------|----------------|---------|----------------|
| Backup Execution | R | A | I | I |
| Staging Restore | R | A | C | I |
| Smoke Test Validation | A | R | R | I |
| Go/No-Go Decision | C | A | R | R |
| Rollback Authorization | C | A | I | R |

**Legend**: R=Responsible, A=Accountable, C=Consulted, I=Informed

## Prerequisites

- [ ] Supabase CLI configured for production and staging projects
- [ ] Production credentials available in secure vault
- [ ] Staging environment provisioned and accessible
- [ ] Network connectivity to all required services
- [ ] Backup storage location accessible (minimum 7-day retention)

## Backup Procedures

### 1. Database Backup

```bash
# Execute production backup
make backup-prod

# Manual execution:
./scripts/backup_prod.sh
```

**Backup Includes**:
- Complete PostgreSQL schema (tables, views, functions, triggers)
- All application data with referential integrity
- User authentication data (will be masked in staging)
- Audit logs and communication history
- System configuration and feature flags

**Verification**:
- Backup file size > 100MB (approximate production size)
- No SQL errors in backup log
- Backup completed within 15 minutes

### 2. Storage Backup

**Buckets Backed Up**:
- `uploads`: Customer document attachments
- `invoices`: Generated invoice PDFs
- `maintenance`: Before/after photos and documentation

**Process**:
- Export storage manifests (object keys and metadata)
- Document file counts and total sizes
- Storage files themselves remain in production (manifests allow recreation)

## Restore Procedures

### 1. Staging Environment Preparation

```bash
# Execute complete restore to staging
make restore-staging

# Manual execution:
./scripts/restore_to_staging.sh
```

**Restore Process**:
1. **Schema Recreation**: Drop and recreate staging database
2. **Data Import**: Load production backup with full referential integrity
3. **Data Masking**: Anonymize PII for staging safety
4. **Storage Setup**: Recreate bucket structure from manifests
5. **Migration Check**: Apply any pending database migrations
6. **Smoke Tests**: Validate critical functionality

### 2. Data Masking Rules

**Applied During Restore**:
- Email addresses → `test-{id}@example.com`
- Phone numbers → `+1000000{id}`
- Customer names → `Test Customer {id}`
- Clear all authentication sessions
- Reset all API keys and tokens to staging values

**Preserved Data**:
- Job scheduling and workflow logic
- System configuration
- Non-PII operational data
- Audit log structure (content masked)

## Smoke Test Procedures

### Automated Tests

```bash
# Run smoke test suite
make smoke

# Manual execution:
./scripts/smoke_tests.sh
```

### Test Coverage

| Endpoint | Expected Result | Validation |
|----------|----------------|------------|
| `/api/health` | 200 + `{ok:true}` | System basic health |
| `/api/ready` | 200 + checks passing | Database connectivity |
| `/api/ops/samples` | 200 + numeric metrics | SLO monitoring active |
| `/api/reports/upcoming-reminders` | 200 + CSV headers | Report generation |
| `/api/uploads/sign` | 401/403 (unauthorized) | Authentication working |

### Manual Validation Checklist

- [ ] Application loads without console errors
- [ ] User authentication flow works
- [ ] Job scheduling interface functional
- [ ] Communication templates render correctly
- [ ] Reports generate without errors
- [ ] File uploads/downloads work
- [ ] SMS integration responds (test mode)

### Pass Criteria

**All tests must pass with**:
- Response times < 2 seconds for all endpoints
- No 5xx server errors
- Authentication properly enforced
- Database queries executing successfully
- No missing critical data relationships

## Rollback Procedures

### If Staging Restore Fails

1. **Immediate Actions**:
   - Document failure symptoms and error messages
   - Preserve failed staging environment for debugging
   - Notify stakeholders of drill status

2. **Investigation Steps**:
   ```bash
   # Check backup integrity
   pg_restore --list /path/to/backup.sql | head -20

   # Validate staging connectivity
   supabase status --project-ref $STAGING_REF

   # Review error logs
   tail -100 /tmp/restore.log
   ```

3. **Recovery Options**:
   - Retry with fresh staging environment
   - Use previous day's backup if corruption suspected
   - Escalate to Supabase support if platform issue

### If Production Issues Occur

**During backup window**:
- Monitor production performance during backup
- Have rollback plan if backup impacts production
- Emergency stop procedures documented

**Post-drill issues**:
- Validate production remains untouched
- Confirm no credential exposure
- Review and update procedures based on findings

## Emergency Contacts

| Role | Primary | Secondary | Escalation |
|------|---------|-----------|------------|
| DevOps Lead | {primary_contact} | {secondary_contact} | {manager} |
| Supabase Support | support@supabase.io | Pro Support Portal | Emergency Hotline |
| Platform Owner | {platform_owner} | {backup_owner} | {executive_sponsor} |

## Post-Drill Activities

### Documentation Updates

- [ ] Update runbook with lessons learned
- [ ] Revise time estimates based on actual performance
- [ ] Update contact information if changed
- [ ] Document any new failure modes discovered

### Process Improvements

- [ ] Review automation opportunities
- [ ] Assess backup/restore performance
- [ ] Update monitoring and alerting based on findings
- [ ] Schedule follow-up improvements

### Reporting

**Drill Report Template**:
```
DR Drill Execution Report - {date}

Executive Summary:
- Drill Status: [PASS/FAIL]
- Total Duration: {duration}
- Issues Encountered: {count}

Metrics:
- Backup Duration: {backup_time}
- Restore Duration: {restore_time}
- Smoke Test Results: {pass_count}/{total_count}

Recommendations:
1. {recommendation_1}
2. {recommendation_2}
3. {recommendation_3}

Next Drill Date: {next_date}
```

## Compliance & Audit

- All backup operations logged with timestamps
- Access to production data tracked and audited
- Data masking verified to meet privacy requirements
- Drill results retained for compliance reporting
- Annual review of RTO/RPO targets

## Quick Reference Commands

```bash
# Complete DR drill
make backup-prod && make restore-staging && make smoke

# Individual components
make backup-prod        # Backup production data
make restore-staging    # Restore to staging with masking
make smoke             # Run smoke tests
make rotate-twilio     # Rotate Twilio credentials
make sentry-scrub-test # Test PII scrubbing

# Emergency read-only connection
psql $PROD_DB_URL_READONLY -c "SELECT version();"
```

---

**Document Version**: 1.0
**Maintained By**: DevOps Team
**Review Cycle**: Quarterly
**Classification**: Internal Use