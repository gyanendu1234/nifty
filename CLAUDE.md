# Nifty — Project Memory

## What This App Does
Nifty Market Cap Ladder tracker. Imports SEBI/AMFI Excel files (half-yearly), tracks which companies are Large/Mid/Small Cap, and shows movement history (who entered, who exited, who climbed or fell).

## Stack
- Backend: Node/Express + TypeScript at `http://localhost:4000`
- Database: Supabase (PostgreSQL + PostgREST)
- Frontend: Next.js
- Admin token: `4bBhdcRvCpoJDyufBG6ZwwGLj5N4o8Pzw3avGBhy`

## Git & GitHub
- Repository: https://github.com/gyanendu1234/nifty
- GitHub account: `gyanendu1234`
- Local path: `c:\Workspace\nifty`
- Main branch: `main`
- Initial commit pushed: 2026-05-10
- To push future changes:
  ```bash
  git add <files>
  git commit -m "message"
  git push
  ```
- If Windows Credential Manager blocks push (403 denied to gyanendurout),
  use a PAT: `git remote set-url origin https://gyanendu1234:<PAT>@github.com/gyanendu1234/nifty.git`
  then push, then reset: `git remote set-url origin https://github.com/gyanendu1234/nifty.git`
- Generate new PAT at: https://github.com/settings/tokens

## Data Model (key tables)
- `companies` — one row per company (isin unique). AMFI uploads do NOT set `sector_primary`; it is always NULL until imported separately.
- `nifty_periods` — one row per uploaded half-year file (`import_status`: uploaded → processing → completed/failed)
- `nifty_snapshots` — one row per company per period (rank, market_cap, category)
- `ladder_movements` — one row per company per consecutive period pair (entry/exit flags, movement_type)
- `company_ladder_summary` — one row per company, full history summary (movement_path, trend_label, ladder_score, etc.)

## FK Relationships (critical for PostgREST joins)
```
nifty_snapshots.company_id  →  companies.id
company_ladder_summary.company_id  →  companies.id   (NOT directly from nifty_snapshots)
ladder_movements.company_id  →  companies.id          (NOT directly from nifty_snapshots)
```

## PostgREST Join Rule — VERY IMPORTANT
`company_ladder_summary` has NO direct FK from `nifty_snapshots` or `ladder_movements`.
You MUST nest it inside `companies!company_id(...)`, never at the same level:

```typescript
// CORRECT
supabase.from('nifty_snapshots').select(`
  ...,
  companies!company_id(
    company_name,
    company_ladder_summary(movement_path, trend_label, ...)
  )
`)

// WRONG — causes HTTP 500 "Could not find relationship"
supabase.from('nifty_snapshots').select(`
  ...,
  companies!company_id(...),
  company_ladder_summary!companies(...)   // ← breaks
`)
```

After nesting, hoist `company_ladder_summary` back to the top level before sending the response, because the frontend accesses it at `snap.company_ladder_summary` or `m.company_ladder_summary`, not inside `snap.companies`:

```typescript
const data = rawData.map(snap => {
  const co = snap.companies;
  const { company_ladder_summary: cls, ...companiesRest } = co ?? {};
  return { ...snap, companies: co ? companiesRest : null, company_ladder_summary: cls ?? null };
});
```

## Movement Logic
In `backend/src/services/movementCalculator.ts`:
- When a company changes category (`fromCategory !== toCategory`): BOTH `is_category_exit=true` AND `is_category_entry=true` are set simultaneously. This is correct.
- When there is no prior period (`fromCategory === null`): only `is_category_entry=true` ("new to list"). No exit.
- `movement_type` format: `'Small → Mid'`, `'Mid → Large'`, `'Large → Mid'`, `'Mid → Small'`

All four movement directions are handled by the same code path — there is no special-casing.

## Why Dashboard Exits / Movement Flows Show 0 (data fix needed)
Root cause: periods were uploaded before prior periods existed, so ALL companies landed in the "no previous period" branch → `is_category_exit=false` for every row in `ladder_movements`.

Fix: recalculate movements for ALL periods in chronological order:
```
node scripts/recalculate-movements.mjs
```
This calls `POST /api/admin/recalculate-movements/:periodId` for each completed period oldest→newest, then `POST /api/admin/recalculate-summaries`. Run with the backend up.

## Why Sector Trends Are Empty
AMFI Excel files do NOT include sector/industry data. All `companies.sector_primary` values are NULL. The `get_sector_summary()` SQL function filters `WHERE c.sector_primary IS NOT NULL`, so it returns nothing.

