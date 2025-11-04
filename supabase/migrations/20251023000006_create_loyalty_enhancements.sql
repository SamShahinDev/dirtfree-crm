-- ============================================================================
-- Enhanced Loyalty and Referral System
-- ============================================================================
-- Creates comprehensive loyalty tiers, achievements, and referral tracking
-- ============================================================================

-- ============================================================================
-- Loyalty Tiers Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name VARCHAR(50) UNIQUE NOT NULL, -- 'Bronze', 'Silver', 'Gold', 'Platinum'
  tier_level INTEGER UNIQUE NOT NULL, -- 1, 2, 3, 4
  points_required INTEGER NOT NULL,
  benefits JSONB,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  free_upgrades TEXT[],
  priority_scheduling BOOLEAN DEFAULT false,
  icon_url TEXT,
  color VARCHAR(20),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for loyalty tiers
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_level ON loyalty_tiers(tier_level);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_points ON loyalty_tiers(points_required);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_active ON loyalty_tiers(active);

-- ============================================================================
-- Loyalty Achievements/Badges Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS loyalty_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_name VARCHAR(100) UNIQUE NOT NULL,
  achievement_description TEXT,
  achievement_type VARCHAR(30), -- 'milestone', 'streak', 'referral', 'review', 'social'
  requirements JSONB,
  points_award INTEGER DEFAULT 0,
  badge_icon_url TEXT,
  rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for achievements
CREATE INDEX IF NOT EXISTS idx_loyalty_achievements_type ON loyalty_achievements(achievement_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_achievements_rarity ON loyalty_achievements(rarity);
CREATE INDEX IF NOT EXISTS idx_loyalty_achievements_active ON loyalty_achievements(active);

-- ============================================================================
-- Customer Achievement Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES loyalty_achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  points_awarded INTEGER,
  metadata JSONB, -- Additional data about how achievement was earned
  UNIQUE(customer_id, achievement_id)
);

-- Indexes for customer achievements
CREATE INDEX IF NOT EXISTS idx_customer_achievements_customer ON customer_achievements(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_achievements_achievement ON customer_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_customer_achievements_earned ON customer_achievements(earned_at);

-- ============================================================================
-- Referrals Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) UNIQUE NOT NULL,

  -- Referred customer
  referred_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  referred_email VARCHAR(255),
  referred_name VARCHAR(255),

  -- Tracking
  referral_link TEXT,
  referral_sent_via VARCHAR(20), -- 'email', 'sms', 'social', 'manual'
  referral_sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Conversion tracking
  referred_customer_registered BOOLEAN DEFAULT false,
  registered_at TIMESTAMPTZ,
  referred_customer_booked BOOLEAN DEFAULT false,
  first_booking_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  booked_at TIMESTAMPTZ,
  referred_customer_completed BOOLEAN DEFAULT false,
  first_service_completed_at TIMESTAMPTZ,

  -- Rewards
  referrer_points_awarded INTEGER,
  referrer_points_awarded_at TIMESTAMPTZ,
  referred_discount_code VARCHAR(50),
  referred_discount_used BOOLEAN DEFAULT false,
  referred_discount_used_at TIMESTAMPTZ,

  status VARCHAR(20) DEFAULT 'pending', -- pending, registered, booked, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for referrals
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_customer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_sent_at ON referrals(referral_sent_at);

-- ============================================================================
-- Update Timestamp Triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loyalty_tiers_timestamp
  BEFORE UPDATE ON loyalty_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_achievements_timestamp
  BEFORE UPDATE ON loyalty_achievements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referrals_timestamp
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Seed Loyalty Tiers
-- ============================================================================

