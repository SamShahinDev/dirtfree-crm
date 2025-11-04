# Database Schema

Complete database schema documentation for Dirt Free CRM.

## Table of Contents

1. [Overview](#overview)
2. [Core Tables](#core-tables)
3. [Opportunities](#opportunities)
4. [Promotions](#promotions)
5. [Reviews](#reviews)
6. [Loyalty & Referrals](#loyalty--referrals)
7. [Chatbot & Support](#chatbot--support)
8. [Monitoring & Logs](#monitoring--logs)
9. [Reports](#reports)
10. [Views](#views)
11. [Functions](#functions)
12. [Relationships](#relationships)

---

## Overview

**Database:** PostgreSQL 15
**Total Tables:** 30+
**Security:** Row Level Security (RLS) enabled on all tables
**Real-time:** Supabase real-time subscriptions enabled

---

## Core Tables

### customers

Customer information and profile data.

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  points_balance INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_tier ON customers(tier);
```

**Columns:**
- `id`: Unique customer identifier
- `first_name`, `last_name`: Customer name
- `email`: Unique email address
- `phone`: Contact phone number
- `tier`: Loyalty tier (bronze, silver, gold, platinum)
- `points_balance`: Current loyalty points
- `lifetime_points`: Total earned points
- `preferences`: Customer preferences (JSONB)

### users

System users (admins, staff).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'staff',
  full_name VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### user_profiles

Extended user data.

```sql
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'staff',
  department VARCHAR(100),
  phone VARCHAR(20),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### user_permissions

Granular permissions for users.

```sql
CREATE TABLE user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  UNIQUE(user_id, permission)
);

CREATE INDEX idx_user_permissions_user ON user_permissions(user_id);
```

**Permission Format:** `resource:action`
**Examples:**
- `opportunities:view`
- `opportunities:edit`
- `promotions:manage`
- `analytics:view_all`

---

## Opportunities

### missed_opportunities

Detected missed opportunities.

```sql
CREATE TABLE missed_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  opportunity_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'lost')),
  estimated_value DECIMAL(10,2),
  notes TEXT,
  contacted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_customer ON missed_opportunities(customer_id);
CREATE INDEX idx_opportunities_status ON missed_opportunities(status);
CREATE INDEX idx_opportunities_type ON missed_opportunities(opportunity_type);
```

**Opportunity Types:**
- `missed_appointment`
- `no_show`
- `declined_service`
- `price_shopping`
- `service_gap`
- `upsell_potential`

### opportunity_interactions

Follow-up history.

```sql
CREATE TABLE opportunity_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES missed_opportunities(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL,
  method VARCHAR(20),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactions_opportunity ON opportunity_interactions(opportunity_id);
```

### opportunity_offers

Generated offers.

```sql
CREATE TABLE opportunity_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES missed_opportunities(id) ON DELETE CASCADE,
  offer_type VARCHAR(50) NOT NULL,
  discount_value DECIMAL(10,2),
  valid_until TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Promotions

### promotions

Promotion definitions.

```sql
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  promotion_type VARCHAR(50) NOT NULL,
  discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed', 'free_service')),
  discount_value DECIMAL(10,2),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  target_tiers TEXT[] DEFAULT ARRAY['bronze', 'silver', 'gold', 'platinum'],
  restrictions TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_promotions_valid ON promotions(valid_from, valid_until);
CREATE INDEX idx_promotions_type ON promotions(promotion_type);
```

**Promotion Types:**
- `seasonal`
- `loyalty_reward`
- `win_back`
- `referral`
- `birthday`
- `anniversary`

### promotion_deliveries

Delivery tracking.

```sql
CREATE TABLE promotion_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  delivery_method VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  delivered_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  promotion_code VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deliveries_promotion ON promotion_deliveries(promotion_id);
CREATE INDEX idx_deliveries_customer ON promotion_deliveries(customer_id);
CREATE INDEX idx_deliveries_status ON promotion_deliveries(status);
```

### promotion_analytics

Performance metrics.

```sql
CREATE TABLE promotion_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  delivered INTEGER DEFAULT 0,
  viewed INTEGER DEFAULT 0,
  claimed INTEGER DEFAULT 0,
  used INTEGER DEFAULT 0,
  revenue_generated DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Reviews

### review_requests

Sent review requests.

```sql
CREATE TABLE review_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  job_id UUID,
  request_token VARCHAR(100) UNIQUE NOT NULL,
  delivery_method VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_requests_customer ON review_requests(customer_id);
CREATE INDEX idx_review_requests_status ON review_requests(status);
CREATE INDEX idx_review_requests_token ON review_requests(request_token);
```

### review_responses

Customer responses.

```sql
CREATE TABLE review_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES review_requests(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  would_recommend BOOLEAN,
  improvement_areas TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_responses_request ON review_responses(request_id);
CREATE INDEX idx_review_responses_rating ON review_responses(rating);
```

### google_reviews

Synced Google reviews.

```sql
CREATE TABLE google_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_review_id VARCHAR(255) UNIQUE NOT NULL,
  author_name VARCHAR(255),
  author_photo_url TEXT,
  rating INTEGER NOT NULL,
  text TEXT,
  time TIMESTAMPTZ NOT NULL,
  reply_text TEXT,
  reply_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_google_reviews_rating ON google_reviews(rating);
CREATE INDEX idx_google_reviews_time ON google_reviews(time DESC);
```

---

## Loyalty & Referrals

### loyalty_tiers

Tier definitions.

```sql
CREATE TABLE loyalty_tiers (
  tier_name VARCHAR(20) PRIMARY KEY,
  points_required INTEGER NOT NULL,
  benefits JSONB NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO loyalty_tiers (tier_name, points_required, benefits, display_order) VALUES
  ('bronze', 0, '{"discount": 0, "priority_booking": false}', 1),
  ('silver', 1000, '{"discount": 5, "priority_booking": false}', 2),
  ('gold', 2500, '{"discount": 10, "priority_booking": true}', 3),
  ('platinum', 5000, '{"discount": 15, "priority_booking": true}', 4);
```

### loyalty_transactions

Points history.

```sql
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earned', 'redeemed', 'expired', 'adjusted')),
  points INTEGER NOT NULL,
  description TEXT NOT NULL,
  source VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_transactions_type ON loyalty_transactions(transaction_type);
```

### loyalty_achievements

Available achievements.

```sql
CREATE TABLE loyalty_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  points_reward INTEGER NOT NULL,
  criteria JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### customer_achievements

Earned achievements.

```sql
CREATE TABLE customer_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES loyalty_achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, achievement_id)
);

CREATE INDEX idx_customer_achievements_customer ON customer_achievements(customer_id);
```

### referrals

Referral tracking.

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  referred_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  referred_email VARCHAR(255) NOT NULL,
  referred_name VARCHAR(200),
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'expired')),
  converted_at TIMESTAMPTZ,
  points_awarded INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);
```

### loyalty_rewards

Reward catalog.

```sql
CREATE TABLE loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL,
  reward_type VARCHAR(50) NOT NULL,
  reward_value DECIMAL(10,2),
  availability_count INTEGER,
  available_from TIMESTAMPTZ,
  available_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### loyalty_redemptions

Redemption history.

```sql
CREATE TABLE loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  points_redeemed INTEGER NOT NULL,
  redemption_code VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_redemptions_customer ON loyalty_redemptions(customer_id);
CREATE INDEX idx_redemptions_code ON loyalty_redemptions(redemption_code);
```

---

## Chatbot & Support

### chatbot_interactions

Chat history.

```sql
CREATE TABLE chatbot_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  intent VARCHAR(100),
  confidence DECIMAL(3,2),
  escalated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chatbot_customer ON chatbot_interactions(customer_id);
CREATE INDEX idx_chatbot_escalated ON chatbot_interactions(escalated);
```

### message_templates

Template library.

```sql
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  subject VARCHAR(255),
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_category ON message_templates(category);
```

### support_tickets

Support tracking.

```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'open',
  assigned_to UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_customer ON support_tickets(customer_id);
CREATE INDEX idx_tickets_status ON support_tickets(status);
```

---

## Monitoring & Logs

### uptime_logs

Health check history.

```sql
CREATE TABLE uptime_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(20) NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
  response_time INTEGER NOT NULL,
  errors TEXT[],
  checks JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uptime_logs_checked_at ON uptime_logs(checked_at DESC);
CREATE INDEX idx_uptime_logs_status ON uptime_logs(status);
```

### alert_history

System alerts.

```sql
CREATE TABLE alert_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_name VARCHAR(255) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  details JSONB,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_history_triggered_at ON alert_history(triggered_at DESC);
CREATE INDEX idx_alert_history_severity ON alert_history(severity);
```

### cron_job_logs

Cron execution logs.

```sql
CREATE TABLE cron_job_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cron_logs_job_started ON cron_job_logs(job_name, started_at DESC);
```

### audit_logs

Security audit trail.

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### portal_activity_logs

Customer activity.

```sql
CREATE TABLE portal_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_portal_activity_customer ON portal_activity_logs(customer_id);
CREATE INDEX idx_portal_activity_type ON portal_activity_logs(activity_type);
```

---

## Reports

### scheduled_reports

Report configurations.

```sql
CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL CHECK (
    report_type IN (
      'revenue_summary',
      'customer_activity',
      'opportunity_pipeline',
      'promotion_performance',
      'loyalty_engagement'
    )
  ),
  schedule VARCHAR(50) NOT NULL,
  recipients TEXT[] NOT NULL,
  filters JSONB,
  format VARCHAR(20) NOT NULL CHECK (format IN ('pdf', 'csv', 'excel')),
  enabled BOOLEAN DEFAULT TRUE,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_reports_enabled ON scheduled_reports(enabled);
```

### report_generation_log

Generation history.

```sql
CREATE TABLE report_generation_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL,
  recipients TEXT[],
  file_name VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_log_scheduled ON report_generation_log(scheduled_report_id, generated_at DESC);
```

---

## Views

### current_system_status

Current system health (last 5 minutes).

```sql
CREATE VIEW current_system_status AS
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'down') > 0 THEN 'down'
    WHEN COUNT(*) FILTER (WHERE status = 'degraded') > 0 THEN 'degraded'
    ELSE 'up'
  END AS status,
  AVG(response_time) AS avg_response_time,
  MAX(checked_at) AS last_check,
  COUNT(*) AS check_count
FROM uptime_logs
WHERE checked_at > NOW() - INTERVAL '5 minutes';
```

### unresolved_alerts

All unresolved alerts.

```sql
CREATE VIEW unresolved_alerts AS
SELECT
  id,
  alert_name,
  severity,
  message,
  triggered_at,
  AGE(NOW(), triggered_at) AS time_since_triggered
FROM alert_history
WHERE resolved = FALSE
ORDER BY
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'warning' THEN 2
    WHEN 'info' THEN 3
  END,
  triggered_at DESC;
```

### cron_job_success_rates

Job statistics (last 30 days).

```sql
CREATE VIEW cron_job_success_rates AS
SELECT
  job_name,
  COUNT(*) FILTER (WHERE status = 'completed') AS successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs,
  COUNT(*) AS total_runs,
  ROUND(
    (COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100,
    2
  ) AS success_rate
FROM cron_job_logs
WHERE started_at > NOW() - INTERVAL '30 days'
GROUP BY job_name;
```

---

## Functions

### get_uptime_percentage

Calculate uptime for a period.

```sql
CREATE FUNCTION get_uptime_percentage(
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'up')::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC) * 100,
      2
    ),
    100.0
  )
  FROM uptime_logs
  WHERE checked_at BETWEEN p_start_time AND p_end_time;
$$;
```

### award_loyalty_points

Award points to customer.

```sql
CREATE FUNCTION award_loyalty_points(
  p_customer_id UUID,
  p_points INTEGER,
  p_description TEXT,
  p_source VARCHAR DEFAULT 'manual'
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
AS $$
BEGIN
  -- Insert transaction
  INSERT INTO loyalty_transactions (
    customer_id,
    transaction_type,
    points,
    description,
    source
  ) VALUES (
    p_customer_id,
    'earned',
    p_points,
    p_description,
    p_source
  );

  -- Update customer balance
  UPDATE customers
  SET
    points_balance = points_balance + p_points,
    lifetime_points = lifetime_points + p_points,
    updated_at = NOW()
  WHERE id = p_customer_id;

  RETURN TRUE;
END;
$$;
```

### check_tier_upgrade

Check if customer qualifies for tier upgrade.

```sql
CREATE FUNCTION check_tier_upgrade(p_customer_id UUID)
RETURNS VARCHAR
LANGUAGE PLPGSQL
AS $$
DECLARE
  v_current_points INTEGER;
  v_new_tier VARCHAR;
BEGIN
  SELECT lifetime_points INTO v_current_points
  FROM customers
  WHERE id = p_customer_id;

  SELECT tier_name INTO v_new_tier
  FROM loyalty_tiers
  WHERE points_required <= v_current_points
  ORDER BY points_required DESC
  LIMIT 1;

  RETURN v_new_tier;
END;
$$;
```

---

## Relationships

### Entity Relationship Diagram

```
customers
  ├─→ missed_opportunities
  ├─→ promotion_deliveries
  ├─→ review_requests
  ├─→ loyalty_transactions
  ├─→ customer_achievements
  ├─→ referrals (as referrer)
  ├─→ loyalty_redemptions
  ├─→ chatbot_interactions
  └─→ portal_activity_logs

users
  ├─→ user_profiles
  ├─→ user_permissions
  └─→ audit_logs

promotions
  ├─→ promotion_deliveries
  └─→ promotion_analytics

missed_opportunities
  ├─→ opportunity_interactions
  └─→ opportunity_offers
```

---

**Last Updated:** 2025-01-24

**Schema Version:** 1.0.0