Fix: import sector data from NSE's public equity master CSV:
1. Download `https://archives.nseindia.com/content/equities/EQUITY_L.csv`
2. Save to `downloads/EQUITY_L.csv`
3. Run: `node scripts/import-nse-sectors.mjs`

This matches by ISIN and calls `PATCH /api/admin/companies/:id/sector` for each match.

## Movement Path in Summary
`recalculateSummary()` builds `movement_path` from ALL historical snapshots (not just latest movement), deduplicates consecutive identical categories, and joins with ` → `. Example: a company that was Small→Mid→Large shows `"Small Cap → Mid Cap → Large Cap"` even if it's currently in Large Cap. This is correct and is populated by the recalculate script above.

## Category Bands (AMFI definition)
- Large Cap: market_cap_rank 1–100
- Mid Cap: market_cap_rank 101–250
- Small Cap: market_cap_rank 251+

Because bands are fixed-size, every company that enters Mid Cap displaces one that exits Mid Cap (either up to Large or down to Small). Entry and exit counts for a category should be roughly equal within a period.

## Ladder API — Movement Filter Architecture (Bug 3 fix)
Movement/summary filters in `GET /api/ladder` are handled server-side via pre-filtering, NOT post-filtering:
1. If `is_category_exit/entry`, `exited/entered_category`, or `movement_type` filters are present → query `ladder_movements` first to get matching `company_id` list → apply `.in('company_id', ids)` to the snapshot query.
2. If `stability_status` or `trend_label` filters are present → same approach with `company_ladder_summary`.
3. Movements are ALWAYS fetched for the resolved period (not only for the latest period) — fixes movements being empty when a specific `period_id` is passed.

This ensures Supabase `count` and paginated `data` both reflect the filtered set correctly.

## Supabase DB Table Rename (migration 004)
Run `supabase/migrations/004_rename_amfi_to_nifty.sql` in Supabase SQL Editor.
Also rename the `amfi-files` storage bucket to `nifty-files` in the Supabase dashboard.

## Scripts
| Script | Purpose |
|--------|---------|
| `scripts/download-historical.mjs` | Download AMFI Excel files for 2016-2020 from AMFI website |
| `scripts/bulk-upload.mjs` | Upload all 20 Excel files (2016–2025) from `downloads/` in order |
| `scripts/recalculate-movements.mjs` | Recalculate all movements + summaries (MUST run after any upload) |
| `scripts/import-nse-sectors.mjs` | Import sector_primary from NSE EQUITY_L.csv |

## Correct order after fresh upload
```
node scripts/download-historical.mjs      # download 2016-2020 files
node scripts/bulk-upload.mjs              # upload all 20 periods
node scripts/recalculate-movements.mjs   # fix exit/movement data
# optionally: node scripts/import-nse-sectors.mjs
```

## Rising/Falling Stars — Bug History & Current State

### Root Cause (was broken, now partially fixed)
`backend/src/routes/starsRoutes.ts` originally filtered by `.eq('trend_label', 'Upward')` or `'Downward'`.
Those string values **do not exist** in `company_ladder_summary`. The actual values produced by
`deriveTrendLabel()` in `movementCalculator.ts` are things like `'Rapid Climber'`, `'Stable Small Cap'`,
`'Confirmed Decliner'`, etc. The filter returned zero rows for every request — page always empty.

### Fix applied
Replaced the `trend_label` equality filter with a numeric filter on `periods_improved` / `periods_declined`:
- Rising  → `.gte('periods_improved', minPeriods)` sorted by `periods_improved DESC`
- Falling → `.gte('periods_declined', minPeriods)` sorted by `periods_declined DESC`

Added optional query params: `?category=Large+Cap|Mid+Cap|Small+Cap` and `?min_periods=1` (default).
The frontend page (`/rising-falling`) now has category filter pills and min-periods buttons.

### Remaining gap — Small Cap trend labels are incomplete
`deriveTrendLabel()` in `movementCalculator.ts` (lines 272–294) has NO rising-trend variant for Small Cap:
```typescript
if (endCat === 'Small Cap' && periodsDeclined > periodsImproved) return 'Confirmed Decliner';
if (endCat === 'Small Cap') return 'Stable Small Cap';  // ← improving Small Cap companies land here too!
```
A Small Cap company that went rank 400→300→250 is labelled **"Stable Small Cap"** even though it is clearly
rising. The `trend_label` column in `company_ladder_summary` is unreliable for Small Cap improvement.

