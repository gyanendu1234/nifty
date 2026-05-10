-- Rename amfi_periods and amfi_snapshots tables to nifty_ prefix
ALTER TABLE amfi_periods  RENAME TO nifty_periods;
ALTER TABLE amfi_snapshots RENAME TO nifty_snapshots;

-- Recreate views/functions that reference the old table names
CREATE OR REPLACE VIEW v_latest_snapshot AS
WITH latest_period AS (
  SELECT id FROM nifty_periods WHERE import_status = 'completed'
  ORDER BY period_end_date DESC LIMIT 1
)
SELECT c.id AS company_id, c.company_name, c.isin, c.nse_symbol, c.bse_symbol,
       c.sector_primary, s.market_cap_rank, s.average_market_cap, s.category,
       s.period_id, p.period_label, p.period_end_date
FROM   nifty_snapshots s
JOIN   companies c ON c.id = s.company_id
JOIN   nifty_periods p ON p.id = s.period_id
WHERE  s.period_id = (SELECT id FROM latest_period);

CREATE OR REPLACE VIEW v_dashboard_summary AS
WITH latest_period AS (
  SELECT id, period_label, period_end_date FROM nifty_periods
  WHERE import_status = 'completed' ORDER BY period_end_date DESC LIMIT 1
)
SELECT
  (SELECT COUNT(*) FROM nifty_snapshots WHERE period_id = (SELECT id FROM latest_period)) AS total_companies,
  (SELECT COUNT(*) FROM v_latest_snapshot WHERE category = 'Large Cap')   AS large_cap_count,
  (SELECT COUNT(*) FROM v_latest_snapshot WHERE category = 'Mid Cap')     AS mid_cap_count,
  (SELECT COUNT(*) FROM v_latest_snapshot WHERE category = 'Small Cap')   AS small_cap_count,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND is_category_entry AND entered_category = 'Large Cap') AS entering_large_cap,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND is_category_exit  AND exited_category  = 'Large Cap') AS exiting_large_cap,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND is_category_entry AND entered_category = 'Mid Cap')   AS entering_mid_cap,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND is_category_exit  AND exited_category  = 'Mid Cap')   AS exiting_mid_cap,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND is_category_entry AND entered_category = 'Small Cap') AS entering_small_cap,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND is_category_exit  AND exited_category  = 'Small Cap') AS exiting_small_cap,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND movement_type = 'Small → Mid')  AS small_to_mid,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND movement_type = 'Mid → Large')  AS mid_to_large,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND movement_type = 'Large → Mid')  AS large_to_mid,
  (SELECT COUNT(*) FROM ladder_movements WHERE to_period_id = (SELECT id FROM latest_period) AND movement_type = 'Mid → Small')  AS mid_to_small,
  (SELECT COUNT(*) FROM v_latest_snapshot WHERE market_cap_rank BETWEEN 101 AND 125)  AS near_large_cap_upgrade,
  (SELECT COUNT(*) FROM v_latest_snapshot WHERE market_cap_rank BETWEEN 90  AND 100)  AS near_large_cap_downgrade,
  (SELECT COUNT(*) FROM v_latest_snapshot WHERE market_cap_rank BETWEEN 251 AND 300)  AS near_mid_cap_upgrade,
  (SELECT COUNT(*) FROM v_latest_snapshot WHERE market_cap_rank BETWEEN 225 AND 250)  AS near_mid_cap_downgrade,
  (SELECT period_label    FROM latest_period)    AS latest_period_label,
  (SELECT period_end_date FROM latest_period)    AS latest_period_date;

CREATE OR REPLACE FUNCTION get_company_timeline(p_isin TEXT)
RETURNS TABLE (period_label TEXT, period_end_date DATE, category TEXT, market_cap_rank INTEGER, average_market_cap NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT ap.period_label, ap.period_end_date, s.category, s.market_cap_rank, s.average_market_cap
  FROM   nifty_snapshots s
  JOIN   nifty_periods   ap ON ap.id = s.period_id
  WHERE  s.isin = p_isin AND ap.import_status = 'completed'
  ORDER BY ap.period_end_date ASC;
$$;

CREATE OR REPLACE FUNCTION get_sector_summary()
RETURNS TABLE (sector_primary TEXT, large_cap_count BIGINT, mid_cap_count BIGINT, small_cap_count BIGINT,
               total_companies BIGINT, entering_large BIGINT, entering_mid BIGINT, exiting_large BIGINT,
               exiting_mid BIGINT, moving_up BIGINT, moving_down BIGINT)
LANGUAGE sql STABLE AS $$
WITH latest AS (SELECT id FROM nifty_periods WHERE import_status='completed' ORDER BY period_end_date DESC LIMIT 1),
     prev   AS (SELECT id FROM nifty_periods WHERE import_status='completed' ORDER BY period_end_date DESC LIMIT 1 OFFSET 1)
SELECT c.sector_primary,
  COUNT(*) FILTER (WHERE s.category = 'Large Cap') AS large_cap_count,
  COUNT(*) FILTER (WHERE s.category = 'Mid Cap')   AS mid_cap_count,
  COUNT(*) FILTER (WHERE s.category = 'Small Cap') AS small_cap_count,
  COUNT(*)                                          AS total_companies,
  COUNT(*) FILTER (WHERE lm.is_category_entry AND lm.entered_category = 'Large Cap') AS entering_large,
  COUNT(*) FILTER (WHERE lm.is_category_entry AND lm.entered_category = 'Mid Cap')   AS entering_mid,
  COUNT(*) FILTER (WHERE lm.is_category_exit  AND lm.exited_category  = 'Large Cap') AS exiting_large,
  COUNT(*) FILTER (WHERE lm.is_category_exit  AND lm.exited_category  = 'Mid Cap')   AS exiting_mid,
  COUNT(*) FILTER (WHERE lm.movement_direction = 'up')   AS moving_up,
  COUNT(*) FILTER (WHERE lm.movement_direction = 'down') AS moving_down
FROM   nifty_snapshots s
JOIN   companies c ON c.id = s.company_id
LEFT JOIN ladder_movements lm ON lm.company_id = s.company_id AND lm.to_period_id = (SELECT id FROM latest)
WHERE  s.period_id = (SELECT id FROM latest)
AND    c.sector_primary IS NOT NULL
GROUP BY c.sector_primary ORDER BY total_companies DESC;
$$;