INSERT INTO loyalty_tiers (tier_name, tier_level, points_required, benefits, discount_percentage, free_upgrades, priority_scheduling, color) VALUES
(
  'Bronze',
  1,
  0,
  '{
    "welcome_gift": "5% off first service",
    "birthday_discount": "10% off birthday month",
    "email_updates": true,
    "member_portal_access": true
  }'::JSONB,
  5.00,
  ARRAY[]::TEXT[],
  false,
  '#CD7F32'
),
(
  'Silver',
  2,
  1000,
  '{
    "discount": "10% off all services",
    "birthday_discount": "15% off birthday month",
    "priority_support": true,
    "quarterly_newsletter": true,
    "exclusive_promotions": true,
    "free_stain_protection": "On annual service"
  }'::JSONB,
  10.00,
  ARRAY['stain_protection_annual'],
  false,
  '#C0C0C0'
),
(
  'Gold',
  3,
  2500,
  '{
    "discount": "15% off all services",
    "birthday_discount": "20% off birthday month",
    "priority_scheduling": true,
    "priority_support": true,
    "free_room_upgrade": "One free room per service",
    "annual_deep_clean_discount": "25% off once per year",
    "referral_bonus": "Double referral points",
    "vip_promotions": true
  }'::JSONB,
  15.00,
  ARRAY['stain_protection', 'deodorizing', 'one_extra_room_per_service'],
  true,
  '#FFD700'
),
(
  'Platinum',
  4,
  5000,
  '{
    "discount": "20% off all services",
    "birthday_discount": "25% off birthday month",
    "priority_scheduling": "First priority for all bookings",
    "priority_support": "Dedicated account manager",
    "free_room_upgrade": "Two free rooms per service",
    "free_upholstery": "One furniture item per service",
    "annual_deep_clean": "Free annual deep clean (up to 5 rooms)",
    "referral_bonus": "Triple referral points",
    "vip_events": "Exclusive VIP events and promotions",
    "lifetime_guarantee": "Lifetime satisfaction guarantee"
  }'::JSONB,
  20.00,
  ARRAY['stain_protection', 'deodorizing', 'scotchgard', 'two_extra_rooms_per_service', 'one_furniture_item'],
  true,
  '#E5E4E2'
)
ON CONFLICT (tier_name) DO NOTHING;

-- ============================================================================
-- Seed Loyalty Achievements
-- ============================================================================

INSERT INTO loyalty_achievements (achievement_name, achievement_description, achievement_type, requirements, points_award, rarity) VALUES

-- Milestone Achievements
(
  'First Service',
  'Complete your first service with us',
  'milestone',
  '{"services_completed": 1}'::JSONB,
  50,
  'common'
),
(
  '5 Services Strong',
  'Complete 5 services',
  'milestone',
  '{"services_completed": 5}'::JSONB,
  100,
  'common'
),
(
  '10 Service Veteran',
  'Complete 10 services',
  'milestone',
  '{"services_completed": 10}'::JSONB,
  250,
  'rare'
),
(
  '25 Service Champion',
  'Complete 25 services',
  'milestone',
  '{"services_completed": 25}'::JSONB,
  500,
  'epic'
),
(
  '50 Service Legend',
  'Complete 50 services',
  'milestone',
  '{"services_completed": 50}'::JSONB,
  1000,
  'legendary'
),

-- Streak Achievements
(
  'Yearly Regular',
  'Book at least one service per year for 2 consecutive years',
  'streak',
  '{"consecutive_years": 2, "min_services_per_year": 1}'::JSONB,
  150,
  'rare'
),
(
  'Seasonal Subscriber',
  'Book services in all 4 seasons in a single year',
  'streak',
  '{"seasons_covered": 4, "within_year": true}'::JSONB,
  200,
  'rare'
),
(
  'Loyalty Master',
  'Maintain membership for 5+ years',
  'streak',
  '{"years_as_customer": 5}'::JSONB,
  500,
  'epic'
),