Compare with Large Cap (4 variants) and Mid Cap (4 variants) — Small Cap only has 2, with no upward label.

### Implemented solution — unified rank-progression table (DONE)
Replaced the Rising/Falling page with a **single "Rank Trends" table** (`/rising-falling` route) that
reads raw rank numbers from `nifty_snapshots` across the last N periods. No dependency on `trend_label`.

**Backend:** `backend/src/routes/trendsRoutes.ts` → `GET /api/trends`
- Fetches last N completed periods (default 6, max 12), queries all snapshots in **parallel pages** (COUNT first, then `Promise.all` all pages), groups by company in memory
- Sequential pagination was the original bottleneck (~30 sequential HTTP calls → 15-30s); parallel fetch fixes it to ~1-3s
- Computes `net_rank_change = start_rank - latest_rank` (positive = improved)
- Computes `periods_improved`, `periods_declined`, `periods_stable` per company
- Filters by: `category` (current_category), `direction` (improving/declining/all), `min_change` (absolute)
- Sorts by `net_rank_change DESC` (biggest risers first) — biggest fallers visible with direction=declining
- Summary stats (`improved`, `declined`, `stable` counts) computed AFTER category filter but BEFORE direction/min_change
- Only includes companies present in BOTH first AND last period (so net_rank_change is always defined)

**Frontend:** `frontend/src/app/(public)/rising-falling/page.tsx`
- Summary stat cards: **REMOVED** (were Companies Improved/Declined/Unchanged — deemed useless)
- Filter bar: Direction (All/Improving/Declining) · Category pills · Min move (Any/±10/±25/±50/±100) · Periods (Last 4/6/8)
  Note: Min move labels use ± prefix so they correctly represent both improving and declining directions
- **Tab bar**: Table tab / Chart tab (same pill-style as Compare page)
- **Table tab**: Company · Category badge · N period-rank columns · Net Move (sortable — click header to toggle ↑/↓) · Track record bar
  - Period column headers show month + year on separate lines (e.g. JUN / 2024) — fixes previous truncation to "JUN 202"
  - Net Move column is client-side sortable; clicking header toggles asc/desc; sort indicator arrow shown in header
- **Chart tab**: Rank trend line chart (Recharts, same style as Compare page)
  - Company selector panel: top-N toggle (10/15/20), checkbox grid with color-coded company cards
  - Y-axis reversed (rank 1 at top); category boundary lines at 100 (Large) and 250 (Mid)
  - Hover tooltip shows all companies at that period sorted by rank; hovered line highlighted at top
  - `colorMap` (useMemo) assigns stable LINE_COLORS indices so colors don't shift on toggle

## actual trend_label values in company_ladder_summary
These are the only strings `deriveTrendLabel()` ever writes. Do NOT filter by any other value:

| Cap Category | trend_label values |
|---|---|
| Large Cap | `'Stable Large Cap'`, `'Strong Confirmed Climber'`, `'Falling Large Cap'`, `'Borderline Large Cap'` |
| Mid Cap   | `'Rapid Climber'`, `'Slow Consistent Climber'`, `'Falling Mid Cap'`, `'Stable Mid Cap'` |
| Small Cap | `'Confirmed Decliner'`, `'Stable Small Cap'`, `'Rising Small Cap'` |
| Cross-cap | `'Upgrade Reversed'`, `'Volatile / Unclear'` |

Note: `'Rising Small Cap'` was added in this session — Small Cap companies where `periodsImproved > periodsDeclined`.

## Compare Page — architecture
`/compare` page (`frontend/src/app/(public)/compare/page.tsx`):
- Defaults to **last 4 completed periods** on mount (avoids timeout with all 12 periods)
- Period count selector: Last 4 / 6 / 8 / All — state `periodCount: PeriodCount`, updates `selected` Set
- Periods are sorted by `period_end_date` ascending on load, then `.slice(-(periodCount))` picks the tail
- Top/Bottom N selector (5/10/15/20/25/30) — sorted by latest-period rank
- Company selector panel below chart/table: checkboxes to toggle visibility
- Search box to pin additional companies beyond the top/bottom N
- Pinned companies preserved across N changes (stored in `pinnedIds: Set<string>`)
- `allCandidates = [...displayedData, ...pinnedRows]` — source for stable color indices
- `visibleRows = allCandidates.filter(r => activeIds.has(r.company_id))` — drives both chart & table
- Recharts `<Line>` hover: `onMouseEnter` sets `hoveredLine` state, dims all other lines to opacity 0.2
- Tooltip: shows ALL companies at the hovered period sorted by rank; focused (hovered) line is highlighted at top with coloured background — no need to aim at a thin line
- Dots: `dot={{ r: 3 }}` normally, `r: 5` when focused, `activeDot={{ r: 8 }}`
- Table has NO Sector column (always null from AMFI)

