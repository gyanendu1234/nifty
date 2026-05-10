-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- companies
-- ─────────────────────────────────────────────────────────────
CREATE TABLE companies (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name     TEXT,
  isin             TEXT        UNIQUE NOT NULL,
  nse_symbol       TEXT,
  bse_symbol       TEXT,
  sector_primary   TEXT,
  industry         TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- company_sector_tags  (many-to-many between companies & themes)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE company_sector_tags (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID        REFERENCES companies(id) ON DELETE CASCADE,
  sector_tag  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sector_tag)
);

-- ─────────────────────────────────────────────────────────────
-- amfi_periods
-- ─────────────────────────────────────────────────────────────
CREATE TABLE amfi_periods (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_label     TEXT        NOT NULL,               -- e.g. "Jun 2025"
  period_end_date  DATE        NOT NULL,
  period_type      TEXT        DEFAULT 'half-yearly',
  source_name      TEXT        DEFAULT 'AMFI',
  source_file_name TEXT,
  source_file_path TEXT,
  uploaded_at      TIMESTAMPTZ DEFAULT NOW(),
  import_status    TEXT        DEFAULT 'uploaded'
                   CHECK (import_status IN ('uploaded','processing','completed','failed')),
  import_error     TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- amfi_snapshots  (one row per company per period)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE amfi_snapshots (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        UUID        REFERENCES companies(id),
  period_id         UUID        REFERENCES amfi_periods(id) ON DELETE CASCADE,
  isin              TEXT        NOT NULL,
  company_name_raw  TEXT,
  nse_symbol        TEXT,
  bse_symbol        TEXT,
  market_cap_rank   INTEGER,
  average_market_cap NUMERIC,
  category          TEXT        CHECK (category IN ('Large Cap','Mid Cap','Small Cap')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, period_id),
  UNIQUE(isin, period_id)
);

-- ─────────────────────────────────────────────────────────────
-- ladder_movements  (one row per company per consecutive period pair)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE ladder_movements (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id         UUID        REFERENCES companies(id),
  from_period_id     UUID        REFERENCES amfi_periods(id),
  to_period_id       UUID        REFERENCES amfi_periods(id),
  from_category      TEXT,
  to_category        TEXT,
  from_rank          INTEGER,
  to_rank            INTEGER,
  rank_change        INTEGER,   -- positive = improved, negative = declined
  movement_direction TEXT        CHECK (movement_direction IN ('up','down','stable','volatile')),
  movement_type      TEXT,       -- e.g. "Mid → Large", "No Change"
  is_category_entry  BOOLEAN     DEFAULT FALSE,
  entered_category   TEXT,
  is_category_exit   BOOLEAN     DEFAULT FALSE,
  exited_category    TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, from_period_id, to_period_id)
);

-- ─────────────────────────────────────────────────────────────
-- company_ladder_summary  (one row per company, full history)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE company_ladder_summary (
  id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id              UUID        REFERENCES companies(id) UNIQUE,
  start_period_id         UUID        REFERENCES amfi_periods(id),
  end_period_id           UUID        REFERENCES amfi_periods(id),
  start_category          TEXT,
  end_category            TEXT,
  movement_path           TEXT,       -- "Small Cap → Mid Cap → Large Cap"
  first_midcap_period_id  UUID        REFERENCES amfi_periods(id),
  first_largecap_period_id UUID       REFERENCES amfi_periods(id),
  first_smallcap_period_id UUID       REFERENCES amfi_periods(id),
  small_to_mid_months     INTEGER,
  mid_to_large_months     INTEGER,
  large_to_mid_months     INTEGER,
  mid_to_small_months     INTEGER,
  total_rank_improvement  INTEGER     DEFAULT 0,
  total_rank_decline      INTEGER     DEFAULT 0,
  periods_improved        INTEGER     DEFAULT 0,
  periods_declined        INTEGER     DEFAULT 0,
  periods_stable          INTEGER     DEFAULT 0,
  stability_status        TEXT,
  trend_label             TEXT,
  ladder_score            NUMERIC,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────
CREATE INDEX idx_companies_isin          ON companies(isin);
CREATE INDEX idx_companies_sector        ON companies(sector_primary);
CREATE INDEX idx_sector_tags_company     ON company_sector_tags(company_id);
CREATE INDEX idx_sector_tags_tag         ON company_sector_tags(sector_tag);
CREATE INDEX idx_periods_end_date        ON amfi_periods(period_end_date);
CREATE INDEX idx_periods_status          ON amfi_periods(import_status);
CREATE INDEX idx_snapshots_period        ON amfi_snapshots(period_id);
CREATE INDEX idx_snapshots_company       ON amfi_snapshots(company_id);
CREATE INDEX idx_snapshots_isin          ON amfi_snapshots(isin);
CREATE INDEX idx_snapshots_category      ON amfi_snapshots(category);
CREATE INDEX idx_snapshots_rank          ON amfi_snapshots(market_cap_rank);
CREATE INDEX idx_movements_company       ON ladder_movements(company_id);
CREATE INDEX idx_movements_to_period     ON ladder_movements(to_period_id);
CREATE INDEX idx_movements_from_period   ON ladder_movements(from_period_id);
CREATE INDEX idx_movements_direction     ON ladder_movements(movement_direction);
CREATE INDEX idx_movements_is_entry      ON ladder_movements(is_category_entry);
CREATE INDEX idx_movements_is_exit       ON ladder_movements(is_category_exit);
CREATE INDEX idx_summary_company         ON company_ladder_summary(company_id);
CREATE INDEX idx_summary_trend           ON company_ladder_summary(trend_label);
CREATE INDEX idx_summary_stability       ON company_ladder_summary(stability_status);

-- ─────────────────────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_summary_updated_at
  BEFORE UPDATE ON company_ladder_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
