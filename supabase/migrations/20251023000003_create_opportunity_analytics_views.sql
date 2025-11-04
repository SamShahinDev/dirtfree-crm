-- Opportunity Analytics Views and Functions
-- Provides comprehensive analytics for opportunity conversion tracking

-- Analytics View by Opportunity Type
CREATE OR REPLACE VIEW opportunity_analytics AS
SELECT
  opportunity_type,
  COUNT(*) as total_opportunities,
  COUNT(CASE WHEN converted THEN 1 END) as conversions,
  ROUND(
    CASE
      WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN converted THEN 1 END)::DECIMAL / COUNT(*)) * 100
      ELSE 0
    END,
    2
  ) as conversion_rate,
  AVG(CASE WHEN converted THEN conversion_value END) as avg_conversion_value,
  SUM(CASE WHEN converted THEN conversion_value END) as total_revenue,
  AVG(
    CASE
      WHEN converted THEN EXTRACT(EPOCH FROM (conversion_date - created_at))/86400
      ELSE NULL
    END
  ) as avg_days_to_convert,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY conversion_value)
    FILTER (WHERE converted = true) as median_conversion_value
FROM missed_opportunities
GROUP BY opportunity_type;

-- Analytics View by Staff Member
CREATE OR REPLACE VIEW opportunity_staff_performance AS
SELECT
  u.id as staff_id,
  u.full_name as staff_name,
  COUNT(mo.id) as total_opportunities,
  COUNT(CASE WHEN mo.converted THEN 1 END) as conversions,
  ROUND(
    CASE
      WHEN COUNT(mo.id) > 0 THEN (COUNT(CASE WHEN mo.converted THEN 1 END)::DECIMAL / COUNT(mo.id)) * 100
      ELSE 0
    END,
    2
  ) as conversion_rate,
  SUM(CASE WHEN mo.converted THEN mo.conversion_value ELSE 0 END) as total_revenue,
  AVG(CASE WHEN mo.converted THEN mo.conversion_value END) as avg_conversion_value
FROM users u
LEFT JOIN missed_opportunities mo ON mo.created_by_user_id = u.id
GROUP BY u.id, u.full_name;

-- Conversion Funnel View
CREATE OR REPLACE VIEW opportunity_conversion_funnel AS
SELECT
  COUNT(*) as total_created,
  COUNT(CASE WHEN status IN ('offer_sent', 'offer_scheduled', 'converted') THEN 1 END) as offers_sent,
  COUNT(oo.id) FILTER (WHERE oo.claimed_at IS NOT NULL) as offers_claimed,
  COUNT(CASE WHEN converted = true THEN 1 END) as conversions,
  ROUND(
    CASE
      WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN status IN ('offer_sent', 'offer_scheduled', 'converted') THEN 1 END)::DECIMAL / COUNT(*)) * 100
      ELSE 0
    END,
    2
  ) as offer_rate,
  ROUND(
    CASE
      WHEN COUNT(CASE WHEN status IN ('offer_sent', 'offer_scheduled') THEN 1 END) > 0
      THEN (COUNT(oo.id) FILTER (WHERE oo.claimed_at IS NOT NULL)::DECIMAL / COUNT(CASE WHEN status IN ('offer_sent', 'offer_scheduled') THEN 1 END)) * 100
      ELSE 0
    END,
    2
  ) as claim_rate,
  ROUND(
    CASE
      WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN converted = true THEN 1 END)::DECIMAL / COUNT(*)) * 100
      ELSE 0
    END,
    2
  ) as overall_conversion_rate
FROM missed_opportunities mo
LEFT JOIN opportunity_offers oo ON oo.opportunity_id = mo.id;

-- Time-based Analytics Function
CREATE OR REPLACE FUNCTION get_opportunity_time_analytics(days_back INT DEFAULT 90)
RETURNS TABLE (
  day_of_week INT,
  day_name TEXT,
  total_created INT,
  total_converted INT,
  conversion_rate NUMERIC,
  avg_days_to_convert NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(DOW FROM mo.created_at)::INT as dow,
    TO_CHAR(mo.created_at, 'Day') as day_name,
    COUNT(*)::INT as total_created,
    COUNT(CASE WHEN mo.converted THEN 1 END)::INT as total_converted,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN mo.converted THEN 1 END)::DECIMAL / COUNT(*)) * 100
        ELSE 0
      END,
      2
    ) as conversion_rate,
    ROUND(
      AVG(
        CASE
          WHEN mo.converted THEN EXTRACT(EPOCH FROM (mo.conversion_date - mo.created_at))/86400
          ELSE NULL
        END
      )::NUMERIC,
      1
    ) as avg_days_to_convert
  FROM missed_opportunities mo
  WHERE mo.created_at >= NOW() - (days_back || ' days')::INTERVAL
  GROUP BY EXTRACT(DOW FROM mo.created_at), TO_CHAR(mo.created_at, 'Day')
  ORDER BY dow;
