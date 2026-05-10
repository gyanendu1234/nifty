import { NiftySnapshot, LadderMovement, MovementResult } from '../types';
import { logger } from '../config/logger';
import { supabase } from '../config/supabase';

// ─────────────────────────────────────────────────────────────
// Core movement logic for a single company between two periods
// ─────────────────────────────────────────────────────────────
function buildMovement(
  companyId: string,
  fromPeriodId: string,
  toPeriodId: string,
  prev: NiftySnapshot | null,
  curr: NiftySnapshot
): MovementResult {
  const fromCategory = prev?.category ?? null;
  const toCategory = curr.category!;
  const fromRank = prev?.market_cap_rank ?? null;
  const toRank = curr.market_cap_rank!;

  const rankChange = fromRank !== null ? fromRank - toRank : null;

  // ── Movement type (between consecutive periods) ──
  let movementType = 'No Change';
  let direction: 'up' | 'down' | 'stable' = 'stable';

  if (!fromCategory || fromCategory === toCategory) {
    movementType = 'No Change';
    direction = 'stable';
  } else {
    movementType = `${fromCategory.replace(' Cap', '')} → ${toCategory.replace(' Cap', '')}`;
    const CAP_ORDER: Record<string, number> = { 'Large Cap': 3, 'Mid Cap': 2, 'Small Cap': 1 };
    direction = (CAP_ORDER[toCategory] ?? 0) > (CAP_ORDER[fromCategory] ?? 0) ? 'up' : 'down';
  }

  // ── Entry / Exit ──
  let isEntry = false;
  let enteredCategory: string | null = null;
  let isExit = false;
  let exitedCategory: string | null = null;

  if (fromCategory && fromCategory !== toCategory) {
    isEntry = true;
    enteredCategory = toCategory;
    isExit = true;
    exitedCategory = fromCategory;
  } else if (!fromCategory) {
    // New to Nifty list
    isEntry = true;
    enteredCategory = toCategory;
  }

  return {
    company_id: companyId,
    from_period_id: fromPeriodId,
    to_period_id: toPeriodId,
    from_category: fromCategory,
    to_category: toCategory,
    from_rank: fromRank,
    to_rank: toRank,
    rank_change: rankChange,
    movement_direction: direction,
    movement_type: movementType,
    is_category_entry: isEntry,
    entered_category: enteredCategory,
    is_category_exit: isExit,
    exited_category: exitedCategory,
  };
}

// ─────────────────────────────────────────────────────────────
// Calculate all movements for a new period vs previous period
// ─────────────────────────────────────────────────────────────
export async function calculateMovementsForPeriod(
  toPeriodId: string,
  fromPeriodId: string | null
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];

  // Load current period snapshots
  const { data: currSnapshots, error: currErr } = await supabase
    .from('nifty_snapshots')
    .select('*')
    .eq('period_id', toPeriodId);

  if (currErr) throw new Error(`Failed to load snapshots for period ${toPeriodId}: ${currErr.message}`);

  let prevByCompany: Map<string, NiftySnapshot> = new Map();

  if (fromPeriodId) {
    const { data: prevSnapshots, error: prevErr } = await supabase
      .from('nifty_snapshots')
      .select('*')
      .eq('period_id', fromPeriodId);

    if (prevErr) {
      logger.warn(`Could not load previous period snapshots: ${prevErr.message}`);
    } else if (prevSnapshots) {
      prevByCompany = new Map(prevSnapshots.map(s => [s.company_id!, s as NiftySnapshot]));
    }
  }

  // Delete existing movements for this period pair (idempotent)
  if (fromPeriodId) {
    await supabase
      .from('ladder_movements')
      .delete()
      .eq('to_period_id', toPeriodId)
      .eq('from_period_id', fromPeriodId);
  }

  const movements: Omit<LadderMovement, 'id' | 'created_at'>[] = [];

  for (const snap of (currSnapshots ?? []) as NiftySnapshot[]) {
    if (!snap.company_id) continue;

    const prev = prevByCompany.get(snap.company_id) ?? null;
    const effectiveFromPeriodId = fromPeriodId ?? toPeriodId;

    const result = buildMovement(snap.company_id, effectiveFromPeriodId, toPeriodId, prev, snap);
    movements.push(result);
  }

  // Batch insert in chunks of 500
  const CHUNK_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < movements.length; i += CHUNK_SIZE) {
    const chunk = movements.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('ladder_movements').insert(chunk);

    if (error) {
      errors.push(`Chunk ${i}–${i + CHUNK_SIZE}: ${error.message}`);
      logger.error('Movement insert error:', error);
    } else {
      inserted += chunk.length;
    }
  }

  logger.info(`Calculated ${inserted} movements for period ${toPeriodId}`);
  return { inserted, errors };
}

