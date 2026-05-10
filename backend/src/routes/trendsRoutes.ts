import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

/**
 * GET /api/trends
 * Unified rank-progression view — no dependency on trend_label.
 * Fetches raw ranks from nifty_snapshots across the last N completed periods,
 * groups by company, computes net_rank_change = start_rank - latest_rank
 * (positive = improved, i.e. rank number went DOWN which means better position).
 *
 * Query params:
 *   periods    = number of past periods to include (default 6, max 12)
 *   category   = filter by current (latest-period) category: "Large Cap" | "Mid Cap" | "Small Cap"
 *   direction  = "improving" | "declining" | "all" (default: "all")
 *   min_change = minimum absolute net rank change to include (default 0)
 *   limit      = rows per page (default 100, max 500)
 *   offset     = pagination offset (default 0)
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q          = req.query as Record<string, string>;
    const nPeriods   = Math.min(Math.max(parseInt(q.periods   ?? '6',   10) || 6,   2), 12);
    const direction  = ['improving', 'declining'].includes(q.direction) ? q.direction : 'all';
    const minChange  = Math.max(0, parseInt(q.min_change ?? '0', 10) || 0);
    const category   = q.category || null;
    const limit      = Math.min(parseInt(q.limit  ?? '100', 10) || 100, 500);
    const offset     = parseInt(q.offset ?? '0', 10) || 0;

    // 1. Fetch last N completed periods, chronological order
    const { data: periodRows } = await supabase
      .from('nifty_periods')
      .select('id, period_label, period_end_date')
      .eq('import_status', 'completed')
      .order('period_end_date', { ascending: false })
      .limit(nPeriods);

    const orderedPeriods = (periodRows ?? []).slice().reverse(); // oldest → newest
    const periodIds      = orderedPeriods.map(p => p.id as string);

    if (periodIds.length === 0) {
      res.json({ data: [], periods: [], meta: { total: 0, improved: 0, declined: 0, stable: 0, limit, offset } });
      return;
    }

    // 2. Fetch ALL snapshots for those periods — parallel pages for speed
    const PAGE = 1000;

    // Count first so we can fire all pages at once
    const { count: totalSnaps, error: countErr } = await supabase
      .from('nifty_snapshots')
      .select('*', { count: 'exact', head: true })
      .in('period_id', periodIds);
    if (countErr) throw new Error(countErr.message);

    const pageCount = Math.ceil((totalSnaps ?? 0) / PAGE);
    const SELECT = `
      company_id,
      period_id,
      market_cap_rank,
      category,
      isin,
      company_name_raw,
      companies!company_id(company_name, nse_symbol)
    `;

    const pages = await Promise.all(
      Array.from({ length: pageCount }, (_, i) =>
        supabase
          .from('nifty_snapshots')
          .select(SELECT)
          .in('period_id', periodIds)
          .range(i * PAGE, (i + 1) * PAGE - 1)
      )
    );

    const snaps: Record<string, unknown>[] = [];
    for (const { data: pageData, error: pageErr } of pages) {
      if (pageErr) throw new Error(pageErr.message);
      if (pageData) for (const r of pageData) snaps.push(r as Record<string, unknown>);
    }

    // 3. Group snapshots by company
    type PeriodSlot = { rank: number | null; category: string | null };
    type CompanyEntry = {
      company_id:   string;
      company_name: string | null;
      isin:         string;
      nse_symbol:   string | null;
      ranks:        Record<string, PeriodSlot>;
    };

    const byCompany = new Map<string, CompanyEntry>();

    for (const snap of snaps ?? []) {
      const co  = (snap.companies as unknown) as Record<string, unknown> | null;
      const cid = snap.company_id as string;

      if (!byCompany.has(cid)) {
        byCompany.set(cid, {
          company_id:   cid,
          company_name: (co?.company_name ?? snap.company_name_raw) as string | null,
          isin:         snap.isin as string,
          nse_symbol:   co?.nse_symbol as string | null ?? null,
          ranks:        {},
        });
      }

      byCompany.get(cid)!.ranks[snap.period_id as string] = {
        rank:     snap.market_cap_rank as number | null,
        category: snap.category        as string | null,
      };
    }

    // 4. Derive per-company stats
    const firstId  = periodIds[0];
    const latestId = periodIds[periodIds.length - 1];

    const companies = Array.from(byCompany.values()).map(c => {
      const startRank  = c.ranks[firstId]?.rank  ?? null;
      const latestRank = c.ranks[latestId]?.rank ?? null;
      // positive = improved (rank number fell → better position)
      const netChange  = startRank !== null && latestRank !== null
        ? startRank - latestRank
        : null;

      let periodsImproved = 0;
      let periodsDeclined = 0;
      let periodsStable   = 0;

      for (let i = 1; i < periodIds.length; i++) {
        const prev = c.ranks[periodIds[i - 1]]?.rank ?? null;
        const curr = c.ranks[periodIds[i]]?.rank     ?? null;
        if (prev !== null && curr !== null) {
          if      (curr < prev) periodsImproved++;
          else if (curr > prev) periodsDeclined++;
          else                  periodsStable++;
        }
      }

      return {
        ...c,
        current_category: c.ranks[latestId]?.category ?? null,
        start_rank:        startRank,
        latest_rank:       latestRank,
        net_rank_change:   netChange,
        periods_improved:  periodsImproved,
        periods_declined:  periodsDeclined,
        periods_stable:    periodsStable,
      };
    });

    // 5. Only keep companies that appear in both first AND last period
    const withChange = companies.filter(c => c.net_rank_change !== null);

    // 6. Summary stats — computed BEFORE direction/min_change filter, AFTER category filter
    const forStats = category
      ? withChange.filter(c => c.current_category === category)
      : withChange;

    const statImproved = forStats.filter(c => (c.net_rank_change ?? 0) > 0).length;
    const statDeclined = forStats.filter(c => (c.net_rank_change ?? 0) < 0).length;
    const statStable   = forStats.filter(c => (c.net_rank_change ?? 0) === 0).length;

    // 7. Apply all filters
    let filtered = withChange;
    if (category)   filtered = filtered.filter(c => c.current_category === category);
    if (direction === 'improving') filtered = filtered.filter(c => (c.net_rank_change ?? 0) > 0);
    if (direction === 'declining') filtered = filtered.filter(c => (c.net_rank_change ?? 0) < 0);
    if (minChange > 0)             filtered = filtered.filter(c => Math.abs(c.net_rank_change ?? 0) >= minChange);

    // 8. Sort: biggest positive change first (risers at top), biggest negative last (fallers there)
    filtered.sort((a, b) => (b.net_rank_change ?? -999999) - (a.net_rank_change ?? -999999));

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    res.json({
      data:    paged,
      periods: orderedPeriods.map(p => ({
        id:    p.id,
        label: p.period_label,
        date:  p.period_end_date,
      })),
      meta: {
        total,
        improved: statImproved,
        declined: statDeclined,
        stable:   statStable,
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
