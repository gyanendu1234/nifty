/**
 * Bulk in-memory rebuild of ladder_movements.
 * - Fetches all completed periods + all snapshots
 * - For every consecutive period pair, builds movements per company
 * - DELETES every existing row (clearing self-ref dupes from earlier buggy runs)
 * - Bulk-inserts in chunks of 500
 *
 * Mirrors backend/src/services/movementCalculator.ts → buildMovement.
 *
 * Run from backend/ : node scripts/recalc-movements-fast.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
const log = (m) => console.log(`[${ts()}] ${m}`);

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

function buildMovement(companyId, fromPeriodId, toPeriodId, prev, curr) {
  const fromCategory = prev?.category ?? null;
  const toCategory   = curr.category;
  const fromRank     = prev?.market_cap_rank ?? null;
  const toRank       = curr.market_cap_rank;

  const rankChange = fromRank != null ? fromRank - toRank : null;

  let movementType = 'No Change';
  let direction = 'stable';
  if (!fromCategory || fromCategory === toCategory) {
    movementType = 'No Change';
    direction = 'stable';
  } else {
    movementType = `${fromCategory.replace(' Cap', '')} → ${toCategory.replace(' Cap', '')}`;
    direction = (CAP_ORDER[toCategory] ?? 0) > (CAP_ORDER[fromCategory] ?? 0) ? 'up' : 'down';
  }

  let isEntry = false, enteredCategory = null;
  let isExit = false, exitedCategory = null;
  if (fromCategory && fromCategory !== toCategory) {
    isEntry = true; enteredCategory = toCategory;
    isExit = true;  exitedCategory = fromCategory;
  } else if (!fromCategory) {
    isEntry = true; enteredCategory = toCategory;
  }

  return {
    company_id:        companyId,
    from_period_id:    fromPeriodId,
    to_period_id:      toPeriodId,
    from_category:     fromCategory,
    to_category:       toCategory,
    from_rank:         fromRank,
    to_rank:           toRank,
    rank_change:       rankChange,
    movement_direction: direction,
    movement_type:     movementType,
    is_category_entry: isEntry,
    entered_category:  enteredCategory,
    is_category_exit:  isExit,
    exited_category:   exitedCategory,
  };
}

async function main() {
  const t0 = Date.now();
  log('Bulk movement rebuild starting…');

  // 1. Periods
  const periods = await fetchAllPaged('nifty_periods', 'id, period_label, period_end_date', q => q.eq('import_status', 'completed').order('period_end_date', { ascending: true }));
  log(`  → ${periods.length} completed periods`);
  if (periods.length === 0) return;

  // 2. All snapshots
  log('Fetching all snapshots…');
  const snaps = await fetchAllPaged('nifty_snapshots', 'company_id, period_id, market_cap_rank, category', q => q.not('company_id', 'is', null));
  log(`  → ${snaps.length} snapshots`);

  // Index: period_id → Map(company_id → snap)
  const byPeriod = new Map();
  for (const s of snaps) {
    if (!byPeriod.has(s.period_id)) byPeriod.set(s.period_id, new Map());
    byPeriod.get(s.period_id).set(s.company_id, s);
  }

  // 3. Build movements for each consecutive period pair
  log('Building movements…');
  const movements = [];
  for (let i = 0; i < periods.length; i++) {
    const curr = periods[i];
    const prev = i > 0 ? periods[i - 1] : null;
    const currMap = byPeriod.get(curr.id) ?? new Map();
    const prevMap = prev ? (byPeriod.get(prev.id) ?? new Map()) : new Map();

    let count = 0;
    for (const [companyId, snap] of currMap) {
      const prevSnap = prevMap.get(companyId) ?? null;
      const fromPeriodId = prev ? prev.id : curr.id; // self-ref only for the very first period
      movements.push(buildMovement(companyId, fromPeriodId, curr.id, prevSnap, snap));
      count++;
    }
    log(`  ${curr.period_label}: ${count} movements`);
  }

  // 4. Delete ALL existing movements (clears stale self-ref dupes)
  log('Deleting old movements…');
  const { error: delErr } = await supabase.from('ladder_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) log(`  delete error (ignoring): ${delErr.message}`);

  // 5. Bulk insert in chunks
  log('Inserting…');
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < movements.length; i += CHUNK) {
    const chunk = movements.slice(i, i + CHUNK);
    const { error } = await supabase.from('ladder_movements').insert(chunk);
    if (error) {
      console.log(`  ✗ chunk ${i}: ${error.message}`);
    } else {
      inserted += chunk.length;
    }
    if (i % 5000 === 0 || i + CHUNK >= movements.length) log(`  ✓ ${inserted} / ${movements.length}`);
  }

  log(`Done. ${inserted} movements written in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