// ─────────────────────────────────────────────────────────────
// Recalculate full company_ladder_summary for a company
// ─────────────────────────────────────────────────────────────
export async function recalculateSummary(companyId: string): Promise<void> {
  // Get all movements for this company ordered by period
  const { data: movements, error: movErr } = await supabase
    .from('ladder_movements')
    .select(`
      *,
      to_period:nifty_periods!to_period_id(period_label, period_end_date)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (movErr || !movements || movements.length === 0) return;

  // Get all snapshots for this company; sort in JS (PostgREST can't order by FK column)
  const { data: rawSnapshots, error: snapErr } = await supabase
    .from('nifty_snapshots')
    .select(`
      *,
      period:nifty_periods(period_label, period_end_date)
    `)
    .eq('company_id', companyId);

  if (snapErr || !rawSnapshots || rawSnapshots.length === 0) return;

  const snapshots = rawSnapshots.slice().sort((a, b) => {
    const da = (a as Record<string, { period_end_date?: string }>).period?.period_end_date ?? '';
    const db = (b as Record<string, { period_end_date?: string }>).period?.period_end_date ?? '';
    return da.localeCompare(db);
  });

  const firstSnap = snapshots[0] as NiftySnapshot & { period: { period_end_date: string } };
  const lastSnap  = snapshots[snapshots.length - 1] as NiftySnapshot & { period: { period_end_date: string } };

  // Build movement path (deduplicated consecutive categories)
  const categories = snapshots.map(s => (s as NiftySnapshot).category!).filter(Boolean);
  const dedupedPath: string[] = [];
  for (const cat of categories) {
    if (dedupedPath[dedupedPath.length - 1] !== cat) dedupedPath.push(cat);
  }
  const movementPath = dedupedPath.join(' → ');

  // First period IDs for each category
  const firstMidcap  = snapshots.find(s => (s as NiftySnapshot).category === 'Mid Cap');
  const firstLargecap = snapshots.find(s => (s as NiftySnapshot).category === 'Large Cap');
  const firstSmallcap = snapshots.find(s => (s as NiftySnapshot).category === 'Small Cap');

  // Rank improvement/decline stats
  let totalImprovement = 0;
  let totalDecline = 0;
  let periodsImproved = 0;
  let periodsDeclined = 0;
  let periodsStable = 0;

  for (const m of movements as LadderMovement[]) {
    if (m.rank_change === null) continue;
    if (m.rank_change > 0) {
      totalImprovement += m.rank_change;
      periodsImproved++;
    } else if (m.rank_change < 0) {
      totalDecline += Math.abs(m.rank_change);
      periodsDeclined++;
    } else {
      periodsStable++;
    }
  }

  const endCategory = lastSnap.category;
  const startCategory = firstSnap.category;

  // ── Stability status ──
  const stability_status = deriveStabilityStatus(startCategory!, endCategory!, periodsImproved, periodsDeclined, dedupedPath);
  const trend_label = deriveTrendLabel(endCategory!, lastSnap.market_cap_rank!, periodsImproved, periodsDeclined, dedupedPath);
  const ladder_score = computeLadderScore(snapshots as (NiftySnapshot & { period: { period_end_date: string } })[], movements as LadderMovement[]);

  // Month calculations
  const smallToMidMonths = computeMonthsBetweenCategories('Small Cap', 'Mid Cap', snapshots as (NiftySnapshot & { period: { period_end_date: string } })[]);
  const midToLargeMonths = computeMonthsBetweenCategories('Mid Cap', 'Large Cap', snapshots as (NiftySnapshot & { period: { period_end_date: string } })[]);
  const largeToMidMonths = computeMonthsBetweenCategories('Large Cap', 'Mid Cap', snapshots as (NiftySnapshot & { period: { period_end_date: string } })[]);
  const midToSmallMonths = computeMonthsBetweenCategories('Mid Cap', 'Small Cap', snapshots as (NiftySnapshot & { period: { period_end_date: string } })[]);

  const summary = {
    company_id: companyId,
    start_period_id: firstSnap.period_id,
    end_period_id: lastSnap.period_id,
    start_category: startCategory,
    end_category: endCategory,
    movement_path: movementPath,
    first_midcap_period_id: firstMidcap?.period_id ?? null,
    first_largecap_period_id: firstLargecap?.period_id ?? null,
    first_smallcap_period_id: firstSmallcap?.period_id ?? null,
    small_to_mid_months: smallToMidMonths,
    mid_to_large_months: midToLargeMonths,
    large_to_mid_months: largeToMidMonths,
    mid_to_small_months: midToSmallMonths,
    total_rank_improvement: totalImprovement,
    total_rank_decline: totalDecline,
    periods_improved: periodsImproved,
    periods_declined: periodsDeclined,
    periods_stable: periodsStable,
    stability_status,
    trend_label,
    ladder_score,
  };

  await supabase
    .from('company_ladder_summary')
    .upsert(summary, { onConflict: 'company_id' });
}

function deriveStabilityStatus(
  startCat: string,
  endCat: string,
  periodsImproved: number,
  periodsDeclined: number,
  path: string[]
): string {
  const CAP_ORDER: Record<string, number> = { 'Large Cap': 3, 'Mid Cap': 2, 'Small Cap': 1 };
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

function deriveTrendLabel(
  endCat: string,
  currentRank: number,
  periodsImproved: number,
  periodsDeclined: number,
  path: string[]
): string {
  if (endCat === 'Large Cap' && periodsDeclined === 0) return 'Stable Large Cap';
  if (endCat === 'Large Cap' && periodsDeclined > 0 && periodsImproved > periodsDeclined) return 'Strong Confirmed Climber';
  if (endCat === 'Large Cap' && periodsDeclined > periodsImproved) return 'Falling Large Cap';
  if (endCat === 'Large Cap' && currentRank >= 90 && currentRank <= 100) return 'Borderline Large Cap';

  if (endCat === 'Mid Cap' && periodsImproved > periodsDeclined) return path.length >= 3 ? 'Rapid Climber' : 'Slow Consistent Climber';
  if (endCat === 'Mid Cap' && periodsDeclined > periodsImproved) return 'Falling Mid Cap';
  if (endCat === 'Mid Cap') return 'Stable Mid Cap';

  if (endCat === 'Small Cap' && periodsDeclined > periodsImproved) return 'Confirmed Decliner';
  if (endCat === 'Small Cap') return 'Stable Small Cap';

  if (path.includes('Large Cap') && path[path.length - 1] !== 'Large Cap') return 'Upgrade Reversed';

  return 'Volatile / Unclear';
}

function computeLadderScore(
  snapshots: (NiftySnapshot & { period: { period_end_date: string } })[],
  movements: LadderMovement[]
): number {
  if (snapshots.length === 0) return 0;

  const CAP_ORDER: Record<string, number> = { 'Large Cap': 3, 'Mid Cap': 2, 'Small Cap': 1 };
  const lastCat = snapshots[snapshots.length - 1].category;
  const baseScore = (CAP_ORDER[lastCat!] ?? 1) * 30;

  let improvementScore = 0;
  for (const m of movements) {
    if (m.rank_change !== null && m.rank_change > 0) improvementScore += 1;
    else if (m.rank_change !== null && m.rank_change < 0) improvementScore -= 0.5;
  }

  const consistency = movements.length > 0
    ? movements.filter(m => m.rank_change !== null && m.rank_change >= 0).length / movements.length
    : 0;

  return Math.round(baseScore + improvementScore + consistency * 10);
}

function computeMonthsBetweenCategories(
  fromCat: string,
  toCat: string,
  snapshots: (NiftySnapshot & { period: { period_end_date: string } })[]
): number | null {
  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  for (const s of snapshots) {
    if (s.category === fromCat && !fromDate) {
      fromDate = new Date(s.period.period_end_date);
    }
    if (fromDate && s.category === toCat && !toDate) {
      toDate = new Date(s.period.period_end_date);
    }
  }

  if (!fromDate || !toDate) return null;
  const diffMs = toDate.getTime() - fromDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24 * 30));
}