## Sector Data — ALWAYS NULL from AMFI
`companies.sector_primary` is ALWAYS NULL unless NSE sector import script has been run. Therefore:
- Sector column has been removed from: Ladder table, Compare table, Entry/Exit table, Boundary Watch table
- Sector card has been removed from Company Detail info grid
- Sector filter chip has been removed from FilterPanel
- `average_market_cap` is also always NULL from AMFI — removed from Company Detail timeline and header

## Company Detail Page — current structure
- Stats grid: **REMOVED** — Journey/Stability/Ladder Score cards removed (StabilityBadge no longer imported)
- Timeline table: Period | Category | Rank (Avg Market Cap column removed)
- Movement History: filtered to exclude self-referential rows (`m.from_period_id !== m.to_period_id`)
  Self-referential rows appear when recalculate runs before a prior period exists (from_period_id = to_period_id)

## CompanyDrawer — current structure
`frontend/src/components/ui/CompanyDrawer.tsx` — right-side slide-in panel, `max-w-md` (448px):
- Header: company name, ISIN, NSE symbol, Full page link, close button
- Stats row: CategoryBadge + rank number + sector tags
- Journey/Stability/Ladder Score KPI grid: **REMOVED**
- Rank History chart
- All Periods table: Period | Category | Rank
- Movement History: filtered to exclude self-referential rows (`from_period_id !== to_period_id`)
- Ladder Summary: start/end category, periods improved/declined/stable, total rank gain, trend

## Public Layout — horizontal stretch fix
`frontend/src/app/(public)/layout.tsx`:
- The flex-1 content div has `min-w-0` to prevent CSS flex's default `min-width: auto` from
  letting the content area expand horizontally with wide table content
- `<main>` has `w-full` to fill the constrained space
- Table containers use `overflow-x-auto` for internal horizontal scroll when needed

## Entry/Exit Page — null from_category handling
When `from_category` is null, the company is a "New Listing" (first appearance on AMFI list).
The Previous Category cell shows a grey "New Listing" pill instead of a CategoryBadge.
CSV export uses `'New Listing'` string for null from_category.

## Supabase Pagination — CRITICAL
Every `.select()` without `.range()` caps at **1000 rows** by default. With 6,500+ companies and
60,000+ snapshots this silently truncates results. ALWAYS paginate large queries:
```typescript
const PAGE = 1000;
const results: Row[] = [];
for (let offset = 0; ; offset += PAGE) {
  const { data, error } = await supabase.from('table').select('...').range(offset, offset + PAGE - 1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) break;
  results.push(...data);
  if (data.length < PAGE) break;
}
```
Routes already paginated: ladderRoutes, compareRoutes, trendsRoutes, adminRoutes (recalculate-summaries).

## PostgREST returns one-to-one FK as object, not array
`company_ladder_summary` has a unique constraint on `company_id`. PostgREST embeds it as a plain object
`{}`, not an array `[{}]`. Always handle both defensively:
```typescript
const rawSummary = co?.company_ladder_summary as Record<string, unknown> | Record<string, unknown>[] | null;
const summary = (Array.isArray(rawSummary) ? rawSummary[0] : rawSummary) ?? {};
```
Applied in: ladderRoutes.ts, compareRoutes.ts.

## Bulk Recalculation Scripts (fast path)
Two scripts in `backend/scripts/` for fast bulk recalculation:
- `recalc-movements-fast.mjs` — fetches all snapshots in memory, builds movements for consecutive period pairs,
  DELETE ALL existing movements, bulk inserts ~60,000 rows. Runs in ~56 seconds.
- `recalc-summaries-fast.mjs` — fetches all snapshots + movements in memory, computes summaries per company,
  batch-upserts 500 at a time. Handles 6,579 companies in ~27 seconds.

These are faster than the REST-based `recalculate-movements.mjs` which makes one HTTP call per period.

