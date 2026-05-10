/**
 * Bulk in-memory recalculation of company_ladder_summary for ALL companies.
 *
 * Strategy: pull every snapshot + every movement in pages, group in memory,
 * compute summaries, batch-upsert. Replaces the per-company REST loop
 * (which was ~1 company/sec; this finishes the whole DB in well under a minute).
 *
 * Mirrors logic in backend/src/services/movementCalculator.ts → recalculateSummary.
 *
 * Run from backend/ : node scripts/recalc-summaries-fast.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const log = (msg) => console.log(`[${ts()}] ${msg}`);

async function fetchAllPaged(table, select, filterFn) {
  const PAGE = 1000;
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = supabase.from(table).select(select).range(offset, offset + PAGE - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

const CAP_ORDER = { 'Large Cap': 3, 'Mid Cap': 2, 'Small Cap': 1 };

function deriveStabilityStatus(startCat, endCat, periodsImproved, periodsDeclined, path) {
  const improved = (CAP_ORDER[endCat] ?? 0) > (CAP_ORDER[startCat] ?? 0);
  const declined = (CAP_ORDER[endCat] ?? 0) < (CAP_ORDER[startCat] ?? 0);
  const volatile = path.length > 3;

  if (improved && periodsDeclined === 0) return 'Confirmed Upgrade';
  if (improved && periodsDeclined > 0 && periodsDeclined <= 1) return 'Borderline Upgrade';
  if (improved && periodsDeclined > 1) return 'Upgrade Reversed';
  if (declined && periodsImproved === 0) return 'Confirmed Downgrade';
  if (declined && periodsImproved > 0) return 'Downgrade Recovered';
  if (declined) return 'Borderline Downgrade';
  if (volatile) return 'Volatile';
  return 'Stable';
}

function deriveTrendLabel(endCat, currentRank, periodsImproved, periodsDeclined, path) {
  if (endCat === 'Large Cap' && periodsDeclined === 0) return 'Stable Large Cap';
  if (endCat === 'Large Cap' && periodsDeclined > 0 && periodsImproved > periodsDeclined) return 'Strong Confirmed Climber';
  if (endCat === 'Large Cap' && periodsDeclined > periodsImproved) return 'Falling Large Cap';
  if (endCat === 'Large Cap' && currentRank >= 90 && currentRank <= 100) return 'Borderline Large Cap';

  if (endCat === 'Mid Cap' && periodsImproved > periodsDeclined) return path.length >= 3 ? 'Rapid Climber' : 'Slow Consistent Climber';
  if (endCat === 'Mid Cap' && periodsDeclined > periodsImproved) return 'Falling Mid Cap';
  if (endCat === 'Mid Cap') return 'Stable Mid Cap';

  if (endCat === 'Small Cap' && periodsDeclined > periodsImproved) return 'Confirmed Decliner';
  if (endCat === 'Small Cap' && periodsImproved > periodsDeclined) return 'Rising Small Cap';
  if (endCat === 'Small Cap') return 'Stable Small Cap';

  if (path.includes('Large Cap') && path[path.length - 1] !== 'Large Cap') return 'Upgrade Reversed';
  return 'Volatile / Unclear';
}

function computeLadderScore(snapshots, movements) {
  if (snapshots.length === 0) return 0;
  const lastCat = snapshots[snapshots.length - 1].category;
  const baseScore = (CAP_ORDER[lastCat] ?? 1) * 30;

  let improvementScore = 0;
  for (const m of movements) {
    if (m.rank_change != null && m.rank_change > 0) improvementScore += 1;
    else if (m.rank_change != null && m.rank_change < 0) improvementScore -= 0.5;
  }

  const consistency = movements.length > 0
    ? movements.filter(m => m.rank_change != null && m.rank_change >= 0).length / movements.length
    : 0;

  return Math.round(baseScore + improvementScore + consistency * 10);
}

function computeMonthsBetween(fromCat, toCat, snapshots) {
  let fromDate = null, toDate = null;
  for (const s of snapshots) {
    if (s.category === fromCat && !fromDate) fromDate = new Date(s.period_end_date);
    if (fromDate && s.category === toCat && !toDate) toDate = new Date(s.period_end_date);
  }
  if (!fromDate || !toDate) return null;
  return Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24 * 30));
}

async function main() {
  const t0 = Date.now();
  log('Bulk recalc starting…');

  // 1. Periods (small)
  log('Fetching periods…');
  const periods = await fetchAllPaged('nifty_periods', 'id, period_end_date');
  const periodById = new Map(periods.map(p => [p.id, p]));
  log(`  → ${periods.length} periods`);

  // 2. Snapshots (large — likely 60-80k rows)
  log('Fetching all snapshots…');
  const snapshots = await fetchAllPaged(
    'nifty_snapshots',
    'company_id, period_id, market_cap_rank, category',
    q => q.not('company_id', 'is', null),
  );
  log(`  → ${snapshots.length} snapshots`);

  // 3. Movements (~12k rows)
  log('Fetching all movements…');
  const movements = await fetchAllPaged(
    'ladder_movements',
    'company_id, rank_change',
    q => q.not('company_id', 'is', null),
  );
  log(`  → ${movements.length} movements`);

  // 4. Group by company
  log('Grouping by company…');
  const snapsByCompany = new Map();
  for (const s of snapshots) {
    const list = snapsByCompany.get(s.company_id) ?? [];
    const period = periodById.get(s.period_id);
    list.push({ ...s, period_end_date: period?.period_end_date ?? '' });
    snapsByCompany.set(s.company_id, list);
  }
  for (const list of snapsByCompany.values()) {
    list.sort((a, b) => (a.period_end_date ?? '').localeCompare(b.period_end_date ?? ''));
  }

  const movsByCompany = new Map();
  for (const m of movements) {
    const list = movsByCompany.get(m.company_id) ?? [];
    list.push(m);
    movsByCompany.set(m.company_id, list);
  }

  log(`  → ${snapsByCompany.size} unique companies in snapshots`);

  // 5. Compute summaries
  log('Computing summaries…');
  const summaries = [];
  for (const [companyId, snaps] of snapsByCompany) {
    if (snaps.length === 0) continue;

    const firstSnap = snaps[0];
    const lastSnap  = snaps[snaps.length - 1];
    const startCat  = firstSnap.category;
    const endCat    = lastSnap.category;

    // movement_path (deduplicated)
    const dedupedPath = [];
    for (const s of snaps) {
      if (s.category && dedupedPath[dedupedPath.length - 1] !== s.category) dedupedPath.push(s.category);
    }
    const movementPath = dedupedPath.join(' → ');

    // first periods per category
    const firstMid   = snaps.find(s => s.category === 'Mid Cap');
    const firstLarge = snaps.find(s => s.category === 'Large Cap');
    const firstSmall = snaps.find(s => s.category === 'Small Cap');

    // movement stats
    const movs = movsByCompany.get(companyId) ?? [];
    let totalImprovement = 0, totalDecline = 0;
    let periodsImproved = 0, periodsDeclined = 0, periodsStable = 0;
    for (const m of movs) {
      if (m.rank_change == null) continue;
      if (m.rank_change > 0) { totalImprovement += m.rank_change; periodsImproved++; }
      else if (m.rank_change < 0) { totalDecline += Math.abs(m.rank_change); periodsDeclined++; }
      else { periodsStable++; }
    }

    summaries.push({
      company_id: companyId,
      start_period_id: firstSnap.period_id,
      end_period_id:   lastSnap.period_id,
      start_category:  startCat,
      end_category:    endCat,
      movement_path:   movementPath,
      first_midcap_period_id:   firstMid?.period_id   ?? null,
      first_largecap_period_id: firstLarge?.period_id ?? null,
      first_smallcap_period_id: firstSmall?.period_id ?? null,
      small_to_mid_months: computeMonthsBetween('Small Cap', 'Mid Cap', snaps),
      mid_to_large_months: computeMonthsBetween('Mid Cap', 'Large Cap', snaps),
      large_to_mid_months: computeMonthsBetween('Large Cap', 'Mid Cap', snaps),
      mid_to_small_months: computeMonthsBetween('Mid Cap', 'Small Cap', snaps),
      total_rank_improvement: totalImprovement,
      total_rank_decline:     totalDecline,
      periods_improved:       periodsImproved,
      periods_declined:       periodsDeclined,
      periods_stable:         periodsStable,
      stability_status: deriveStabilityStatus(startCat, endCat, periodsImproved, periodsDeclined, dedupedPath),
      trend_label:      deriveTrendLabel(endCat, lastSnap.market_cap_rank ?? 9999, periodsImproved, periodsDeclined, dedupedPath),
      ladder_score:     computeLadderScore(snaps, movs),
    });
  }
  log(`  → ${summaries.length} summaries to upsert`);

  // 6. Bulk upsert in chunks
  log('Upserting…');
  const CHUNK = 500;
  let done = 0;
  for (let i = 0; i < summaries.length; i += CHUNK) {
    const chunk = summaries.slice(i, i + CHUNK);
    const { error } = await supabase.from('company_ladder_summary').upsert(chunk, { onConflict: 'company_id' });
    if (error) {
      console.log(`  ✗ chunk ${i}: ${error.message}`);
    } else {
      done += chunk.length;
      log(`  ✓ ${done} / ${summaries.length}`);
    }
  }

  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  log(`Done. ${done} summaries written in ${seconds}s`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
