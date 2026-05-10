# Nifty Market Cap Ladder — Setup Guide

## Stack
- **Frontend**: Next.js 14 (App Router) → Vercel
- **Backend**: Express.js + TypeScript → Railway
- **Database**: Supabase (PostgreSQL + Storage)
- **Auth model**: Single `ADMIN_TOKEN` bearer token (no Supabase Auth)
- **Version Control**: Git

---

## 1. Supabase Setup

### Create Project
1. Go to https://supabase.com → New Project
2. Note your **Project URL** (Settings → API)
3. Note your **service role key** (keep secret — backend only)

### Run Migrations
In Supabase SQL Editor, run these files in order:
1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_views_functions.sql`

The migrations create:
- 6 tables (`companies`, `company_sector_tags`, `nifty_periods`, `nifty_snapshots`, `ladder_movements`, `company_ladder_summary`)
- Public read-only RLS policies (writes go through the backend service-role key)
- Storage bucket `nifty-files` (private)
- Views and RPC functions for the dashboard

> No `admin_users` table, no auth users to create. Admin access is gated by `ADMIN_TOKEN` in the backend `.env`.

---

## 2. Backend (local)

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Edit .env and fill in:
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
#   ADMIN_TOKEN (any 32+ char random string)
npm run dev
```

Backend runs on http://localhost:4000.

---

## 3. Frontend (local)

```powershell
cd frontend
npm install
Copy-Item .env.local.example .env.local
# Default value (NEXT_PUBLIC_API_URL=http://localhost:4000) is fine for local dev
npm run dev
```

Frontend runs on http://localhost:3000.

---

## 4. Uploading Data

1. Visit http://localhost:3000/admin
2. Paste the `ADMIN_TOKEN` value from `backend/.env` when prompted
3. Go to **Upload Nifty** → upload the Excel file
4. Set Period End Date (e.g. `2024-12-31`) and Period Label (e.g. `Dec 2024`)
5. Click **Upload & Process**

The token is stored in your browser's localStorage. Use **Sign Out** in the sidebar to clear it.

The system will:
- Store the original file in Supabase Storage (`nifty-files/raw/YYYY-MM-nifty.xlsx`)
- Parse the Excel and extract company data
- Upsert companies by ISIN
- Insert snapshots for the period
- Calculate movements vs previous period
- Recalculate ladder summaries for all companies

---

## 5. Data Source

Official AMFI half-yearly categorisation files (source data remains from AMFI India):
https://www.amfiindia.com/research-information/other-data/categorization-of-stocks

Files are released every June and December.

---

## Application URLs

| Route             | Description                        |
|-------------------|------------------------------------|
| `/dashboard`      | Main KPI dashboard                 |
| `/ladder`         | Full sortable/filterable ladder    |
| `/entry-exit`     | Entry/exit by category             |
| `/sectors`        | Sector-wise trends                 |
| `/company/:isin`  | Company detail + rank history      |
| `/admin`          | Admin overview (token-gated)       |
| `/admin/upload`   | Upload Excel file                  |
| `/admin/periods`  | Manage uploaded periods            |
| `/admin/companies`| Manage company sector tags         |

---

## Deploying later

When ready for cloud deploy:

**Backend (Railway)** — set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`, `ALLOWED_ORIGINS=https://your-frontend.vercel.app`, `NODE_ENV=production`.

**Frontend (Vercel)** — set env var: `NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app`.

---

## Important

This platform provides **market-cap ladder trend analysis** based on AMFI categorisation data.
It is **NOT** investment advice, stock recommendation, or valuation analysis.
