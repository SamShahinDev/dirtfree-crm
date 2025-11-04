# Secrets Rotation Playbook

## Overview

This playbook defines procedures for rotating critical application secrets including Supabase service role keys, Twilio API credentials, and other sensitive tokens used by the Dirt Free CRM system.

**Rotation Frequency**:
- Critical secrets (Supabase service_role): Every 90 days
- API credentials (Twilio): Every 180 days
- Webhook tokens: Every 90 days
- Emergency rotation: As needed for security incidents

## Risk Assessment

### Blast Radius Mitigation

| Secret Type | Impact if Compromised | Mitigation Strategy |
|-------------|----------------------|-------------------|
| Supabase service_role | Full database access | Immediate rotation + audit logs |
| Twilio API Key | SMS/voice capabilities | Rate limiting + webhook validation |
| Webhook secrets | Message tampering | Signature validation + retry logic |
| Sentry DSN | Error log access | Read-only impact, rotate if needed |

## Pre-Rotation Checklist

- [ ] Backup current working configuration
- [ ] Verify staging environment for testing
- [ ] Schedule maintenance window if needed
- [ ] Prepare rollback procedures
- [ ] Notify relevant team members
- [ ] Document current secret identifiers (not values)

## Supabase Service Role Rotation

### Overview
The service_role key provides full database access bypassing RLS. Rotation requires careful coordination to avoid service disruption.

### Manual Process (Supabase Console)

1. **Access Supabase Console**
   ```bash
   # Login to Supabase console
   open "https://app.supabase.com/project/{project_id}/settings/api"
   ```

2. **Generate New Service Role Key**
   - Navigate to Project Settings → API
   - Locate "service_role" in API Keys section
   - Click "Regenerate token"
   - **CRITICAL**: Copy new token immediately (shown only once)
   - Document new key identifier (not the key value)

3. **Update Environment Variables**
   ```bash
   # Update production environment
   # DO NOT commit these values to git
   SUPABASE_SERVICE_ROLE_KEY=eyJ... # New key value

   # Update staging environment
   STAGING_SUPABASE_SERVICE_ROLE_KEY=eyJ... # Same new key or separate staging key
   ```

4. **Deploy and Verify**
   ```bash
   # Deploy to staging first
   vercel deploy --target staging

   # Run verification tests
   curl -H "Authorization: Bearer $NEW_SERVICE_ROLE_KEY" \
        "$SUPABASE_URL/rest/v1/customers?select=count"

   # Deploy to production
   vercel deploy --target production
   ```

5. **Verify RLS and Functionality**
   ```bash
   # Test RLS bypass (service_role should work)
   # Test application functionality
   # Check audit logs for any access issues

   # Validate key rotation in application
   make smoke
   ```

6. **Cache Invalidation**
   - Clear any cached connections
   - Restart application instances if needed
   - Verify no old credentials remain in memory

### Automation Considerations

```typescript
// Future: Automated rotation via Supabase Management API
// Currently requires manual console access
// Track: https://github.com/supabase/supabase/discussions/...
```

## Twilio API Key Rotation

### Overview
Twilio uses API Key/Secret pairs that can be programmatically managed. The system supports multiple active keys during transition.

### Automated Process

1. **Generate New API Key**
   ```bash
   # Use rotation script
   ./scripts/twilio_rotate_key.ts

   # Script will:
   # - Create new API Key via Twilio REST API
   # - Output Key SID (safe to log)
   # - Generate .env.local.patch with placeholders
   # - Preserve old key for safe transition
   ```

2. **Update Environment Variables**
   ```bash
   # Script generates patch file:
   cat .env.local.patch
   # TWILIO_API_KEY_SID=SK...
   # TWILIO_API_KEY_SECRET=***REPLACE_WITH_SECURE_VALUE***

   # Update production secrets (secure method)
   # Vercel: vercel env add TWILIO_API_KEY_SID
   # Or your deployment platform's secret management
   ```

3. **Verify Webhook Signatures**
   ```bash
   # Test webhook signature validation with new credentials
   curl -X POST localhost:3000/api/twilio/inbound \
        -H "X-Twilio-Signature: ..." \
        -d "MessageSid=test&From=%2B15555551234&Body=test"

   # Should return 200, not 401 signature validation error
   ```

4. **Revoke Old Key (After Verification)**
   ```bash
   # Only after confirming new key works
   ./scripts/twilio_rotate_key.ts --revoke-key SK_OLD_KEY_SID --confirm

   # Script requires --confirm flag to prevent accidental revocation
   ```

### Manual Twilio Rotation (Fallback)

If automation fails:

1. **Twilio Console Access**
   ```bash
   open "https://console.twilio.com/us1/develop/api-keys-credentials/api-keys"
   ```