END;
$$ LANGUAGE plpgsql;

-- Offer Effectiveness Analytics
CREATE OR REPLACE FUNCTION get_offer_effectiveness_analytics()
RETURNS TABLE (
  discount_range TEXT,
  total_offers BIGINT,
  claimed_offers BIGINT,
  redeemed_offers BIGINT,
  claim_rate NUMERIC,
  redemption_rate NUMERIC,
  avg_discount NUMERIC,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH discount_brackets AS (
    SELECT
      oo.id,
      oo.offer_percentage,
      oo.claimed_at,
      oo.redeemed_at,
      mo.conversion_value,
      CASE
        WHEN oo.offer_percentage <= 10 THEN '0-10%'
        WHEN oo.offer_percentage <= 15 THEN '11-15%'
        WHEN oo.offer_percentage <= 20 THEN '16-20%'
        ELSE '20%+'
      END as bracket
    FROM opportunity_offers oo
    JOIN missed_opportunities mo ON mo.id = oo.opportunity_id
  )
  SELECT
    bracket as discount_range,
    COUNT(*) as total_offers,
    COUNT(claimed_at) as claimed_offers,
    COUNT(redeemed_at) as redeemed_offers,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN (COUNT(claimed_at)::DECIMAL / COUNT(*)) * 100
        ELSE 0
      END,
      2
    ) as claim_rate,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN (COUNT(redeemed_at)::DECIMAL / COUNT(*)) * 100
        ELSE 0
      END,
      2
    ) as redemption_rate,
    ROUND(AVG(offer_percentage)::NUMERIC, 2) as avg_discount,
    ROUND(COALESCE(SUM(CASE WHEN redeemed_at IS NOT NULL THEN conversion_value END), 0)::NUMERIC, 2) as total_revenue
  FROM discount_brackets
  GROUP BY bracket
  ORDER BY
    CASE bracket
      WHEN '0-10%' THEN 1
      WHEN '11-15%' THEN 2
      WHEN '16-20%' THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;

-- Monthly Trend Analytics
CREATE OR REPLACE FUNCTION get_opportunity_monthly_trends(months_back INT DEFAULT 12)
RETURNS TABLE (
  month TEXT,
  total_opportunities BIGINT,
  conversions BIGINT,
  conversion_rate NUMERIC,
  total_revenue NUMERIC,
  avg_days_to_convert NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(mo.created_at, 'YYYY-MM') as month,
    COUNT(*) as total_opportunities,
    COUNT(CASE WHEN mo.converted THEN 1 END) as conversions,
    ROUND(
      CASE
        WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN mo.converted THEN 1 END)::DECIMAL / COUNT(*)) * 100
        ELSE 0
      END,
      2
    ) as conversion_rate,
    ROUND(COALESCE(SUM(CASE WHEN mo.converted THEN mo.conversion_value END), 0)::NUMERIC, 2) as total_revenue,
    ROUND(
      AVG(
        CASE
          WHEN mo.converted THEN EXTRACT(EPOCH FROM (mo.conversion_date - mo.created_at))/86400
          ELSE NULL
        END
      )::NUMERIC,
      1
    ) as avg_days_to_convert
  FROM missed_opportunities mo
  WHERE mo.created_at >= NOW() - (months_back || ' months')::INTERVAL
  GROUP BY TO_CHAR(mo.created_at, 'YYYY-MM')
  ORDER BY month DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON VIEW opportunity_analytics IS 'Aggregated analytics by opportunity type including conversion rates and revenue';
COMMENT ON VIEW opportunity_staff_performance IS 'Performance metrics for each staff member managing opportunities';
COMMENT ON VIEW opportunity_conversion_funnel IS 'Conversion funnel showing stages from creation to conversion';
COMMENT ON FUNCTION get_opportunity_time_analytics IS 'Returns opportunity creation and conversion patterns by day of week';
COMMENT ON FUNCTION get_offer_effectiveness_analytics IS 'Analyzes effectiveness of different discount levels';
COMMENT ON FUNCTION get_opportunity_monthly_trends IS 'Returns monthly trends for opportunity creation and conversion';