-- Referral Achievements
(
  'Friend Bringer',
  'Refer your first friend',
  'referral',
  '{"successful_referrals": 1}'::JSONB,
  100,
  'common'
),
(
  'Social Butterfly',
  'Refer 5 friends',
  'referral',
  '{"successful_referrals": 5}'::JSONB,
  300,
  'rare'
),
(
  'Ambassador',
  'Refer 10 friends',
  'referral',
  '{"successful_referrals": 10}'::JSONB,
  750,
  'epic'
),
(
  'Referral Champion',
  'Refer 25 friends',
  'referral',
  '{"successful_referrals": 25}'::JSONB,
  2000,
  'legendary'
),

-- Review Achievements
(
  'Voice Heard',
  'Leave your first review',
  'review',
  '{"reviews_left": 1}'::JSONB,
  50,
  'common'
),
(
  '5 Star Contributor',
  'Leave 5 five-star reviews',
  'review',
  '{"five_star_reviews": 5}'::JSONB,
  200,
  'rare'
),
(
  'Super Reviewer',
  'Leave 10 reviews',
  'review',
  '{"reviews_left": 10}'::JSONB,
  400,
  'epic'
),

-- Social Achievements
(
  'Social Sharer',
  'Share on social media',
  'social',
  '{"social_shares": 1}'::JSONB,
  25,
  'common'
),
(
  'Influencer',
  'Share 5 times on social media',
  'social',
  '{"social_shares": 5}'::JSONB,
  100,
  'rare'
),

-- Special Achievements
(
  'Early Bird',
  'Book a service before 9 AM',
  'milestone',
  '{"early_morning_booking": true}'::JSONB,
  25,
  'common'
),
(
  'Weekend Warrior',
  'Book 5 weekend services',
  'milestone',
  '{"weekend_services": 5}'::JSONB,
  75,
  'common'
),
(
  'Bundle Master',
  'Book a service with 3+ add-ons',
  'milestone',
  '{"service_add_ons": 3}'::JSONB,
  50,
  'common'
),
(
  'Premium Service Fan',
  'Book 5 premium services',
  'milestone',
  '{"premium_services": 5}'::JSONB,
  150,
  'rare'
)
ON CONFLICT (achievement_name) DO NOTHING;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get customer's current loyalty tier
CREATE OR REPLACE FUNCTION get_customer_loyalty_tier(p_customer_id UUID)
RETURNS loyalty_tiers AS $$
DECLARE
  v_customer_points INTEGER;
  v_tier loyalty_tiers;
BEGIN
  -- Get customer's total points (assuming this exists in customer_loyalty table)
  SELECT COALESCE(total_points, 0) INTO v_customer_points
  FROM customer_loyalty
  WHERE customer_id = p_customer_id;

  -- If no loyalty record, return Bronze tier
  IF v_customer_points IS NULL THEN
    v_customer_points := 0;
  END IF;

  -- Get the highest tier the customer qualifies for
  SELECT * INTO v_tier
  FROM loyalty_tiers
  WHERE active = true
    AND points_required <= v_customer_points
  ORDER BY tier_level DESC
  LIMIT 1;

  -- If no tier found, return Bronze (lowest tier)
  IF NOT FOUND THEN
    SELECT * INTO v_tier
    FROM loyalty_tiers
    WHERE tier_level = 1
    LIMIT 1;
  END IF;

  RETURN v_tier;
END;
$$ LANGUAGE plpgsql;