## Admin API Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/periods` | List all periods |
| GET | `/api/admin/companies` | List all companies (limit/offset) |
| POST | `/api/admin/upload` | Upload new AMFI Excel |
| POST | `/api/admin/reprocess/:periodId` | Reprocess stored file |
| POST | `/api/admin/recalculate-movements/:periodId` | Recalculate movements for one period |
| POST | `/api/admin/recalculate-summaries` | Recalculate all company summaries |
| PATCH | `/api/admin/companies/:companyId/sector` | Set sector_primary |
| POST | `/api/admin/companies/:companyId/tags` | Set sector tags |
| DELETE | `/api/admin/periods/:periodId` | Delete a period and its data |

## NSE Live Page — Enhanced UI (session 2026-05-10)

### Sparkline / Trend Charts
NSE API returns three SVG chart URL fields per stock:
- `chartTodayPath` — intraday chart (e.g. `https://nsearchives.nseindia.com/today/SONATSOFTWEQN.svg`)
- `chart30dPath` — 30-day chart (`/30d/SONATSOFTW-EQ.svg`)
- `chart365dPath` — 365-day chart (`/365d/SONATSOFTW-EQ.svg`)

These are loaded via `<img>` tags (avoids CORS). `onError` silently hides the img if NSE blocks it.

`stockChartUrl(stock, statMode)` picks context-appropriate URL:
- `gainers_30d` / `losers_30d` → `chart30dPath`
- `gainers_1y` / `losers_1y` → `chart365dPath`
- all other modes (today gainers/losers) → `chartTodayPath`

Losers get a CSS `filter: hue-rotate(300deg)` to shift the green SVG line to red.

The "Trend" column header is `hidden 2xl:table-cell` (only visible on very wide screens).

### Additional Data Shown Per Row
- **F&O badge**: purple `F&O` pill when `stock.meta?.isFNOSec === true`
- **Absolute ₹ change**: shown as sub-text under the % change column (green/red colored)
- **Trade value**: `stock.totalTradedValue` formatted with `fmtVal()` helper (₹Cr / BCr / KCr) shown under volume
- **52W proximity label**: shown below the range bar
  - Within 5% of 52W high: `▲ X.XX% to 52H` (green)
  - Within 5% of 52W low: `▼ X.XX% to 52L` (red)
  - Otherwise: shows position % along the bar
- Fields `nearWKH` / `nearWKL` on `NseStock` are % distance from 52W high / low

### NseStock type additions (types/index.ts)
```typescript
export interface NseStock {
  // existing fields...
  totalTradedValue?:  number;   // optional — not always present
  chartTodayPath?:    string;
  chart30dPath?:      string;
  chart365dPath?:     string;
}
```

## Charts — Y-axis & Tooltip Unification (session 2026-05-10)

### Smart Y-axis (`chartYAxis` useMemo) — identical in both pages
Both `/rising-falling` and `/compare` use the same `chartYAxis` useMemo:
- Computes tight domain from visible rank data with 8% padding (min 15)
- Adaptive tick step: 10 (span ≤80), 20 (≤150), 25 (≤300), 50 (≤500), 100 (larger)
- Inserts cap boundaries (100, 250) into ticks only if they fall within domain
- `domain[1]` used as `y2` on the Small Cap `ReferenceArea` so it clips correctly (no `y2={9999}`)

### YAxis props — unified across both pages
```tsx
<YAxis
  reversed
  domain={chartYAxis.domain}
  ticks={chartYAxis.ticks}
  tick={{ fontSize: 11, fill: '#64748b' }}
  tickLine={false}
  axisLine={{ stroke: '#334155' }}
  tickFormatter={v => `#${v}`}
  width={44}
/>
```
- `width={44}` ensures both charts have identical left-margin for Y-axis labels
- `tickFormatter={v => \`#${v}\`}` shows `#100` style labels (no `label` prop)

### Hover Tooltip — single-company only
Both `TrendTooltip` (rising-falling) and `ChartTooltip` (compare) now show ONLY the hovered line:
```tsx
function TrendTooltip({ active, payload, label, focusedLine }) {
  if (!active || !payload?.length || !focusedLine) return null;
  const item = payload.find(p => p.name === focusedLine);
  if (!item || item.value == null) return null;
  // render single company card
}
```
- Returns `null` when mouse is not directly over a line (`focusedLine` is null)
- `focusedLine` is set via `onMouseEnter`/`onMouseLeave` on each `<Line>` component
- Compare tooltip additionally shows a `CategoryBadge` for the company's category at that period