2. **Create New API Key**
   - Click "Create new API Key"
   - Name: "CRM-Production-{YYYY-MM-DD}"
   - Copy Key SID and Secret (shown only once)

3. **Update Application Configuration**
   - Follow same verification steps as automated process
   - Manually revoke old key after successful deployment

## Webhook Secret Rotation

### Slack Webhook URL
```bash
# Update Slack webhook URL if compromised
# 1. Generate new webhook in Slack workspace settings
# 2. Update SLACK_WEBHOOK_URL environment variable
# 3. Test alert delivery
make sentry-scrub-test  # Includes Slack alert test
```

### Twilio Webhook Validation
```bash
# Webhook signatures use Account Auth Token (not API Key)
# Rotation requires Twilio console access:
# 1. Navigate to Account → General Settings
# 2. Reset Auth Token (impacts all webhooks)
# 3. Update TWILIO_AUTH_TOKEN in environment
# 4. Verify all webhook endpoints still validate correctly
```

## Emergency Rotation Procedures

### Security Incident Response

1. **Immediate Actions** (< 15 minutes)
   ```bash
   # Rotate compromised credential immediately
   # Use manual process if automation unavailable
   # Document incident for post-mortem
   ```

2. **Impact Assessment** (< 1 hour)
   ```bash
   # Check audit logs for unauthorized access
   # Verify no data exfiltration
   # Assess need for customer notification
   ```

3. **Recovery Validation** (< 2 hours)
   ```bash
   # Run full smoke test suite
   make smoke

   # Verify all integrations working
   # Check error rates and system health
   ```

## Communication Templates

### Planned Rotation Notification

```
Subject: Scheduled Secrets Rotation - {Service Name}

Team,

Scheduled secrets rotation for {service} will occur:
- Date: {date}
- Time: {time} UTC
- Duration: {estimated_duration}
- Impact: {expected_impact}

Pre-work completed:
- Staging validation: ✓
- Rollback plan: ✓
- Monitoring: ✓

Contact {owner} with questions.
```

### Emergency Rotation Notification

```
Subject: URGENT - Emergency Secrets Rotation

Team,

Emergency secrets rotation in progress:
- Service: {service}
- Trigger: {security_incident_summary}
- Status: {current_status}
- ETA: {completion_time}

Actions taken:
- Compromised credential revoked: {timestamp}
- New credential deployed: {timestamp}
- Verification: {status}

Updates every 30 minutes until resolved.
```

## Validation and Testing

### Post-Rotation Verification

```bash
# Database connectivity (Supabase)
npm test -- --testNamePattern="database connection"

# API functionality (Twilio)
npm test -- --testNamePattern="sms integration"

# Webhook signature validation
curl -X POST {webhook_endpoint} -H "X-Signature: {test_signature}"

# End-to-end smoke tests
make smoke
```

### Monitoring Post-Rotation

- [ ] Error rates within normal bounds (< 1% increase)
- [ ] Response times stable (< 10% increase)
- [ ] No authentication failures in logs
- [ ] All integrations reporting healthy
- [ ] SLO metrics within targets

## Automation and Tooling

### Rotation Scripts Location
```
scripts/
├── twilio_rotate_key.ts      # Automated Twilio rotation
├── supabase_rotate_key.sh    # Future: Supabase automation
└── verify_rotation.sh        # Post-rotation validation
```

### Monitoring Integration
```bash
# Set up alerts for rotation events
# Monitor for authentication failures post-rotation
# Track rotation compliance (overdue secrets)
```

## Compliance and Audit

### Rotation Tracking

| Secret | Last Rotated | Next Due | Owner | Status |
|--------|-------------|----------|-------|--------|
| Supabase service_role | {date} | {date} | DevOps | Current |
| Twilio API Key | {date} | {date} | DevOps | Current |
| Slack Webhook | {date} | {date} | DevOps | Current |

### Audit Requirements

- All rotations logged with timestamps
- No secrets in plaintext logs or git history
- Failed rotation attempts documented
- Emergency rotations require incident reports
- Quarterly review of rotation procedures

## Security Best Practices

### Secret Storage
- Use secure secret management (Vercel Secrets, AWS Secrets Manager, etc.)
- Never commit secrets to version control
- Rotate secrets in staging first when possible
- Maintain separate staging/production secrets

### Access Control
- Limit who can perform rotations
- Require two-person authorization for emergency rotations
- Use break-glass procedures for after-hours emergencies
- Document all access and changes

### Backup and Recovery
- Keep secure backup of working configuration during rotation
- Test rollback procedures quarterly
- Document dependencies between secrets
- Maintain emergency contact list

---

**Document Version**: 1.0
**Last Updated**: {date}
**Next Review**: {date}
**Owner**: DevOps Team
**Classification**: Confidential