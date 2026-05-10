-- ─────────────────────────────────────────────────────────────
-- Row Level Security Policies
-- Public read-only model. All writes happen via the backend
-- using the service-role key (which bypasses RLS entirely),
-- gated by an ADMIN_TOKEN bearer-token check at the API layer.
-- ─────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_sector_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE amfi_periods           ENABLE ROW LEVEL SECURITY;
ALTER TABLE amfi_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ladder_movements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_ladder_summary ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- Public read policies on every table
-- (Anon and authenticated users can SELECT; nobody can write
-- via PostgREST. The backend uses the service-role key.)
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "companies_public_read"
  ON companies FOR SELECT USING (true);

CREATE POLICY "tags_public_read"
  ON company_sector_tags FOR SELECT USING (true);

CREATE POLICY "periods_public_read"
  ON amfi_periods FOR SELECT USING (true);

CREATE POLICY "snapshots_public_read"
  ON amfi_snapshots FOR SELECT USING (true);

CREATE POLICY "movements_public_read"
  ON ladder_movements FOR SELECT USING (true);

CREATE POLICY "summary_public_read"
  ON company_ladder_summary FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────────
-- Storage: amfi-files bucket (private; only service-role can read/write)
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'amfi-files',
  'amfi-files',
  false,
  52428800,  -- 50 MB
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;