-- Function to award achievement to customer
CREATE OR REPLACE FUNCTION award_achievement(
  p_customer_id UUID,
  p_achievement_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_achievement loyalty_achievements;
  v_points_awarded INTEGER;
  v_already_earned BOOLEAN;
BEGIN
  -- Check if achievement already earned
  SELECT EXISTS(
    SELECT 1 FROM customer_achievements
    WHERE customer_id = p_customer_id
      AND achievement_id = p_achievement_id
  ) INTO v_already_earned;

  IF v_already_earned THEN
    RETURN false; -- Already earned
  END IF;

  -- Get achievement details
  SELECT * INTO v_achievement
  FROM loyalty_achievements
  WHERE id = p_achievement_id
    AND active = true;

  IF NOT FOUND THEN
    RETURN false; -- Achievement not found or inactive
  END IF;

  -- Award the achievement
  INSERT INTO customer_achievements (
    customer_id,
    achievement_id,
    points_awarded
  ) VALUES (
    p_customer_id,
    p_achievement_id,
    v_achievement.points_award
  );

  -- Add points to customer loyalty
  UPDATE customer_loyalty
  SET total_points = total_points + v_achievement.points_award,
      updated_at = NOW()
  WHERE customer_id = p_customer_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(p_customer_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_code VARCHAR(20);
  v_customer_name TEXT;
  v_exists BOOLEAN;
  v_counter INTEGER := 0;
BEGIN
  -- Get customer name for code generation
  SELECT UPPER(SUBSTRING(full_name FROM 1 FOR 3))
  INTO v_customer_name
  FROM customers
  WHERE id = p_customer_id;

  IF v_customer_name IS NULL OR v_customer_name = '' THEN
    v_customer_name := 'REF';
  END IF;

  LOOP
    -- Generate code: NAME + 4 random chars
    v_code := v_customer_name || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));

    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM referrals WHERE referral_code = v_code)
    INTO v_exists;

    EXIT WHEN NOT v_exists;

    v_counter := v_counter + 1;
    IF v_counter > 10 THEN
      -- Fallback to fully random code
      v_code := 'REF' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
      EXIT;
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update referral status
CREATE OR REPLACE FUNCTION update_referral_status(p_referral_id UUID)
RETURNS VOID AS $$
DECLARE
  v_referral referrals;
BEGIN
  SELECT * INTO v_referral FROM referrals WHERE id = p_referral_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Update status based on progress
  IF v_referral.referred_customer_completed THEN
    UPDATE referrals
    SET status = 'completed'
    WHERE id = p_referral_id;
  ELSIF v_referral.referred_customer_booked THEN
    UPDATE referrals
    SET status = 'booked'
    WHERE id = p_referral_id;
  ELSIF v_referral.referred_customer_registered THEN
    UPDATE referrals
    SET status = 'registered'
    WHERE id = p_referral_id;
  ELSE
    UPDATE referrals
    SET status = 'pending'
    WHERE id = p_referral_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer referral stats
CREATE OR REPLACE FUNCTION get_customer_referral_stats(p_customer_id UUID)
RETURNS TABLE (
  total_referrals INTEGER,
  pending_referrals INTEGER,
  registered_referrals INTEGER,
  completed_referrals INTEGER,
  total_points_earned INTEGER,
  conversion_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_referrals,
    COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending_referrals,
    COUNT(*) FILTER (WHERE status = 'registered')::INTEGER as registered_referrals,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as completed_referrals,
    COALESCE(SUM(referrer_points_awarded), 0)::INTEGER as total_points_earned,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)) * 100, 2)
      ELSE 0
    END as conversion_rate
  FROM referrals
  WHERE referrer_customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE loyalty_tiers IS 'Defines loyalty tier levels and their benefits';
COMMENT ON TABLE loyalty_achievements IS 'Defines achievements/badges customers can earn';
COMMENT ON TABLE customer_achievements IS 'Tracks which achievements customers have earned';
COMMENT ON TABLE referrals IS 'Tracks customer referrals and their conversion status';

COMMENT ON FUNCTION get_customer_loyalty_tier IS 'Returns the current loyalty tier for a customer based on points';
COMMENT ON FUNCTION award_achievement IS 'Awards an achievement to a customer and grants associated points';
COMMENT ON FUNCTION generate_referral_code IS 'Generates a unique referral code for a customer';
COMMENT ON FUNCTION update_referral_status IS 'Updates referral status based on conversion progress';
COMMENT ON FUNCTION get_customer_referral_stats IS 'Returns referral statistics for a customer';
